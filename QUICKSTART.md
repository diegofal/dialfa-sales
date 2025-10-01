# SPISA Quick Start Guide

Get the SPISA development environment running in 5 minutes.

## Prerequisites

- Docker Desktop installed and running
- Git (optional, for version control)

## Initial Setup

### 1. Clone/Navigate to Project

```bash
cd D:\Dialfa\spisa-new
```

### 2. Create Environment File

```bash
# Copy the example environment file
copy env.example .env

# Edit .env with your preferred text editor
notepad .env
```

**Important:** Change at least the `DB_PASSWORD` and `JWT_SECRET` values.

### 3. Start PostgreSQL Database

```bash
# Start just the database
docker compose up -d postgres

# Check if it's running
docker compose ps

# View logs
docker compose logs -f postgres
```

### 4. Verify Database Setup

The database will automatically:
- Create the `spisa` database
- Run all schema migrations (schema.sql)
- Load initial data (seed.sql)

**Connect to verify:**
- Host: `localhost`
- Port: `5432`
- Database: `spisa`
- User: `spisa_user`
- Password: (from your .env file)

### 5. (Optional) Start pgAdmin

```bash
# Start database management UI
docker compose --profile tools up -d pgadmin

# Access pgAdmin at: http://localhost:5050
# Login: admin@spisa.local / admin (from your .env)
```

**Add connection in pgAdmin:**
1. Right-click "Servers" → Register → Server
2. General tab: Name = "SPISA Local"
3. Connection tab:
   - Host: `postgres` (or `localhost` if connecting from outside Docker)
   - Port: `5432`
   - Database: `spisa`
   - Username: `spisa_user`
   - Password: (from .env)

## Database Verification

### Check Tables

```bash
docker compose exec postgres psql -U spisa_user -d spisa -c "\dt"
```

Expected output: List of all tables (users, articles, clients, etc.)

### View Seed Data

```bash
# Check provinces
docker compose exec postgres psql -U spisa_user -d spisa -c "SELECT * FROM provinces LIMIT 5;"

# Check default admin user
docker compose exec postgres psql -U spisa_user -d spisa -c "SELECT username, email, role FROM users;"

# Check categories
docker compose exec postgres psql -U spisa_user -d spisa -c "SELECT code, name FROM categories;"
```

## Default Credentials

**Admin User:**
- Username: `admin`
- Password: `Admin123!`
- **⚠️ CHANGE THIS IMMEDIATELY AFTER FIRST LOGIN**

## Next Steps

1. **Review the migration plan:** See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)
2. **Set up backend:** Coming soon (Phase 1 implementation)
3. **Set up frontend:** Coming soon (Phase 1 implementation)

## Common Commands

### Database Management

```bash
# Stop database
docker compose stop postgres

# Restart database
docker compose restart postgres

# View database logs
docker compose logs -f postgres

# Backup database
docker compose exec postgres pg_dump -U spisa_user spisa > backup.sql

# Restore database
docker compose exec -T postgres psql -U spisa_user spisa < backup.sql

# Reset database (WARNING: deletes all data)
docker compose down -v
docker compose up -d postgres
```

### Troubleshooting

**Database won't start:**
```bash
# Check logs
docker compose logs postgres

# Common issue: port 5432 already in use
# Solution: Stop other PostgreSQL instance or change port in docker-compose.yml
```

**Can't connect to database:**
```bash
# Check if container is running
docker compose ps

# Check if database is healthy
docker compose exec postgres pg_isready -U spisa_user

# Try connecting with explicit host
psql -h localhost -p 5432 -U spisa_user -d spisa
```

**Schema not created:**
```bash
# Recreate database
docker compose down -v
docker compose up -d postgres

# Check init logs
docker compose logs postgres | grep "init"
```

## File Structure

```
spisa-new/
├── database/
│   ├── schema.sql          ← Complete database schema
│   └── seed.sql            ← Initial data (provinces, etc.)
├── docker-compose.yml      ← Docker services configuration
├── env.example             ← Copy to .env
├── MIGRATION_PLAN.md       ← Full migration strategy
├── QUICKSTART.md           ← This file
└── README.md               ← Project overview
```

## Support

For detailed architecture and implementation plan, see:
- [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) - Complete migration strategy
- [README.md](./README.md) - Project overview

## What's Next?

With the database running, you're ready to:

1. **Phase 1 (Weeks 1-2):**
   - [ ] Initialize .NET 8 backend solution
   - [ ] Initialize Next.js frontend
   - [ ] Implement authentication
   - [ ] Setup CI/CD

2. **Phase 2 (Weeks 3-5):**
   - [ ] Categories module
   - [ ] Articles module
   - [ ] Clients module

See the full timeline in [MIGRATION_PLAN.md](./MIGRATION_PLAN.md#implementation-phases).

---

**Current Status:** ✅ Database Ready | ⏳ Backend Pending | ⏳ Frontend Pending

