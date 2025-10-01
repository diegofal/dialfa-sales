-- SPISA Database Cleanup Script
-- Limpia TODAS las tablas manteniendo la estructura

-- Deshabilitar temporalmente las foreign keys para truncar
SET session_replication_role = 'replica';

-- Limpiar tablas transaccionales (orden: hijos primero)
TRUNCATE TABLE account_movements RESTART IDENTITY CASCADE;
TRUNCATE TABLE stock_movements RESTART IDENTITY CASCADE;
TRUNCATE TABLE sales_order_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE delivery_notes RESTART IDENTITY CASCADE;
TRUNCATE TABLE invoices RESTART IDENTITY CASCADE;
TRUNCATE TABLE sales_orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE client_discounts RESTART IDENTITY CASCADE;

-- Limpiar tablas maestras
TRUNCATE TABLE articles RESTART IDENTITY CASCADE;
TRUNCATE TABLE clients RESTART IDENTITY CASCADE;
TRUNCATE TABLE categories RESTART IDENTITY CASCADE;

-- Limpiar lookup tables (mantener solo las esenciales)
TRUNCATE TABLE transporters RESTART IDENTITY CASCADE;
TRUNCATE TABLE operation_types RESTART IDENTITY CASCADE;
-- NO limpiar: provinces, tax_conditions, payment_methods (son estándar)

-- Limpiar usuarios (excepto admin si quieres mantenerlo)
-- TRUNCATE TABLE users RESTART IDENTITY CASCADE;

-- Refrescar vistas materializadas
REFRESH MATERIALIZED VIEW IF EXISTS client_balances;

-- Re-habilitar foreign keys
SET session_replication_role = 'origin';

-- Verificar limpieza
SELECT 
    'articles' as table_name, COUNT(*) as count FROM articles
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'clients', COUNT(*) FROM clients
UNION ALL SELECT 'sales_orders', COUNT(*) FROM sales_orders
UNION ALL SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL SELECT 'transporters', COUNT(*) FROM transporters
UNION ALL SELECT 'operation_types', COUNT(*) FROM operation_types;

