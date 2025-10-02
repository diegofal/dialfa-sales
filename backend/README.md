# SPISA Backend - Clean Architecture

Backend del sistema SPISA construido con **Clean Architecture** + **Domain-Driven Design (DDD)** usando **.NET 8** y **PostgreSQL**.

## 📁 Estructura del Proyecto

```
backend/
├── src/
│   ├── Spisa.Domain/           # Capa de Dominio (Core)
│   │   ├── Entities/           # Entidades del dominio
│   │   ├── ValueObjects/       # Objetos de valor
│   │   ├── Interfaces/         # Interfaces de repositorios
│   │   └── Common/             # Base classes, enums compartidos
│   │
│   ├── Spisa.Application/      # Capa de Aplicación
│   │   ├── Commands/           # Commands (CQRS)
│   │   ├── Queries/            # Queries (CQRS)
│   │   ├── DTOs/               # Data Transfer Objects
│   │   ├── Interfaces/         # Interfaces de servicios
│   │   └── Common/             # Behaviors, mappings, validaciones
│   │
│   ├── Spisa.Infrastructure/   # Capa de Infraestructura
│   │   ├── Data/               # DbContext, Configurations
│   │   ├── Repositories/       # Implementaciones de repositorios
│   │   └── Services/           # Servicios externos
│   │
│   └── Spisa.WebApi/          # API Web (Entry Point)
│       ├── Controllers/        # API Controllers
│       ├── Middleware/         # Custom middleware
│       └── Extensions/         # Service extensions
│
└── tools/
    └── Spisa.DataMigration/   # Herramienta de migración de datos
```

## 🏗️ Arquitectura

### Principios de Clean Architecture

1. **Independencia de Frameworks**: El dominio no depende de ningún framework
2. **Testeable**: La lógica de negocio puede ser testeada sin UI, BD o servicios externos
3. **Independencia de UI**: La UI puede cambiar sin afectar el resto del sistema
4. **Independencia de BD**: Podemos cambiar de PostgreSQL a otra BD sin afectar reglas de negocio
5. **Independencia de agentes externos**: Las reglas de negocio no saben nada sobre el mundo exterior

### Flujo de Dependencias

```
WebApi → Application → Domain
  ↓           ↓
Infrastructure ⟵ Application
```

**Regla de Oro:** Las dependencias siempre apuntan hacia el centro (Domain)

## 🛠️ Tecnologías

### Spisa.Domain
- **.NET 8** - Framework base
- Sin dependencias externas (Clean Architecture)

### Spisa.Application
- **MediatR** 13.0 - CQRS Pattern
- **FluentValidation** 12.0 - Validación de commands/queries
- **AutoMapper** 15.0 - Mapeo de objetos

### Spisa.Infrastructure
- **Entity Framework Core** 9.0 - ORM
- **Npgsql.EntityFrameworkCore.PostgreSQL** 9.0 - Provider PostgreSQL
- **Serilog** 4.3 - Logging estructurado

### Spisa.WebApi
- **ASP.NET Core Web API** 8.0
- **JWT Bearer Authentication** 8.0 - Autenticación
- **Swashbuckle (Swagger)** 9.0 - Documentación API
- **Serilog.AspNetCore** 9.0 - Logging

## 📦 Instalación y Configuración

### Prerrequisitos

- .NET 8 SDK
- PostgreSQL 16+
- Docker (opcional, para desarrollo)

### Compilar el Proyecto

```bash
cd backend
dotnet restore
dotnet build
```

### Configurar la Base de Datos

Asegúrate de que PostgreSQL esté corriendo (ver `docker-compose.yml` en la raíz).

**Ejecutar migraciones de EF Core:**

```bash
cd src/Spisa.Infrastructure
dotnet ef database update --startup-project ../Spisa.WebApi/Spisa.WebApi.csproj
```

**Crear nueva migración (cuando cambies entidades):**

```bash
cd src/Spisa.Infrastructure
dotnet ef migrations add MigrationName --startup-project ../Spisa.WebApi/Spisa.WebApi.csproj
```

**Revertir última migración:**

```bash
cd src/Spisa.Infrastructure
dotnet ef migrations remove --startup-project ../Spisa.WebApi/Spisa.WebApi.csproj
```

### Ejecutar el API

```bash
cd src/Spisa.WebApi
dotnet run
```

El API estará disponible en:
- HTTP: `http://localhost:5000`
- HTTPS: `https://localhost:5001`
- Swagger UI: `http://localhost:5000/swagger`

## 🔧 Configuración

### Connection String

Editar `appsettings.json` en `Spisa.WebApi`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=spisa;Username=spisa_user;Password=spisa_dev_password"
  }
}
```

### JWT Configuration

```json
{
  "JWT": {
    "Secret": "your-super-secret-jwt-key-change-in-production",
    "Issuer": "spisa-api",
    "Audience": "spisa-frontend",
    "ExpirationMinutes": 60
  }
}
```

## 📝 Patrones y Prácticas

### CQRS (Command Query Responsibility Segregation)

Separación de operaciones de lectura y escritura:

**Commands** (`Application/Commands/`):
```csharp
public class CreateClientCommand : IRequest<ClientDto>
{
    public string BusinessName { get; set; }
    public string Cuit { get; set; }
    // ...
}

public class CreateClientCommandHandler : IRequestHandler<CreateClientCommand, ClientDto>
{
    // Implementation
}
```

**Queries** (`Application/Queries/`):
```csharp
public class GetClientByIdQuery : IRequest<ClientDto>
{
    public long Id { get; set; }
}

public class GetClientByIdQueryHandler : IRequestHandler<GetClientByIdQuery, ClientDto>
{
    // Implementation
}
```

### Repository Pattern

**Interface** (`Domain/Interfaces/`):
```csharp
public interface IClientRepository
{
    Task<Client> GetByIdAsync(long id);
    Task<IEnumerable<Client>> GetAllAsync();
    Task<Client> AddAsync(Client client);
    // ...
}
```

**Implementation** (`Infrastructure/Repositories/`):
```csharp
public class ClientRepository : IClientRepository
{
    private readonly SpisaDbContext _context;
    // Implementation using EF Core
}
```

### Value Objects

Objetos inmutables que representan conceptos del dominio:

```csharp
public class Cuit : ValueObject
{
    public string Value { get; private set; }
    
    private Cuit(string value)
    {
        Value = value;
    }
    
    public static Cuit Create(string value)
    {
        if (!IsValid(value))
            throw new InvalidCuitException();
        return new Cuit(value);
    }
    
    private static bool IsValid(string value)
    {
        return Regex.IsMatch(value, @"^\d{11}$");
    }
}
```

### FluentValidation

```csharp
public class CreateClientCommandValidator : AbstractValidator<CreateClientCommand>
{
    public CreateClientCommandValidator()
    {
        RuleFor(x => x.BusinessName)
            .NotEmpty()
            .MaximumLength(200);
            
        RuleFor(x => x.Cuit)
            .NotEmpty()
            .Length(11)
            .Matches(@"^\d{11}$");
    }
}
```

## 🧪 Testing

```bash
# Unit Tests (Domain + Application)
dotnet test --filter Category=Unit

# Integration Tests (Infrastructure)
dotnet test --filter Category=Integration

# E2E Tests (WebApi)
dotnet test --filter Category=E2E
```

## 🚀 Despliegue

### Docker

```bash
# Build image
docker build -t spisa-api:latest .

# Run container
docker run -p 5000:8080 spisa-api:latest
```

### Producción

1. Actualizar `appsettings.Production.json`
2. Configurar variables de entorno
3. Ejecutar migraciones de EF Core
4. Desplegar en servidor/cloud

## 📚 Estado de Implementación

### ✅ Completado

1. ✅ Estructura de proyectos creada (Clean Architecture)
2. ✅ Configurar Entity Framework Core y DbContext
3. ✅ Implementar entidades del dominio (Client, Article, SalesOrder, Invoice, etc.)
4. ✅ Crear migraciones de EF Core
5. ✅ Crear repositorios base (Generic Repository Pattern + UnitOfWork)
6. ✅ Implementar módulo Clients con CQRS
   - ✅ Queries: GetAllClients, GetClientById
   - ✅ Commands: CreateClient, UpdateClient, DeleteClient
7. ✅ Endpoints funcionales de Clients (GET, POST, PUT, DELETE)
8. ✅ Migración completa de datos legacy → PostgreSQL
   - 397 clientes con saldos
   - 1,797 artículos
   - 39,065 órdenes de venta
   - 32,575 facturas
   - 27,636 remitos

### ⏭️ Próximos Pasos

1. Fix bug menor en PUT /api/clients/{id}
2. Configurar JWT Authentication
3. Implementar módulos Articles y SalesOrders
4. Inicializar frontend Next.js

## 🤝 Contribuciones

Ver `MIGRATION_PLAN.md` en la raíz del proyecto para el plan completo de migración.

## 📄 Licencia

Privado - SPISA © 2025

