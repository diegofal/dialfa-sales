# Import bacpac to local SQL Server
# You can also do this manually in SSMS: Tasks > Import Data-tier Application

Write-Host "To import the bacpac file to local SQL Server:"
Write-Host ""
Write-Host "Option 1: Using SSMS (SQL Server Management Studio)"
Write-Host "  1. Open SSMS and connect to (local)"
Write-Host "  2. Right-click on Databases"
Write-Host "  3. Select 'Import Data-tier Application...'"
Write-Host "  4. Browse to: d:\dialfa new\spisa-new\backend\tools\Spisa.DataMigration\db.bacpac"
Write-Host "  5. Name it: SPISA_Local"
Write-Host ""
Write-Host "Option 2: If you have SqlPackage.exe installed (usually in Program Files)"
Write-Host "  Run: SqlPackage.exe /Action:Import /SourceFile:'d:\dialfa new\spisa-new\backend\tools\Spisa.DataMigration\db.bacpac' /TargetServerName:'(local)' /TargetDatabaseName:'SPISA_Local' /TargetUser:'sa' /TargetPassword:'Transc0reTransc0re!'"
Write-Host ""
Write-Host "Or I can update the connection string to use Azure but it will be slower..."


