@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || (echo Node.js is required. & pause & exit /b 1)
echo ==============================================
echo TrustBridge Windows Verification
 echo IMPORTANT: API scenario will RESET demo data.
echo Keep start_windows.bat running in another window.
echo ==============================================
set /p CONFIRM="Type TEST to reset demo data and run API scenario: "
if /i not "%CONFIRM%"=="TEST" (echo Cancelled. & exit /b 0)
call npm run test:contract || (pause & exit /b 1)
call npm run test:source || (pause & exit /b 1)
call npm run test:api || (pause & exit /b 1)
echo.
echo [PASS] API scenario finished; demo seed was restored.
pause
