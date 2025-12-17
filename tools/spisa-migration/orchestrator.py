"""Migration orchestrator with parallel waves."""
import asyncio
import logging
from datetime import datetime
from typing import List, Set
import time
import bcrypt

from db.sql_server import SqlServerReader
from db.postgres import PostgresWriter
from validators.migration import MigrationValidator
from models.result import MigrationResult, EntityMigrationResult
from models import legacy, modern
from mappers import entities

logger = logging.getLogger(__name__)


class MigrationOrchestrator:
    """Orchestrates the entire migration process with parallel execution."""
    
    def __init__(
        self,
        sql_reader: SqlServerReader,
        pg_writer: PostgresWriter,
        validator: MigrationValidator,
        parallel: bool = True
    ):
        self.sql_reader = sql_reader
        self.pg_writer = pg_writer
        self.validator = validator
        self.parallel = parallel
    
    async def execute(self) -> MigrationResult:
        """Execute full migration."""
        result = MigrationResult(start_time=datetime.utcnow())
        
        try:
            logger.info("Starting migration...")
            
            # Pre-validation
            logger.info("Validating legacy data...")
            validation = await self.validator.validate_legacy_data()
            if not validation.is_valid:
                logger.warning(f"Legacy data has {len(validation.issues)} issues")
                for issue in validation.issues:
                    logger.warning(f"  - {issue}")
            
            # Test connections
            logger.info("Testing database connections...")
            await self.sql_reader.test_connection()
            await self.pg_writer.test_connection()
            
            # Clear target database
            logger.info("Clearing target database...")
            await self.pg_writer.truncate_all()
            
            # Run migration
            if self.parallel:
                logger.info("Running PARALLEL migration...")
                await self._migrate_parallel(result)
            else:
                logger.info("Running SEQUENTIAL migration...")
                await self._migrate_sequential(result)
            
            # Post-validation
            logger.info("Validating record counts...")
            count_validation = await self.validator.validate_record_counts()
            
            logger.info("Validating referential integrity...")
            integrity_validation = await self.validator.validate_referential_integrity()
            
            if not count_validation.is_valid:
                result.errors.extend(count_validation.issues)
                result.success = False
            elif not integrity_validation.is_valid:
                result.errors.extend(integrity_validation.issues)
                result.success = False
            else:
                result.success = all(e.success for e in result.entities)
            
        except Exception as e:
            logger.exception("Migration failed")
            result.success = False
            result.errors.append(str(e))
        finally:
            result.end_time = datetime.utcnow()
        
        return result
    
    async def _migrate_parallel(self, result: MigrationResult):
        """Migrate in parallel waves."""
        # Wave 1: Lookup tables + categories (no dependencies)
        logger.info("Wave 1: Lookup tables and categories...")
        wave1_tasks = [
            self._migrate_provinces(),
            self._migrate_tax_conditions(),
            self._migrate_operation_types(),
            self._migrate_payment_methods(),
            self._migrate_transporters(),
            self._migrate_categories(),
        ]
        wave1_results = await asyncio.gather(*wave1_tasks, return_exceptions=True)
        result.entities.extend([r for r in wave1_results if not isinstance(r, Exception)])
        
        # Wave 2: Articles + Clients (depend on wave 1, independent of each other)
        logger.info("Wave 2: Articles and clients...")
        wave2_tasks = [
            self._migrate_articles(),
            self._migrate_clients(),
        ]
        wave2_results = await asyncio.gather(*wave2_tasks, return_exceptions=True)
        result.entities.extend([r for r in wave2_results if not isinstance(r, Exception)])
        
        # Wave 3: Sales orders (depends on clients)
        logger.info("Wave 3: Sales orders...")
        orders_result = await self._migrate_sales_orders()
        result.entities.append(orders_result)
        
        # Wave 4: Order items, invoices, delivery notes (depend on orders, independent of each other)
        logger.info("Wave 4: Order items, invoices, and delivery notes...")
        wave4_tasks = [
            self._migrate_order_items(),
            self._migrate_invoices(),
            self._migrate_delivery_notes(),
        ]
        wave4_results = await asyncio.gather(*wave4_tasks, return_exceptions=True)
        result.entities.extend([r for r in wave4_results if not isinstance(r, Exception)])
        
        # Wave 5: Invoice items and delivery note items (depend on wave 4)
        logger.info("Wave 5: Invoice items and delivery note items...")
        wave5_tasks = [
            self._migrate_invoice_items(),
            self._migrate_delivery_note_items(),
        ]
        wave5_results = await asyncio.gather(*wave5_tasks, return_exceptions=True)
        result.entities.extend([r for r in wave5_results if not isinstance(r, Exception)])
        
        # Wave 5.5: Update invoice totals from items
        logger.info("Wave 5.5: Calculating invoice totals...")
        totals_result = await self._update_invoice_totals()
        result.entities.append(totals_result)
        
        # Wave 6: Seed admin user
        logger.info("Wave 6: Seeding admin user...")
        admin_result = await self._seed_admin_user()
        result.entities.append(admin_result)
    
    async def _migrate_sequential(self, result: MigrationResult):
        """Migrate sequentially."""
        # Lookup tables
        result.entities.append(await self._migrate_provinces())
        result.entities.append(await self._migrate_tax_conditions())
        result.entities.append(await self._migrate_operation_types())
        result.entities.append(await self._migrate_payment_methods())
        result.entities.append(await self._migrate_transporters())
        
        # Categories
        result.entities.append(await self._migrate_categories())
        
        # Articles and clients
        result.entities.append(await self._migrate_articles())
        result.entities.append(await self._migrate_clients())
        
        # Sales orders
        result.entities.append(await self._migrate_sales_orders())
        
        # Order details
        result.entities.append(await self._migrate_order_items())
        result.entities.append(await self._migrate_invoices())
        result.entities.append(await self._migrate_delivery_notes())
        
        # Invoice and delivery note items
        result.entities.append(await self._migrate_invoice_items())
        result.entities.append(await self._migrate_delivery_note_items())
        
        # Update invoice totals
        result.entities.append(await self._update_invoice_totals())
        
        # Admin user
        result.entities.append(await self._seed_admin_user())
    
    async def _migrate_provinces(self) -> EntityMigrationResult:
        """Migrate provinces."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Provinces")
        
        try:
            legacy_data = await self.sql_reader.read_table("Provincias", legacy.LegacyProvincia)
            modern_data = [entities.map_province(item) for item in legacy_data]
            
            result.migrated_count = await self.pg_writer.bulk_insert("provinces", modern_data)
            await self.pg_writer.reset_sequence("provinces", "provinces_id_seq")
            
        except Exception as e:
            logger.exception("Failed to migrate provinces")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result
    
    async def _migrate_tax_conditions(self) -> EntityMigrationResult:
        """Migrate tax conditions."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Tax Conditions")
        
        try:
            legacy_data = await self.sql_reader.read_table("CondicionesIVA", legacy.LegacyCondicionIVA)
            modern_data = [entities.map_tax_condition(item) for item in legacy_data]
            
            result.migrated_count = await self.pg_writer.bulk_insert("tax_conditions", modern_data)
            await self.pg_writer.reset_sequence("tax_conditions", "tax_conditions_id_seq")
            
        except Exception as e:
            logger.exception("Failed to migrate tax conditions")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result
    
    async def _migrate_operation_types(self) -> EntityMigrationResult:
        """Migrate operation types."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Operation Types")
        
        try:
            legacy_data = await self.sql_reader.read_table("Operatorias", legacy.LegacyOperatoria)
            modern_data = [entities.map_operation_type(item) for item in legacy_data]
            
            result.migrated_count = await self.pg_writer.bulk_insert("operation_types", modern_data)
            await self.pg_writer.reset_sequence("operation_types", "operation_types_id_seq")
            
        except Exception as e:
            logger.exception("Failed to migrate operation types")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result
    
    async def _migrate_payment_methods(self) -> EntityMigrationResult:
        """Migrate payment methods."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Payment Methods")
        
        try:
            legacy_data = await self.sql_reader.read_table("FormasDePago", legacy.LegacyFormaDePago)
            modern_data = [entities.map_payment_method(item) for item in legacy_data]
            
            result.migrated_count = await self.pg_writer.bulk_insert("payment_methods", modern_data)
            await self.pg_writer.reset_sequence("payment_methods", "payment_methods_id_seq")
            
        except Exception as e:
            logger.exception("Failed to migrate payment methods")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result
    
    async def _migrate_transporters(self) -> EntityMigrationResult:
        """Migrate transporters."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Transporters")
        
        try:
            legacy_data = await self.sql_reader.read_table("Transportistas", legacy.LegacyTransportista)
            modern_data = [entities.map_transporter(item) for item in legacy_data]
            
            result.migrated_count = await self.pg_writer.bulk_insert("transporters", modern_data)
            await self.pg_writer.reset_sequence("transporters", "transporters_id_seq")
            
        except Exception as e:
            logger.exception("Failed to migrate transporters")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result
    
    async def _migrate_categories(self) -> EntityMigrationResult:
        """Migrate categories."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Categories")
        
        try:
            # Reset code cache
            entities.reset_category_code_cache()
            
            # Check if already migrated
            existing = await self.pg_writer.get_record_count("categories")
            if existing > 0:
                logger.info(f"Categories already exist ({existing} records), skipping")
                result.migrated_count = existing
                return result
            
            legacy_data = await self.sql_reader.read_table("Categorias", legacy.LegacyCategoria)
            modern_data = [entities.map_category(item) for item in legacy_data]
            
            result.migrated_count = await self.pg_writer.bulk_insert("categories", modern_data)
            await self.pg_writer.reset_sequence("categories", "categories_id_seq")
            
        except Exception as e:
            logger.exception("Failed to migrate categories")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result
    
    async def _migrate_articles(self) -> EntityMigrationResult:
        """Migrate articles."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Articles")
        
        try:
            legacy_data = await self.sql_reader.read_table("Articulos", legacy.LegacyArticulo)
            modern_data = [entities.map_article(item) for item in legacy_data]
            
            result.migrated_count = await self.pg_writer.bulk_insert("articles", modern_data)
            await self.pg_writer.reset_sequence("articles", "articles_id_seq")
            
        except Exception as e:
            logger.exception("Failed to migrate articles")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result
    
    async def _migrate_clients(self) -> EntityMigrationResult:
        """Migrate clients and client discounts."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Clients")
        
        try:
            # Migrate clients
            legacy_clients = await self.sql_reader.read_table("Clientes", legacy.LegacyCliente)
            modern_clients = [entities.map_client(item) for item in legacy_clients]
            
            result.migrated_count = await self.pg_writer.bulk_insert("clients", modern_clients)
            await self.pg_writer.reset_sequence("clients", "clients_id_seq")
            
            # Migrate client discounts (filter orphaned)
            legacy_discounts = await self.sql_reader.read_table("Descuentos", legacy.LegacyDescuento)
            legacy_categories = await self.sql_reader.read_table("Categorias", legacy.LegacyCategoria)
            
            valid_client_ids = {c.IdCliente for c in legacy_clients}
            valid_category_ids = {c.IdCategoria for c in legacy_categories}
            
            valid_discounts = [
                d for d in legacy_discounts
                if d.IdCliente in valid_client_ids and d.IdCategoria in valid_category_ids
            ]
            
            filtered_count = len(legacy_discounts) - len(valid_discounts)
            if filtered_count > 0:
                logger.warning(f"Filtered {filtered_count} orphaned client discounts")
            
            modern_discounts = [entities.map_client_discount(item) for item in valid_discounts]
            if modern_discounts:
                await self.pg_writer.bulk_insert("client_discounts", modern_discounts)
            
        except Exception as e:
            logger.exception("Failed to migrate clients")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result
    
    async def _migrate_sales_orders(self) -> EntityMigrationResult:
        """Migrate sales orders."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Sales Orders")
        
        try:
            legacy_orders = await self.sql_reader.read_table("NotaPedidos", legacy.LegacyNotaPedido)
            legacy_clients = await self.sql_reader.read_table("Clientes", legacy.LegacyCliente)
            
            # Filter orders with invalid client references
            valid_client_ids = {c.IdCliente for c in legacy_clients}
            valid_orders = [o for o in legacy_orders if o.IdCliente in valid_client_ids]
            
            filtered_count = len(legacy_orders) - len(valid_orders)
            if filtered_count > 0:
                logger.warning(f"Filtered {filtered_count} sales orders with invalid client FKs")
            
            modern_orders = [entities.map_sales_order(item) for item in valid_orders]
            
            result.migrated_count = await self.pg_writer.bulk_insert("sales_orders", modern_orders)
            await self.pg_writer.reset_sequence("sales_orders", "sales_orders_id_seq")
            
        except Exception as e:
            logger.exception("Failed to migrate sales orders")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result
    
    async def _migrate_order_items(self) -> EntityMigrationResult:
        """Migrate sales order items."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Order Items")
        
        try:
            legacy_items = await self.sql_reader.read_table("NotaPedido_Items", legacy.LegacyNotaPedidoItem)
            legacy_orders = await self.sql_reader.read_table("NotaPedidos", legacy.LegacyNotaPedido)
            legacy_articles = await self.sql_reader.read_table("Articulos", legacy.LegacyArticulo)
            
            valid_order_ids = {o.IdNotaPedido for o in legacy_orders}
            valid_article_ids = {a.idArticulo for a in legacy_articles}
            
            valid_items = [
                i for i in legacy_items
                if i.IdNotaPedido in valid_order_ids and i.IdArticulo in valid_article_ids
            ]
            
            filtered_count = len(legacy_items) - len(valid_items)
            if filtered_count > 0:
                logger.warning(f"Filtered {filtered_count} order items with invalid FK references")
            
            modern_items = [entities.map_sales_order_item(item) for item in valid_items]
            
            if modern_items:
                result.migrated_count = await self.pg_writer.bulk_insert("sales_order_items", modern_items)
            
        except Exception as e:
            logger.exception("Failed to migrate order items")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result
    
    async def _migrate_invoices(self) -> EntityMigrationResult:
        """Migrate invoices."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Invoices")
        
        try:
            legacy_invoices = await self.sql_reader.read_table("Facturas", legacy.LegacyFactura)
            legacy_orders = await self.sql_reader.read_table("NotaPedidos", legacy.LegacyNotaPedido)
            
            valid_order_ids = {o.IdNotaPedido for o in legacy_orders}
            valid_invoices = [inv for inv in legacy_invoices if inv.IdNotaPedido in valid_order_ids]
            
            filtered_count = len(legacy_invoices) - len(valid_invoices)
            if filtered_count > 0:
                logger.warning(f"Filtered {filtered_count} invoices with invalid sales_order FKs")
            
            modern_invoices = [entities.map_invoice(item) for item in valid_invoices]
            
            result.migrated_count = await self.pg_writer.bulk_insert("invoices", modern_invoices)
            await self.pg_writer.reset_sequence("invoices", "invoices_id_seq")
            
        except Exception as e:
            logger.exception("Failed to migrate invoices")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result
    
    async def _migrate_delivery_notes(self) -> EntityMigrationResult:
        """Migrate delivery notes."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Delivery Notes")
        
        try:
            legacy_remitos = await self.sql_reader.read_table("Remitos", legacy.LegacyRemito)
            legacy_orders = await self.sql_reader.read_table("NotaPedidos", legacy.LegacyNotaPedido)
            
            # Get valid transporter IDs from PostgreSQL
            valid_transporter_ids = await self.pg_writer.get_valid_ids("transporters")
            
            # Filter delivery notes with invalid sales_order references
            valid_order_ids = {o.IdNotaPedido for o in legacy_orders}
            valid_remitos = [r for r in legacy_remitos if r.IdNotaPedido in valid_order_ids]
            
            filtered_count = len(legacy_remitos) - len(valid_remitos)
            if filtered_count > 0:
                logger.warning(f"Filtered {filtered_count} delivery notes with invalid sales_order FKs")
            
            # Map and fix invalid transporter FKs
            modern_notes = []
            invalid_transporter_count = 0
            
            for remito in valid_remitos:
                note = entities.map_delivery_note(remito)
                # Set transporter to None if it doesn't exist
                if note.transporter_id is not None and note.transporter_id not in valid_transporter_ids:
                    note.transporter_id = None
                    invalid_transporter_count += 1
                modern_notes.append(note)
            
            if invalid_transporter_count > 0:
                logger.warning(f"Set {invalid_transporter_count} delivery notes with invalid transporter FKs to NULL")
            
            result.migrated_count = await self.pg_writer.bulk_insert("delivery_notes", modern_notes)
            await self.pg_writer.reset_sequence("delivery_notes", "delivery_notes_id_seq")
            
        except Exception as e:
            logger.exception("Failed to migrate delivery notes")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result
    
    async def _migrate_invoice_items(self) -> EntityMigrationResult:
        """Migrate invoice items by copying from sales_order_items."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Invoice Items")
        
        try:
            # Query to get invoices with their sales orders
            invoices_query = """
                SELECT i.id as invoice_id, i.sales_order_id 
                FROM invoices i
                ORDER BY i.id
            """
            invoices = await self.pg_writer.fetch_all(invoices_query)
            
            if not invoices:
                logger.info("No invoices found, skipping invoice items")
                return result
            
            # Query to get sales_order_items with article information
            items_query = """
                SELECT 
                    soi.id as sales_order_item_id,
                    soi.sales_order_id,
                    soi.article_id,
                    a.code as article_code,
                    a.description as article_description,
                    soi.quantity,
                    soi.unit_price,
                    soi.discount_percent,
                    soi.line_total
                FROM sales_order_items soi
                JOIN articles a ON soi.article_id = a.id
                ORDER BY soi.sales_order_id, soi.id
            """
            all_items = await self.pg_writer.fetch_all(items_query)
            
            # Group items by sales_order_id for fast lookup
            items_by_order = {}
            for item in all_items:
                order_id = item['sales_order_id']
                if order_id not in items_by_order:
                    items_by_order[order_id] = []
                items_by_order[order_id].append(item)
            
            # Create invoice_items for each invoice
            invoice_items = []
            for invoice in invoices:
                order_id = invoice['sales_order_id']
                invoice_id = invoice['invoice_id']
                
                # Get items for this sales order
                order_items = items_by_order.get(order_id, [])
                
                for item in order_items:
                    invoice_items.append((
                        invoice_id,  # invoice_id
                        item['sales_order_item_id'],  # sales_order_item_id
                        item['article_id'],  # article_id
                        item['article_code'],  # article_code
                        item['article_description'],  # article_description
                        item['quantity'],  # quantity
                        item['unit_price'],  # unit_price_usd
                        item['unit_price'],  # unit_price_ars (same as USD for now)
                        item['discount_percent'],  # discount_percent
                        item['line_total'],  # line_total
                        datetime.utcnow(),  # created_at
                    ))
            
            if invoice_items:
                # Bulk insert using COPY
                columns = [
                    "invoice_id", "sales_order_item_id", "article_id", "article_code",
                    "article_description", "quantity", "unit_price_usd", "unit_price_ars",
                    "discount_percent", "line_total", "created_at"
                ]
                
                async with self.pg_writer.pool.acquire() as conn:
                    await conn.copy_records_to_table(
                        table_name="invoice_items",
                        records=invoice_items,
                        columns=columns
                    )
                
                await self.pg_writer.reset_sequence("invoice_items", "invoice_items_id_seq")
                result.migrated_count = len(invoice_items)
                logger.info(f"Migrated {len(invoice_items)} invoice items from {len(invoices)} invoices")
            else:
                logger.warning("No invoice items to migrate")
            
        except Exception as e:
            logger.exception("Failed to migrate invoice items")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result
    
    async def _migrate_delivery_note_items(self) -> EntityMigrationResult:
        """Migrate delivery note items by copying from sales_order_items."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Delivery Note Items")
        
        try:
            # Query to get delivery notes with their sales orders
            delivery_notes_query = """
                SELECT dn.id as delivery_note_id, dn.sales_order_id 
                FROM delivery_notes dn
                ORDER BY dn.id
            """
            delivery_notes = await self.pg_writer.fetch_all(delivery_notes_query)
            
            if not delivery_notes:
                logger.info("No delivery notes found, skipping delivery note items")
                return result
            
            # Query to get sales_order_items with article information
            items_query = """
                SELECT 
                    soi.id as sales_order_item_id,
                    soi.sales_order_id,
                    soi.article_id,
                    a.code as article_code,
                    a.description as article_description,
                    soi.quantity
                FROM sales_order_items soi
                JOIN articles a ON soi.article_id = a.id
                ORDER BY soi.sales_order_id, soi.id
            """
            all_items = await self.pg_writer.fetch_all(items_query)
            
            # Group items by sales_order_id for fast lookup
            items_by_order = {}
            for item in all_items:
                order_id = item['sales_order_id']
                if order_id not in items_by_order:
                    items_by_order[order_id] = []
                items_by_order[order_id].append(item)
            
            # Create delivery_note_items for each delivery note
            delivery_note_items = []
            for dn in delivery_notes:
                order_id = dn['sales_order_id']
                dn_id = dn['delivery_note_id']
                
                # Get items for this sales order
                order_items = items_by_order.get(order_id, [])
                
                for item in order_items:
                    delivery_note_items.append((
                        dn_id,  # delivery_note_id
                        item['sales_order_item_id'],  # sales_order_item_id
                        item['article_id'],  # article_id
                        item['article_code'],  # article_code
                        item['article_description'],  # article_description
                        item['quantity'],  # quantity
                        datetime.utcnow(),  # created_at
                    ))
            
            if delivery_note_items:
                # Bulk insert using COPY
                columns = [
                    "delivery_note_id", "sales_order_item_id", "article_id", "article_code",
                    "article_description", "quantity", "created_at"
                ]
                
                async with self.pg_writer.pool.acquire() as conn:
                    await conn.copy_records_to_table(
                        table_name="delivery_note_items",
                        records=delivery_note_items,
                        columns=columns
                    )
                
                await self.pg_writer.reset_sequence("delivery_notes", "delivery_notes_id_seq")
                result.migrated_count = len(delivery_note_items)
                logger.info(f"Migrated {len(delivery_note_items)} delivery note items from {len(delivery_notes)} delivery notes")
            else:
                logger.warning("No delivery note items to migrate")
            
        except Exception as e:
            logger.exception("Failed to migrate delivery note items")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result
    
    async def _update_invoice_totals(self) -> EntityMigrationResult:
        """Calculate and update invoice totals from invoice_items."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Invoice Totals Update")
        
        try:
            # Get all invoices with their client's tax condition
            invoices_query = """
                SELECT 
                    i.id as invoice_id,
                    i.sales_order_id,
                    so.client_id,
                    c.tax_condition_id
                FROM invoices i
                JOIN sales_orders so ON i.sales_order_id = so.id
                JOIN clients c ON so.client_id = c.id
                ORDER BY i.id
            """
            invoices = await self.pg_writer.fetch_all(invoices_query)
            
            if not invoices:
                logger.info("No invoices found to update")
                return result
            
            # Get all invoice items with totals
            items_query = """
                SELECT 
                    invoice_id,
                    SUM(line_total) as subtotal
                FROM invoice_items
                GROUP BY invoice_id
            """
            items_totals = await self.pg_writer.fetch_all(items_query)
            totals_by_invoice = {item['invoice_id']: item['subtotal'] for item in items_totals}
            
            # Tax conditions: 1=Responsable Inscripto (21% IVA), 2=Monotributista (no IVA), 3=Exento (no IVA)
            # This is a simplification - adjust based on actual business rules
            
            updates_count = 0
            for invoice in invoices:
                invoice_id = invoice['invoice_id']
                subtotal = float(totals_by_invoice.get(invoice_id, 0))
                tax_condition_id = invoice['tax_condition_id']
                
                # Calculate tax based on tax condition
                # Responsable Inscripto (typically ID=1) pays 21% IVA
                if tax_condition_id == 1:
                    tax_rate = 0.21
                else:
                    tax_rate = 0.0  # Monotributista, Exento, etc.
                
                tax_amount = subtotal * tax_rate
                total_amount = subtotal + tax_amount
                
                # Update invoice
                update_sql = """
                    UPDATE invoices 
                    SET 
                        net_amount = $1,
                        tax_amount = $2,
                        total_amount = $3,
                        updated_at = $4
                    WHERE id = $5
                """
                
                async with self.pg_writer.pool.acquire() as conn:
                    await conn.execute(
                        update_sql,
                        subtotal,
                        tax_amount,
                        total_amount,
                        datetime.utcnow(),
                        invoice_id
                    )
                
                updates_count += 1
            
            result.migrated_count = updates_count
            logger.info(f"Updated totals for {updates_count} invoices")
            
        except Exception as e:
            logger.exception("Failed to update invoice totals")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result
    
    async def _seed_admin_user(self) -> EntityMigrationResult:
        """Seed admin user."""
        start = time.time()
        result = EntityMigrationResult(entity_name="Admin User")
        
        try:
            # Check if users exist
            existing = await self.pg_writer.get_record_count("users", check_deleted=False)
            if existing > 0:
                logger.info(f"Users already exist ({existing} records), skipping admin seed")
                result.migrated_count = existing
                return result
            
            # Hash password
            password_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode('utf-8')
            
            # Create admin user as tuple
            admin_tuple = [(
                "admin",  # username
                "admin@spisa.local",  # email
                password_hash,  # password_hash
                "System Administrator",  # full_name
                "Admin",  # role
                True,  # is_active
                None,  # last_login_at
                datetime.utcnow(),  # created_at
                datetime.utcnow(),  # updated_at
            )]
            
            columns = [
                "username", "email", "password_hash", "full_name", "role",
                "is_active", "last_login_at", "created_at", "updated_at"
            ]
            
            async with self.pg_writer.pool.acquire() as conn:
                await conn.copy_records_to_table(
                    table_name="users",
                    records=admin_tuple,
                    columns=columns
                )
            
            await self.pg_writer.reset_sequence("users", "users_id_seq")
            
            result.migrated_count = 1
            logger.info("Seeded admin user: admin")
            
        except Exception as e:
            logger.exception("Failed to seed admin user")
            result.errors.append(str(e))
            result.failed_count = 1
        finally:
            result.duration = time.time() - start
        
        return result

