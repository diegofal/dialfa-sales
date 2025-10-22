@echo off
REM ========================================
REM SPISA Migration to Railway PostgreSQL
REM ========================================

echo.
echo ========================================
echo   SPISA Data Migration Tool
echo   Azure SQL Server to Railway PostgreSQL
echo ========================================
echo.

cd /d "%~dp0backend\tools\Spisa.DataMigration"

echo [1/3] Checking migration tool...
if not exist "Spisa.DataMigration.csproj" (
    echo ERROR: Migration tool not found!
    pause
    exit /b 1
)

echo [2/3] Starting data migration...
echo This will migrate data from Azure SQL Server to Railway PostgreSQL.
echo Using Development environment configuration.
echo.
set DOTNET_ENVIRONMENT=Development
dotnet run -- --yes

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Migration failed!
    echo Check logs in migration-logs/ for details.
    pause
    exit /b 1
)

echo.
echo [3/3] Migration completed!
echo.

REM Find and display the latest migration report
for /f "delims=" %%i in ('dir /b /od migration-reports\migration-report-*.txt 2^>nul') do set LATEST_REPORT=%%i

if defined LATEST_REPORT (
    echo Report saved: migration-reports\%LATEST_REPORT%
    echo.
    type "migration-reports\%LATEST_REPORT%"
) else (
    echo No report generated.
)

echo.
echo ========================================
echo   Data synced to Railway successfully!
echo ========================================
echo.
pause

