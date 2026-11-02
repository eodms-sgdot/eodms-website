@echo off
setlocal

if not exist "%~dp0.env.local" (
	echo Missing site\.env.local. Copy site\.env.example and configure the local API targets first.
	exit /b 1
)

cd /d "%~dp0"
call npm run dev:all
exit /b %errorlevel%