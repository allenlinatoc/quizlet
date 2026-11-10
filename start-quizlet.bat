@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 24 is required. Install it and try again.
  pause
  exit /b 1
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Install Node.js 24 and try again.
  pause
  exit /b 1
)

echo Installing dependencies...
call npm.cmd install
if errorlevel 1 goto :failed

echo Building Quizlet...
call npm.cmd run build
if errorlevel 1 goto :failed

if not defined PORT set "PORT=3001"
echo Starting Quizlet at http://127.0.0.1:%PORT%
echo Press Ctrl+C to stop the server.
start "" /b cmd /c "timeout /t 3 /nobreak >nul ^& start "" "http://127.0.0.1:%PORT%""
call npm.cmd start
if errorlevel 1 goto :failed
exit /b 0

:failed
echo Quizlet could not be started. See the error above.
pause
exit /b 1
