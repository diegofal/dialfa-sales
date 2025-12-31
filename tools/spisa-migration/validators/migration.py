"""Migration validators for data integrity checks."""
import asyncio
import logging
from typing import Dict, Tuple

from db.sql_server import SqlServerReader
from db.postgres import PostgresWriter
from models.result import ValidationResult

logger = logging.getLogger(__name__)


class MigrationValidator:
    """Validates data before and after migration."""
    
    def __init__(self, sql_reader: SqlServerReader, pg_writer: PostgresWriter):
        self.sql_reader = sql_reader
        self.pg_writer = pg_writer
    
    async def validate_legacy_data(self) -> ValidationResult:
        """Validate legacy data for common issues."""
        result = ValidationResult(is_valid=True)
        
        # Run validation queries in thread pool
        checks = [
            self._check_orphaned_articles(),
            self._check_orphaned_clients(),
            self._check_invalid_cuits(),
            self._check_negative_stock(),
        ]
        
        check_results = await asyncio.gather(*checks, return_exceptions=True)
        
        for check_result in check_results:
            if isinstance(check_result, Exception):
                result.issues.append(f"Validation error: {str(check_result)}")
            elif isinstance(check_result, str):
                result.issues.append(check_result)
        
        result.is_valid = len(result.issues) == 0
        
        if not result.is_valid:
            logger.warning(f"Legacy data validation found {len(result.issues)} issues")
        
        return result
    
    async def _check_orphaned_articles(self) -> str:
        """Check for articles without valid category."""
        query = """
            SELECT COUNT(*) 
            FROM Articulos a 
            LEFT JOIN Categorias c ON a.IdCategoria = c.IdCategoria 
            WHERE c.IdCategoria IS NULL
        """
        count = await asyncio.to_thread(self._execute_sql_count, query)
        if count > 0:
            return f"Found {count} articles without valid category"
        return None
    
    async def _check_orphaned_clients(self) -> str:
        """Check for clients without valid province."""
        query = """
            SELECT COUNT(*) 
            FROM Clientes cl 
            LEFT JOIN Provincias p ON cl.IdProvincia = p.IdProvincia 
            WHERE p.IdProvincia IS NULL
        """
        count = await asyncio.to_thread(self._execute_sql_count, query)
        if count > 0:
            return f"Found {count} clients without valid province"
        return None
    
    async def _check_invalid_cuits(self) -> str:
        """Check for invalid CUIT formats."""
        query = """
            SELECT COUNT(*) 
            FROM Clientes 
            WHERE LEN(CUIT) != 11 OR CUIT LIKE '%[^0-9]%'
        """
        count = await asyncio.to_thread(self._execute_sql_count, query)
        if count > 0:
            return f"Found {count} clients with invalid CUIT format (will be cleaned)"
        return None
    
    async def _check_negative_stock(self) -> str:
        """Check for negative stock."""
        query = "SELECT COUNT(*) FROM Articulos WHERE cantidad < 0"
        count = await asyncio.to_thread(self._execute_sql_count, query)
        if count > 0:
            return f"Found {count} articles with negative stock"
        return None
    
    def _execute_sql_count(self, query: str) -> int:
        """Execute SQL query that returns count."""
        conn = self.sql_reader._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(query)
            return cursor.fetchone()[0]
        finally:
            cursor.close()
            conn.close()
    
    async def validate_migrated_data(self) -> ValidationResult:
        """Validate migrated data in PostgreSQL."""
        result = ValidationResult(is_valid=True)
        
        # Check invalid CUITs
        invalid_cuits = await self._check_pg_invalid_cuits()
        if invalid_cuits > 0:
            result.issues.append(f"Found {invalid_cuits} clients with invalid CUIT in PostgreSQL")
            result.is_valid = False
        
        # Check negative prices
        negative_prices = await self._check_pg_negative_prices()
        if negative_prices > 0:
            result.issues.append(f"Found {negative_prices} articles with negative prices")
            result.is_valid = False
        
        return result
    
    async def _check_pg_invalid_cuits(self) -> int:
        """Check invalid CUITs in PostgreSQL."""
        query = """
            SELECT COUNT(*) 
            FROM clients 
            WHERE cuit !~ '^\\d{11}$' AND deleted_at IS NULL
        """
        async with self.pg_writer.pool.acquire() as conn:
            count = await conn.fetchval(query)
        return count
    
    async def _check_pg_negative_prices(self) -> int:
        """Check negative prices in PostgreSQL."""
        query = """
            SELECT COUNT(*) 
            FROM articles 
            WHERE unit_price < 0 AND deleted_at IS NULL
        """
        async with self.pg_writer.pool.acquire() as conn:
            count = await conn.fetchval(query)
        return count
    
    async def validate_referential_integrity(self) -> ValidationResult:
        """Validate referential integrity in PostgreSQL."""
        result = ValidationResult(is_valid=True)
        
        checks = [
            ("articles → categories", """
                SELECT COUNT(*) 
                FROM articles a 
                LEFT JOIN categories c ON a.category_id = c.id 
                WHERE c.id IS NULL AND a.deleted_at IS NULL
            """),
            ("clients → provinces", """
                SELECT COUNT(*) 
                FROM clients cl 
                LEFT JOIN provinces p ON cl.province_id = p.id 
                WHERE p.id IS NULL AND cl.deleted_at IS NULL
            """),
            ("sales_orders → clients", """
                SELECT COUNT(*) 
                FROM sales_orders so 
                LEFT JOIN clients c ON so.client_id = c.id 
                WHERE c.id IS NULL AND so.deleted_at IS NULL
            """),
        ]
        
        # Acquire connection once for all validation checks
        async with self.pg_writer.pool.acquire() as conn:
            for check_name, query in checks:
                count = await conn.fetchval(query)
                
                if count > 0:
                    result.issues.append(f"{check_name}: Found {count} orphaned records")
                    result.is_valid = False
        
        return result
    
    async def validate_record_counts(self) -> ValidationResult:
        """Compare record counts between SQL Server and PostgreSQL."""
        result = ValidationResult(is_valid=True)
        
        # Tables with deleted_at column (soft deletes) - exact match expected
        comparisons_with_deletes: Dict[str, Tuple[str, str]] = {
            "Categories": ("Categorias", "categories"),
            "Clients": ("Clientes", "clients"),
            "Sales Orders": ("NotaPedidos", "sales_orders"),
            "Invoices": ("Facturas", "invoices"),
            "Delivery Notes": ("Remitos", "delivery_notes"),
        }
        
        # Validate tables with soft deletes (exact match)
        for entity, (sql_table, pg_table) in comparisons_with_deletes.items():
            sql_count = await self.sql_reader.get_record_count(sql_table)
            pg_count = await self.pg_writer.get_record_count(pg_table, check_deleted=True)
            
            if sql_count != pg_count:
                result.issues.append(
                    f"{entity}: SQL Server={sql_count}, PostgreSQL={pg_count} (mismatch!)"
                )
                result.is_valid = False
            else:
                logger.info(f"{entity}: {sql_count} records match")
        
        # Special validation for Articles (discontinued articles are excluded)
        await self._validate_articles_count(result)
        
        # Special validation for Order Items (items with discontinued articles are excluded)
        await self._validate_order_items_count(result)
        
        # Special validation for invoice_items and delivery_note_items
        # (they don't exist in legacy system, so we validate they were properly created)
        await self._validate_item_replication(result)
        
        return result
    
    async def _validate_articles_count(self, result: ValidationResult):
        """Validate articles count (discontinued articles are excluded from migration)."""
        # Get count of non-discontinued articles from SQL Server
        query = "SELECT COUNT(*) FROM Articulos WHERE discontinuado = 0 OR discontinuado IS NULL"
        sql_active_count = await asyncio.to_thread(self._execute_sql_count, query)
        pg_count = await self.pg_writer.get_record_count("articles", check_deleted=True)
        
        if sql_active_count != pg_count:
            result.issues.append(
                f"Articles: SQL Server (active)={sql_active_count}, PostgreSQL={pg_count} (mismatch!)"
            )
            result.is_valid = False
        else:
            logger.info(f"Articles: {pg_count} records match (discontinued excluded)")
    
    async def _validate_order_items_count(self, result: ValidationResult):
        """Validate order items count (items with discontinued articles are excluded)."""
        # Get count of order items with active articles from SQL Server
        query = """
            SELECT COUNT(*) 
            FROM NotaPedido_Items npi
            INNER JOIN Articulos a ON npi.IdArticulo = a.idArticulo
            WHERE a.discontinuado = 0 OR a.discontinuado IS NULL
        """
        sql_active_count = await asyncio.to_thread(self._execute_sql_count, query)
        pg_count = await self.pg_writer.get_record_count("sales_order_items", check_deleted=False)
        
        if sql_active_count != pg_count:
            result.issues.append(
                f"Order Items: SQL Server (with active articles)={sql_active_count}, PostgreSQL={pg_count} (mismatch!)"
            )
            result.is_valid = False
        else:
            logger.info(f"Order Items: {pg_count} records match (discontinued article items excluded)")
    
    async def _validate_item_replication(self, result: ValidationResult):
        """Validate that invoice and delivery note items were properly replicated."""
        try:
            # Validate invoice items
            invoice_count = await self.pg_writer.get_record_count("invoices", check_deleted=True)
            invoice_items_count = await self.pg_writer.get_record_count("invoice_items", check_deleted=False)
            
            if invoice_count > 0 and invoice_items_count == 0:
                result.issues.append(
                    f"Invoice Items: {invoice_count} invoices exist but 0 invoice items (items not replicated!)"
                )
                result.is_valid = False
            else:
                logger.info(f"Invoice Items: {invoice_items_count} items for {invoice_count} invoices")
            
            # Validate delivery note items
            dn_count = await self.pg_writer.get_record_count("delivery_notes", check_deleted=True)
            dn_items_count = await self.pg_writer.get_record_count("delivery_note_items", check_deleted=False)
            
            if dn_count > 0 and dn_items_count == 0:
                result.issues.append(
                    f"Delivery Note Items: {dn_count} delivery notes exist but 0 items (items not replicated!)"
                )
                result.is_valid = False
            else:
                logger.info(f"Delivery Note Items: {dn_items_count} items for {dn_count} delivery notes")
                
        except Exception as e:
            logger.warning(f"Failed to validate item replication: {e}")
            result.issues.append(f"Item replication validation error: {e}")

