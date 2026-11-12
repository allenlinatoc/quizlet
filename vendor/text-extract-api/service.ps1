param([Parameter(Mandatory=$true)][ValidateSet('start','stop')][string]$Action)
$ErrorActionPreference = 'Stop'
$revision = 'a78eebfbcbfdaa96951ddb3aaed571e7b77ad511'
$upstream = Join-Path $PSScriptRoot 'upstream'
$compose = Join-Path $PSScriptRoot 'compose.yaml'

function Invoke-Docker {
    & docker @args
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE." }
}

try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker was not found. Install and start Docker Desktop with WSL 2.' }
    Invoke-Docker info --format '{{.ServerVersion}}' | Out-Null
    Invoke-Docker compose version | Out-Null
    if ($Action -eq 'stop') {
        Invoke-Docker compose -p quizlet-text-extract -f $compose stop
        exit 0
    }
    if (-not (Test-Path -LiteralPath $upstream)) {
        if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is required to download the pinned OCR service source.' }
        & git clone --no-checkout https://github.com/CatchTheTornado/text-extract-api.git $upstream
        if ($LASTEXITCODE -ne 0) { throw 'Could not clone text-extract-api.' }
        & git -C $upstream checkout --detach $revision
        if ($LASTEXITCODE -ne 0) { throw 'Could not check out the pinned text-extract-api revision.' }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $upstream '.git'))) { throw 'The upstream folder is not a Git checkout. Restore or remove it before retrying.' }
    $actual = (& git -C $upstream rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $actual -ne $revision) { throw "The upstream checkout is not at the expected revision $revision." }
    $changes = & git -C $upstream status --porcelain
    if ($LASTEXITCODE -ne 0 -or $changes) { throw 'The upstream checkout has local changes. Preserve them and restore a clean pinned checkout before starting.' }
    Write-Host 'Building and starting the OCR service. The first build can take a while.'
    Invoke-Docker compose -p quizlet-text-extract -f $compose up -d --build
    Write-Host 'Downloading or checking the llama3.1 model. This can take a while.'
    Invoke-Docker compose -p quizlet-text-extract -f $compose exec -T ollama ollama pull llama3.1
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try { Invoke-WebRequest -Uri 'http://127.0.0.1:8000/openapi.json' -UseBasicParsing -TimeoutSec 3 | Out-Null; $ready = $true; break } catch { Start-Sleep -Seconds 2 }
    }
    if (-not $ready) { throw 'The API did not become ready. Check logs with docker compose -p quizlet-text-extract -f vendor/text-extract-api/compose.yaml logs.' }
} catch {
    Write-Error $_
    exit 1
}
