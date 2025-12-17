"""SPISA Data Migration Tool - Main CLI entry point."""
import asyncio
import logging
import sys
from pathlib import Path
import re

import typer
from rich.console import Console
from rich.logging import RichHandler
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.table import Table
from rich.panel import Panel
from rich import box

from config import settings
from db.sql_server import SqlServerReader
from db.postgres import PostgresWriter
from validators.migration import MigrationValidator
from orchestrator import MigrationOrchestrator
from models.result import MigrationResult

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    handlers=[RichHandler(rich_tracebacks=True, show_time=False)]
)
logger = logging.getLogger(__name__)

# Create Typer app
app = typer.Typer(
    name="spisa-migration",
    help="SPISA Data Migration Tool - Migrate from SQL Server to PostgreSQL",
    add_completion=False
)
console = Console()


def mask_connection_string(conn_str: str) -> str:
    """Mask passwords in connection strings for display."""
    return re.sub(
        r'(Password|PWD|password)[\s=:]+[^;]+',
        r'\1=***',
        conn_str,
        flags=re.IGNORECASE
    )


def display_configuration():
    """Display current configuration."""
    table = Table(title="Migration Configuration", box=box.ROUNDED)
    table.add_column("Setting", style="yellow")
    table.add_column("Value", style="green")
    
    table.add_row("SQL Server", mask_connection_string(settings.sqlserver_connection_string))
    table.add_row("PostgreSQL", mask_connection_string(settings.postgres_dsn))
    table.add_row("Dry Run", str(settings.migration_dry_run))
    table.add_row("Parallel Mode", "Enabled")
    
    console.print(table)
    console.print()


def display_results(result: MigrationResult):
    """Display migration results."""
    # Results table
    table = Table(
        title="Migration Results",
        box=box.DOUBLE,
        border_style="green" if result.success else "red"
    )
    table.add_column("Entity", style="bold")
    table.add_column("Migrated", justify="right")
    table.add_column("Failed", justify="right")
    table.add_column("Duration", justify="right")
    table.add_column("Status")
    
    for entity in result.entities:
        status = "[green]✓[/green]" if entity.success else "[red]✗[/red]"
        table.add_row(
            entity.entity_name,
            str(entity.migrated_count),
            str(entity.failed_count),
            f"{entity.duration:.2f}s",
            status
        )
    
    console.print()
    console.print(table)
    
    # Summary
    total_migrated = sum(e.migrated_count for e in result.entities)
    console.print(f"\n[bold]Total Duration:[/bold] {result.duration:.2f} seconds")
    console.print(f"[bold]Total Records:[/bold] {total_migrated}")
    
    # Errors
    if result.errors:
        console.print(f"\n[red]Total Errors: {len(result.errors)}[/red]")
        error_text = "\n".join(f"• {error}" for error in result.errors[:5])
        if len(result.errors) > 5:
            error_text += f"\n... and {len(result.errors) - 5} more errors"
        
        panel = Panel(
            error_text,
            title="[red]Error Summary[/red]",
            border_style="red"
        )
        console.print(panel)
    
    # Final status
    if result.success:
        console.print("\n[bold green]✓ Migration completed successfully![/bold green]")
    else:
        console.print("\n[bold red]✗ Migration completed with errors.[/bold red]")


async def run_migration(dry_run: bool, parallel: bool, clean: bool = False):
    """Execute the migration."""
    # Create database connectors
    sql_reader = SqlServerReader(settings.sqlserver_connection_string)
    pg_writer = PostgresWriter(settings.postgres_dsn, dry_run=dry_run)
    
    try:
        # Connect to databases
        sql_reader.connect()
        await pg_writer.connect()
        
        # Optional full cleanup
        if clean:
            console.print("\n[yellow]Performing full cleanup (including users)...[/yellow]")
            await pg_writer.cleanup_all_data()
            console.print("[green]✓ Database cleaned[/green]\n")
        
        # Create validator and orchestrator
        validator = MigrationValidator(sql_reader, pg_writer)
        orchestrator = MigrationOrchestrator(sql_reader, pg_writer, validator, parallel=parallel)
        
        # Run migration with progress
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=console
        ) as progress:
            task = progress.add_task("[cyan]Migrating data...", total=None)
            
            result = await orchestrator.execute()
            
            progress.update(task, completed=1, total=1)
        
        return result
        
    finally:
        sql_reader.close()
        await pg_writer.close()


@app.command()
def migrate(
    dry_run: bool = typer.Option(
        False, "--dry-run", "-d",
        help="Simulate migration without writing to database"
    ),
    yes: bool = typer.Option(
        False, "--yes", "-y",
        help="Skip confirmation prompt"
    ),
    parallel: bool = typer.Option(
        True, "--parallel/--sequential",
        help="Run migration in parallel (faster) or sequential mode"
    ),
    clean: bool = typer.Option(
        False, "--clean",
        help="Clean all data (including users) before migration"
    ),
):
    """
    Run full data migration from SQL Server to PostgreSQL.
    
    This will:
    1. Validate legacy data
    2. Clear target database
    3. Migrate all tables preserving IDs
    4. Validate migrated data
    5. Generate migration report
    """
    console.print()
    console.print(Panel.fit(
        "[bold blue]SPISA Data Migration Tool[/bold blue]\n"
        "Migrating from SQL Server to PostgreSQL",
        border_style="blue"
    ))
    console.print()
    
    # Display configuration
    display_configuration()
    
    # Confirm if not --yes
    if not yes:
        if dry_run:
            console.print("[yellow]Running in DRY RUN mode - no data will be written[/yellow]")
        else:
            console.print("[yellow]⚠️  This will CLEAR all data in the target PostgreSQL database![/yellow]")
        
        confirm = typer.confirm("\nProceed with migration?", default=False)
        if not confirm:
            console.print("[red]Migration cancelled.[/red]")
            raise typer.Exit(0)
    
    console.print()
    
    # Run migration
    try:
        result = asyncio.run(run_migration(dry_run, parallel, clean))
        
        # Display results
        display_results(result)
        
        # Exit code
        sys.exit(0 if result.success else 1)
        
    except Exception as e:
        console.print(f"\n[bold red]Migration failed: {e}[/bold red]")
        logger.exception("Migration failed")
        sys.exit(1)


@app.command()
def validate():
    """
    Validate data integrity without running migration.
    
    This checks:
    - Legacy data quality issues
    - Record counts between databases
    - Referential integrity
    """
    console.print("\n[bold blue]Validating Data Integrity[/bold blue]\n")
    
    async def run_validation():
        sql_reader = SqlServerReader(settings.sqlserver_connection_string)
        pg_writer = PostgresWriter(settings.postgres_dsn)
        
        try:
            sql_reader.connect()
            await pg_writer.connect()
            
            validator = MigrationValidator(sql_reader, pg_writer)
            
            # Legacy validation
            console.print("[cyan]Checking legacy data...[/cyan]")
            legacy_result = await validator.validate_legacy_data()
            
            if legacy_result.is_valid:
                console.print("[green]✓ Legacy data is valid[/green]\n")
            else:
                console.print(f"[yellow]⚠️  Found {len(legacy_result.issues)} issues:[/yellow]")
                for issue in legacy_result.issues:
                    console.print(f"  • {issue}")
                console.print()
            
            # Count validation
            console.print("[cyan]Checking record counts...[/cyan]")
            count_result = await validator.validate_record_counts()
            
            if count_result.is_valid:
                console.print("[green]✓ Record counts match[/green]\n")
            else:
                console.print(f"[red]✗ Count mismatches found:[/red]")
                for issue in count_result.issues:
                    console.print(f"  • {issue}")
                console.print()
            
            # Integrity validation
            console.print("[cyan]Checking referential integrity...[/cyan]")
            integrity_result = await validator.validate_referential_integrity()
            
            if integrity_result.is_valid:
                console.print("[green]✓ Referential integrity is valid[/green]\n")
            else:
                console.print(f"[red]✗ Integrity issues found:[/red]")
                for issue in integrity_result.issues:
                    console.print(f"  • {issue}")
                console.print()
            
            all_valid = legacy_result.is_valid and count_result.is_valid and integrity_result.is_valid
            
            if all_valid:
                console.print("[bold green]✓ All validations passed![/bold green]")
            else:
                console.print("[bold yellow]⚠️  Some validation issues found[/bold yellow]")
            
            return all_valid
            
        finally:
            sql_reader.close()
            await pg_writer.close()
    
    try:
        result = asyncio.run(run_validation())
        sys.exit(0 if result else 1)
    except Exception as e:
        console.print(f"\n[bold red]Validation failed: {e}[/bold red]")
        logger.exception("Validation failed")
        sys.exit(1)


@app.command()
def status():
    """
    Show current record counts in both databases.
    """
    console.print("\n[bold blue]Database Status[/bold blue]\n")
    
    async def get_status():
        sql_reader = SqlServerReader(settings.sqlserver_connection_string)
        pg_writer = PostgresWriter(settings.postgres_dsn)
        
        try:
            sql_reader.connect()
            await pg_writer.connect()
            
            tables = [
                ("Categories", "Categorias", "categories"),
                ("Articles", "Articulos", "articles"),
                ("Clients", "Clientes", "clients"),
                ("Sales Orders", "NotaPedidos", "sales_orders"),
                ("Order Items", "NotaPedido_Items", "sales_order_items"),
                ("Invoices", "Facturas", "invoices"),
                ("Delivery Notes", "Remitos", "delivery_notes"),
            ]
            
            table = Table(title="Record Counts", box=box.ROUNDED)
            table.add_column("Entity", style="bold")
            table.add_column("SQL Server", justify="right", style="cyan")
            table.add_column("PostgreSQL", justify="right", style="green")
            table.add_column("Status")
            
            for entity, sql_table, pg_table in tables:
                sql_count = await sql_reader.get_record_count(sql_table)
                pg_count = await pg_writer.get_record_count(pg_table)
                
                if sql_count == pg_count:
                    status = "[green]✓[/green]"
                else:
                    status = "[red]✗[/red]"
                
                table.add_row(entity, str(sql_count), str(pg_count), status)
            
            console.print(table)
            
        finally:
            sql_reader.close()
            await pg_writer.close()
    
    try:
        asyncio.run(get_status())
    except Exception as e:
        console.print(f"\n[bold red]Failed to get status: {e}[/bold red]")
        logger.exception("Status check failed")
        sys.exit(1)


@app.command()
def clean(
    yes: bool = typer.Option(
        False, "--yes", "-y",
        help="Skip confirmation prompt"
    ),
    include_users: bool = typer.Option(
        False, "--include-users",
        help="Also delete users table (complete wipe)"
    ),
):
    """
    Clean/reset the PostgreSQL database before migration.
    
    This will:
    - Truncate all migration tables
    - Reset all sequences
    - Optionally delete users table
    
    This is useful when you want a completely fresh start.
    """
    console.print("\n[bold red]⚠️  Database Cleanup[/bold red]\n")
    
    async def run_cleanup():
        pg_writer = PostgresWriter(settings.postgres_dsn)
        
        try:
            await pg_writer.connect()
            
            # Show current state
            console.print("[cyan]Current database state:[/cyan]")
            info = await pg_writer.get_table_info()
            
            table = Table(box=box.SIMPLE)
            table.add_column("Table", style="bold")
            table.add_column("Records", justify="right")
            
            total_records = 0
            for table_name, count in info.items():
                if isinstance(count, int):
                    table.add_row(table_name, str(count))
                    total_records += count
                else:
                    table.add_row(table_name, str(count))
            
            console.print(table)
            console.print(f"\n[bold]Total records: {total_records}[/bold]\n")
            
            if total_records == 0:
                console.print("[green]Database is already clean![/green]")
                return True
            
            # Confirm
            if not yes:
                if include_users:
                    console.print("[yellow]This will DELETE ALL DATA including users![/yellow]")
                else:
                    console.print("[yellow]This will DELETE ALL migration data (users will be preserved).[/yellow]")
                
                confirm = typer.confirm("\nProceed with cleanup?", default=False)
                if not confirm:
                    console.print("[red]Cleanup cancelled.[/red]")
                    return False
            
            # Perform cleanup
            console.print("\n[cyan]Cleaning database...[/cyan]")
            
            if include_users:
                await pg_writer.cleanup_all_data()
            else:
                await pg_writer.truncate_all()
            
            console.print("[bold green]✓ Database cleaned successfully![/bold green]\n")
            
            # Show final state
            info_after = await pg_writer.get_table_info()
            remaining = sum(c for c in info_after.values() if isinstance(c, int))
            
            if remaining > 0:
                console.print(f"[yellow]Remaining records: {remaining} (likely users or other protected data)[/yellow]")
            else:
                console.print("[green]All tables are now empty.[/green]")
            
            return True
            
        finally:
            await pg_writer.close()
    
    try:
        result = asyncio.run(run_cleanup())
        sys.exit(0 if result else 1)
    except Exception as e:
        console.print(f"\n[bold red]Cleanup failed: {e}[/bold red]")
        logger.exception("Cleanup failed")
        sys.exit(1)


@app.command()
def setup():
    """
    Setup configuration file (.env) for first-time use.
    
    This will help you create the .env file with your database credentials.
    """
    from pathlib import Path
    import shutil
    
    console.print("\n[bold blue]SPISA Migration Tool - Setup[/bold blue]\n")
    
    env_file = Path(".env")
    example_file = Path(".env.example")
    
    # Check if .env already exists
    if env_file.exists():
        console.print("[yellow]⚠️  .env file already exists![/yellow]\n")
        overwrite = typer.confirm("Do you want to overwrite it?", default=False)
        if not overwrite:
            console.print("[green]Setup cancelled. Your existing .env is preserved.[/green]")
            return
    
    # Copy from example if it exists
    if example_file.exists():
        shutil.copy(example_file, env_file)
        console.print("[green]✓ Created .env file from .env.example[/green]\n")
    else:
        # Create basic .env file
        env_content = """# SPISA Migration Tool Configuration

# SQL Server (Legacy Database)
SQLSERVER_HOST=localhost
SQLSERVER_PORT=1433
SQLSERVER_DATABASE=SPISA
SQLSERVER_USER=sa
SQLSERVER_PASSWORD=your_password_here
SQLSERVER_DRIVER=ODBC Driver 17 for SQL Server

# PostgreSQL (Modern Database)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=spisa
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password_here

# Migration Settings
MIGRATION_DRY_RUN=false
MIGRATION_BATCH_SIZE=1000
MIGRATION_GENERATE_REPORT=true
MIGRATION_REPORT_PATH=./migration-reports
"""
        env_file.write_text(env_content)
        console.print("[green]✓ Created .env file with default settings[/green]\n")
    
    console.print("[bold]Next steps:[/bold]")
    console.print("1. Edit the .env file and set your database passwords:")
    console.print("   - SQLSERVER_PASSWORD=your_sql_server_password")
    console.print("   - POSTGRES_PASSWORD=your_postgres_password")
    console.print("\n2. Optionally configure hosts and ports if not localhost")
    console.print("\n3. Test your configuration:")
    console.print("   python main.py status")
    console.print("\n[green]Setup complete! Edit .env and you're ready to go.[/green]\n")


if __name__ == "__main__":
    app()

