@echo off
echo ============================================
echo    SPISA - Starting All Services
echo ============================================
echo.
echo Starting Backend API in new window...
start "SPISA Backend API" cmd /k "cd /d %~dp0 && start-backend.bat"
timeout /t 2 /nobreak >nul

echo Starting Frontend App in new window...
start "SPISA Frontend App" cmd /k "cd /d %~dp0 && start-frontend.bat"
timeout /t 2 /nobreak >nul

echo.
echo ============================================
echo    Services Started Successfully
echo ============================================
echo.
echo Backend API: http://localhost:5021
echo Frontend App: http://localhost:3000
echo.
echo Login credentials:
echo   Username: admin
echo   Password: admin123
echo.
echo Two windows have been opened:
echo   1. Backend API (port 5021)
echo   2. Frontend App (port 3000)
echo.
echo Press any key to close this window...
pause >nul



