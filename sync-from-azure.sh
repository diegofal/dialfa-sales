#!/bin/bash

# ========================================
# SPISA Azure to Railway Sync Script
# ========================================

echo ""
echo "========================================"
echo "  SPISA Data Migration Tool"
echo "  Azure SQL Server to Railway PostgreSQL"
echo "========================================"
echo ""

cd "$(dirname "$0")/backend/tools/Spisa.DataMigration"

echo "[1/4] Checking migration tool..."
if [ ! -f "Spisa.DataMigration.csproj" ]; then
    echo "ERROR: Migration tool not found!"
    echo "Please ensure you are in the correct directory."
    exit 1
fi

echo "[2/4] Validating connections..."
echo ""
dotnet run -- --validate-only
if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Connection validation failed!"
    echo "Please check your connection strings in appsettings.json"
    exit 1
fi

echo ""
echo "[3/4] Starting data migration..."
echo "This may take several minutes depending on data size."
echo ""
dotnet run

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Migration failed!"
    echo "Check logs in migration-logs/ for details."
    exit 1
fi

echo ""
echo "[4/4] Generating report..."
echo ""

# Find and display the latest migration report
LATEST_REPORT=$(ls -t migration-reports/migration-report-*.txt 2>/dev/null | head -1)

if [ -n "$LATEST_REPORT" ]; then
    echo "Report saved: $LATEST_REPORT"
    echo ""
    grep -E "Status:|Duration:|Migrated:" "$LATEST_REPORT" || true
else
    echo "No report generated."
fi

echo ""
echo "========================================"
echo "  Sync completed successfully!"
echo "========================================"
echo ""

