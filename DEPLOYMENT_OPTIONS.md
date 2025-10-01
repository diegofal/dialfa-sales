# SPISA Deployment Options Analysis

**Last Updated:** October 1, 2025  
**Application:** SPISA Web Application (2 concurrent users)  
**Stack:** .NET 8 API + Next.js Frontend + PostgreSQL

---

## Overview

This document compares deployment options for SPISA considering:
- **User Count:** 2 concurrent users
- **Budget:** Cost-effective solutions prioritized
- **Complexity:** Minimal maintenance overhead
- **Scalability:** Room to grow if needed
- **Argentina Location:** Latency considerations for AR users

---

## Quick Comparison Matrix

| Option | Monthly Cost | Complexity | Performance | Scalability | Recommended For |
|--------|--------------|------------|-------------|-------------|-----------------|
| **1. Self-Hosted VPS** | $5-20 | Medium | Excellent | High | **Best for 2 users** |
| **2. Railway** | $5-15 | Low | Good | High | Quick start, dev-friendly |
| **3. Render** | $7-21 | Low | Good | High | Simple, reliable |
| **4. DigitalOcean App Platform** | $12-30 | Low | Good | High | Managed simplicity |
| **5. AWS Lightsail** | $10-20 | Medium | Excellent | High | AWS ecosystem |
| **6. Azure App Service** | $13-55 | Medium | Excellent | High | Microsoft ecosystem |
| **7. On-Premises** | $0 | High | Depends | Low | Existing infrastructure |

---

## Option 1: Self-Hosted VPS (RECOMMENDED ⭐)

**Best for:** Cost-conscious, full control, 2 users

### Providers
- **Contabo** (Europe/US): €5-10/month
- **Hetzner** (Europe): €5-10/month
- **Vultr** (global): $6-12/month
- **DigitalOcean Droplets** (global): $12-24/month
- **Linode** (global): $12-24/month

### Specifications

**Minimum (for 2 users):**
```
CPU: 2 vCPUs
RAM: 4GB
Storage: 50GB SSD
Bandwidth: 2TB/month
Cost: $6-12/month
```

**Recommended:**
```
CPU: 4 vCPUs
RAM: 8GB
Storage: 100GB SSD
Bandwidth: 4TB/month
Cost: $12-24/month
```

### Deployment Architecture

```
┌─────────────────────────────────────────┐
│         VPS (Ubuntu 22.04)              │
│                                         │
│  ┌────────────────────────────────┐    │
│  │ Nginx (Reverse Proxy + SSL)    │    │
│  │   Port 80/443                  │    │
│  └─────────┬──────────────────────┘    │
│            │                            │
│  ┌─────────▼──────────┐  ┌──────────┐  │
│  │ Next.js Frontend   │  │ .NET API │  │
│  │ (Docker)           │  │ (Docker) │  │
│  │ Port 3000          │  │ Port 5000│  │
│  └────────────────────┘  └──────────┘  │
│                                         │
│  ┌────────────────────────────────┐    │
│  │ PostgreSQL 16                  │    │
│  │ (Docker Volume)                │    │
│  │ Port 5432 (internal only)      │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Setup Steps

1. **Provision VPS**
   ```bash
   # Choose Ubuntu 22.04 LTS
   # SSH into server
   ssh root@your-server-ip
   ```

2. **Install Docker**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo apt install docker-compose-plugin
   ```

3. **Setup Firewall**
   ```bash
   sudo ufw allow 22/tcp   # SSH
   sudo ufw allow 80/tcp   # HTTP
   sudo ufw allow 443/tcp  # HTTPS
   sudo ufw enable
   ```

4. **Deploy Application**
   ```bash
   git clone https://github.com/yourorg/spisa-new.git
   cd spisa-new
   cp env.example .env
   nano .env  # Configure production values
   docker compose up -d
   ```

5. **Setup SSL (Let's Encrypt)**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d spisa.yourdomain.com
   ```

6. **Setup Automated Backups**
   ```bash
   # See backup script in appendix
   sudo crontab -e
   # Add: 0 2 * * * /opt/spisa/backup.sh
   ```

### Pros
✅ Full control over environment  
✅ Lowest cost ($6-24/month)  
✅ No vendor lock-in  
✅ Can host multiple apps  
✅ Root access for customization  
✅ Predictable costs  

### Cons
❌ Manual server maintenance  
❌ You handle security updates  
❌ Need basic Linux knowledge  
❌ Backup responsibility  
❌ No auto-scaling  

### Monitoring & Maintenance

**Automatic Updates:**
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

**Monitoring (Optional):**
- **Uptime Kuma** (self-hosted): Free
- **UptimeRobot**: Free tier for basic monitoring
- **Netdata**: Free, real-time performance monitoring

---

## Option 2: Railway.app

**Best for:** Fastest deployment, developer-friendly

### Pricing
- **Free Tier**: $5 credit/month (limited)
- **Hobby Plan**: $5/month + usage (~$10-15 total for SPISA)
- **Pro Plan**: $20/month + usage

### Setup

1. Connect GitHub repository
2. Railway auto-detects Dockerfile
3. Add PostgreSQL service
4. Set environment variables
5. Deploy with one click

### Configuration

```yaml
# railway.toml
[build]
  builder = "DOCKERFILE"
  dockerfilePath = "./backend/src/Spisa.WebApi/Dockerfile"

[deploy]
  numReplicas = 1
  restartPolicyType = "ON_FAILURE"
  healthcheckPath = "/health"
  healthcheckTimeout = 100
```

### Pros
✅ Extremely easy setup (< 10 minutes)  
✅ Auto SSL certificates  
✅ GitHub integration  
✅ Automatic deployments  
✅ Built-in PostgreSQL  
✅ Good for startups  

### Cons
❌ Usage-based pricing can surprise  
❌ Limited to US regions (higher latency from Argentina)  
❌ Less control than VPS  
❌ Can get expensive at scale  

### Estimated Cost for SPISA
- API: $5-7/month
- Frontend: $3-5/month
- PostgreSQL: $2-3/month
- **Total: ~$10-15/month**

---

## Option 3: Render.com

**Best for:** Simple, reliable, good DX

### Pricing
- **Free Tier**: Available (with limitations)
- **Starter**: $7/month per service
- **PostgreSQL**: $7/month (basic)

### Setup

1. Connect Git repository
2. Create Web Service (API)
3. Create Static Site (Frontend)
4. Create PostgreSQL instance
5. Configure environment variables

### Render Blueprint (render.yaml)

```yaml
services:
  - type: web
    name: spisa-api
    env: docker
    dockerfilePath: ./backend/src/Spisa.WebApi/Dockerfile
    plan: starter
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: spisa-db
          property: connectionString
  
  - type: web
    name: spisa-frontend
    env: static
    buildCommand: cd frontend && npm install && npm run build
    staticPublishPath: frontend/out
    plan: starter

databases:
  - name: spisa-db
    plan: starter
    databaseName: spisa
    user: spisa_user
```

### Pros
✅ Very simple setup  
✅ Auto SSL  
✅ Free tier available  
✅ Auto-deploy from Git  
✅ Managed PostgreSQL  
✅ Background jobs support  

### Cons
❌ Limited regions (US/EU only)  
❌ Free tier services sleep after inactivity  
❌ More expensive than VPS  
❌ Less flexibility  

### Estimated Cost for SPISA
- API: $7/month
- Frontend: $0 (static)
- PostgreSQL: $7/month
- **Total: ~$14-21/month**

---

## Option 4: DigitalOcean App Platform

**Best for:** Managed simplicity with DO ecosystem

### Pricing
- **Basic**: $5/month per service
- **Professional**: $12/month per service
- **PostgreSQL**: $15/month (managed)

### Features
- Managed PostgreSQL with backups
- Auto-scaling (if needed later)
- Built-in monitoring
- CDN included

### Estimated Cost for SPISA
- API: $12/month
- Frontend: $5/month
- PostgreSQL: $15/month
- **Total: ~$32/month**

### Pros
✅ Well-documented  
✅ Good uptime SLA  
✅ Easy to scale later  
✅ Managed database backups  
✅ Integrated monitoring  

### Cons
❌ More expensive than VPS  
❌ Limited regions  
❌ Overkill for 2 users  

---

## Option 5: AWS Lightsail

**Best for:** AWS ecosystem, simple managed service

### Pricing
- **Instance**: $10-20/month
- **Managed PostgreSQL**: $15/month
- **Static IP**: Free
- **Total: ~$25-35/month**

### Pros
✅ AWS reliability  
✅ Easy to upgrade to full AWS later  
✅ Good documentation  
✅ Predictable pricing  

### Cons
❌ More expensive than standalone VPS  
❌ AWS learning curve  
❌ Region limitation (latency from Argentina)  

---

## Option 6: Azure App Service

**Best for:** Microsoft ecosystem, enterprise features

### Pricing
- **App Service (B1)**: $13/month
- **Azure Database for PostgreSQL**: $42/month (basic)
- **Total: ~$55/month**

### Pros
✅ Enterprise-grade  
✅ .NET native support  
✅ Good for Microsoft shops  
✅ Azure DevOps integration  

### Cons
❌ Most expensive option  
❌ Overkill for 2 users  
❌ Complex pricing  
❌ Steep learning curve  

---

## Option 7: On-Premises (Existing Infrastructure)

**Best for:** Already have local server, no internet dependency

### Requirements
- Windows Server or Linux server
- Static IP or VPN access
- UPS for power backup
- Manual backup strategy

### Pros
✅ No monthly hosting costs  
✅ Complete control  
✅ Data stays on-premises  
✅ No internet dependency (after setup)  

### Cons
❌ Hardware maintenance  
❌ Electricity costs  
❌ No redundancy  
❌ Manual backups required  
❌ Remote access complexity  
❌ Limited by local infrastructure  

---

## Recommended Solution for SPISA

### 🏆 Primary Recommendation: Self-Hosted VPS

**Provider:** Contabo or Hetzner  
**Plan:** 4 vCPU, 8GB RAM, 100GB SSD  
**Cost:** €10-12/month (~$11-13 USD)  
**Region:** Europe (acceptable latency to Argentina)

**Why?**
1. **Cost-Effective**: Lowest cost for resources provided
2. **Full Control**: Can customize everything
3. **Scalable**: Easy to upgrade resources
4. **Predictable**: Fixed monthly cost
5. **Portable**: Can migrate anywhere

### 🥈 Alternative: Railway

**Cost:** ~$10-15/month  
**Best if:** You want zero DevOps work and fastest setup

**Why?**
1. Deploy in <10 minutes
2. Auto-scaling available
3. Good developer experience
4. GitHub integration

---

## Detailed VPS Setup Guide

### 1. Provider Selection

**Recommended: Contabo**
```
VPS M SSD
- 4 vCPU Cores
- 8 GB RAM
- 200 GB NVMe
- €8.99/month
- Location: Germany (EU)
- Latency to Argentina: ~200-250ms (acceptable)
```

**Alternative: Hetzner**
```
CX31
- 2 vCPU
- 8 GB RAM
- 80 GB SSD
- €9.51/month
- Location: Germany/Finland
```

### 2. Initial Server Setup

```bash
# 1. SSH into server
ssh root@your-server-ip

# 2. Update system
apt update && apt upgrade -y

# 3. Create non-root user
adduser spisa
usermod -aG sudo spisa
usermod -aG docker spisa

# 4. Setup SSH key authentication (from your local machine)
ssh-copy-id spisa@your-server-ip

# 5. Disable root SSH login
nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
systemctl restart ssh

# 6. Install fail2ban (security)
apt install fail2ban -y
systemctl enable fail2ban
systemctl start fail2ban
```

### 3. Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose V2
apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

### 4. Deploy SPISA

```bash
# Create application directory
sudo mkdir -p /opt/spisa
sudo chown spisa:spisa /opt/spisa
cd /opt/spisa

# Clone repository
git clone https://github.com/yourorg/spisa-new.git .

# Setup environment
cp env.example .env
nano .env
# Update with production values

# Start services
docker compose up -d

# Check logs
docker compose logs -f
```

### 5. Setup Nginx & SSL

```bash
# Install Nginx
apt install nginx certbot python3-certbot-nginx -y

# Create Nginx config
nano /etc/nginx/sites-available/spisa
```

```nginx
server {
    listen 80;
    server_name spisa.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name spisa.yourdomain.com;

    # SSL certificates (managed by certbot)
    ssl_certificate /etc/letsencrypt/live/spisa.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/spisa.yourdomain.com/privkey.pem;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:5000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/spisa /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Get SSL certificate
certbot --nginx -d spisa.yourdomain.com
```

### 6. Automated Backups

Create `/opt/spisa/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/spisa/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker compose exec -T postgres pg_dump -U spisa_user spisa > $BACKUP_DIR/spisa_$DATE.sql

# Compress
gzip $BACKUP_DIR/spisa_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "spisa_*.sql.gz" -mtime +30 -delete

# Optional: Upload to cloud storage (rclone, aws s3, etc.)
# rclone copy $BACKUP_DIR remote:spisa-backups/
```

```bash
# Make executable
chmod +x /opt/spisa/backup.sh

# Add to crontab (runs daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /opt/spisa/backup.sh
```

### 7. Monitoring Setup (Optional)

**Uptime Kuma (Self-Hosted)**

```bash
cd /opt
git clone https://github.com/louislam/uptime-kuma.git
cd uptime-kuma
npm run setup
pm2 start server/server.js --name uptime-kuma
pm2 save
pm2 startup
```

Access at: `http://your-server-ip:3001`

---

## Cost Comparison Summary

| Option | Setup | Monthly | Annual | Notes |
|--------|-------|---------|--------|-------|
| **Contabo VPS** | 1-2 hours | $11 | $132 | Best value ⭐ |
| **Railway** | 10 min | $12 | $144 | Easiest setup |
| **Render** | 15 min | $14 | $168 | Good middle ground |
| **DigitalOcean** | 30 min | $32 | $384 | Managed DB expensive |
| **AWS Lightsail** | 1 hour | $30 | $360 | AWS ecosystem |
| **Azure** | 1 hour | $55 | $660 | Overkill for 2 users |
| **On-Prem** | 4 hours | $0 | $0 | + hardware + electricity |

---

## Final Recommendation

**For SPISA with 2 users:**

### Option A: Technical Team Available
**→ Self-Hosted VPS (Contabo/Hetzner)**
- **Cost:** ~$11/month
- **Setup Time:** 2 hours
- **Pros:** Full control, lowest cost, scalable
- **Best if:** Someone comfortable with Linux/Docker

### Option B: Zero Maintenance Desired
**→ Railway.app**
- **Cost:** ~$12/month
- **Setup Time:** 10 minutes
- **Pros:** Zero DevOps, auto-deploy, simple
- **Best if:** Want to focus 100% on application, not infrastructure

---

## Next Steps

1. **Choose deployment option** based on your team's skills
2. **Register domain** (e.g., spisa.com or spisa.yourdomain.com)
3. **Set up DNS** (point to server IP or platform)
4. **Deploy database** (run schema.sql and seed.sql)
5. **Run migration tool** (to migrate legacy data)
6. **Deploy application** (using chosen method)
7. **Test thoroughly** (user acceptance testing)
8. **Train users** (on new system)
9. **Go live!**

---

## Appendix: Domain & DNS Setup

### Domain Registration
- **Namecheap**: $8-12/year
- **Google Domains**: $12/year
- **NIC Argentina (.ar)**: ~$10/year

### DNS Configuration (Example: Cloudflare)

```
A     spisa            your-server-ip
CNAME www              spisa.yourdomain.com
```

### SSL Certificate (Let's Encrypt - Free)

```bash
sudo certbot --nginx -d spisa.yourdomain.com -d www.spisa.yourdomain.com
```

Auto-renewal:
```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

**Questions? Need help choosing?** Let me know your priorities (cost vs. simplicity vs. control) and I can recommend the best fit.

