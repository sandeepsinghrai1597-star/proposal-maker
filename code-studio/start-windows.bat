@echo off
REM Double-click to start Code Studio on Windows.
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies, first time only...
  call npm install || goto :error
)
if not exist .env copy .env.example .env >nul
start "" /b cmd /c "timeout /t 6 >nul && start http://127.0.0.1:3000"
call npm start
goto :eof
:error
echo Install failed. Is Node.js 20+ installed? https://nodejs.org
pause
