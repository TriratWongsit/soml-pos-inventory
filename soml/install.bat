@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "runtime\node\node.exe" set "PATH=%~dp0runtime\node;%PATH%"
where node >nul 2>nul || (echo [!] Node.js not found. & pause & exit /b 1)
if not exist "node_modules\" (
  echo [1/2] npm install ...
  call npm install --no-audit --no-fund || (echo [!] npm install failed. Check the internet connection. & pause & exit /b 1)
)
echo [2/2] setup ...
node setup.js
pause
