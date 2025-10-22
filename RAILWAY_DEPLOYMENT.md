# Railway Deployment Guide for SPISA

## Overview

This guide walks you through deploying the SPISA application (Backend API + Frontend + PostgreSQL) to Railway.app.

**Estimated Time:** 15-20 minutes  
**Estimated Cost:** $10-15/month

---

## Prerequisites

1. ✅ Railway account: https://railway.app (sign up with GitHub)
2. ✅ GitHub repository with your code
3. ✅ Project is working locally (verified via `start-all.bat`)

---

## Architecture on Railway

```
┌─────────────────────────────────────────────────┐
│                   Railway                       │
│                                                 │
│  ┌──────────────┐  ┌──────────────┐            │
│  │   Frontend   │  │   Backend    │            │
│  │   Next.js    │  │   .NET 8     │            │
│  │   Port 3000  │  │   Port 8080  │            │
│  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                    │
│         └──────────────────┘                    │
│                    │                            │
│         ┌──────────▼──────────┐                 │
│         │   PostgreSQL 16     │                 │
│         │   (Railway Managed) │                 │
│         └─────────────────────┘                 │
└─────────────────────────────────────────────────┘
```

---

## Step-by-Step Deployment

### 1. Prepare Your Repository

**Push your code to GitHub (if not already done):**

```bash
cd "D:\dialfa new\spisa-new"

# Initialize git (if not done)
git init
git add .
git commit -m "Initial commit - SPISA application"

# Create GitHub repo and push
git remote add origin https://github.com/YOUR_USERNAME/spisa-new.git
git branch -M main
git push -u origin main
```

**Important:** Make sure you have a `.gitignore` file:

```gitignore
# .NET
bin/
obj/
*.user
*.suo
appsettings.Development.json

# Node
node_modules/
.next/
out/
.env.local
.env*.local

# Database
*.db

# Logs
logs/
*.log
```

---

### 2. Create Railway Project

1. Go to https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub
5. Select your `spisa-new` repository

---

### 3. Deploy PostgreSQL Database

**In your Railway project:**

1. Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway will provision a PostgreSQL 16 instance
3. Wait for it to deploy (~30 seconds)

**Get Database Credentials:**

1. Click on the PostgreSQL service
2. Go to **"Variables"** tab
3. You'll see these variables (Railway auto-generates them):
   - `DATABASE_URL` (full connection string)
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`
   - `PGDATABASE`

**Initialize Database Schema:**

Railway doesn't run init scripts automatically, so you need to:

**Option A: Connect from local machine**

```bash
# Get DATABASE_URL from Railway dashboard
export DATABASE_URL="postgresql://postgres:password@host.railway.app:5432/railway"

# Run schema and seed scripts
psql $DATABASE_URL < database/schema.sql
psql $DATABASE_URL < database/seed.sql
```

**Option B: Use Railway CLI**

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migrations
railway run psql < database/schema.sql
railway run psql < database/seed.sql
```

**Option C: Use pgAdmin or DBeaver**

Connect using the credentials from Railway dashboard and execute the SQL scripts manually.

---

### 4. Deploy Backend (.NET 8 API)

**Create Backend Service:**

1. In Railway project, click **"+ New"** → **"GitHub Repo"**
2. Select your repository again
3. Railway will detect it's a .NET project

**Configure Backend Service:**

1. Click on the service → **"Settings"**
2. Set **Root Directory:** `backend/src/Spisa.WebApi`
3. Set **Build Command:** (leave default, Railway auto-detects)
4. Set **Start Command:** `dotnet Spisa.WebApi.dll`

**Set Environment Variables:**

Go to **"Variables"** tab and add:

```bash
# Connection String (use Railway's DATABASE_URL)
ConnectionStrings__DefaultConnection=${{Postgres.DATABASE_URL}}

# JWT Settings
JWT__Secret=your-production-jwt-secret-at-least-32-characters-long
JWT__Issuer=spisa-api
JWT__Audience=spisa-frontend
JWT__ExpirationMinutes=60

# ASP.NET Core
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://0.0.0.0:8080
```

**Reference Database Service:**

1. Click **"+ Variable"** → **"Add Reference"**
2. Select `ConnectionStrings__DefaultConnection`
3. Choose the PostgreSQL service
4. Select `DATABASE_URL`

**Generate Domain:**

1. Go to **"Settings"** tab
2. Click **"Generate Domain"** under Public Networking
3. You'll get a URL like: `https://spisa-backend-production.up.railway.app`
4. **Save this URL** - you'll need it for the frontend

**Deploy:**

Railway will automatically build and deploy. Monitor the logs in the **"Deployments"** tab.

---

### 5. Deploy Frontend (Next.js)

**Create Frontend Service:**

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your repository again

**Configure Frontend Service:**

1. Click on the service → **"Settings"**
2. Set **Root Directory:** `frontend`
3. Set **Build Command:** `npm install && npm run build`
4. Set **Start Command:** `npm start`

**Set Environment Variables:**

Go to **"Variables"** tab and add:

```bash
# API URL (use the backend domain from Step 4)
NEXT_PUBLIC_API_URL=https://spisa-backend-production.up.railway.app

# Node Environment
NODE_ENV=production
```

**Generate Domain:**

1. Go to **"Settings"** tab
2. Click **"Generate Domain"**
3. You'll get a URL like: `https://spisa-frontend-production.up.railway.app`
4. **This is your app URL!** 🎉

**Deploy:**

Railway will build and deploy automatically. Check logs for any errors.

---

### 6. Create Dockerfiles (Optional - Better Performance)

Railway can auto-detect, but Dockerfiles provide better control.

**Backend Dockerfile:**

Create `backend/src/Spisa.WebApi/Dockerfile`:

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/Spisa.WebApi/Spisa.WebApi.csproj", "Spisa.WebApi/"]
COPY ["src/Spisa.Application/Spisa.Application.csproj", "Spisa.Application/"]
COPY ["src/Spisa.Domain/Spisa.Domain.csproj", "Spisa.Domain/"]
COPY ["src/Spisa.Infrastructure/Spisa.Infrastructure.csproj", "Spisa.Infrastructure/"]
RUN dotnet restore "Spisa.WebApi/Spisa.WebApi.csproj"

COPY src/ .
WORKDIR "/src/Spisa.WebApi"
RUN dotnet build "Spisa.WebApi.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Spisa.WebApi.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Spisa.WebApi.dll"]
```

**Frontend Dockerfile:**

Create `frontend/Dockerfile`:

```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Update `next.config.ts` for standalone build:**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone', // Enable standalone build for Docker
  reactStrictMode: true,
}

export default nextConfig
```

**Railway will auto-detect Dockerfiles** and use them instead of buildpacks.

---

### 7. Run Data Migration

**You need to populate the Railway database with your legacy data.**

**Option A: Migrate from local (recommended for initial setup)**

```bash
# Update connection string in Spisa.DataMigration/appsettings.json
{
  "ConnectionStrings": {
    "SqlServer": "Server=your-azure-sqlserver.database.windows.net;Database=SPISA;User Id=your-user;Password=your-password;",
    "PostgreSQL": "postgresql://postgres:password@host.railway.app:5432/railway"
  }
}

# Run migration tool
cd backend/tools/Spisa.DataMigration
dotnet run
```

**Option B: Schedule periodic sync (see next section)**

---

## Verify Deployment

1. **Check Backend:**
   ```bash
   curl https://spisa-backend-production.up.railway.app/health
   # Should return: { "status": "Healthy" }
   ```

2. **Check Swagger:**
   - Visit: `https://spisa-backend-production.up.railway.app/swagger`
   - Try the login endpoint

3. **Check Frontend:**
   - Visit: `https://spisa-frontend-production.up.railway.app`
   - Login with: `admin` / `admin123`
   - Navigate to Clients page

---

## Cost Breakdown

Railway pricing is usage-based:

| Service | Resource Usage | Estimated Cost |
|---------|---------------|----------------|
| PostgreSQL | ~100MB database | $2-3/month |
| Backend API | ~512MB RAM, minimal CPU | $5-7/month |
| Frontend | ~256MB RAM | $3-5/month |
| **Total** | | **$10-15/month** |

**Hobby Plan:** $5/month + usage ($20 credit included)

---

## Custom Domain (Optional)

**Add your own domain (e.g., spisa.yourdomain.com):**

1. Go to Frontend service → **"Settings"** → **"Domains"**
2. Click **"Custom Domain"**
3. Enter: `spisa.yourdomain.com`
4. Railway will show DNS records to add
5. Add CNAME record in your DNS provider:
   ```
   CNAME  spisa  →  spisa-frontend-production.up.railway.app
   ```
6. SSL certificate is automatically provisioned (Let's Encrypt)

---

## Monitoring & Logs

**View Logs:**

1. Click on any service
2. Go to **"Deployments"** tab
3. Click on latest deployment
4. View real-time logs

**Metrics:**

1. Go to service **"Metrics"** tab
2. View CPU, Memory, Network usage
3. Set up alerts for high resource usage

**Railway CLI:**

```bash
# View backend logs
railway logs --service spisa-backend

# View frontend logs
railway logs --service spisa-frontend

# View database logs
railway logs --service postgres
```

---

## Environment Variables Reference

### Backend

```bash
ConnectionStrings__DefaultConnection=${{Postgres.DATABASE_URL}}
JWT__Secret=<generate-32-char-secret>
JWT__Issuer=spisa-api
JWT__Audience=spisa-frontend
JWT__ExpirationMinutes=60
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://0.0.0.0:8080
```

### Frontend

```bash
NEXT_PUBLIC_API_URL=https://spisa-backend-production.up.railway.app
NODE_ENV=production
PORT=3000
```

---

## Troubleshooting

### Backend won't start

**Check logs for:**
- Database connection errors → Verify `ConnectionStrings__DefaultConnection`
- Port binding issues → Ensure `ASPNETCORE_URLS=http://0.0.0.0:8080`

### Frontend can't reach API

**Check:**
- `NEXT_PUBLIC_API_URL` is set correctly
- Backend service has generated domain and is running
- CORS is configured in backend `Program.cs`

### Database connection fails

**Verify:**
- PostgreSQL service is running
- Schema and seed scripts have been executed
- Connection string format is correct

### Migration tool fails

**Common issues:**
- Azure SQL Server firewall → Add your IP to allowed list
- SSL connection → Add `Encrypt=True;TrustServerCertificate=True` to connection string
- Network timeout → Check Azure SQL Server is accessible

---

## Continuous Deployment

Railway automatically redeploys when you push to `main` branch:

```bash
git add .
git commit -m "Update feature"
git push origin main
# Railway auto-deploys in ~2 minutes
```

**Disable auto-deploy:**

1. Go to service → **"Settings"**
2. Toggle **"Auto-Deploy"** off
3. Deploy manually via **"Deploy"** button

---

## Backup Strategy

**Railway doesn't backup your database automatically on Hobby plan.**

### Option 1: Scheduled Backup Script (Recommended)

Create a GitHub Action to backup daily:

`.github/workflows/backup-db.yml`:

```yaml
name: Daily Database Backup

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
  workflow_dispatch:  # Manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      
      - name: Backup PostgreSQL
        env:
          DATABASE_URL: ${{ secrets.RAILWAY_DATABASE_URL }}
        run: |
          BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
          pg_dump $DATABASE_URL > $BACKUP_FILE
          
      - name: Upload to S3 or Google Drive
        # Add your cloud storage integration here
```

### Option 2: Manual Backups

```bash
# Set Railway database URL
export DATABASE_URL="postgresql://postgres:password@host.railway.app:5432/railway"

# Backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Compress
gzip backup-*.sql

# Store securely
```

### Option 3: Upgrade to Pro Plan

Railway Pro includes automated backups.

---

## Next Steps

1. ✅ Deploy to Railway (follow this guide)
2. ✅ Migrate data from Azure SQL Server
3. ✅ Test all functionality
4. ✅ Set up backups
5. ✅ Configure monitoring/alerts
6. ✅ Add custom domain (optional)
7. ✅ Set up database sync strategy (see AZURE_SYNC_GUIDE.md)

---

## Support

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **SPISA Issues:** GitHub repository issues

---

*Last Updated: October 16, 2025*








