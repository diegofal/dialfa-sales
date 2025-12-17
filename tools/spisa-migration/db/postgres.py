"""PostgreSQL async writer with bulk COPY support."""
import asyncpg
import logging
from typing import Any, List, Set
from dataclasses import fields, is_dataclass

logger = logging.getLogger(__name__)


def to_snake_case(name: str) -> str:
    """Convert PascalCase/camelCase to snake_case."""
    result = []
    for i, char in enumerate(name):
        if char.isupper() and i > 0:
            result.append('_')
        result.append(char.lower())
    return ''.join(result)


class PostgresWriter:
    """Async PostgreSQL writer with bulk insert capabilities."""
    
    def __init__(self, dsn: str, dry_run: bool = False):
        self.dsn = dsn
        self.dry_run = dry_run
        self.pool: asyncpg.Pool = None
        
    async def connect(self):
        """Create connection pool."""
        self.pool = await asyncpg.create_pool(
            self.dsn,
            min_size=2,
            max_size=10,
            command_timeout=600
        )
        logger.info("Connected to PostgreSQL")
        
    async def close(self):
        """Close connection pool."""
        if self.pool:
            await self.pool.close()
            
    async def test_connection(self):
        """Test database connection."""
        async with self.pool.acquire() as conn:
            version = await conn.fetchval("SELECT version()")
            logger.info(f"PostgreSQL version: {version}")
            
    async def bulk_insert(self, table: str, records: List[Any]) -> int:
        """
        Bulk insert using COPY protocol - extremely fast.
        
        Args:
            table: Target table name
            records: List of dataclass instances
            
        Returns:
            Number of records inserted
        """
        if not records:
            return 0
            
        if self.dry_run:
            logger.info(f"[DRY RUN] Would insert {len(records)} records into {table}")
            return len(records)
        
        # Get field names from first record
        if is_dataclass(records[0]):
            field_names = [f.name for f in fields(records[0])]
            column_names = [to_snake_case(f) for f in field_names]
            
            # Convert dataclasses to tuples
            tuples = []
            for record in records:
                tuple_data = tuple(getattr(record, f) for f in field_names)
                tuples.append(tuple_data)
        else:
            raise ValueError("Records must be dataclass instances")
        
        async with self.pool.acquire() as conn:
            await conn.copy_records_to_table(
                table_name=table,
                records=tuples,
                columns=column_names
            )
            
        logger.info(f"Inserted {len(records)} records into {table}")
        return len(records)
    
    async def truncate_table(self, table: str):
        """Truncate a single table."""
        if self.dry_run:
            logger.info(f"[DRY RUN] Would truncate table {table}")
            return
            
        async with self.pool.acquire() as conn:
            await conn.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE")
            
        logger.info(f"Truncated table {table}")
    
    async def truncate_all(self):
        """Truncate all tables in reverse dependency order."""
        if self.dry_run:
            logger.info("[DRY RUN] Would truncate all tables")
            return
        
        tables_sql = """
            TRUNCATE TABLE 
                delivery_notes,
                invoices,
                sales_order_items,
                sales_orders,
                client_discounts,
                clients,
                articles,
                categories,
                transporters,
                payment_methods,
                operation_types,
                tax_conditions,
                provinces
            RESTART IDENTITY CASCADE
        """
        
        async with self.pool.acquire() as conn:
            await conn.execute(tables_sql)
            
        logger.info("Truncated all migration tables (users preserved)")
    
    async def cleanup_all_data(self):
        """
        Complete cleanup - truncate all tables including users.
        This is useful for fresh migrations from scratch.
        """
        if self.dry_run:
            logger.info("[DRY RUN] Would cleanup all data")
            return
        
        tables_sql = """
            TRUNCATE TABLE 
                users,
                delivery_notes,
                invoices,
                sales_order_items,
                sales_orders,
                client_discounts,
                clients,
                articles,
                categories,
                transporters,
                payment_methods,
                operation_types,
                tax_conditions,
                provinces
            RESTART IDENTITY CASCADE
        """
        
        async with self.pool.acquire() as conn:
            await conn.execute(tables_sql)
            
        logger.info("Cleaned up all tables including users")
    
    async def get_table_info(self) -> dict:
        """Get information about all migration tables."""
        tables = [
            "provinces", "tax_conditions", "operation_types", 
            "payment_methods", "transporters", "categories",
            "articles", "clients", "client_discounts",
            "sales_orders", "sales_order_items", "invoices",
            "delivery_notes", "users"
        ]
        
        info = {}
        async with self.pool.acquire() as conn:
            for table in tables:
                try:
                    # Check if table has deleted_at column
                    has_deleted = await conn.fetchval(f"""
                        SELECT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name = '{table}' AND column_name = 'deleted_at'
                        )
                    """)
                    
                    if has_deleted and table != "users":
                        count = await conn.fetchval(
                            f"SELECT COUNT(*) FROM {table} WHERE deleted_at IS NULL"
                        )
                    else:
                        count = await conn.fetchval(f"SELECT COUNT(*) FROM {table}")
                    
                    info[table] = count
                except Exception as e:
                    info[table] = f"Error: {str(e)}"
        
        return info
    
    async def reset_sequence(self, table: str, sequence: str):
        """Reset sequence to max ID in table."""
        if self.dry_run:
            logger.info(f"[DRY RUN] Would reset sequence {sequence}")
            return
            
        sql = f"SELECT setval('{sequence}', COALESCE((SELECT MAX(id) FROM {table}), 1))"
        
        async with self.pool.acquire() as conn:
            await conn.execute(sql)
            
        logger.info(f"Reset sequence {sequence} for table {table}")
    
    async def get_record_count(self, table: str, check_deleted: bool = True) -> int:
        """Get count of records in table."""
        if check_deleted:
            sql = f"SELECT COUNT(*) FROM {table} WHERE deleted_at IS NULL"
        else:
            sql = f"SELECT COUNT(*) FROM {table}"
            
        async with self.pool.acquire() as conn:
            count = await conn.fetchval(sql)
            
        return count
    
    async def get_valid_ids(self, table: str) -> Set[int]:
        """Get all valid IDs from a table."""
        sql = f"SELECT id FROM {table}"
        
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(sql)
            
        return {row['id'] for row in rows}
    
    async def execute_sql(self, sql: str):
        """Execute raw SQL."""
        if self.dry_run:
            logger.info(f"[DRY RUN] Would execute: {sql[:100]}...")
            return
            
        async with self.pool.acquire() as conn:
            await conn.execute(sql)
    
    async def fetch_all(self, sql: str) -> list:
        """Fetch all rows from a query."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(sql)
            return [dict(row) for row in rows]

