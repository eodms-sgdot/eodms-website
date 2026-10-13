@echo off
setlocal

if not exist "%~dp0.env.local" (
	echo Missing site\.env.local. Copy site\.env.example and configure the local API targets first.
	exit /b 1
)

start "EODMS AAA proxy" cmd /k "cd /d ""%~dp0server"" && npm run start"
start "EODMS frontend - http://localhost:5173" cmd /k "cd /d ""%~dp0"" && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"