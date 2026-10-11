@echo off
setlocal

start "EODMS AAA proxy" cmd /k "cd /d ""%~dp0server"" && npm run start"
start "EODMS frontend" cmd /k "cd /d ""%~dp0"" && npm run dev"