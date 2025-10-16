# Railway Deployment - Step-by-Step Guide

## ✅ Step 1: GitHub Preparation - DONE!

Your code is already on GitHub:
- Repository: https://github.com/diegofal/dialfa-sales
- Branch: main
- Latest commit includes all deployment files ✅

---

## 📋 Step 2: Railway Account Setup

### Create Account:

1. Go to: **https://railway.app**
2. Click **"Login with GitHub"**
3. Authorize Railway to access your GitHub account
4. You'll be redirected to Railway dashboard

**Why GitHub?** Railway deploys directly from your GitHub repository for continuous deployment.

---

## 🗄️ Step 3: Deploy PostgreSQL Database

### Create Database:

1. In Railway dashboard, click **"New Project"**
2. Select **"Provision PostgreSQL"**
3. Wait ~30 seconds for database to provision
4. **IMPORTANT:** Copy the database credentials

### Get Database Connection String:

1. Click on the **PostgreSQL** service
2. Go to **"Variables"** tab
3. Find `DATABASE_URL` - this is your full connection string
4. It looks like: `postgresql://postgres:password@host.railway.app:5432/railway`

### Initialize Database Schema:

**Option A: Use Railway CLI (recommended)**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Connect to database
railway run psql

# In psql, run:
\i database/schema.sql
\i database/seed.sql
\q
```

**Option B: Use pgAdmin or DBeaver**

1. Install pgAdmin: https://www.pgadmin.org/download/
2. Create new server connection with Railway credentials:
   - Host: (from DATABASE_URL)
   - Port: 5432
   - Database: railway
   - Username: postgres
   - Password: (from DATABASE_URL)
3. Execute `database/schema.sql`
4. Execute `database/seed.sql`

**Option C: Use psql from command line**

```bash
# Replace with your actual DATABASE_URL from Railway
$env:DATABASE_URL="postgresql://postgres:password@host.railway.app:5432/railway"

# Run schema
Get-Content database/schema.sql | psql $env:DATABASE_URL

# Run seed data
Get-Content database/seed.sql | psql $env:DATABASE_URL
```

---

## 🔧 Step 4: Deploy Backend (.NET 8 API)

### Add Backend Service:

1. In your Railway project, click **"New"** → **"GitHub Repo"**
2. Select your repository: **diegofal/dialfa-sales**
3. Railway will detect it's a .NET project

### Configure Backend:

1. Click on the new service
2. Go to **"Settings"** tab
3. **Service Name:** `spisa-backend`
4. **Root Directory:** Leave empty (Railway will auto-detect)
5. **Build Command:** Auto-detected
6. **Start Command:** Auto-detected

### Set Environment Variables:

1. Go to **"Variables"** tab
2. Click **"New Variable"** for each:

```bash
# Add these environment variables:

ConnectionStrings__DefaultConnection
  → Click "Add Reference" → Select PostgreSQL → DATABASE_URL

JWT__Secret
  → spisa-production-jwt-secret-key-must-be-at-least-32-characters-long-2025

JWT__Issuer
  → spisa-api

JWT__Audience
  → spisa-frontend

JWT__ExpirationMinutes
  → 60

ASPNETCORE_ENVIRONMENT
  → Production

ASPNETCORE_URLS
  → http://0.0.0.0:8080
```

### Generate Public URL:

1. Go to **"Settings"** tab
2. Scroll to **"Networking"**
3. Click **"Generate Domain"**
4. You'll get: `https://spisa-backend-production.up.railway.app`
5. **SAVE THIS URL** - you'll need it for the frontend!

### Deploy:

- Railway will automatically build and deploy
- Check **"Deployments"** tab to monitor progress
- Should take ~3-5 minutes
- Look for "Build successful" and "Deployment successful"

### Verify Backend:

Once deployed, test these URLs (replace with your actual domain):

```bash
# Health check
https://your-backend.up.railway.app/health

# Swagger UI
https://your-backend.up.railway.app/swagger

# Should return: {"status":"Healthy"}
```

---

## 🎨 Step 5: Deploy Frontend (Next.js)

### Add Frontend Service:

1. In Railway project, click **"New"** → **"GitHub Repo"**
2. Select **diegofal/dialfa-sales** again
3. Railway will create a second service

### Configure Frontend:

1. Click on the new service
2. Go to **"Settings"** tab
3. **Service Name:** `spisa-frontend`
4. **Root Directory:** `frontend`
5. **Build Command:** `npm install && npm run build`
6. **Start Command:** `npm start`
7. **Watch Paths:** `/frontend/**`

### Set Environment Variables:

1. Go to **"Variables"** tab
2. Add:

```bash
NEXT_PUBLIC_API_URL
  → https://your-backend-domain.up.railway.app
  (Use the backend URL from Step 4)

NODE_ENV
  → production

PORT
  → 3000
```

### Generate Public URL:

1. Go to **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. You'll get: `https://spisa-frontend-production.up.railway.app`
4. **This is your app URL!** 🎉

### Deploy:

- Railway will build and deploy automatically
- Takes ~5-10 minutes for first build
- Monitor in **"Deployments"** tab

---

## 🧪 Step 6: Verify Deployment

### Test Backend:

```bash
# Method 1: Browser
Open: https://your-backend.up.railway.app/health

# Method 2: PowerShell
Invoke-RestMethod https://your-backend.up.railway.app/health

# Expected: {"status":"Healthy"}
```

### Test Swagger:

```
Open: https://your-backend.up.railway.app/swagger
```

You should see the Swagger UI with all your API endpoints.

### Test Frontend:

```
Open: https://your-frontend.up.railway.app
```

You should see the SPISA login page.

### Test Login:

1. Go to frontend URL
2. Login with:
   - Username: `admin`
   - Password: `admin123`
3. You should be redirected to the dashboard

**Expected:** Dashboard shows "0 clients, 0 articles" (database is empty until we migrate data)

---

## 📊 Step 7: Migrate Data from Azure

Now that everything is deployed, let's populate the database with your production data.

### Update Migration Tool Config:

1. Open: `backend/tools/Spisa.DataMigration/appsettings.json`
2. Update connection strings:

```json
{
  "ConnectionStrings": {
    "SqlServer": "Server=your-azure-server.database.windows.net;Database=SPISA;User Id=your-user;Password=your-password;Encrypt=True;",
    "PostgreSQL": "Host=your-railway-host.railway.app;Port=5432;Database=railway;Username=postgres;Password=your-railway-password;SSL Mode=Require;"
  },
  "Migration": {
    "BatchSize": 1000,
    "EnableValidation": true,
    "GenerateReport": true,
    "DryRun": false
  }
}
```

**Get PostgreSQL connection details from Railway:**
- Click PostgreSQL service → Variables tab
- Copy: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE

### Run Migration:

```bash
# Navigate to migration tool
cd backend/tools/Spisa.DataMigration

# Run migration
dotnet run
```

**Expected output:**
```
Starting migration...
Migrating categories: 12/12 ✓
Migrating articles: 1,797/1,797 ✓
Migrating clients: 397/397 ✓
...
Migration completed successfully!
Duration: ~3 minutes
```

### Verify Data:

1. Refresh frontend in browser
2. Dashboard should now show:
   - 397 Clients
   - 1,797 Articles
   - 12 Categories
3. Navigate to Clients page - should see all 397 clients

---

## ✅ Step 8: Final Checklist

- [ ] PostgreSQL database deployed and initialized
- [ ] Backend API deployed and healthy
- [ ] Frontend deployed and accessible
- [ ] Swagger UI works
- [ ] Login works (admin/admin123)
- [ ] Data migrated from Azure (397 clients, 1,797 articles)
- [ ] Dashboard shows correct statistics
- [ ] Clients page loads all clients
- [ ] Articles page loads all articles
- [ ] CRUD operations work (create, edit, delete)

---

## 🎉 You're Live!

Your SPISA application is now deployed to Railway!

### Your URLs:

- **Frontend:** https://your-frontend.up.railway.app
- **Backend API:** https://your-backend.up.railway.app
- **Swagger Docs:** https://your-backend.up.railway.app/swagger

### Next Steps:

1. **Test thoroughly** with both users
2. **Add custom domain** (optional - see RAILWAY_DEPLOYMENT.md)
3. **Set up monitoring** (Railway has built-in metrics)
4. **Schedule backups** (see RAILWAY_DEPLOYMENT.md for backup strategies)
5. **Plan cutover** from old system

---

## 💰 Expected Costs

Monthly Railway costs:

| Service | Cost |
|---------|------|
| PostgreSQL (~100MB) | $2-3 |
| Backend (.NET 8) | $5-7 |
| Frontend (Next.js) | $3-5 |
| **Total** | **$10-15/month** |

**Hobby Plan:** $5/month + usage (includes $20 credit)

---

## 🆘 Troubleshooting

### Backend won't start?

**Check Logs:**
1. Click Backend service → "Deployments" → Latest deployment
2. Look for error messages

**Common Issues:**
- Database connection failed → Check `ConnectionStrings__DefaultConnection`
- Port binding error → Check `ASPNETCORE_URLS=http://0.0.0.0:8080`
- Build failed → Check Dockerfile syntax

### Frontend can't reach backend?

**Check:**
1. `NEXT_PUBLIC_API_URL` is set to backend URL
2. Backend is running (check health endpoint)
3. CORS is configured in backend

**Fix:**
- Update `NEXT_PUBLIC_API_URL` in frontend variables
- Redeploy frontend

### Database connection fails?

**Check:**
1. PostgreSQL service is running
2. Schema and seed scripts executed successfully
3. Connection string format is correct

**Fix:**
- Go to PostgreSQL service → Variables → Copy DATABASE_URL
- Update backend variable `ConnectionStrings__DefaultConnection`
- Redeploy backend

### Migration fails?

**Check:**
1. Azure SQL Server firewall allows your IP
2. Both connection strings are correct
3. Azure database is accessible

**Fix:**
- Add your IP to Azure SQL firewall rules
- Test connections individually
- Check logs in `migration-logs/`

---

## 📞 Get Help

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Railway Support:** support@railway.app
- **GitHub Issues:** Your repository issues page

---

## 🎓 Tips

1. **Monitor Usage:** Check Railway dashboard for resource usage
2. **View Logs:** Click any service → "Deployments" → "View Logs"
3. **Redeploy:** Click service → "Deployments" → "⋯" → "Redeploy"
4. **Environment Variables:** Can be updated anytime (triggers redeploy)
5. **Custom Domain:** Settings → Domains → Add Domain

---

**Ready to start?** Go to https://railway.app and let's begin! 🚀

---

*Created: October 16, 2025*
*For: SPISA Deployment to Railway*


