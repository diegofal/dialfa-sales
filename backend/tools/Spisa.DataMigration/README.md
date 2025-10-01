# SPISA Data Migration Tool

Console application to migrate data from legacy SQL Server database to modern PostgreSQL database.

## Features

- ✅ Automated migration of all entity types
- ✅ Pre-migration validation
- ✅ Post-migration validation
- ✅ Referential integrity checks
- ✅ Record count verification
- ✅ Detailed progress tracking
- ✅ Comprehensive error reporting
- ✅ Dry-run mode for testing
- ✅ Transaction support with rollback
- ✅ Beautiful console UI (Spectre.Console)

## Prerequisites

- .NET 8 SDK
- Access to legacy SQL Server database
- Access to target PostgreSQL database
- PostgreSQL database initialized with schema (run `schema.sql` and `seed.sql` first)

## Configuration

Edit `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "SqlServer": "Server=(local)\\sqlexpress;Database=SPISA;Integrated Security=True",
    "PostgreSQL": "Host=localhost;Port=5432;Database=spisa;Username=spisa_user;Password=your_password"
  },
  "Migration": {
    "BatchSize": 1000,
    "EnableValidation": true,
    "GenerateReport": true,
    "DryRun": false,  // Set to true for testing
    "ContinueOnError": false
  }
}
```

## Usage

### 1. Test Run (Dry Run)

```bash
# Set DryRun to true in appsettings.json
dotnet run
```

This will:
- Validate connections
- Check legacy data quality
- Show what would be migrated
- **NOT** write any data to PostgreSQL

### 2. Production Migration

```bash
# Set DryRun to false in appsettings.json
dotnet run
```

### 3. Command Line Override

```bash
# Override connection strings via environment variables
export ConnectionStrings__PostgreSQL="Host=localhost;Database=spisa;..."
dotnet run
```

## Migration Process

The tool executes the following steps:

1. **Pre-Migration Validation**
   - Check for orphaned records
   - Validate CUIT formats
   - Check for negative stock
   - Identify data quality issues

2. **Connection Tests**
   - Verify SQL Server connection
   - Verify PostgreSQL connection

3. **Migrate Lookup Tables**
   - Provinces (already seeded)
   - Tax conditions (already seeded)
   - Payment methods (already seeded)

4. **Migrate Master Data**
   - Categories (Categorias → categories)
   - Articles (Articulos → articles)
   - Clients (Clientes → clients)
   - Client Discounts (Descuentos → client_discounts)

5. **Migrate Transactional Data**
   - Sales Orders (NotaPedidos → sales_orders)
   - Sales Order Items (NotaPedido_Items → sales_order_items)
   - Invoices (Facturas → invoices)
   - Delivery Notes (Remitos → delivery_notes)

6. **Refresh Materialized Views**
   - client_balances
   - article_stock_levels

7. **Post-Migration Validation**
   - Verify record counts match
   - Check referential integrity
   - Validate data quality

8. **Generate Report**
   - Saved to `./migration-reports/`
   - Includes all statistics and errors

## Output

### Console Output

```
     ███████╗██████╗ ██╗███████╗ █████╗ 
     ██╔════╝██╔══██╗██║██╔════╝██╔══██╗
     ███████╗██████╔╝██║███████╗███████║
     ╚════██║██╔═══╝ ██║╚════██║██╔══██║
     ███████║██║     ██║███████║██║  ██║
     ╚══════╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝

Data Migration Tool v1.0
Migrating from SQL Server to PostgreSQL

┌──────────────────────┬─────────────────────────────────────┐
│ Configuration        │ Value                               │
├──────────────────────┼─────────────────────────────────────┤
│ Source (SQL Server)  │ Server=(local)\sqlexpress;Data...  │
│ Target (PostgreSQL)  │ Host=localhost;Port=5432;Data...   │
│ Batch Size           │ 1000                                │
│ Dry Run              │ false                               │
└──────────────────────┴─────────────────────────────────────┘

Proceed with migration? (y/n): y

┌────────────────────────────────┬─────┬──────┬────────────┬──────────┐
│                                │     │      │            │          │
├────────────────────────────────┼─────┼──────┼────────────┼──────────┤
│ Validating legacy data         │ 100%│      │            │ ✓        │
│ Testing database connections   │ 100%│      │            │ ✓        │
│ Migrating categories           │ 100%│      │  00:00:02  │ ⠋        │
│ Migrating articles             │  45%│      │  00:01:23  │ ⠙        │
└────────────────────────────────┴─────┴──────┴────────────┴──────────┘
```

### Migration Report

Saved to `./migration-reports/migration-report-20251001-143022.txt`:

```
═══════════════════════════════════════════════════════════════
                SPISA DATA MIGRATION REPORT                    
═══════════════════════════════════════════════════════════════

Start Time:  2025-10-01 14:30:22
End Time:    2025-10-01 14:35:18
Duration:    00:04:56
Status:      SUCCESS

Entity Migration Results:
───────────────────────────────────────────────────────────────
Categories           Migrated:      6  Failed:      0  Duration: 00:00:01
Articles             Migrated:   1234  Failed:      0  Duration: 00:01:23
Clients              Migrated:    456  Failed:      0  Duration: 00:00:45
SalesOrders          Migrated:   5678  Failed:      0  Duration: 00:02:12
Invoices             Migrated:   3456  Failed:      0  Duration: 00:01:34
DeliveryNotes        Migrated:   2345  Failed:      0  Duration: 00:00:58

═══════════════════════════════════════════════════════════════
```

## Error Handling

- **Transaction Rollback**: Each entity migration is wrapped in a transaction
- **Validation Errors**: Pre-migration validation can stop migration if critical issues found
- **Continue on Error**: Configurable via `Migration:ContinueOnError` setting
- **Detailed Logs**: All errors logged to `./migration-logs/migration-YYYYMMDD.log`

## Troubleshooting

### Connection Errors

```
Error: Cannot connect to SQL Server
```

**Solution:** Verify connection string, check SQL Server is running, verify credentials.

### Referential Integrity Errors

```
Error: Foreign key constraint violation
```

**Solution:** Check migration order. Parent entities must be migrated before children.

### CUIT Validation Errors

```
Error: Found 5 clients with invalid CUIT format
```

**Solution:** Clean CUIT data in SQL Server before migration, or update `CleanCuit()` method.

### Sequence Reset Issues

```
Error: Duplicate key value violates unique constraint
```

**Solution:** Ensure sequences are properly reset after each entity migration.

## Development

### Project Structure

```
Spisa.DataMigration/
├── Program.cs                    # Entry point
├── appsettings.json             # Configuration
├── Models/
│   └── MigrationResult.cs       # Result models
├── Services/
│   ├── ILegacyDataReader.cs     # SQL Server reader interface
│   ├── SqlServerDataReader.cs   # SQL Server implementation
│   ├── IModernDataWriter.cs     # PostgreSQL writer interface
│   ├── PostgresDataWriter.cs    # PostgreSQL implementation
│   ├── IMigrationValidator.cs   # Validator interface
│   ├── MigrationValidator.cs    # Validator implementation
│   └── MigrationOrchestrator.cs # Main orchestrator
└── Mappers/
    ├── LegacyModels.cs          # SQL Server models
    ├── ModernModels.cs          # PostgreSQL models
    └── EntityMappers.cs         # Mapping logic
```

### Adding New Entity Migration

1. Create legacy model in `LegacyModels.cs`
2. Create modern model in `ModernModels.cs`
3. Create mapper in `EntityMappers.cs`
4. Add migration method in `MigrationOrchestrator.cs`
5. Call method in `ExecuteMigration()`

## License

Internal tool for SPISA migration project.

