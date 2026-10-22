@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Amporn OMS
if exist "runtime\node\node.exe" set "PATH=%~dp0runtime\node;%PATH%"
node start.js
pause
