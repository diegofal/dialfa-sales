# SPISA Data Migration Tool

Migrates data from Azure SQL Server to PostgreSQL databases.

## Configuration Files

### **appsettings.json** (Default - Local)
- **Target:** Local PostgreSQL (`localhost:5432`)
- **Use for:** Testing migrations locally

### **appsettings.Development.json** (Railway Development)
- **Target:** Railway PostgreSQL (`shinkansen.proxy.rlwy.net:36395`)
- **Use for:** Syncing to Railway development database

### **appsettings.Production.json** (Railway Production)
- **Target:** Railway production database (when you have one)
- **Use for:** Production migrations

---

## Before Running Migration

### 1. Update Azure SQL Connection String

Edit the appropriate `appsettings.*.json` file and replace:
```
"SqlServer": "YOUR-AZURE-SQL-CONNECTION-STRING-HERE"
```

With your actual Azure connection string:
```
"SqlServer": "Server=your-server.database.windows.net;Database=SPISA;User Id=your-user;Password=your-password;Encrypt=True;"
```

---

## Running Migrations

### **Migrate to Local PostgreSQL**

From repository root:
```bash
migrate-to-local.bat
```

Or manually:
```bash
cd backend/tools/Spisa.DataMigration
dotnet run
```

### **Migrate to Railway (Development)**

From repository root:
```bash
migrate-to-railway.bat
```

Or manually:
```bash
cd backend/tools/Spisa.DataMigration
dotnet run --environment Development
```

### **Migrate to Railway (Production)**

```bash
cd backend/tools/Spisa.DataMigration
dotnet run --environment Production
```

---

## What Gets Migrated

✅ **397** Clients  
✅ **1,797** Articles  
✅ **12** Categories  
✅ **39,065** Sales Orders  
✅ **165,656** Sales Order Items  
✅ **32,575** Invoices  
✅ **27,636** Delivery Notes  
✅ **Lookup Tables** (Payment terms, VAT rates, etc.)

**Total:** ~268,000+ records

---

## Migration Reports

After each migration, reports are saved to:
- `migration-reports/migration-report-YYYYMMDD-HHMMSS.txt`
- `migration-logs/migration-YYYYMMDD.log`

---

## Troubleshooting

### Error: "Cannot connect to Azure SQL Server"
- Check firewall rules in Azure Portal
- Add your IP to allowed list
- Verify connection string is correct

### Error: "Cannot connect to PostgreSQL"
- **Local:** Ensure Docker containers are running (`docker-compose up -d`)
- **Railway:** Verify connection string in appsettings file
- Check SSL/TLS requirements

### Error: "Table already exists"
- PostgreSQL tables already exist
- Option 1: Drop existing tables first
- Option 2: Set `DryRun: true` in config to test without writing

---

## Configuration Options

In `appsettings.json` → `Migration` section:

| Option | Description | Default |
|--------|-------------|---------|
| `BatchSize` | Records per batch | 1000 |
| `EnableValidation` | Validate after migration | true |
| `GenerateReport` | Create report file | true |
| `ContinueOnError` | Keep going if errors | true |
| `DryRun` | Test without writing | false |

---

## Quick Reference

```bash
# Test locally first
migrate-to-local.bat

# Deploy to Railway development
migrate-to-railway.bat

# Check the report
type backend\tools\Spisa.DataMigration\migration-reports\migration-report-*.txt
```

---

**Estimated time:** 3-5 minutes for full migration (~268K records)
