@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0service.ps1" start
if errorlevel 1 (
  echo OCR service could not be started. See the error above.
  pause
  exit /b 1
)
echo OCR service is ready at http://127.0.0.1:8000
pause
