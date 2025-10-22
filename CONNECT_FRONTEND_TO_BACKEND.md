# Connect Frontend to Backend on Railway

## 🎯 Quick Fix: Frontend Connecting to Localhost

Your frontend is deployed but still trying to connect to `localhost`. Here's how to fix it:

---

## Step 1: Get Your Backend URL

1. Go to **Railway Dashboard**
2. Click on your **Backend Service** (spisa-backend)
3. Go to **Settings** tab
4. Scroll to **Networking** section
5. Look for **Public Networking**
   - If you see a URL like `spisa-backend-production.up.railway.app`, copy it
   - If you don't see one, click **"Generate Domain"** button first

**Your backend URL should look like:**
```
https://spisa-backend-production.up.railway.app
```
or
```
https://web-production-XXXX.up.railway.app
```

---

## Step 2: Set Frontend Environment Variable

1. Go to **Railway Dashboard**
2. Click on your **Frontend Service** (spisa-frontend)
3. Go to **Variables** tab
4. Look for `NEXT_PUBLIC_API_URL` variable
   
### If the variable EXISTS:
1. Click on it to edit
2. Update the value to your backend URL (from Step 1)
3. Make sure it includes `https://` 
4. Click **Save** or press Enter

### If the variable DOESN'T EXIST:
1. Click **"+ New Variable"**
2. Set:
   - **Name:** `NEXT_PUBLIC_API_URL`
   - **Value:** `https://your-actual-backend-url.up.railway.app`
3. Click **Add**

---

## Step 3: Redeploy Frontend

After updating the environment variable:

1. Stay in the **Frontend Service**
2. Go to **Deployments** tab
3. Click on the **three dots (...)** on the latest deployment
4. Click **"Redeploy"**

Or simply:
1. Click **"Deploy"** button at the top right
2. It will trigger a new deployment with the updated variable

**Wait 2-3 minutes** for the deployment to complete.

---

## Step 4: Verify the Connection

### Test Backend:
Open in browser:
```
https://your-backend-url.up.railway.app/health
```

Should return:
```json
{"status":"Healthy"}
```

### Test Frontend:
1. Open your frontend URL: `https://your-frontend-url.up.railway.app`
2. Try to login (you may need to seed users first)
3. Open **Browser DevTools** (F12)
4. Go to **Network** tab
5. Try to login
6. Look at the request to `/api/auth/login`
7. Check the **Request URL** - it should now point to your Railway backend, NOT localhost!

---

## 🔍 How to Check Current Configuration

### In Railway Dashboard:

**Frontend Service → Variables:**
- Should have: `NEXT_PUBLIC_API_URL` = `https://[your-backend].up.railway.app`

**Backend Service → Settings → Networking:**
- Should have a **Public Domain** generated

---

## ⚠️ Common Issues

### Issue: Frontend still hitting localhost after redeploy
**Cause:** Browser cache
**Fix:**
1. Hard refresh: `Ctrl + Shift + R` (or `Cmd + Shift + R` on Mac)
2. Or clear browser cache
3. Or open in incognito/private window

### Issue: CORS error when calling backend
**Cause:** Backend CORS not configured for Railway domain
**Fix:** Check backend CORS configuration in `Program.cs` - it should allow Railway domains

### Issue: 401 Unauthorized
**Cause:** No users in database yet
**Fix:** You need to seed the database first (see database setup docs)

---

## 📋 Quick Checklist

- [ ] Backend has a public domain generated
- [ ] Frontend has `NEXT_PUBLIC_API_URL` variable set to backend URL
- [ ] Backend URL includes `https://`
- [ ] Frontend redeployed after setting variable
- [ ] Browser cache cleared
- [ ] Backend `/health` endpoint works
- [ ] Network tab shows requests going to Railway backend (not localhost)

---

## 🎯 Expected Environment Variables

### Frontend Service Should Have:

```bash
NEXT_PUBLIC_API_URL=https://spisa-backend-production.up.railway.app
NODE_ENV=production
PORT=3000
```

### Backend Service Should Have:

```bash
ConnectionStrings__DefaultConnection=Host=postgres.railway.internal;Port=5432;...
JWT__Secret=spisa-railway-production-jwt-secret-key-must-be-at-least-32-characters-long-2025
JWT__Issuer=spisa-api
JWT__Audience=spisa-frontend
JWT__ExpirationMinutes=60
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://0.0.0.0:8080
```

---

## 🚀 Next Steps After Connection Works

1. **Initialize Database Schema**
   - Run schema.sql on Railway database
   - See: `RAILWAY_DEPLOYMENT_STEPS.md`

2. **Seed Initial Data**
   - Run seed.sql to create test users
   - Default login: `admin` / `Admin123!`

3. **Test All Features**
   - Login
   - View categories, clients, articles
   - Create a sales order

---

*Last Updated: October 22, 2025*

