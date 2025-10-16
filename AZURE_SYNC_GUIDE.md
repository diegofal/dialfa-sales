# Azure SQL Server Sync Guide

## Overview

This guide explains how to synchronize data between your **Azure SQL Server** (legacy SPISA database) and your **PostgreSQL database** (modern SPISA on Railway).

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         AZURE                               │
│                                                             │
│  ┌────────────────────────────────────────────────┐        │
│  │   SQL Server (Legacy SPISA Database)           │        │
│  │   - Production data                            │        │
│  │   - Active transactions                        │        │
│  │   - ~268,817 records (and growing)             │        │
│  └────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Sync via
                              │ Spisa.DataMigration
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       RAILWAY                               │
│                                                             │
│  ┌────────────────────────────────────────────────┐        │
│  │   PostgreSQL 16 (Modern SPISA Database)        │        │
│  │   - Synced data from Azure                     │        │
│  │   - Powers new web app                         │        │
│  └────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Good News: Sync Tool Already Exists!

You **already have** a data synchronization tool: **`Spisa.DataMigration`**

**Location:** `backend/tools/Spisa.DataMigration/`

**What it does:**
- ✅ Reads from Azure SQL Server (legacy database)
- ✅ Transforms data to modern schema
- ✅ Writes to PostgreSQL
- ✅ Validates referential integrity
- ✅ Handles 268,817+ records
- ✅ Already proven to work (October 1, 2025 migration)

---

## Sync Strategies

You have **3 options** for keeping your databases in sync:

### Option 1: One-Time Migration (Cutover)

**Best for:** Transitioning completely from old system to new system

**Process:**
1. Run migration tool once
2. Switch all users to new system
3. Decommission old system
4. No ongoing sync needed

**Pros:**
- ✅ Simple - no ongoing maintenance
- ✅ Single source of truth
- ✅ No data conflicts

**Cons:**
- ❌ Requires immediate user adoption
- ❌ No fallback to old system
- ❌ All users must be trained first

---

### Option 2: Periodic Manual Sync

**Best for:** Transition period with parallel systems (RECOMMENDED)

**Process:**
1. Continue using old system as primary
2. Manually sync to new system daily/weekly
3. Test new system with real data
4. Eventually cutover to new system

**Pros:**
- ✅ Safe - old system still works
- ✅ Time to test and train users
- ✅ Data stays fresh for testing
- ✅ Low complexity

**Cons:**
- ❌ Manual process (requires running tool)
- ❌ Data in new system is read-only (or conflicts occur)
- ❌ Time lag between systems

---

### Option 3: Automated Scheduled Sync

**Best for:** Long-term parallel operation

**Process:**
1. Schedule migration tool to run automatically
2. Sync nightly (or hourly)
3. Both systems stay in sync
4. Gradually migrate users

**Pros:**
- ✅ Automatic - no manual intervention
- ✅ Near real-time sync
- ✅ Both systems always current

**Cons:**
- ❌ Complex setup (need server or service)
- ❌ Must handle conflicts if users modify both systems
- ❌ Ongoing maintenance

---

## Implementation Guides

### Option 1: One-Time Cutover

**Step 1: Prepare for migration**

```bash
# Test connection to Azure SQL Server
sqlcmd -S your-server.database.windows.net -d SPISA -U your-user -P your-password -Q "SELECT COUNT(*) FROM Clientes"

# Test connection to Railway PostgreSQL
psql "postgresql://postgres:password@host.railway.app:5432/railway" -c "SELECT COUNT(*) FROM clients"
```

**Step 2: Final data sync**

```bash
cd backend/tools/Spisa.DataMigration

# Update appsettings.json with production credentials
{
  "ConnectionStrings": {
    "SqlServer": "Server=your-azure-server.database.windows.net;Database=SPISA;User Id=your-user;Password=your-password;Encrypt=True;TrustServerCertificate=False;",
    "PostgreSQL": "Host=host.railway.app;Port=5432;Database=railway;Username=postgres;Password=your-railway-password;SSL Mode=Require;"
  },
  "Migration": {
    "BatchSize": 1000,
    "EnableValidation": true,
    "GenerateReport": true,
    "DryRun": false
  }
}

# Run migration
dotnet run
```

**Step 3: Validate**

```bash
# Check record counts match
psql $RAILWAY_DB_URL -c "
  SELECT 'clients' as table_name, COUNT(*) FROM clients
  UNION ALL SELECT 'articles', COUNT(*) FROM articles
  UNION ALL SELECT 'sales_orders', COUNT(*) FROM sales_orders
  UNION ALL SELECT 'invoices', COUNT(*) FROM invoices;
"
```

**Step 4: Cutover**

1. Stop old Windows application
2. Train users on new web app
3. Go live with new system
4. Decommission Azure SQL Server (after backup)

---

### Option 2: Manual Periodic Sync (RECOMMENDED)

**Setup:**

Create a reusable sync script.

**Windows (sync-from-azure.bat):**

```batch
@echo off
echo ========================================
echo SPISA Azure to Railway Sync
echo ========================================
echo.

cd /d "%~dp0backend\tools\Spisa.DataMigration"

echo [1/3] Checking connections...
dotnet run --validate-only
if %errorlevel% neq 0 (
    echo ERROR: Connection validation failed
    pause
    exit /b 1
)

echo.
echo [2/3] Running migration...
dotnet run

echo.
echo [3/3] Generating report...
echo Report saved to: ./migration-reports/

echo.
echo ========================================
echo Sync completed successfully!
echo ========================================
pause
```

**Linux/macOS (sync-from-azure.sh):**

```bash
#!/bin/bash

echo "========================================"
echo "SPISA Azure to Railway Sync"
echo "========================================"
echo

cd "$(dirname "$0")/backend/tools/Spisa.DataMigration"

echo "[1/3] Checking connections..."
dotnet run --validate-only
if [ $? -ne 0 ]; then
    echo "ERROR: Connection validation failed"
    exit 1
fi

echo
echo "[2/3] Running migration..."
dotnet run

echo
echo "[3/3] Generating report..."
echo "Report saved to: ./migration-reports/"

echo
echo "========================================"
echo "Sync completed successfully!"
echo "========================================"
```

**Usage:**

```bash
# Windows
sync-from-azure.bat

# Linux/macOS
./sync-from-azure.sh
```

**Sync Schedule (Recommended):**

- **Development/Testing:** Weekly (Monday mornings)
- **Staging:** Daily (nightly at 2 AM)
- **Production:** Before cutover only

---

### Option 3: Automated Scheduled Sync

You have several options for automation:

#### Option A: Windows Task Scheduler (if running from Windows server)

**Create scheduled task:**

1. Open **Task Scheduler**
2. Create New Task
3. **Trigger:** Daily at 2:00 AM
4. **Action:** Run `sync-from-azure.bat`
5. **Conditions:** Run only if network available

**PowerShell script (scheduled-sync.ps1):**

```powershell
# Scheduled Azure to Railway Sync
$logFile = "D:\logs\spisa-sync-$(Get-Date -Format 'yyyyMMdd').log"
$migrationPath = "D:\spisa-new\backend\tools\Spisa.DataMigration"

Start-Transcript -Path $logFile

Write-Host "Starting SPISA sync: $(Get-Date)"

Set-Location $migrationPath

try {
    # Run migration
    dotnet run
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Sync completed successfully" -ForegroundColor Green
        
        # Send success notification (optional)
        Send-MailMessage -To "admin@example.com" `
            -From "spisa-sync@example.com" `
            -Subject "SPISA Sync Success" `
            -Body "Daily sync completed successfully at $(Get-Date)"
    } else {
        Write-Host "Sync failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        
        # Send failure notification
        Send-MailMessage -To "admin@example.com" `
            -From "spisa-sync@example.com" `
            -Subject "SPISA Sync FAILED" `
            -Body "Sync failed at $(Get-Date). Check logs: $logFile"
    }
} catch {
    Write-Host "Exception occurred: $_" -ForegroundColor Red
}

Stop-Transcript
```

**Schedule it:**

```powershell
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-File D:\spisa-new\scheduled-sync.ps1"

$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable

Register-ScheduledTask -TaskName "SPISA-Azure-Sync" `
    -Action $action -Trigger $trigger -Settings $settings `
    -Description "Daily sync from Azure SQL to Railway PostgreSQL"
```

---

#### Option B: Linux Cron Job (if running from Linux server)

**Setup cron job:**

```bash
# Edit crontab
crontab -e

# Add daily sync at 2 AM
0 2 * * * /home/user/spisa-new/sync-from-azure.sh >> /var/log/spisa-sync.log 2>&1

# Or hourly sync
0 * * * * /home/user/spisa-new/sync-from-azure.sh >> /var/log/spisa-sync.log 2>&1
```

**With email notifications:**

```bash
# Install mail utils
sudo apt install mailutils

# Cron with email on error
MAILTO=admin@example.com
0 2 * * * /home/user/spisa-new/sync-from-azure.sh || echo "SPISA sync failed"
```

---

#### Option C: GitHub Actions (Recommended for Cloud)

**Best for:** No local server, runs in cloud

Create `.github/workflows/sync-from-azure.yml`:

```yaml
name: Sync from Azure SQL to Railway PostgreSQL

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3
      
      - name: Setup .NET 8
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: '8.0.x'
      
      - name: Restore dependencies
        working-directory: backend/tools/Spisa.DataMigration
        run: dotnet restore
      
      - name: Build migration tool
        working-directory: backend/tools/Spisa.DataMigration
        run: dotnet build --configuration Release
      
      - name: Run migration
        working-directory: backend/tools/Spisa.DataMigration
        env:
          ConnectionStrings__SqlServer: ${{ secrets.AZURE_SQL_CONNECTION }}
          ConnectionStrings__PostgreSQL: ${{ secrets.RAILWAY_DB_URL }}
        run: dotnet run --configuration Release
      
      - name: Upload migration report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: migration-report
          path: backend/tools/Spisa.DataMigration/migration-reports/
      
      - name: Notify on failure
        if: failure()
        run: |
          echo "Sync failed!"
          # Add Slack/Discord/Email notification here
```

**Setup Secrets in GitHub:**

1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Add secrets:
   - `AZURE_SQL_CONNECTION`: Your Azure SQL Server connection string
   - `RAILWAY_DB_URL`: Your Railway PostgreSQL connection string

**Trigger manually:**

1. Go to **Actions** tab
2. Select "Sync from Azure SQL to Railway PostgreSQL"
3. Click **"Run workflow"**

**Pros:**
- ✅ Runs in cloud (no local server needed)
- ✅ Free (GitHub Actions included)
- ✅ Automatic scheduling
- ✅ Email notifications built-in
- ✅ Audit trail in Actions history

---

#### Option D: Railway Cron Job (Native)

**Railway supports cron jobs natively.**

**Create a new service:**

1. In Railway project, click **"+ New"**
2. Select **"Empty Service"**
3. Name it: `spisa-sync-job`

**Configure as Cron Job:**

Railway doesn't have native cron support yet, but you can:

1. Deploy a simple Node.js script that runs the migration
2. Use a service like **Cron-job.org** to trigger a webhook
3. Webhook runs the migration tool

**webhook-trigger.js:**

```javascript
const express = require('express');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;

app.post('/sync', (req, res) => {
  console.log('Sync triggered at', new Date());
  
  exec('dotnet run --project ../backend/tools/Spisa.DataMigration', (error, stdout, stderr) => {
    if (error) {
      console.error('Sync failed:', error);
      res.status(500).json({ success: false, error: error.message });
      return;
    }
    
    console.log('Sync completed:', stdout);
    res.json({ success: true, output: stdout });
  });
});

app.listen(PORT, () => {
  console.log(`Sync webhook listening on port ${PORT}`);
});
```

**Set up external cron:**

1. Go to https://cron-job.org
2. Create account (free)
3. Create job: POST to `https://your-railway-webhook.up.railway.app/sync`
4. Schedule: Daily at 2 AM

---

## Azure SQL Server Configuration

### Enable Remote Access

Your Azure SQL Server needs to allow connections from:

1. **Your local machine** (for manual syncs)
2. **Railway servers** (for automated syncs)
3. **GitHub Actions runners** (if using GitHub Actions)

**Configure Firewall:**

1. Go to **Azure Portal** → SQL Server
2. **Settings** → **Networking** → **Firewall rules**
3. Add rules:
   - **Your IP:** Add current IP for local testing
   - **Allow Azure Services:** Enable (for Railway if using Azure-hosted)
   - **GitHub Actions:** Add `0.0.0.0/0` (or use GitHub IP ranges)

⚠️ **Security Note:** Opening `0.0.0.0/0` is risky. Better options:

- Use **Azure Private Link** (requires Pro Railway plan)
- Whitelist specific IP ranges
- Use VPN or Azure Bastion

### Connection String Format

**Azure SQL Server connection string:**

```
Server=your-server.database.windows.net;
Database=SPISA;
User Id=your-username;
Password=your-password;
Encrypt=True;
TrustServerCertificate=False;
Connection Timeout=30;
```

**Get it from Azure Portal:**

1. SQL Database → **Connection strings**
2. Copy **ADO.NET** connection string
3. Replace `{your_password}` with actual password

---

## Handling Conflicts

**Problem:** What if users modify data in BOTH systems?

### Strategy 1: Read-Only New System (Recommended)

- Old system = **Write** (production)
- New system = **Read-Only** (testing)
- Sync flows **one direction only** (old → new)
- No conflicts possible

**Implementation:**
- During parallel operation, users only view data in new system
- All modifications happen in old system
- Sync brings changes to new system

### Strategy 2: Last Write Wins

- Track `UpdatedAt` timestamp on all records
- During sync, only overwrite if source is newer
- Potential data loss if not careful

### Strategy 3: Manual Resolution

- Detect conflicts (compare timestamps)
- Flag conflicted records
- Admin manually resolves

**Not recommended** - too complex for 2 users.

---

## Sync Performance

### Current Performance (from October 1 migration):

- **268,817 records** migrated in **~3 minutes**
- **~1,500 records/second**

### For periodic syncs:

**Full Sync:** ~3 minutes (all 268,817 records)

**Incremental Sync (Future Enhancement):**

Modify migration tool to only sync changed records:

```csharp
// Pseudo-code
var lastSyncTime = GetLastSyncTime();
var changedRecords = sqlServer.GetRecordsModifiedAfter(lastSyncTime);
postgres.UpsertRecords(changedRecords);
SetLastSyncTime(DateTime.Now);
```

This would reduce sync time from **3 minutes → 10 seconds** for typical daily changes.

---

## Monitoring Sync Health

### Option 1: Check Logs

```bash
# View latest migration report
cat backend/tools/Spisa.DataMigration/migration-reports/migration-report-*.txt | tail -100
```

### Option 2: Database Queries

**Record count comparison:**

```sql
-- Azure SQL Server
SELECT 
  'Azure' as source,
  (SELECT COUNT(*) FROM Clientes) as clients,
  (SELECT COUNT(*) FROM Articulos) as articles,
  (SELECT COUNT(*) FROM NotaPedidos) as sales_orders

-- Railway PostgreSQL
SELECT 
  'Railway' as source,
  (SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL) as clients,
  (SELECT COUNT(*) FROM articles WHERE deleted_at IS NULL) as articles,
  (SELECT COUNT(*) FROM sales_orders WHERE deleted_at IS NULL) as sales_orders
```

### Option 3: Monitoring Dashboard

Create a simple health check endpoint:

**backend/src/Spisa.WebApi/Controllers/SyncHealthController.cs:**

```csharp
[ApiController]
[Route("api/sync-health")]
public class SyncHealthController : ControllerBase
{
    private readonly SpisaDbContext _context;

    public SyncHealthController(SpisaDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetSyncHealth()
    {
        var lastClientUpdate = await _context.Clients
            .MaxAsync(c => c.UpdatedAt);

        var lastArticleUpdate = await _context.Articles
            .MaxAsync(a => a.UpdatedAt);

        var clientCount = await _context.Clients.CountAsync();
        var articleCount = await _context.Articles.CountAsync();

        return Ok(new
        {
            LastClientUpdate = lastClientUpdate,
            LastArticleUpdate = lastArticleUpdate,
            ClientCount = clientCount,
            ArticleCount = articleCount,
            IsHealthy = (DateTime.UtcNow - lastClientUpdate).TotalHours < 48 // Alert if no updates in 48h
        });
    }
}
```

**Check it:**

```bash
curl https://spisa-backend.railway.app/api/sync-health
```

---

## Recommended Approach

**For SPISA with 2 users, I recommend:**

### Phase 1: Testing Period (2-4 weeks)

- ✅ Use **Option 2: Manual Periodic Sync**
- Run sync **weekly** (Monday mornings)
- Users continue using old system
- Test new system with real data
- Train users gradually

### Phase 2: Transition Period (2 weeks)

- Run sync **daily** (automated with GitHub Actions)
- Users can view data in new system
- Continue modifications in old system
- Build confidence in new system

### Phase 3: Cutover (1 day)

- Final sync from Azure to Railway
- Switch users to new system completely
- Decommission old system
- No more syncing needed

---

## Cost Comparison

| Sync Strategy | Setup Time | Ongoing Cost | Maintenance |
|---------------|-----------|-------------|-------------|
| One-Time Cutover | 1 hour | $0 | None |
| Manual Sync | 2 hours | $0 | 5 min/week |
| Windows Task Scheduler | 3 hours | $0 (if you have Windows server) | Low |
| GitHub Actions | 2 hours | $0 (free tier) | None |
| Railway Cron | 4 hours | $5/month | Low |

---

## Security Considerations

1. **Never commit connection strings to Git**
   - Use environment variables
   - Use GitHub Secrets for CI/CD
   - Use Railway environment variables

2. **Use strong passwords**
   - Azure SQL: 16+ character password
   - Railway: Auto-generated strong password

3. **Encrypt connections**
   - Azure SQL: `Encrypt=True`
   - Railway: `SSL Mode=Require`

4. **Limit firewall access**
   - Whitelist only necessary IPs
   - Use VPN if possible

5. **Rotate credentials regularly**
   - Change passwords quarterly
   - Update secrets in all systems

---

## Troubleshooting

### Sync fails with "Login failed for user"

**Solution:** Check Azure SQL firewall rules, verify credentials

### Sync times out

**Solution:** Increase batch size in `appsettings.json`, increase connection timeout

### Data integrity errors

**Solution:** Run validation queries, check for orphaned records

### Migration tool crashes

**Solution:** Check logs in `migration-logs/`, reduce batch size

---

## Next Steps

1. ✅ Choose your sync strategy (I recommend Option 2: Manual Periodic Sync)
2. ✅ Test sync from Azure to local PostgreSQL first
3. ✅ Deploy to Railway (see RAILWAY_DEPLOYMENT.md)
4. ✅ Configure sync from Azure to Railway
5. ✅ Test with real data
6. ✅ Train users
7. ✅ Plan cutover date

---

## Additional Resources

- **Azure SQL Documentation:** https://learn.microsoft.com/en-us/azure/azure-sql/
- **PostgreSQL Migration:** https://www.postgresql.org/docs/current/migration.html
- **Railway Docs:** https://docs.railway.app

---

*Last Updated: October 16, 2025*

