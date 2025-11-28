# Railway Deployment Fix

## Problem
The `system_settings` table didn't exist in the Railway database, causing Prisma errors during invoice generation.

## Solution
Created Prisma migrations to ensure the database schema is properly deployed on Railway.

## What Changed

### 1. Migration Files Created
- `prisma/migrations/20250101000000_init/migration.sql` - Complete database schema
- `prisma/migrations/migration_lock.toml` - Migration lock file

### 2. Server Startup Updated
- Modified `server-with-logs.js` to use `prisma migrate deploy` in production
- This ensures migrations run automatically on Railway deployment

### 3. Railway Configuration Fixed
- Updated `railway.json` to use `server-with-logs.js` instead of `server.js`
- **This was the critical missing piece** - Railway was bypassing our migration script!

### 4. Dockerfile Enhanced
- Added Prisma CLI dependencies (openssl, libc6-compat)
- Copied Prisma node_modules to enable migrations in production
- Ensures `npx prisma migrate deploy` works correctly

## Deployment Steps

### Option 1: Automatic (Recommended)
1. Commit and push these changes:
   ```bash
   git add prisma/migrations/ server-with-logs.js railway.json Dockerfile RAILWAY_DEPLOYMENT_FIX.md
   git commit -m "Fix Railway deployment: add migrations and fix startup script"
   git push
   ```

2. Railway will automatically:
   - Build the Docker image
   - Run `npx prisma migrate deploy` on startup
   - Create the `system_settings` table and all missing tables
   - Start the application

### Option 2: Manual Migration (If automatic fails)
If the automatic migration fails, you can run it manually in Railway:

1. Go to Railway dashboard
2. Select your project
3. Go to the "Settings" tab
4. Click on "Deploy" and then "New Deployment"
5. Once deployed, check the logs to verify the migration ran successfully

### Option 3: Direct Database Access (Emergency)
If both above fail, you can run the migration SQL directly:

1. In Railway dashboard, go to your PostgreSQL database
2. Click "Connect" and then "Query"
3. Copy the content from `prisma/migrations/20250101000000_init/migration.sql`
4. Paste and execute in the query console

## Verification

After deployment, check the Railway logs for:
```
🔄 Checking database schema...
Running: npx prisma migrate deploy
✅ Database migrations deployed successfully
```

The error about `system_settings` table not existing should be resolved.

## Notes

- The migration is **idempotent** (safe to run multiple times)
- It uses `IF NOT EXISTS` checks to avoid errors if tables already exist
- Default exchange rate is set to 1000.0000 ARS/USD
- All foreign keys are added conditionally to prevent duplicates
