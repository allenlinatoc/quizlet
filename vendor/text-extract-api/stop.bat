@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0service.ps1" stop
if errorlevel 1 (
  echo OCR service could not be stopped. See the error above.
  pause
  exit /b 1
)
echo OCR service stopped. Model data was retained.
pause
