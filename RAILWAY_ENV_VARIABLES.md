# Railway Environment Variables - Copy & Paste Guide

## 🗄️ PostgreSQL Database (Already Created)

**Your Railway Database URL:**
```
postgresql://postgres:diHwuLPimwutIwcvMUyvTnAqimEzKFZR@postgres.railway.internal:5432/railway
```

---

## 🔧 Backend Service Environment Variables

Copy these into **Railway Dashboard → Backend Service → Variables**

### Method 1: Add Each Variable

Click "New Variable" for each:

```bash
# Variable 1
Name: ConnectionStrings__DefaultConnection
Value: Host=postgres.railway.internal;Port=5432;Database=railway;Username=postgres;Password=diHwuLPimwutIwcvMUyvTnAqimEzKFZR;SSL Mode=Require;Trust Server Certificate=true;

# Variable 2
Name: JWT__Secret
Value: spisa-railway-production-jwt-secret-key-must-be-at-least-32-characters-long-2025

# Variable 3
Name: JWT__Issuer
Value: spisa-api

# Variable 4
Name: JWT__Audience
Value: spisa-frontend

# Variable 5
Name: JWT__ExpirationMinutes
Value: 60

# Variable 6
Name: ASPNETCORE_ENVIRONMENT
Value: Production

# Variable 7
Name: ASPNETCORE_URLS
Value: http://0.0.0.0:8080
```

### Method 2: Use Reference for Database (Recommended)

For `ConnectionStrings__DefaultConnection`:
1. Click "New Variable"
2. Name: `ConnectionStrings__DefaultConnection`
3. Click "Add a Reference"
4. Select: **PostgreSQL** service
5. Select: **DATABASE_URL**

Then add the other variables normally.

---

## 🎨 Frontend Service Environment Variables

Copy these into **Railway Dashboard → Frontend Service → Variables**

**⚠️ IMPORTANT:** Replace `YOUR-BACKEND-URL` with your actual backend Railway URL after backend is deployed!

```bash
# Variable 1
Name: NEXT_PUBLIC_API_URL
Value: https://YOUR-BACKEND-URL.up.railway.app

# Variable 2
Name: NODE_ENV
Value: production

# Variable 3
Name: PORT
Value: 3000
```

**How to get YOUR-BACKEND-URL:**
1. Deploy backend first
2. Go to Backend Service → Settings → Networking
3. Click "Generate Domain"
4. Copy the URL (e.g., `spisa-backend-production.up.railway.app`)
5. Use it as: `https://spisa-backend-production.up.railway.app`

---

## 📋 Service Configuration

### Backend Service Settings

| Setting | Value |
|---------|-------|
| Service Name | `spisa-backend` |
| Root Directory | `backend/src/Spisa.WebApi` |
| Dockerfile Path | `backend/src/Spisa.WebApi/Dockerfile` |
| Deploy from | `main` branch |

### Frontend Service Settings

| Setting | Value |
|---------|-------|
| Service Name | `spisa-frontend` |
| Root Directory | `frontend` |
| Dockerfile Path | `frontend/Dockerfile` |
| Deploy from | `main` branch |

---

## ✅ Quick Checklist

### PostgreSQL
- [x] Database created
- [x] Got DATABASE_URL
- [ ] Schema initialized (do this after backend is deployed)

### Backend
- [ ] Service created from GitHub
- [ ] Root directory set to `backend/src/Spisa.WebApi`
- [ ] 7 environment variables added
- [ ] Domain generated
- [ ] Deployed successfully
- [ ] Health check works: `/health`

### Frontend
- [ ] Service created from GitHub
- [ ] Root directory set to `frontend`
- [ ] 3 environment variables added (with backend URL)
- [ ] Domain generated
- [ ] Deployed successfully
- [ ] App loads

---

## 🧪 Testing After Deployment

### Backend Health Check
```bash
# Replace with your actual URL
https://your-backend.up.railway.app/health

# Expected response:
{"status":"Healthy"}
```

### Backend Swagger
```bash
https://your-backend.up.railway.app/swagger
```

### Frontend
```bash
https://your-frontend.up.railway.app

# Should show login page
```

---

## 🔐 Security Notes

1. **JWT Secret:** Generated a new secret for Railway (different from local)
2. **Database Password:** Already included in Railway DATABASE_URL
3. **SSL Mode:** Required for Railway PostgreSQL connections
4. **Trust Server Certificate:** Needed for Railway internal network

---

## 📝 Local vs Railway

### Local Development
- Uses `appsettings.Development.json`
- PostgreSQL: `localhost:5432`
- Run with: `dotnet run`
- No environment variables needed

### Railway Production
- Uses environment variables
- PostgreSQL: `postgres.railway.internal:5432`
- Auto-deploys from GitHub
- Environment variables set in Railway dashboard

---

## 🆘 Troubleshooting

### Backend won't connect to database

**Check:**
1. `ConnectionStrings__DefaultConnection` variable exists
2. Password matches Railway PostgreSQL password
3. Using `postgres.railway.internal` (not external URL)

**Fix:** Update the connection string variable in Railway

### Frontend can't reach backend

**Check:**
1. `NEXT_PUBLIC_API_URL` is set
2. Backend URL is correct (check for typos)
3. URL includes `https://`

**Fix:** Update frontend variables, redeploy

---

*Your Railway Database Password:* `diHwuLPimwutIwcvMUyvTnAqimEzKFZR`  
*Internal Host:* `postgres.railway.internal:5432`  
*Database Name:* `railway`

---

*Last Updated: October 16, 2025*

