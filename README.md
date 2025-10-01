# SPISA - Sistema de Gestión

Modern inventory and sales management system built with .NET 8, PostgreSQL, and Next.js.

## Overview

SPISA is a complete business management solution for inventory control, client management, sales orders, invoicing, and accounting. This is a complete rewrite of a legacy Windows Forms application using modern web technologies.

## Technology Stack

### Backend
- .NET 8 (LTS)
- ASP.NET Core Web API
- Entity Framework Core
- PostgreSQL 16+
- MediatR (CQRS)
- FluentValidation
- AutoMapper
- Serilog

### Frontend
- Next.js 14+
- React 18+
- TypeScript
- TailwindCSS
- shadcn/ui
- React Query
- Zustand

## Project Status

🚧 **Currently in Planning/Setup Phase**

See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) for complete migration strategy and timeline.

## Quick Start

### Prerequisites

- Docker & Docker Compose
- .NET 8 SDK (for local development)
- Node.js 18+ (for local development)
- PostgreSQL 16+ (optional, can use Docker)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourorg/spisa-new.git
   cd spisa-new
   ```

2. **Start services with Docker Compose**
   ```bash
   docker compose up -d
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - API: http://localhost:5000
   - Swagger: http://localhost:5000/swagger

### Local Development (without Docker)

**Backend:**
```bash
cd backend
dotnet restore
dotnet run --project src/Spisa.WebApi
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
spisa-new/
├── backend/           # .NET 8 Web API
│   ├── src/
│   │   ├── Spisa.Domain/
│   │   ├── Spisa.Application/
│   │   ├── Spisa.Infrastructure/
│   │   └── Spisa.WebApi/
│   └── tests/
├── frontend/          # Next.js application
│   └── src/
├── database/          # SQL scripts
├── docs/              # Documentation
└── docker-compose.yml
```

## Core Modules

- **Inventory Management** - Articles, categories, stock tracking
- **Client Management** - Customer data, discounts, balances
- **Sales Orders** - Order creation and management
- **Invoicing** - Invoice generation and PDF printing
- **Delivery Notes** - Shipment documentation
- **Current Accounts** - Payment tracking and statements
- **Reporting** - Sales, inventory, and financial reports

## Documentation

- [Migration Plan](./MIGRATION_PLAN.md) - Complete migration strategy
- [API Documentation](./docs/api/) - API endpoints and schemas
- [User Guide](./docs/user-guide/) - End-user documentation

## Development Workflow

1. Create feature branch from `main`
2. Implement changes following Clean Architecture
3. Write tests (unit, integration)
4. Submit pull request
5. Code review
6. Merge to main (triggers CI/CD)

## Testing

```bash
# Backend tests
cd backend
dotnet test

# Frontend tests
cd frontend
npm test
```

## Deployment

Production deployment uses Docker Compose. See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md#deployment-plan) for details.

## License

[Your License Here]

## Contributors

- [Your Name] - Project Lead

---

**Note:** This is an active migration project. The legacy system source code is in the `/spisa` directory for reference.

