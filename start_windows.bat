@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title TrustBridge 1.1 - Windows Demo
where node >nul 2>&1 || (echo [ERROR] Install Node.js 20+ first. & pause & exit /b 1)
where npm >nul 2>&1 || (echo [ERROR] npm is missing. Reinstall Node.js. & pause & exit /b 1)
where docker >nul 2>&1 || (echo [ERROR] Install and start Docker Desktop first. & pause & exit /b 1)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\check-ports.ps1"
if errorlevel 1 (pause & exit /b 1)
if not exist "server\.env" (
  copy "server\.env.example" "server\.env" >nul
  echo [INFO] Created server\.env from template; DEMO ONLY.
)
echo [1/6] Checking Docker Desktop and PostgreSQL...
docker info >nul 2>&1 || (echo [ERROR] Docker Engine is not running. Start Docker Desktop. & pause & exit /b 1)
docker compose up -d --wait || (echo [ERROR] PostgreSQL failed to start. & pause & exit /b 1)
echo [2/6] Installing workspace dependencies (first run needs Internet)...
call npm install || (echo [ERROR] npm install failed. Check network. & pause & exit /b 1)
echo [3/6] Generating Prisma Client...
call npm run db:generate || (pause & exit /b 1)
echo [4/6] Synchronizing PostgreSQL schema...
call npm run db:push || (pause & exit /b 1)
echo [5/6] Seeding DEMO accounts (keeps existing changes if already seeded)...
call npm run db:seed || (pause & exit /b 1)
echo [6/6] Checking TypeScript, front-end bundle and unit tests...
call npm run build || (pause & exit /b 1)
call npm run test || (pause & exit /b 1)
echo.
echo ===============================================
echo WEB: http://localhost:5173
echo API: http://localhost:8000/api/v1/health
echo SWAGGER: http://localhost:8000/docs
echo ===============================================
echo Starting local services; leave this window open.
echo Open another terminal and run verify_windows.bat to test API flows.
call npm run dev
if errorlevel 1 (echo [ERROR] Services stopped with a non-zero exit code.)
pause
