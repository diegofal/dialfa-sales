@echo off
echo ============================================
echo    SPISA - Starting Frontend App
echo ============================================
echo.

cd frontend
echo Frontend directory: %CD%
echo.
echo Starting Next.js dev server...
echo URL: http://localhost:3000
echo.
echo Login credentials:
echo   Username: admin
echo   Password: admin123
echo.
echo Press Ctrl+C to stop
echo.

npm run dev
