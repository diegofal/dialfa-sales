# SPISA Environment Configuration Guide

## Overview

SPISA supports multiple environments with proper configuration management:

1. **Local Development** - Your computer with local PostgreSQL
2. **Railway (Production)** - Deployed to Railway with Railway PostgreSQL

---

## Configuration Hierarchy

.NET configuration is loaded in this order (later overrides earlier):

```
1. appsettings.json                  (Base settings)
2. appsettings.{Environment}.json    (Environment-specific)
3. Environment Variables             (Deployment-specific)
4. Command Line Arguments            (Runtime overrides)
```

---

## Local Development Setup

### Configuration Files

**`appsettings.json`** - Base configuration (shared across all environments)
- Contains default values
- Safe to commit to Git

**`appsettings.Development.json`** - Local development overrides
- Contains local PostgreSQL connection
- Safe to commit to Git
- Used when `ASPNETCORE_ENVIRONMENT=Development`

**`appsettings.Production.json`** - Production overrides
- Minimal settings (mostly logging levels)
- Secrets come from environment variables
- Safe to commit to Git

### Running Locally

```bash
cd backend/src/Spisa.WebApi

# Development mode (uses appsettings.Development.json)
dotnet run

# Or explicitly set environment
$env:ASPNETCORE_ENVIRONMENT="Development"
dotnet run
```

**Local PostgreSQL Connection:**
```
Host=localhost
Database=spisa
Username=spisa_user
Password=spisa_dev_password
```

This is configured in `appsettings.Development.json` and used automatically when running locally.

---

## Railway (Production) Setup

### Environment Variables in Railway

Railway uses **environment variables** to override configuration. These are set in the Railway dashboard.

**Go to:** Railway Dashboard → Backend Service → Variables

### Required Environment Variables:

```bash
# Database Connection (from Railway PostgreSQL)
ConnectionStrings__DefaultConnection
  → postgresql://postgres:diHwuLPimwutIwcvMUyvTnAqimEzKFZR@postgres.railway.internal:5432/railway

# JWT Secret (generate a new secure one for production)
JWT__Secret
  → spisa-production-jwt-key-change-this-to-something-secure-and-random-2025

JWT__Issuer
  → spisa-api

JWT__Audience
  → spisa-frontend

JWT__ExpirationMinutes
  → 60

# ASP.NET Environment
ASPNETCORE_ENVIRONMENT
  → Production

ASPNETCORE_URLS
  → http://0.0.0.0:8080
```

### How to Add Variables in Railway:

1. Click on **Backend Service**
2. Go to **"Variables"** tab
3. Click **"New Variable"**
4. Enter variable name (e.g., `ConnectionStrings__DefaultConnection`)
5. Enter value (e.g., the PostgreSQL URL)
6. Click **"Add"**
7. Repeat for all variables

### Database Connection Reference:

**Option 1: Use Reference (Recommended)**

1. Click **"New Variable"**
2. Name: `ConnectionStrings__DefaultConnection`
3. Click **"Add a Reference"**
4. Select **PostgreSQL** service
5. Select **`DATABASE_URL`** variable
6. Railway will automatically link them

**Option 2: Manual (if reference doesn't work)**

Copy your Railway PostgreSQL URL:
```
postgresql://postgres:diHwuLPimwutIwcvMUyvTnAqimEzKFZR@postgres.railway.internal:5432/railway
```

Paste it as the value for `ConnectionStrings__DefaultConnection`

---

## Configuration Format

### .NET Configuration (appsettings.json)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=spisa..."
  },
  "JWT": {
    "Secret": "...",
    "Issuer": "...",
    "Audience": "..."
  }
}
```

### Environment Variables (Railway, Docker, etc.)

Use **double underscore** `__` to represent nested sections:

```bash
ConnectionStrings__DefaultConnection="Host=..."
JWT__Secret="..."
JWT__Issuer="..."
JWT__Audience="..."
```

---

## Frontend Configuration

### Local Development

**File:** `frontend/.env.local` (create this file)

```bash
# Local backend API
NEXT_PUBLIC_API_URL=http://localhost:5021

# Development mode
NODE_ENV=development
```

**This file is gitignored** - safe to put local settings here.

### Railway Production

**Set in Railway Dashboard:**

1. Click **Frontend Service**
2. Go to **"Variables"** tab
3. Add:

```bash
NEXT_PUBLIC_API_URL
  → https://your-backend-service.up.railway.app
  (Use your actual Railway backend URL)

NODE_ENV
  → production

PORT
  → 3000
```

---

## Migration Tool Configuration

The data migration tool also needs configuration for both environments.

**File:** `backend/tools/Spisa.DataMigration/appsettings.json`

```json
{
  "ConnectionStrings": {
    "SqlServer": "Server=your-azure-server.database.windows.net;Database=SPISA;User Id=...;Password=...;Encrypt=True;",
    "PostgreSQL": "Host=localhost;Database=spisa;Username=spisa_user;Password=spisa_dev_password"
  },
  "Migration": {
    "BatchSize": 1000,
    "EnableValidation": true,
    "GenerateReport": true,
    "DryRun": false
  }
}
```

### Sync to Local PostgreSQL

```json
"PostgreSQL": "Host=localhost;Database=spisa;Username=spisa_user;Password=spisa_dev_password"
```

### Sync to Railway PostgreSQL

```json
"PostgreSQL": "Host=postgres.railway.internal;Port=5432;Database=railway;Username=postgres;Password=diHwuLPimwutIwcvMUyvTnAqimEzKFZR;SSL Mode=Require;"
```

**Or use environment variable:**

```bash
# Set before running migration
$env:ConnectionStrings__PostgreSQL="postgresql://postgres:diHwuLPimwutIwcvMUyvTnAqimEzKFZR@postgres.railway.internal:5432/railway"

cd backend/tools/Spisa.DataMigration
dotnet run
```

---

## Quick Reference

### Local Development

| Component | Configuration | Location |
|-----------|--------------|----------|
| Backend API | appsettings.Development.json | Auto-loaded when running locally |
| Frontend | .env.local | Create manually |
| Database | Docker Compose | Already running |
| Migration Tool | appsettings.json | Update PostgreSQL connection |

### Railway Production

| Component | Configuration | Location |
|-----------|--------------|----------|
| Backend API | Environment Variables | Railway Dashboard → Backend → Variables |
| Frontend | Environment Variables | Railway Dashboard → Frontend → Variables |
| Database | Automatically configured | Railway PostgreSQL service |
| Migration Tool | Update appsettings.json | Or use environment variables |

---

## Connection String Formats

### PostgreSQL (Railway Internal Network)

```
postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway
```

**Converted to .NET format:**
```
Host=postgres.railway.internal;Port=5432;Database=railway;Username=postgres;Password=PASSWORD;SSL Mode=Require;
```

### PostgreSQL (Railway External/Public)

For connecting from your local machine to Railway database:

```
postgresql://postgres:PASSWORD@junction.proxy.rlwy.net:PORT/railway
```

Get this from Railway Dashboard → PostgreSQL → Connect → Public Network

---

## Environment Detection

Your application automatically detects the environment:

```csharp
// In Program.cs
var builder = WebApplication.CreateBuilder(args);

// This is automatically set based on ASPNETCORE_ENVIRONMENT
var environment = builder.Environment.EnvironmentName;

if (environment == "Development")
{
    // Uses appsettings.Development.json
    // Local PostgreSQL connection
}
else if (environment == "Production")
{
    // Uses appsettings.Production.json + Environment Variables
    // Railway PostgreSQL connection from env vars
}
```

---

## Security Best Practices

### ✅ DO:

- ✅ Commit `appsettings.json` (base settings)
- ✅ Commit `appsettings.Development.json` (local dev settings)
- ✅ Commit `appsettings.Production.json` (structure only, no secrets)
- ✅ Use environment variables for production secrets
- ✅ Use different JWT secrets for dev and production
- ✅ Keep Railway database password in Railway variables only

### ❌ DON'T:

- ❌ Don't commit `.env.local` files
- ❌ Don't commit production secrets in appsettings
- ❌ Don't use the same JWT secret in dev and production
- ❌ Don't hardcode Railway database passwords in code

---

## Troubleshooting

### "Can't connect to database" (Local)

**Check:**
1. Docker Compose is running: `docker ps`
2. PostgreSQL container is healthy
3. Connection string in `appsettings.Development.json` matches Docker Compose settings

**Fix:**
```bash
cd "d:\dialfa new\spisa-new"
docker-compose up -d postgres
```

### "Can't connect to database" (Railway)

**Check:**
1. `ConnectionStrings__DefaultConnection` is set in Railway variables
2. Value matches Railway PostgreSQL connection string
3. Backend service is deployed and running

**Fix:**
1. Railway Dashboard → PostgreSQL → Variables → Copy `DATABASE_URL`
2. Backend Service → Variables → Update `ConnectionStrings__DefaultConnection`
3. Railway will auto-redeploy

### "Configuration not loading" (Railway)

**Check:**
1. Environment variable names use double underscore `__`
2. Variable names match exactly (case-sensitive)
3. ASPNETCORE_ENVIRONMENT is set to "Production"

**Fix:**
- Verify all variable names in Railway dashboard
- Check deployment logs for configuration errors

### Frontend can't reach backend

**Check:**
1. `NEXT_PUBLIC_API_URL` in frontend variables
2. Backend URL is correct and includes `https://`
3. Backend is deployed and healthy

**Fix:**
- Update `NEXT_PUBLIC_API_URL` to backend URL
- Redeploy frontend

---

## Testing Configuration

### Test Local Configuration

```bash
# Backend
cd backend/src/Spisa.WebApi
dotnet run
# Visit: http://localhost:5021/health

# Frontend
cd frontend
npm run dev
# Visit: http://localhost:3000
```

### Test Railway Configuration

```bash
# Backend Health Check
Invoke-RestMethod https://your-backend.up.railway.app/health

# Frontend
# Open: https://your-frontend.up.railway.app
```

---

## Your Railway Database URL

**Internal URL (use this for Railway backend):**
```
postgresql://postgres:diHwuLPimwutIwcvMUyvTnAqimEzKFZR@postgres.railway.internal:5432/railway
```

**Formatted for .NET ConnectionString:**
```
Host=postgres.railway.internal;Port=5432;Database=railway;Username=postgres;Password=diHwuLPimwutIwcvMUyvTnAqimEzKFZR;SSL Mode=Require;Trust Server Certificate=true;
```

---

## Next Steps

1. ✅ Configuration files are now set up
2. ✅ Local development uses `appsettings.Development.json`
3. ✅ Railway will use environment variables
4. ⏭️ Set up environment variables in Railway (see below)
5. ⏭️ Deploy backend to Railway
6. ⏭️ Deploy frontend to Railway

---

*Last Updated: October 16, 2025*







