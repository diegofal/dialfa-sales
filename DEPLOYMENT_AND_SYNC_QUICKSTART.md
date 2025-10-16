# SPISA Deployment & Sync - Quick Reference

## Quick Decision Guide

### Question 1: Where to deploy?

**You asked about Railway** → ✅ Good choice! Railway is perfect for your use case.

**Why Railway?**
- ✅ Easy setup (15 minutes)
- ✅ Affordable ($10-15/month)
- ✅ Auto-deploy from GitHub
- ✅ Managed PostgreSQL included
- ✅ SSL certificates automatic
- ✅ Good for 2-user application

**📖 Full Guide:** See `RAILWAY_DEPLOYMENT.md`

---

### Question 2: How to sync with Azure database?

**Good news:** You already have a sync tool! → `Spisa.DataMigration`

**Three options:**

#### Option A: One-Time Migration (Recommended if ready to switch)
- Run migration tool once
- Move users to new system
- Decommission Azure SQL Server
- **No ongoing sync needed**

#### Option B: Manual Periodic Sync (Recommended for testing)
- Keep Azure SQL as primary
- Manually sync weekly/daily
- Test new system with real data
- Eventually cutover

#### Option C: Automated Sync
- Schedule automatic syncs (GitHub Actions or Task Scheduler)
- Both systems stay current
- Good for long-term parallel operation

**📖 Full Guide:** See `AZURE_SYNC_GUIDE.md`

---

## Recommended Path (For SPISA with 2 users)

```
Week 1: Deploy to Railway
  ├─ Deploy PostgreSQL database
  ├─ Deploy .NET backend
  ├─ Deploy Next.js frontend
  └─ Run initial data migration from Azure
  
Week 2-4: Testing Phase
  ├─ Users continue using old system
  ├─ Manual sync weekly (Monday mornings)
  ├─ Test all features in new system
  └─ Train users gradually
  
Week 5: Cutover Weekend
  ├─ Friday evening: Final sync from Azure
  ├─ Weekend: Users test new system
  └─ Monday: Go live with new system
  
Week 6+: Production
  ├─ All users on new system
  ├─ Monitor for issues
  └─ Decommission old system after 30 days
```

---

## Quick Start Commands

### 1. Deploy to Railway (15 minutes)

```bash
# Push code to GitHub
git add .
git commit -m "Initial commit"
git push origin main

# Create Railway project (via web UI)
# 1. Go to railway.app
# 2. New Project → Deploy from GitHub
# 3. Add PostgreSQL service
# 4. Add Backend service (root: backend/src/Spisa.WebApi)
# 5. Add Frontend service (root: frontend)
```

**📖 Detailed Steps:** `RAILWAY_DEPLOYMENT.md`

---

### 2. Sync from Azure (Manual)

**One-time or periodic sync:**

```bash
cd backend/tools/Spisa.DataMigration

# Update appsettings.json with:
# - SqlServer: Your Azure SQL connection string
# - PostgreSQL: Your Railway PostgreSQL connection string

dotnet run
```

**Result:** All data synced in ~3 minutes

**📖 Automation Options:** `AZURE_SYNC_GUIDE.md`

---

## Connection Strings You'll Need

### Azure SQL Server (Source)

Get from Azure Portal:

```
Server=your-server.database.windows.net;
Database=SPISA;
User Id=your-username;
Password=your-password;
Encrypt=True;
TrustServerCertificate=False;
```

### Railway PostgreSQL (Target)

Get from Railway Dashboard → PostgreSQL service → Variables:

```
Host=host.railway.app;
Port=5432;
Database=railway;
Username=postgres;
Password=generated-password;
SSL Mode=Require;
```

---

## Cost Summary

### Railway Hosting

| Service | Cost/Month |
|---------|-----------|
| PostgreSQL | $2-3 |
| Backend (.NET) | $5-7 |
| Frontend (Next.js) | $3-5 |
| **Total** | **$10-15** |

### Azure SQL Server

- Current cost: ??? (you're already paying)
- After cutover: Can decommission (save money!)

### Total

- **During transition:** Railway ($10-15) + Azure (existing cost)
- **After cutover:** Railway only ($10-15)

---

## Architecture Overview

### Current (Legacy)

```
┌─────────────────────────┐
│     Azure SQL Server    │
│    (Legacy Database)    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Windows Application   │
│   (.NET Framework 3.5)  │
│   (2 users)             │
└─────────────────────────┘
```

### Future (After Migration)

```
┌──────────────────────────────────────────┐
│              RAILWAY.APP                 │
│                                          │
│  ┌────────────────────────────────┐     │
│  │   Frontend (Next.js)           │     │
│  │   https://spisa.railway.app    │     │
│  └────────────┬───────────────────┘     │
│               │                          │
│  ┌────────────▼───────────────────┐     │
│  │   Backend (.NET 8 API)         │     │
│  │   JWT Auth, REST endpoints     │     │
│  └────────────┬───────────────────┘     │
│               │                          │
│  ┌────────────▼───────────────────┐     │
│  │   PostgreSQL 16                │     │
│  │   Modern schema, 268k+ records │     │
│  └────────────────────────────────┘     │
└──────────────────────────────────────────┘
```

---

## Security Checklist

Before going to production:

- [ ] Change JWT secret to strong 32+ character string
- [ ] Use strong database passwords
- [ ] Enable SSL/HTTPS (automatic on Railway)
- [ ] Configure Azure SQL firewall rules
- [ ] Test backup and restore procedures
- [ ] Set up monitoring/alerts
- [ ] Document admin credentials securely
- [ ] Enable 2FA on Railway account
- [ ] Enable 2FA on GitHub account

---

## Support & Documentation

### Documentation Files

| File | Purpose |
|------|---------|
| `RAILWAY_DEPLOYMENT.md` | Complete Railway deployment guide |
| `AZURE_SYNC_GUIDE.md` | Azure SQL Server sync strategies |
| `MIGRATION_PLAN.md` | Overall migration strategy |
| `MIGRATION_STATUS.md` | Current progress (Oct 7, 2025) |
| `START_GUIDE.md` | Local development setup |
| `README.md` | Project overview |

### Get Help

- **Railway Issues:** https://railway.app/help
- **Azure Support:** Azure Portal → Help + Support
- **SPISA Issues:** Your GitHub repository issues

---

## Next Actions

### Immediate (Today)

1. [ ] Read `RAILWAY_DEPLOYMENT.md` (10 minutes)
2. [ ] Create Railway account
3. [ ] Push code to GitHub

### This Week

1. [ ] Deploy to Railway (following guide)
2. [ ] Run initial data migration
3. [ ] Test login and basic features
4. [ ] Share staging URL with stakeholders

### Next Week

1. [ ] Set up weekly sync from Azure
2. [ ] User acceptance testing
3. [ ] Train users on new system
4. [ ] Plan cutover date

---

## Key Files for Deployment

```
spisa-new/
├── RAILWAY_DEPLOYMENT.md          ← Railway deployment guide
├── AZURE_SYNC_GUIDE.md           ← Azure sync strategies
├── database/
│   ├── schema.sql                ← PostgreSQL schema
│   └── seed.sql                  ← Initial data
├── backend/
│   ├── src/Spisa.WebApi/
│   │   ├── appsettings.json      ← Backend config
│   │   └── Dockerfile            ← (create for Railway)
│   └── tools/Spisa.DataMigration/
│       └── appsettings.json      ← Sync tool config
├── frontend/
│   ├── .env.local                ← Frontend config
│   └── Dockerfile                ← (create for Railway)
└── docker-compose.yml            ← Local development
```

---

## FAQ

**Q: Can I deploy without GitHub?**  
A: No, Railway requires GitHub/GitLab. But it's easy to set up.

**Q: Will the old system stop working?**  
A: No, not until you decide to decommission it. Both can run in parallel.

**Q: How often should I sync?**  
A: During testing: weekly. Before cutover: daily. After cutover: not needed.

**Q: What if Railway goes down?**  
A: Railway has 99.5% uptime. Plus you still have Azure as backup during transition.

**Q: Can I use a custom domain?**  
A: Yes! Railway supports custom domains with free SSL. See deployment guide.

**Q: How do I backup the Railway database?**  
A: Use `pg_dump` or upgrade to Railway Pro for automated backups. See guide.

**Q: What happens to my Azure database?**  
A: Keep it during transition. After cutover, you can decommission it and save money.

---

## Contact

For questions about:
- **Railway:** Railway Discord or support
- **Azure:** Azure Portal support
- **SPISA Migration:** Your development team

---

**Ready to deploy?** → Start with `RAILWAY_DEPLOYMENT.md`

**Need to sync data?** → See `AZURE_SYNC_GUIDE.md`

---

*Last Updated: October 16, 2025*

