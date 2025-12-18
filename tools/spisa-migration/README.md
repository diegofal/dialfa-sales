# SPISA Data Migration Tool (Python)

High-performance async Python tool for migrating data from SQL Server (legacy) to PostgreSQL (modern).

## Features

- ✨ **Async/Parallel Execution** - Independent tables migrate in parallel
- 🚀 **Bulk Inserts** - PostgreSQL COPY protocol (10-100x faster than row-by-row)
- 🎯 **Type-Safe CLI** - Built with Typer and Rich for beautiful terminal UI
- ✅ **Data Validation** - Pre and post-migration integrity checks
- 🔄 **Preserve IDs** - Maintains legacy IDs for data continuity
- 🧹 **Data Cleaning** - Fixes invalid CUITs, dates, and FK references
- 📊 **Progress Tracking** - Real-time progress bars and detailed reports

## Performance

Expected migration time:

| Records | C# Tool (row-by-row) | Python Tool (async + bulk) |
|---------|----------------------|----------------------------|
| 10k     | ~60 seconds          | ~2-5 seconds               |
| 50k     | 2-5 minutes          | ~5-10 seconds              |
| 250k+   | 10-20 minutes        | ~10-20 seconds             |
| 500k+   | 20-40 minutes        | ~15-30 seconds             |

**Actual SPISA database**: **527,945 records** migrated in **12.71 seconds** ⚡

This includes:
- 39,334 Sales Orders
- 166,456 Order Items  
- 32,838 Invoices + 142,350 Invoice Items (replicated)
- 27,884 Delivery Notes + 116,808 Delivery Note Items (replicated)
- All lookup tables, categories, articles, and clients

## Installation

### Prerequisites

- Python 3.10+
- ODBC Driver 17 for SQL Server (Windows usually has it)
- Access to both SQL Server and PostgreSQL databases
- Docker (if using containerized SQL Server - see project root docker-compose.yml)

### Setup

```bash
cd tools/spisa-migration

# Install dependencies
pip install -r requirements.txt

# Option 1: Use setup command (easiest)
python main.py setup
# Then edit .env with your database credentials

# Option 2: Manual setup
cp .env.example .env     # Linux/Mac
copy .env.example .env   # Windows
# Edit .env with your database credentials
```

### Environment Configuration

Edit `.env` file:

```env
# SQL Server (Legacy)
SQLSERVER_HOST=localhost
SQLSERVER_DATABASE=SPISA
SQLSERVER_USER=sa
SQLSERVER_PASSWORD=your_password

# PostgreSQL (Modern)
POSTGRES_HOST=localhost
POSTGRES_DATABASE=spisa
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# Migration Settings
MIGRATION_DRY_RUN=false
MIGRATION_GENERATE_REPORT=true
```

## Usage

### Database Cleanup (Recommended First)

Clean the database before migration for a fresh start:

```bash
# Clean all migration data (preserves users)
python main.py clean

# Complete wipe including users
python main.py clean --include-users

# Skip confirmation
python main.py clean --yes
```

### Full Migration

```bash
# Standard migration (with confirmation)
python main.py migrate

# Skip confirmation (for scripts)
python main.py migrate --yes

# Clean + migrate in one command
python main.py migrate --clean

# Dry run (no writes, test only)
python main.py migrate --dry-run

# Sequential mode (for debugging)
python main.py migrate --sequential
```

### Validation Only

Check data integrity without migrating:

```bash
python main.py validate
```

### Status Check

View current record counts:

```bash
python main.py status
```

### Setup Configuration

First-time setup helper:

```bash
python main.py setup
```

This creates a `.env` file that you can then edit with your credentials.

### Help

```bash
python main.py --help
python main.py migrate --help
python main.py clean --help
python main.py setup --help
```

## Common Workflows

### Fresh Migration (Clean Start)

```bash
# Option 1: Clean then migrate
python main.py clean --yes
python main.py migrate --yes

# Option 2: Clean + migrate in one command
python main.py migrate --clean --yes
```

### Testing Before Production

```bash
# 1. Check current state
python main.py status

# 2. Dry run to test
python main.py migrate --dry-run

# 3. Clean database
python main.py clean

# 4. Run actual migration
python main.py migrate

# 5. Validate results
python main.py validate
python main.py status
```

### Re-running Migration

If migration failed or you need to start over:

```bash
# Clean and retry
python main.py clean --yes
python main.py migrate --yes
```

## Migration Process

The tool migrates data in **6 parallel waves** to maximize performance while respecting foreign key dependencies:

### Wave 1: Foundation (Parallel)
- Provinces
- Tax Conditions
- Operation Types
- Payment Methods
- Transporters
- Categories

### Wave 2: Core Entities (Parallel)
- Articles (depends on Categories)
- Clients (depends on Wave 1)

### Wave 3: Sales Orders
- Sales Orders (depends on Clients)

### Wave 4: Order Details (Parallel)
- Order Items
- Invoices
- Delivery Notes

### Wave 5: Item Details (Parallel)
- Invoice Items (copied from Sales Order Items)
- Delivery Note Items (copied from Sales Order Items)

**Note**: In the legacy system, invoices and delivery notes didn't have their own items - they referenced the sales order items. In the modern system, each entity has its own items table for better data independence and querying.

### Wave 5.5: Calculate Invoice Totals
- Updates invoice totals (`net_amount`, `tax_amount`, `total_amount`) by summing the invoice items
- Calculates tax based on client's tax condition:
  - Responsable Inscripto: 21% IVA
  - Monotributista/Exento: 0% IVA

**Note**: The legacy system didn't store totals in the invoices table, so they're calculated post-migration from the items.

### Wave 5.6: Calculate Sales Order Totals
- Updates sales order totals by summing the sales order items
- Applies the special discount percentage to get the final total

**Note**: The legacy system didn't store totals in the sales orders table, so they're calculated post-migration from the items.

### Wave 6: Admin User
- Seeds admin user (username: `admin`, password: `admin123`)

## Data Transformations

The tool automatically handles:

- **CUIT Cleaning**: Removes dashes, pads to 11 digits
- **Category Codes**: Generates unique codes from descriptions
- **Invalid Dates**: Fixes delivery dates earlier than order dates
- **Invalid Quantities**: Sets zero/negative quantities to 1
- **Invalid Discounts**: Normalizes discounts < 0 or > 100 to 0
- **Orphaned Records**: Filters records with invalid foreign keys
- **Null Transporters**: Sets invalid transporter IDs to NULL
- **Type Conversions**: Handles mixed int/string fields (Codigo, NumeroOrden, NumeroRemito)

## Architecture

```
main.py                 # CLI entry point (Typer)
├── config.py           # Pydantic Settings
├── orchestrator.py     # Parallel wave execution
├── db/
│   ├── sql_server.py   # Async-wrapped SQL Server reader
│   └── postgres.py     # Async PostgreSQL writer (COPY)
├── validators/
│   └── migration.py    # Pre/post validation
├── mappers/
│   └── entities.py     # Legacy → Modern transformations
└── models/
    ├── legacy.py       # SQL Server dataclasses
    ├── modern.py       # PostgreSQL dataclasses
    └── result.py       # Migration results
```

## Troubleshooting

### Configuration Errors

If you see "Configuration Error: .env file not found":

```bash
python main.py setup
# Then edit .env with your credentials
```

### ODBC Driver Not Found

Install ODBC Driver 17 for SQL Server:
- Windows: Usually pre-installed
- Linux: https://learn.microsoft.com/en-us/sql/connect/odbc/linux-mac/installing-the-microsoft-odbc-driver-for-sql-server

### Connection Busy Errors

If you see "Connection is busy with results for another command":
- This is now fixed - each operation uses its own connection
- If it persists, try running with `--sequential` mode:
  ```bash
  python main.py migrate --sequential
  ```

### Type Conversion Errors

If you see "'int' object has no attribute 'strip'":
- This is now fixed - all fields are properly converted to strings when needed
- Update to the latest version of the tool

### Connection Timeout

Increase command timeout in `db/postgres.py`:

```python
self.pool = await asyncpg.create_pool(
    self.dsn,
    command_timeout=1200  # 20 minutes
)
```

### Memory Issues

If migrating very large datasets, implement batching in `db/sql_server.py`:

```python
def _read_table_sync(self, table: str, batch_size: int = 10000):
    # Implement cursor-based pagination
    ...
```

## Comparison with C# Tool

| Feature | C# Tool | Python Tool |
|---------|---------|-------------|
| Language | C# / .NET | Python 3.10+ |
| Execution | Sequential | Async/Parallel |
| Insert Method | Row-by-row | Bulk COPY |
| Performance | 2-5 min | 10-30 sec |
| Lines of Code | ~1,700 | ~1,200 |
| Dependencies | .NET SDK | Python + pip |
| CLI | Spectre.Console | Typer + Rich |

## License

Internal tool for SPISA project.

