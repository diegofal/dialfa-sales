# SPISA - Sistema de Gestión de Inventario y Ventas

**Versión:** 2.0  
**Fecha:** Octubre 2025  
**Estado:** ✅ Backend + Frontend + Data Migration Completados

---

## 🚀 Quick Start

**¿Primera vez? Lee la guía completa:** [START_GUIDE.md](./START_GUIDE.md)

**Inicio rápido (Windows):**
```batch
start-all.bat
```

**Inicio rápido (Linux/macOS/Git Bash):**
```bash
./start-all.sh
```

Luego abre: http://localhost:3000 (login: `admin` / `admin123`)

---

## 📋 Descripción

Sistema modernizado de gestión de inventario, ventas y facturación. Migrado desde .NET Framework 3.5/Windows Forms a una arquitectura web moderna con .NET 8 y React/Next.js.

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────┐
│   Frontend (Next.js 14)             │
│   - React 18 + TypeScript           │
│   - TailwindCSS + shadcn/ui         │
│   - React Query + Zustand           │
└──────────────┬──────────────────────┘
               │ HTTP/REST + JWT
┌──────────────▼──────────────────────┐
│   Backend (.NET 8 Web API)          │
│   - Clean Architecture + DDD        │
│   - CQRS (MediatR)                  │
│   - FluentValidation + AutoMapper   │
└──────────────┬──────────────────────┘
               │ EF Core 8
┌──────────────▼──────────────────────┐
│   PostgreSQL 16                     │
│   - 268,817 registros migrados      │
│   - Soft deletes + Audit trails     │
└─────────────────────────────────────┘
```

---

## ✨ Características Principales

### ✅ Completado
- **Autenticación JWT** - Segura y stateless
- **Gestión de Clientes** - CRUD completo (397 clientes)
- **Gestión de Categorías** - CRUD completo (12 categorías)
- **Data Migration** - 268,817 registros desde SQL Server
- **Dashboard** - Estadísticas y accesos rápidos
- **API REST** - Documentada con Swagger
- **UI Moderna** - Responsive y accesible
- **Scripts de inicio** - Fácil setup con start-all.bat/.sh

### ⏳ Pendiente
- Gestión de Artículos
- Módulo de Pedidos
- Facturación
- Remitos
- Reportes
- Cuenta Corriente

---

## 🚀 Inicio Rápido

### Requisitos Previos
- Node.js 18+
- .NET 8 SDK
- Docker (para PostgreSQL)

### 1. Clonar y Setup
```bash
git clone [repository]
cd spisa-new
```

### 2. Backend
```bash
cd backend/src/Spisa.WebApi
dotnet restore
dotnet run
```
**URL:** http://localhost:5021

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
**URL:** http://localhost:3000

### 4. Acceso
- **Usuario:** `admin`
- **Contraseña:** `admin123`

---

## 📂 Estructura del Proyecto

```
spisa-new/
├── backend/                      # API .NET 8
│   ├── src/
│   │   ├── Spisa.Domain/         # Entidades y lógica de negocio
│   │   ├── Spisa.Application/    # CQRS, DTOs, Validators
│   │   ├── Spisa.Infrastructure/ # EF Core, Repositories, JWT
│   │   └── Spisa.WebApi/         # Controllers, Middleware
│   └── tools/
│       └── Spisa.DataMigration/  # Herramienta de migración
├── frontend/                     # Next.js 14
│   ├── app/                      # App Router
│   ├── components/               # React components
│   ├── lib/                      # API clients, hooks
│   ├── store/                    # Zustand stores
│   └── types/                    # TypeScript types
├── database/                     # SQL scripts
├── docs/                         # Documentación
├── MIGRATION_PLAN.md            # Plan de migración
├── MIGRATION_STATUS.md          # Estado actual
├── FRONTEND_GUIDE.md            # Guía del frontend
└── README.md                    # Este archivo
```

---

## 🛠️ Stack Tecnológico

### Backend
| Componente | Tecnología | Versión |
|------------|------------|---------|
| Runtime | .NET | 8.0 LTS |
| Web Framework | ASP.NET Core | 8.0 |
| ORM | Entity Framework Core | 8.0 |
| Base de Datos | PostgreSQL | 16+ |
| CQRS | MediatR | 12.x |
| Validación | FluentValidation | 11.x |
| Mapping | AutoMapper | 13.x |
| Logging | Serilog | 3.x |
| Auth | JWT Tokens | - |
| Testing | xUnit + Moq | Latest |

### Frontend
| Componente | Tecnología | Versión |
|------------|------------|---------|
| Framework | Next.js | 14+ |
| Lenguaje | TypeScript | 5.x |
| UI Library | React | 18+ |
| Estilos | TailwindCSS | 3.x |
| Componentes | shadcn/ui | Latest |
| State (Server) | React Query | 5.x |
| State (Client) | Zustand | 4.x |
| Formularios | React Hook Form | 7.x |
| Validación | Zod | 3.x |
| HTTP Client | Axios | 1.x |

---

## 📊 Base de Datos

### Estadísticas
- **Total Registros:** 268,817
- **Clientes:** 397
- **Artículos:** 1,797
- **Pedidos:** 39,065
- **Facturas:** 32,575
- **Remitos:** 27,636
- **Otros:** ~165,000

### Características
- Soft deletes (deleted_at)
- Audit trails (created_at, updated_at, created_by, updated_by)
- Constraints de integridad
- Índices optimizados
- Naming convention: snake_case

---

## 🔐 Seguridad

- **JWT Authentication** con tokens de 60 minutos
- **Password hashing** con BCrypt
- **CORS** configurado para desarrollo
- **Input validation** en backend (FluentValidation)
- **SQL Injection protection** (EF Core parametrizado)
- **XSS protection** (React escapa por defecto)

---

## 📖 Documentación

- **[MIGRATION_PLAN.md](MIGRATION_PLAN.md)** - Plan completo de migración
- **[MIGRATION_STATUS.md](MIGRATION_STATUS.md)** - Estado y progreso
- **[FRONTEND_GUIDE.md](FRONTEND_GUIDE.md)** - Guía de usuario del frontend
- **Swagger UI:** http://localhost:5021/swagger

---

## 🧪 Testing

### Backend (Pendiente)
```bash
cd backend
dotnet test
```

### Frontend (Pendiente)
```bash
cd frontend
npm run test
```

---

## 📦 Deployment

### Docker (Recomendado)
```bash
docker compose up -d
```

### Manual
Ver documentación en `MIGRATION_PLAN.md` sección "Deployment Plan"

---

## 📈 Progreso del Proyecto

```
Phase 1: Foundation & Setup    ✅ ████████████ 100%
Phase 2: Core Modules          🚧 ████░░░░░░░░  33%
  ├─ Clients                   ✅ ████████████ 100%
  ├─ Categories                ⏭️ ░░░░░░░░░░░░   0%
  └─ Articles                  ⏭️ ░░░░░░░░░░░░   0%
Phase 3: Sales & Documents     ⏭️ ░░░░░░░░░░░░   0%
Phase 4: Financial & Reports   ⏭️ ░░░░░░░░░░░░   0%
Phase 5: Deployment           ✅ ██████████░░  83%

OVERALL: ████████░░░░ 45%
```

---

## 🤝 Contribución

### Branch Strategy
- `main` - Producción
- `develop` - Desarrollo
- `feature/*` - Nuevas características
- `bugfix/*` - Correcciones

### Commits
Usar Conventional Commits:
- `feat:` - Nueva característica
- `fix:` - Corrección de bug
- `docs:` - Documentación
- `refactor:` - Refactorización
- `test:` - Tests

---

## 📝 Licencia

[Definir licencia]

---

## 👥 Equipo

- **Desarrollo:** [Tu nombre]
- **Arquitectura:** [Tu nombre]
- **Data Migration:** [Tu nombre]

---

## 📞 Contacto

Para soporte o consultas: [email/contacto]

---

## 🎯 Roadmap

### Q4 2025
- [x] Backend Architecture
- [x] Data Migration
- [x] Frontend Base
- [x] Clients Module
- [ ] Articles Module
- [ ] Orders Module

### Q1 2026
- [ ] Invoicing Module
- [ ] Reports
- [ ] Mobile Optimization
- [ ] Production Deployment

---

**¡Sistema operativo y listo para usar!** 🚀

*Última actualización: Octubre 2, 2025*
