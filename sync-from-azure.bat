@echo off
REM ========================================
REM SPISA Azure to Railway Sync Script
REM ========================================

echo.
echo ========================================
echo   SPISA Data Migration Tool
echo   Azure SQL Server to Railway PostgreSQL
echo ========================================
echo.

cd /d "%~dp0backend\tools\Spisa.DataMigration"

echo [1/4] Checking migration tool...
if not exist "Spisa.DataMigration.csproj" (
    echo ERROR: Migration tool not found!
    echo Please ensure you are in the correct directory.
    pause
    exit /b 1
)

echo [2/4] Validating connections...
echo.
dotnet run -- --validate-only
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Connection validation failed!
    echo Please check your connection strings in appsettings.json
    pause
    exit /b 1
)

echo.
echo [3/4] Starting data migration...
echo This may take several minutes depending on data size.
echo.
dotnet run

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Migration failed!
    echo Check logs in migration-logs/ for details.
    pause
    exit /b 1
)

echo.
echo [4/4] Generating report...
echo.

REM Find and display the latest migration report
for /f "delims=" %%i in ('dir /b /od migration-reports\migration-report-*.txt 2^>nul') do set LATEST_REPORT=%%i

if defined LATEST_REPORT (
    echo Report saved: migration-reports\%LATEST_REPORT%
    echo.
    type "migration-reports\%LATEST_REPORT%" | findstr /C:"Status:" /C:"Duration:" /C:"Migrated:"
) else (
    echo No report generated.
)

echo.
echo ========================================
echo   Sync completed successfully!
echo ========================================
echo.
pause

