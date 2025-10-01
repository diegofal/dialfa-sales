# SPISA Migration Plan - Legacy to Modern Stack

**Document Version:** 1.0  
**Date:** October 1, 2025  
**Status:** Planning Phase

---

## Executive Summary

This document outlines the complete migration strategy for SPISA (Sistema de Gestión) from a legacy .NET Framework 3.5/Windows Forms application to a modern web-based system using .NET 8, PostgreSQL, and React/Next.js.

**Migration Goals:**
- Modernize technology stack while preserving business logic
- Improve maintainability and scalability
- Enable future mobile app development
- Implement proper architecture patterns (Clean Architecture + DDD)
- Migrate from SQL Server to PostgreSQL
- Provide web-based UI accessible from any device

**Timeline:** 16 weeks (4 months)  
**Team Size:** 1 full-time developer + domain expert consultation  
**Concurrent Users:** 2

---

## Table of Contents

1. [Current System Analysis](#current-system-analysis)
2. [Target Architecture](#target-architecture)
3. [Technology Stack](#technology-stack)
4. [Database Redesign](#database-redesign)
5. [Data Migration Strategy](#data-migration-strategy)
6. [Project Structure](#project-structure)
7. [Implementation Phases](#implementation-phases)
8. [Risk Assessment](#risk-assessment)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Plan](#deployment-plan)

---

## Current System Analysis

### Technology Stack (Legacy)

| Component | Technology | Version | Status |
|-----------|-----------|---------|--------|
| UI Framework | Windows Forms | .NET 3.5/4.0 | Obsolete |
| UI Controls | Infragistics | 7.2 | Discontinued |
| Data Access | Enterprise Library | 3.1 | Deprecated |
| ORM | Entity Framework | .edmx | Legacy |
| Database | SQL Server | 2008+ | Outdated |
| Architecture | Active Record | N/A | Anti-pattern |

### Core Business Modules

1. **Inventory Management (Artículos)**
   - Product catalog with categories
   - Stock quantity tracking
   - Pricing management
   - Search and filtering

2. **Client Management (Clientes)**
   - Client registry with tax information (CUIT)
   - Custom discounts per category
   - Province/location data
   - Current account balance
   - Transport assignment

3. **Sales Orders (Nota de Pedido)**
   - Order creation and management
   - Line items with pricing
   - Special discounts
   - Delivery date tracking

4. **Invoicing (Facturas)**
   - Invoice generation from orders
   - USD exchange rate support
   - Print/PDF generation
   - Cancellation tracking

5. **Delivery Notes (Remitos)**
   - Shipment documentation
   - Transport information (weight, packages)
   - Linked to sales orders

6. **Current Accounts (Cuenta Corriente)**
   - Movement tracking (charges/payments)
   - Payment methods (cash, check, etc.)
   - Check data storage
   - Balance calculations

7. **Reporting**
   - Client lists and searches
   - Inventory reports
   - Sales tracking
   - Account statements

### Critical Issues Identified

**Architecture Problems:**
- Business logic mixed with data access (Active Record pattern)
- Static methods everywhere (no dependency injection)
- Tight coupling to UI framework
- No separation of concerns
- No repository pattern

**Data Layer Issues:**
- Manual ADO.NET with stored procedures
- SQL injection vulnerabilities
- No audit trail (CreatedAt, UpdatedAt)
- Weak referential integrity
- Calculated values stored (Saldo)
- Inconsistent naming conventions
- Missing indexes on foreign keys

**Code Quality:**
- No unit tests
- Exception handling via Enterprise Library
- Global error handling via email
- No input validation framework
- Duplicate code across forms

**Deployment:**
- Manual installation
- No version control for database
- No automated deployment
- Configuration in App.config

---

## Target Architecture

### Architectural Pattern: Clean Architecture + DDD

```
┌─────────────────────────────────────────────────────┐
│                   Presentation                       │
│            (React/Next.js Frontend)                  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                  API Layer                           │
│           (ASP.NET Core Web API)                     │
│  • Controllers                                       │
│  • Middleware (Auth, Error Handling)                 │
│  • Filters & Validation                              │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              Application Layer                       │
│                  (Use Cases)                         │
│  • CQRS Commands & Queries (MediatR)                │
│  • DTOs & Mappers (AutoMapper)                      │
│  • Validators (FluentValidation)                    │
│  • Business Logic Orchestration                      │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│               Domain Layer                           │
│              (Core Business)                         │
│  • Entities (Cliente, Articulo, Factura)            │
│  • Value Objects (Money, CUIT, Address)             │
│  • Domain Events                                     │
│  • Repository Interfaces                             │
│  • Domain Services                                   │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│            Infrastructure Layer                      │
│          (External Concerns)                         │
│  • Database Context (EF Core)                       │
│  • Repository Implementations                        │
│  • External Services (Email, PDF)                   │
│  • File Storage                                      │
└─────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Dependency Rule**: Dependencies point inward (Domain has no external dependencies)
2. **CQRS Pattern**: Separate read and write operations
3. **Repository Pattern**: Abstract data access
4. **Dependency Injection**: Constructor-based DI throughout
5. **Domain-Driven Design**: Rich domain models with behavior
6. **API-First**: RESTful API enables future mobile apps

---

## Technology Stack

### Backend Stack

| Component | Technology | Version | Justification |
|-----------|-----------|---------|---------------|
| Runtime | .NET | 8.0 (LTS) | Modern, performant, long-term support |
| API Framework | ASP.NET Core | 8.0 | Industry standard for APIs |
| ORM | Entity Framework Core | 8.0 | Code-first, migrations, LINQ |
| Database | PostgreSQL | 16+ | Open-source, robust, JSONB support |
| CQRS/Mediator | MediatR | 12.x | Clean command/query separation |
| Validation | FluentValidation | 11.x | Readable, testable validation |
| Mapping | AutoMapper | 13.x | DTO mapping automation |
| Logging | Serilog | 3.x | Structured logging |
| Auth | JWT Tokens | - | Stateless authentication |
| Testing | xUnit + Moq | Latest | Unit and integration tests |

**Dependencies NOT included:**
- ❌ Redis - Unnecessary for 2 users (can add later if needed)
- ❌ RabbitMQ/Message Queue - No async processing requirements
- ❌ IdentityServer - Simple JWT sufficient for 2 users

### Frontend Stack

| Component | Technology | Version | Justification |
|-----------|-----------|---------|---------------|
| Framework | Next.js | 14+ | SSR, routing, API routes, optimizations |
| Language | TypeScript | 5.x | Type safety, better DX |
| UI Library | React | 18+ | Industry standard |
| Styling | TailwindCSS | 3.x | Utility-first, fast development |
| Components | shadcn/ui | Latest | Accessible, customizable components |
| State (Server) | React Query | 5.x | Server state, caching, mutations |
| State (Client) | Zustand | 4.x | Simple, lightweight state management |
| Forms | React Hook Form | 7.x | Performant form handling |
| Validation | Zod | 3.x | TypeScript-first schema validation |
| API Client | Axios | 1.x | HTTP client with interceptors |
| PWA | next-pwa | 5.x | Offline capability, caching |

### DevOps & Tooling

| Component | Technology | Justification |
|-----------|-----------|---------------|
| Containerization | Docker + Docker Compose | Consistent environments |
| CI/CD | GitHub Actions | Free, integrated with repo |
| Version Control | Git + GitHub | Industry standard |
| API Documentation | Swagger/OpenAPI | Auto-generated API docs |
| Database Migrations | EF Core Migrations | Version-controlled schema |
| Code Quality | SonarLint | Static analysis |

### Development Tools

- **IDE**: Visual Studio Code / Visual Studio 2022
- **API Testing**: Postman / Thunder Client
- **Database Tool**: pgAdmin / DBeaver
- **Package Manager (Backend)**: NuGet
- **Package Manager (Frontend)**: npm / pnpm

---

## Database Redesign

### Design Principles

1. **Normalization**: Proper 3NF normalization
2. **Audit Trails**: All tables include created_at, updated_at, created_by, updated_by
3. **Soft Deletes**: deleted_at for data recovery
4. **PostgreSQL Features**: Use JSONB, full-text search, materialized views
5. **Indexing**: Strategic indexes on foreign keys and search fields
6. **Constraints**: Unique constraints on business keys, CHECK constraints for validation
7. **Naming**: Consistent snake_case, plural table names
8. **Calculated Fields**: Remove stored calculations (calculate on-demand or use views)

### Schema Comparison

**Legacy Schema Issues → Modern Solutions:**

| Issue | Legacy Approach | Modern Solution |
|-------|----------------|-----------------|
| Naming inconsistency | Mixed case (IdCliente vs idArticulo) | Consistent snake_case |
| No audit trail | Missing CreatedAt/UpdatedAt | All tables have audit fields |
| Stored calculations | Saldo in Clientes table | Calculated from movements or materialized view |
| No soft deletes | Hard deletes lose data | deleted_at timestamp |
| Missing indexes | Only primary keys | Strategic indexes on FKs and search fields |
| Weak validation | No constraints | CHECK constraints, proper foreign keys |
| Poor money handling | Inconsistent decimal precision | DECIMAL(18,4) consistently |
| No business keys | Only surrogate keys | Unique constraints on codes |

### Complete PostgreSQL Schema

See `database/schema.sql` for the complete schema definition.

**Key Tables:**

1. **users** - Authentication and user management (NEW)
2. **categories** - Product categories with default discounts
3. **articles** - Inventory items with enhanced fields
4. **clients** - Customer data with proper constraints
5. **client_discounts** - Per-client category discounts
6. **sales_orders** - Sales orders with denormalized totals
7. **sales_order_items** - Order line items
8. **invoices** - Invoice documents linked to orders
9. **delivery_notes** - Shipment documentation
10. **stock_movements** - Complete inventory movement tracking (NEW)
11. **account_movements** - Current account transactions
12. **provinces** - Geographic data
13. **tax_conditions** - IVA conditions
14. **operation_types** - Business operation types
15. **payment_methods** - Payment method lookup
16. **transporters** - Shipping companies

### Materialized Views for Performance

```sql
-- Client balances (replaces stored Saldo)
CREATE MATERIALIZED VIEW client_balances AS
SELECT 
    c.id,
    c.business_name,
    COALESCE(SUM(am.amount), 0) as current_balance,
    MAX(am.movement_date) as last_movement_date
FROM clients c
LEFT JOIN account_movements am ON am.client_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.business_name;

-- Refresh strategy: After each payment/invoice posting
REFRESH MATERIALIZED VIEW CONCURRENTLY client_balances;
```

---

## Data Migration Strategy

### Migration Phases

**Phase 1: Schema Creation**
1. Create PostgreSQL database
2. Run schema creation scripts
3. Populate lookup tables (provinces, tax_conditions, etc.)
4. Create indexes and constraints
5. Validate schema integrity

**Phase 2: Data Extraction**
1. Export data from SQL Server to CSV/JSON
2. Clean and validate data
3. Handle encoding issues (Spanish characters)
4. Identify orphaned records
5. Document data quality issues

**Phase 3: Data Transformation**
1. Map legacy IDs to new IDs
2. Transform data types (varchar → proper types)
3. Calculate derived data (balance from movements)
4. Handle null values
5. Validate business rules

**Phase 4: Data Loading**
1. Load in dependency order (parents before children)
2. Maintain referential integrity
3. Set ID sequences correctly
4. Verify row counts
5. Run integrity checks

**Phase 5: Validation**
1. Compare record counts
2. Validate relationships
3. Test queries
4. User acceptance testing
5. Rollback plan verification

### Migration Tool Architecture

**Location:** `backend/tools/Spisa.DataMigration/`

```csharp
// Migration orchestrator
public class MigrationOrchestrator
{
    private readonly ILegacyDataReader _legacyReader;     // SQL Server
    private readonly IModernDataWriter _modernWriter;     // PostgreSQL
    private readonly IMigrationValidator _validator;
    private readonly ILogger _logger;
    
    public async Task<MigrationResult> ExecuteMigration()
    {
        // 1. Pre-migration validation
        await _validator.ValidateLegacyData();
        
        // 2. Migrate lookup tables
        await MigrateLookupTables();
        
        // 3. Migrate master data
        await MigrateCategories();
        await MigrateArticles();
        await MigrateClients();
        await MigrateTransporters();
        
        // 4. Migrate transactional data
        await MigrateSalesOrders();
        await MigrateInvoices();
        await MigrateDeliveryNotes();
        
        // 5. Migrate financial data
        await MigrateAccountMovements();
        
        // 6. Recalculate derived data
        await RecalculateStockQuantities();
        await RefreshMaterializedViews();
        
        // 7. Post-migration validation
        await _validator.ValidateMigratedData();
        
        // 8. Generate migration report
        return await GenerateMigrationReport();
    }
}
```

### Migration Mapping Examples

**Clients (Clientes → clients):**

```csharp
public class ClientMigrationMapper
{
    public ModernClient MapLegacyClient(LegacyCliente legacy)
    {
        return new ModernClient
        {
            // Direct mappings
            Id = legacy.IdCliente,
            Code = legacy.Codigo,
            BusinessName = legacy.RazonSocial,
            Address = legacy.Domicilio,
            City = legacy.Localidad,
            Cuit = CleanCuit(legacy.CUIT),
            
            // Foreign key mappings
            ProvinceId = legacy.IdProvincia,
            TaxConditionId = legacy.IdCondicionIVA,
            OperationTypeId = legacy.IdOperatoria,
            TransporterId = legacy.IdTransportista,
            
            // Audit fields
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            DeletedAt = null,
            
            // Note: Saldo is NOT migrated - will be recalculated
        };
    }
    
    private string CleanCuit(string cuit)
    {
        // Remove dashes and spaces: "20-12345678-9" → "20123456789"
        return new string(cuit.Where(char.IsDigit).ToArray());
    }
}
```

**Articles (Articulos → articles):**

```csharp
public class ArticleMigrationMapper
{
    public ModernArticle MapLegacyArticle(LegacyArticulo legacy)
    {
        return new ModernArticle
        {
            Id = legacy.IdArticulo,
            CategoryId = legacy.IdCategoria,
            Code = legacy.Codigo.Trim(),
            Description = legacy.Descripcion.Trim(),
            Quantity = legacy.Cantidad,
            UnitPrice = legacy.PrecioUnitario,
            
            // New fields (defaults)
            CostPrice = null,  // Will need to be populated separately
            MinimumStock = 0,
            IsActive = true,
            
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
}
```

### Validation Queries

**Before Migration (SQL Server):**

```sql
-- Record counts
SELECT 'Clientes' as tabla, COUNT(*) as registros FROM Clientes
UNION ALL
SELECT 'Articulos', COUNT(*) FROM Articulos
UNION ALL
SELECT 'NotaPedidos', COUNT(*) FROM NotaPedidos
UNION ALL
SELECT 'Facturas', COUNT(*) FROM Facturas;

-- Data quality checks
SELECT 'Clientes sin provincia' as issue, COUNT(*) 
FROM Clientes WHERE IdProvincia IS NULL;

SELECT 'Articulos sin categoria' as issue, COUNT(*) 
FROM Articulos WHERE IdCategoria IS NULL;

SELECT 'CUIT invalido' as issue, COUNT(*) 
FROM Clientes WHERE LEN(CUIT) != 11 OR CUIT LIKE '%[^0-9]%';
```

**After Migration (PostgreSQL):**

```sql
-- Record count verification
SELECT 'clients' as table_name, COUNT(*) as record_count FROM clients WHERE deleted_at IS NULL
UNION ALL
SELECT 'articles', COUNT(*) FROM articles WHERE deleted_at IS NULL
UNION ALL
SELECT 'sales_orders', COUNT(*) FROM sales_orders WHERE deleted_at IS NULL
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices WHERE deleted_at IS NULL;

-- Referential integrity checks
SELECT 'Orphaned articles' as issue, COUNT(*) 
FROM articles a 
LEFT JOIN categories c ON a.category_id = c.id 
WHERE c.id IS NULL;

SELECT 'Orphaned clients' as issue, COUNT(*) 
FROM clients cl 
LEFT JOIN provinces p ON cl.province_id = p.id 
WHERE p.id IS NULL;

-- Business rule validation
SELECT 'Negative stock' as issue, COUNT(*) 
FROM articles WHERE quantity < 0;

SELECT 'Invalid CUIT' as issue, COUNT(*) 
FROM clients WHERE cuit !~ '^[0-9]{11}$';
```

### Rollback Strategy

1. **Database Snapshots**: Take PostgreSQL snapshot before migration
2. **Transaction Wrapping**: Entire migration in single transaction where possible
3. **Backup Scripts**: Automated backup of SQL Server before extraction
4. **Checkpoint System**: Save progress after each major table migration
5. **Rollback Commands**: Pre-written rollback scripts

```bash
# Create snapshot before migration
pg_dump -h localhost -U postgres spisa > backup_pre_migration_$(date +%Y%m%d).sql

# Rollback if needed
psql -h localhost -U postgres spisa < backup_pre_migration_20251001.sql
```

---

## Project Structure

```
spisa-new/
├── README.md
├── MIGRATION_PLAN.md (this file)
├── docker-compose.yml
├── .gitignore
├── .env.example
│
├── backend/
│   ├── Spisa.sln
│   ├── src/
│   │   ├── Spisa.Domain/                      # Core domain layer
│   │   │   ├── Entities/
│   │   │   │   ├── BaseEntity.cs
│   │   │   │   ├── Cliente.cs
│   │   │   │   ├── Articulo.cs
│   │   │   │   ├── Categoria.cs
│   │   │   │   ├── SalesOrder.cs
│   │   │   │   ├── Invoice.cs
│   │   │   │   └── ...
│   │   │   ├── ValueObjects/
│   │   │   │   ├── Money.cs
│   │   │   │   ├── CUIT.cs
│   │   │   │   ├── Address.cs
│   │   │   │   └── Discount.cs
│   │   │   ├── Enums/
│   │   │   │   ├── OrderStatus.cs
│   │   │   │   ├── MovementType.cs
│   │   │   │   └── UserRole.cs
│   │   │   ├── Events/
│   │   │   │   ├── OrderCreatedEvent.cs
│   │   │   │   ├── StockUpdatedEvent.cs
│   │   │   │   └── ...
│   │   │   ├── Exceptions/
│   │   │   │   ├── DomainException.cs
│   │   │   │   ├── InsufficientStockException.cs
│   │   │   │   └── ...
│   │   │   └── Interfaces/
│   │   │       ├── IArticuloRepository.cs
│   │   │       ├── IClienteRepository.cs
│   │   │       ├── IUnitOfWork.cs
│   │   │       └── ...
│   │   │
│   │   ├── Spisa.Application/                 # Application layer (use cases)
│   │   │   ├── Common/
│   │   │   │   ├── Behaviors/
│   │   │   │   │   ├── ValidationBehavior.cs
│   │   │   │   │   ├── LoggingBehavior.cs
│   │   │   │   │   └── TransactionBehavior.cs
│   │   │   │   ├── Interfaces/
│   │   │   │   │   ├── IEmailService.cs
│   │   │   │   │   ├── IPdfGenerator.cs
│   │   │   │   │   └── ICurrentUserService.cs
│   │   │   │   ├── Mappings/
│   │   │   │   │   └── MappingProfile.cs
│   │   │   │   ├── Models/
│   │   │   │   │   ├── PaginatedList.cs
│   │   │   │   │   └── Result.cs
│   │   │   │   └── Exceptions/
│   │   │   │       └── ValidationException.cs
│   │   │   │
│   │   │   ├── Articulos/
│   │   │   │   ├── Commands/
│   │   │   │   │   ├── CreateArticulo/
│   │   │   │   │   │   ├── CreateArticuloCommand.cs
│   │   │   │   │   │   ├── CreateArticuloCommandHandler.cs
│   │   │   │   │   │   └── CreateArticuloCommandValidator.cs
│   │   │   │   │   ├── UpdateArticulo/
│   │   │   │   │   └── DeleteArticulo/
│   │   │   │   ├── Queries/
│   │   │   │   │   ├── GetAllArticulos/
│   │   │   │   │   ├── GetArticuloById/
│   │   │   │   │   └── SearchArticulos/
│   │   │   │   └── DTOs/
│   │   │   │       ├── ArticuloDto.cs
│   │   │   │       ├── ArticuloListDto.cs
│   │   │   │       └── CreateArticuloDto.cs
│   │   │   │
│   │   │   ├── Clientes/
│   │   │   │   ├── Commands/
│   │   │   │   ├── Queries/
│   │   │   │   └── DTOs/
│   │   │   │
│   │   │   ├── SalesOrders/
│   │   │   ├── Invoices/
│   │   │   ├── Reports/
│   │   │   └── DependencyInjection.cs
│   │   │
│   │   ├── Spisa.Infrastructure/              # Infrastructure layer
│   │   │   ├── Persistence/
│   │   │   │   ├── Configurations/
│   │   │   │   │   ├── ArticuloConfiguration.cs
│   │   │   │   │   ├── ClienteConfiguration.cs
│   │   │   │   │   └── ...
│   │   │   │   ├── Repositories/
│   │   │   │   │   ├── ArticuloRepository.cs
│   │   │   │   │   ├── ClienteRepository.cs
│   │   │   │   │   └── ...
│   │   │   │   ├── SpisaDbContext.cs
│   │   │   │   ├── DbContextFactory.cs
│   │   │   │   └── Migrations/
│   │   │   │
│   │   │   ├── Services/
│   │   │   │   ├── EmailService.cs
│   │   │   │   ├── PdfGenerator.cs
│   │   │   │   ├── CurrentUserService.cs
│   │   │   │   └── DateTimeService.cs
│   │   │   │
│   │   │   ├── Identity/
│   │   │   │   ├── JwtTokenGenerator.cs
│   │   │   │   └── PasswordHasher.cs
│   │   │   │
│   │   │   └── DependencyInjection.cs
│   │   │
│   │   └── Spisa.WebApi/                      # API layer
│   │       ├── Controllers/
│   │       │   ├── ArticulosController.cs
│   │       │   ├── ClientesController.cs
│   │       │   ├── SalesOrdersController.cs
│   │       │   ├── InvoicesController.cs
│   │       │   └── AuthController.cs
│   │       ├── Middleware/
│   │       │   ├── ErrorHandlingMiddleware.cs
│   │       │   └── RequestLoggingMiddleware.cs
│   │       ├── Filters/
│   │       │   └── ApiExceptionFilter.cs
│   │       ├── Extensions/
│   │       │   └── ServiceCollectionExtensions.cs
│   │       ├── Program.cs
│   │       ├── appsettings.json
│   │       ├── appsettings.Development.json
│   │       └── Dockerfile
│   │
│   ├── tests/
│   │   ├── Spisa.Domain.Tests/
│   │   │   ├── Entities/
│   │   │   └── ValueObjects/
│   │   ├── Spisa.Application.Tests/
│   │   │   ├── Articulos/
│   │   │   └── Clientes/
│   │   └── Spisa.WebApi.Tests/
│   │       └── Controllers/
│   │
│   └── tools/
│       └── Spisa.DataMigration/
│           ├── Readers/
│           │   └── SqlServerDataReader.cs
│           ├── Writers/
│           │   └── PostgresDataWriter.cs
│           ├── Mappers/
│           │   ├── ClientMapper.cs
│           │   └── ArticuloMapper.cs
│           ├── Validators/
│           │   └── MigrationValidator.cs
│           └── Program.cs
│
├── frontend/
│   ├── public/
│   │   ├── icons/
│   │   └── manifest.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── layout.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── articulos/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── [id]/
│   │   │   │   │   └── nuevo/
│   │   │   │   ├── clientes/
│   │   │   │   ├── pedidos/
│   │   │   │   ├── facturas/
│   │   │   │   └── reportes/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                    # shadcn components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   └── ...
│   │   │   ├── articulos/
│   │   │   │   ├── ArticuloList.tsx
│   │   │   │   ├── ArticuloForm.tsx
│   │   │   │   └── ArticuloSearch.tsx
│   │   │   ├── clientes/
│   │   │   ├── common/
│   │   │   │   ├── DataTable.tsx
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── LoadingSpinner.tsx
│   │   │   └── layout/
│   │   │
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   │   ├── client.ts
│   │   │   │   ├── articulos.ts
│   │   │   │   ├── clientes.ts
│   │   │   │   └── auth.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useArticulos.ts
│   │   │   │   ├── useClientes.ts
│   │   │   │   └── useAuth.ts
│   │   │   ├── utils/
│   │   │   │   ├── formatters.ts
│   │   │   │   └── validators.ts
│   │   │   └── validations/
│   │   │       ├── articuloSchema.ts
│   │   │       └── clienteSchema.ts
│   │   │
│   │   ├── store/
│   │   │   ├── authStore.ts
│   │   │   └── uiStore.ts
│   │   │
│   │   └── types/
│   │       ├── articulo.ts
│   │       ├── cliente.ts
│   │       └── api.ts
│   │
│   ├── .env.local.example
│   ├── next.config.js
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── Dockerfile
│
├── database/
│   ├── schema.sql                    # Complete PostgreSQL schema
│   ├── seed.sql                      # Initial data (provinces, lookup tables)
│   ├── migrations/                   # Manual migrations if needed
│   └── views/
│       └── client_balances.sql       # Materialized views
│
├── docs/
│   ├── api/
│   │   └── openapi.yaml
│   ├── architecture/
│   │   ├── diagrams.md
│   │   └── decisions/
│   └── user-guide/
│       └── manual.md
│
└── .github/
    └── workflows/
        ├── backend-ci.yml
        ├── frontend-ci.yml
        └── deploy.yml
```

---

## Implementation Phases

### Phase 1: Foundation & Setup (Weeks 1-2)

**Goals:**
- Project scaffolding
- Development environment setup
- Database schema creation
- CI/CD pipelines

**Tasks:**
- [x] Document migration plan
- [ ] Initialize backend .NET solution
- [ ] Initialize Next.js frontend
- [ ] Setup Docker Compose
- [ ] Create PostgreSQL schema
- [ ] Implement base entities and repositories
- [ ] Setup authentication infrastructure
- [ ] Configure logging (Serilog)
- [ ] Setup GitHub Actions CI/CD

**Deliverables:**
- Working development environment
- Database created and seeded with lookup data
- Authentication working (login/JWT)
- Basic project structure
- CI/CD pipelines running

---

### Phase 2: Core Modules (Weeks 3-5)

**Module 1: Categories (Categorías)**

**Backend:**
```csharp
// Commands
- CreateCategoryCommand
- UpdateCategoryCommand
- DeleteCategoryCommand

// Queries
- GetAllCategoriesQuery
- GetCategoryByIdQuery
- GetActiveCategoriesQuery
```

**Frontend:**
- Category list page
- Create/Edit form
- Delete confirmation

**Module 2: Articles (Artículos)**

**Backend:**
```csharp
// Commands
- CreateArticuloCommand
- UpdateArticuloCommand
- DeleteArticuloCommand (soft delete)
- AdjustStockCommand

// Queries
- GetAllArticulosQuery (with pagination)
- GetArticuloByIdQuery
- GetArticuloByCodeQuery
- SearchArticulosQuery (code, description, category)
- GetLowStockArticulosQuery
```

**Frontend:**
- Article list with pagination and search
- Create/Edit form with category dropdown
- Stock adjustment modal
- Low stock alerts
- Print article labels

**Module 3: Clients (Clientes)**

**Backend:**
```csharp
// Commands
- CreateClienteCommand
- UpdateClienteCommand
- DeleteClienteCommand
- AddClientDiscountCommand
- RemoveClientDiscountCommand

// Queries
- GetAllClientesQuery
- GetClienteByIdQuery
- GetClienteByCodeQuery
- SearchClientesQuery
- GetClienteWithBalanceQuery
```

**Frontend:**
- Client list with search
- Create/Edit form (multi-step?)
- Discount management section
- Current account balance display
- Client history view

**Deliverables:**
- Fully functional inventory management
- Client CRUD operations
- All tests passing

---

### Phase 3: Sales & Documents (Weeks 6-11)

**Module 4: Sales Orders (Nota de Pedido)**

**Backend:**
```csharp
// Commands
- CreateSalesOrderCommand
- UpdateSalesOrderCommand
- CancelSalesOrderCommand
- AddOrderItemCommand
- RemoveOrderItemCommand

// Queries
- GetAllSalesOrdersQuery
- GetSalesOrderByIdQuery
- GetSalesOrdersByClientQuery
- GetPendingOrdersQuery
- CalculateOrderTotalQuery
```

**Frontend:**
- Order list with filters (client, date, status)
- Order creation wizard
  - Step 1: Select client
  - Step 2: Add items (with stock validation)
  - Step 3: Review and confirm
- Order detail view
- Print order

**Module 5: Invoices (Facturas)**

**Backend:**
```csharp
// Commands
- CreateInvoiceFromOrderCommand
- CancelInvoiceCommand
- MarkInvoiceAsPrintedCommand

// Queries
- GetAllInvoicesQuery
- GetInvoiceByIdQuery
- GetInvoicesByClientQuery
- GetUnpaidInvoicesQuery
```

**Frontend:**
- Invoice list with filters
- Create invoice from order
- Invoice detail view
- Print/Download PDF
- Cancel invoice (with reason)

**Module 6: Delivery Notes (Remitos)**

**Backend:**
```csharp
// Commands
- CreateDeliveryNoteCommand
- UpdateDeliveryNoteCommand

// Queries
- GetAllDeliveryNotesQuery
- GetDeliveryNoteByIdQuery
```

**Frontend:**
- Delivery note list
- Create from order
- Print delivery note

**Deliverables:**
- Complete sales workflow (Order → Invoice → Delivery)
- PDF generation working
- Stock updates on invoice creation

---

### Phase 4: Financial & Reporting (Weeks 12-14)

**Module 7: Current Accounts (Cuenta Corriente)**

**Backend:**
```csharp
// Commands
- RecordPaymentCommand
- RecordChargeCommand
- RecordAdjustmentCommand

// Queries
- GetClientBalanceQuery
- GetAccountMovementsQuery
- GetAccountStatementQuery (PDF)
```

**Frontend:**
- Client balance overview
- Movement history
- Record payment modal
- Account statement report

**Module 8: Reporting**

**Reports to Implement:**
1. **Inventory Reports:**
   - Current stock levels
   - Low stock alert
   - Stock movement history
   - Inventory valuation

2. **Sales Reports:**
   - Sales by period
   - Sales by client
   - Sales by article
   - Sales by category

3. **Financial Reports:**
   - Accounts receivable aging
   - Payment history
   - Client statements

**Frontend:**
- Report selection page
- Dynamic filters (date ranges, clients, etc.)
- Preview before print/export
- Export to PDF/Excel

**Deliverables:**
- Current account management
- All key reports implemented
- Export functionality

---

### Phase 5: Polish & Deployment (Weeks 15-16)

**Week 15: Data Migration & Testing**

**Tasks:**
- [ ] Run data migration tool
- [ ] Validate migrated data
- [ ] User acceptance testing
- [ ] Performance testing
- [ ] Security audit
- [ ] Fix any bugs found

**Week 16: Deployment & Training**

**Tasks:**
- [ ] Production environment setup
- [ ] Database backup strategy
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] User training sessions
- [ ] Documentation finalization
- [ ] Create user manual

**Deliverables:**
- System deployed to production
- All data migrated successfully
- Users trained
- Complete documentation

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Data migration data loss | Medium | Critical | Comprehensive validation, backups, rollback plan |
| Performance issues | Low | Medium | Proper indexing, query optimization, load testing |
| Security vulnerabilities | Medium | High | Security audit, input validation, JWT best practices |
| Third-party library issues | Low | Medium | Use well-maintained libraries, version locking |
| Database design flaws | Medium | High | Thorough review, prototype testing, DBA consultation |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| User resistance to change | High | High | Training, phased rollout, gather feedback |
| Missing requirements | Medium | Medium | Regular stakeholder reviews, iterative development |
| Timeline overrun | Medium | Medium | Buffer time, prioritize core features |
| Concurrent use of old system | High | Low | Clear cutover plan, data sync if needed |

### Mitigation Strategies

1. **Parallel Running**: Run old and new systems in parallel for 2-4 weeks
2. **Incremental Rollout**: Deploy modules one at a time
3. **Comprehensive Testing**: Unit, integration, and user acceptance testing
4. **Regular Backups**: Automated daily backups with tested restore procedures
5. **Monitoring**: Application and database monitoring from day one
6. **Documentation**: Keep detailed runbooks for common issues

---

## Testing Strategy

### Testing Pyramid

```
        /\
       /  \      E2E Tests (10%)
      /----\     - Critical user flows
     /      \    - Selenium/Playwright
    /--------\   
   /          \  Integration Tests (30%)
  /------------\ - API endpoints
 /              \- Database operations
/----------------\
  Unit Tests (60%)
  - Domain logic
  - Value objects
  - Commands/Queries
```

### Unit Testing

**Coverage Target:** 80% for Domain and Application layers

**Example:**
```csharp
public class CreateArticuloCommandHandlerTests
{
    [Fact]
    public async Task Handle_ValidCommand_CreatesArticulo()
    {
        // Arrange
        var mockRepo = new Mock<IArticuloRepository>();
        var handler = new CreateArticuloCommandHandler(mockRepo.Object);
        var command = new CreateArticuloCommand
        {
            Code = "ART001",
            Description = "Test Article",
            CategoryId = 1,
            UnitPrice = 100.00m
        };
        
        // Act
        var result = await handler.Handle(command, CancellationToken.None);
        
        // Assert
        result.Should().BeGreaterThan(0);
        mockRepo.Verify(r => r.AddAsync(It.IsAny<Articulo>()), Times.Once);
    }
    
    [Fact]
    public async Task Handle_DuplicateCode_ThrowsException()
    {
        // Test duplicate handling
    }
}
```

### Integration Testing

**Test API endpoints with in-memory database:**

```csharp
public class ArticulosControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    
    [Fact]
    public async Task GetAll_ReturnsArticulos()
    {
        // Arrange
        await SeedDatabase();
        
        // Act
        var response = await _client.GetAsync("/api/articulos");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var articulos = await response.Content.ReadFromJsonAsync<List<ArticuloDto>>();
        articulos.Should().HaveCountGreaterThan(0);
    }
}
```

### End-to-End Testing

**Frontend E2E tests with Playwright:**

```typescript
test('Create new article', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name=username]', 'admin');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');
  
  // Navigate to articles
  await page.click('text=Artículos');
  await page.click('text=Nuevo Artículo');
  
  // Fill form
  await page.fill('[name=code]', 'ART001');
  await page.fill('[name=description]', 'Test Article');
  await page.selectOption('[name=categoryId]', '1');
  await page.fill('[name=unitPrice]', '150.00');
  
  // Submit
  await page.click('button:has-text("Guardar")');
  
  // Verify success
  await expect(page.locator('.success-message')).toBeVisible();
  await expect(page.locator('text=ART001')).toBeVisible();
});
```

---

## Deployment Plan

### Infrastructure Requirements

**Minimum Server Specifications:**
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 50GB SSD
- **OS**: Ubuntu 22.04 LTS

**Recommended for Production:**
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 100GB SSD

### Docker Deployment

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: spisa
      POSTGRES_USER: spisa_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ./database/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  api:
    build:
      context: ./backend
      dockerfile: src/Spisa.WebApi/Dockerfile
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - ConnectionStrings__DefaultConnection=Host=postgres;Database=spisa;Username=spisa_user;Password=${DB_PASSWORD}
      - JWT__Secret=${JWT_SECRET}
      - JWT__Issuer=spisa-api
      - JWT__Audience=spisa-frontend
    depends_on:
      - postgres
    ports:
      - "5000:8080"
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      - NEXT_PUBLIC_API_URL=http://api:8080
    depends_on:
      - api
    ports:
      - "3000:3000"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - frontend
      - api
    restart: unless-stopped

volumes:
  postgres_data:
```

### Deployment Steps

**1. Server Preparation:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin

# Create application directory
sudo mkdir -p /opt/spisa
cd /opt/spisa
```

**2. Deploy Application:**
```bash
# Clone repository
git clone https://github.com/yourorg/spisa-new.git .

# Create environment file
cp .env.example .env
nano .env  # Edit with production values

# Build and start services
docker compose up -d

# Check logs
docker compose logs -f
```

**3. Database Migration:**
```bash
# Run migration tool
docker compose exec api dotnet Spisa.DataMigration.dll

# Verify migration
docker compose exec postgres psql -U spisa_user -d spisa -c "SELECT COUNT(*) FROM clients;"
```

**4. SSL Certificate (Let's Encrypt):**
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d spisa.yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

### Monitoring & Maintenance

**Health Checks:**
```bash
# API health endpoint
curl http://localhost:5000/health

# Database connection
docker compose exec postgres pg_isready

# Container status
docker compose ps
```

**Backup Strategy:**
```bash
# Daily database backup script
#!/bin/bash
BACKUP_DIR="/opt/spisa/backups"
DATE=$(date +%Y%m%d_%H%M%S)

docker compose exec postgres pg_dump -U spisa_user spisa > $BACKUP_DIR/spisa_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "spisa_*.sql" -mtime +30 -delete
```

**Log Rotation:**
```bash
# Configure Docker logging
# In docker-compose.yml, add to each service:
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

## Success Metrics

### Migration Success Criteria

- [ ] 100% of active data migrated without loss
- [ ] All referential integrity maintained
- [ ] Zero critical bugs in production after 1 week
- [ ] User acceptance sign-off
- [ ] System performance meets requirements (<200ms API response)

### Post-Migration KPIs

- **Performance**: 95% of API requests <200ms
- **Uptime**: 99.5% availability
- **User Adoption**: 2 users actively using within 1 week
- **Data Quality**: Zero data integrity issues
- **Bug Rate**: <5 bugs per week in first month

---

## Next Steps

1. **Review & Approval**: Stakeholder review of this migration plan
2. **Environment Setup**: Provision development and staging servers
3. **Kick-off Meeting**: Align on timeline and responsibilities
4. **Sprint Planning**: Break down Phase 1 into 2-week sprints
5. **Begin Implementation**: Start with project scaffolding

---

## Appendix

### Glossary

- **CQRS**: Command Query Responsibility Segregation
- **DDD**: Domain-Driven Design
- **DTO**: Data Transfer Object
- **ORM**: Object-Relational Mapping
- **PWA**: Progressive Web Application
- **JWT**: JSON Web Token
- **CUIT**: Código Único de Identificación Tributaria (Argentina Tax ID)

### References

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Microsoft .NET Architecture Guides](https://learn.microsoft.com/en-us/dotnet/architecture/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Next.js Documentation](https://nextjs.org/docs)

### Contact

**Project Lead**: [Your Name]  
**Email**: [your-email]  
**Repository**: https://github.com/yourorg/spisa-new

---

*Last Updated: October 1, 2025*

