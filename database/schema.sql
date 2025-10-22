-- SPISA Database Schema - PostgreSQL 16+
-- Version: 1.0
-- Date: October 1, 2025
-- 
-- This schema represents a complete redesign of the legacy SPISA database
-- with modern PostgreSQL features, proper normalization, and audit trails.

-- ==============================================================================
-- DROP EXISTING OBJECTS (for idempotent execution)
-- ==============================================================================

-- Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS article_stock_levels CASCADE;
DROP MATERIALIZED VIEW IF EXISTS client_balances CASCADE;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS schema_version CASCADE;
DROP TABLE IF EXISTS account_movements CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS delivery_notes CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS sales_order_items CASCADE;
DROP TABLE IF EXISTS sales_orders CASCADE;
DROP TABLE IF EXISTS client_discounts CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS transporters CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS operation_types CASCADE;
DROP TABLE IF EXISTS tax_conditions CASCADE;
DROP TABLE IF EXISTS provinces CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop types
DROP TYPE IF EXISTS stock_movement_type CASCADE;
DROP TYPE IF EXISTS movement_type CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- ==============================================================================
-- EXTENSIONS
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Fuzzy text search
CREATE EXTENSION IF NOT EXISTS "unaccent";       -- Remove accents for search

-- ==============================================================================
-- ENUMS
-- ==============================================================================

CREATE TYPE user_role AS ENUM ('ADMIN', 'USER', 'VIEWER');
CREATE TYPE order_status AS ENUM ('PENDING', 'INVOICED', 'CANCELLED');
CREATE TYPE movement_type AS ENUM ('CHARGE', 'PAYMENT', 'ADJUSTMENT');
CREATE TYPE stock_movement_type AS ENUM ('SALE', 'PURCHASE', 'ADJUSTMENT', 'RETURN');

-- ==============================================================================
-- USERS & AUTHENTICATION
-- ==============================================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role user_role NOT NULL DEFAULT 'USER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_username_length CHECK (LENGTH(username) >= 3),
    CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

COMMENT ON TABLE users IS 'System users for authentication and audit trails';

-- ==============================================================================
-- LOOKUP TABLES
-- ==============================================================================

-- Provinces (Argentina)
CREATE TABLE provinces (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE provinces IS 'Argentine provinces';

-- Tax Conditions (IVA)
CREATE TABLE tax_conditions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tax_conditions IS 'IVA tax condition types (Responsable Inscripto, Monotributo, etc.)';

-- Operation Types
CREATE TABLE operation_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE operation_types IS 'Client operation types';

-- Payment Methods
CREATE TABLE payment_methods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    requires_check_data BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE payment_methods IS 'Payment methods (Cash, Check, Transfer, etc.)';

-- Transporters
CREATE TABLE transporters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    address VARCHAR(200),
    phone VARCHAR(50),
    email VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_transporters_active ON transporters(is_active) WHERE deleted_at IS NULL;

-- ==============================================================================
-- CATEGORIES
-- ==============================================================================

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    default_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    
    CONSTRAINT chk_discount_range CHECK (default_discount_percent >= 0 AND default_discount_percent <= 100)
);

CREATE INDEX idx_categories_code ON categories(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_active ON categories(is_active) WHERE deleted_at IS NULL;

COMMENT ON TABLE categories IS 'Product categories (Bridas, Espárragos, Válvulas, etc.)';

-- ==============================================================================
-- ARTICLES (INVENTORY)
-- ==============================================================================

CREATE TABLE articles (
    id BIGSERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    code VARCHAR(50) NOT NULL,
    description VARCHAR(500) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    unit_price DECIMAL(18,4) NOT NULL,
    cost_price DECIMAL(18,4),
    minimum_stock DECIMAL(12,3) DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    
    CONSTRAINT chk_unit_price_positive CHECK (unit_price >= 0),
    CONSTRAINT chk_cost_price_positive CHECK (cost_price IS NULL OR cost_price >= 0),
    CONSTRAINT chk_minimum_stock_positive CHECK (minimum_stock >= 0),
    CONSTRAINT uq_article_code UNIQUE (code, deleted_at)  -- Unique when not deleted
);

CREATE INDEX idx_articles_category ON articles(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_articles_code ON articles(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_articles_active ON articles(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_articles_low_stock ON articles(quantity) WHERE quantity <= minimum_stock AND deleted_at IS NULL;

-- Full-text search on description
CREATE INDEX idx_articles_description_fts ON articles USING gin(to_tsvector('spanish', description));

COMMENT ON TABLE articles IS 'Inventory items (products for sale)';
COMMENT ON COLUMN articles.quantity IS 'Current stock quantity';
COMMENT ON COLUMN articles.minimum_stock IS 'Alert threshold for low stock';

-- ==============================================================================
-- CLIENTS
-- ==============================================================================

CREATE TABLE clients (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    business_name VARCHAR(200) NOT NULL,
    cuit VARCHAR(11) NOT NULL,
    address VARCHAR(200),
    city VARCHAR(100),
    province_id INTEGER REFERENCES provinces(id),
    postal_code VARCHAR(10),
    phone VARCHAR(50),
    email VARCHAR(100),
    tax_condition_id INTEGER NOT NULL REFERENCES tax_conditions(id),
    operation_type_id INTEGER NOT NULL REFERENCES operation_types(id),
    transporter_id INTEGER REFERENCES transporters(id),
    credit_limit DECIMAL(18,2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    
    CONSTRAINT chk_cuit_format CHECK (cuit ~ '^\d{11}$'),
    CONSTRAINT chk_credit_limit_positive CHECK (credit_limit IS NULL OR credit_limit >= 0),
    CONSTRAINT uq_client_code UNIQUE (code, deleted_at),
    CONSTRAINT uq_client_cuit UNIQUE (cuit, deleted_at)
);

CREATE INDEX idx_clients_code ON clients(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_cuit ON clients(cuit) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_active ON clients(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_province ON clients(province_id);

-- Full-text search on business name
CREATE INDEX idx_clients_business_name_fts ON clients USING gin(to_tsvector('spanish', business_name));

COMMENT ON TABLE clients IS 'Customer/client master data';
COMMENT ON COLUMN clients.cuit IS 'Argentina tax ID (11 digits)';
COMMENT ON COLUMN clients.credit_limit IS 'Optional credit limit for the client';

-- ==============================================================================
-- CLIENT DISCOUNTS
-- ==============================================================================

CREATE TABLE client_discounts (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    discount_percent DECIMAL(5,2) NOT NULL,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    
    CONSTRAINT chk_discount_range CHECK (discount_percent >= 0 AND discount_percent <= 100),
    CONSTRAINT chk_valid_dates CHECK (valid_until IS NULL OR valid_until >= valid_from),
    CONSTRAINT uq_client_category_discount UNIQUE (client_id, category_id, valid_from)
);

CREATE INDEX idx_client_discounts_client ON client_discounts(client_id);
CREATE INDEX idx_client_discounts_category ON client_discounts(category_id);
CREATE INDEX idx_client_discounts_validity ON client_discounts(valid_from, valid_until);

COMMENT ON TABLE client_discounts IS 'Per-client discounts by product category';

-- ==============================================================================
-- SALES ORDERS
-- ==============================================================================

CREATE TABLE sales_orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(20) NOT NULL UNIQUE,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE,
    special_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    notes TEXT,
    status order_status NOT NULL DEFAULT 'PENDING',
    subtotal DECIMAL(18,4),
    discount_amount DECIMAL(18,4),
    total DECIMAL(18,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    
    CONSTRAINT chk_special_discount_range CHECK (special_discount_percent >= 0 AND special_discount_percent <= 100),
    CONSTRAINT chk_delivery_date CHECK (delivery_date IS NULL OR delivery_date >= order_date)
);

CREATE INDEX idx_sales_orders_number ON sales_orders(order_number);
CREATE INDEX idx_sales_orders_client ON sales_orders(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_date ON sales_orders(order_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_status ON sales_orders(status) WHERE deleted_at IS NULL;

COMMENT ON TABLE sales_orders IS 'Sales orders (Nota de Pedido)';
COMMENT ON COLUMN sales_orders.order_number IS 'Auto-generated order number';
COMMENT ON COLUMN sales_orders.special_discount_percent IS 'Additional discount on entire order';

-- ==============================================================================
-- SALES ORDER ITEMS
-- ==============================================================================

CREATE TABLE sales_order_items (
    id BIGSERIAL PRIMARY KEY,
    sales_order_id BIGINT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    article_id BIGINT NOT NULL REFERENCES articles(id),
    quantity DECIMAL(12,3) NOT NULL,
    unit_price DECIMAL(18,4) NOT NULL,
    discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    line_total DECIMAL(18,4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_unit_price_positive CHECK (unit_price >= 0),
    CONSTRAINT chk_discount_range CHECK (discount_percent >= 0 AND discount_percent <= 100),
    CONSTRAINT uq_order_article UNIQUE (sales_order_id, article_id)
);

CREATE INDEX idx_order_items_order ON sales_order_items(sales_order_id);
CREATE INDEX idx_order_items_article ON sales_order_items(article_id);

COMMENT ON TABLE sales_order_items IS 'Line items for sales orders';
COMMENT ON COLUMN sales_order_items.unit_price IS 'Price at time of order (historical)';

-- ==============================================================================
-- INVOICES
-- ==============================================================================

CREATE TABLE invoices (
    id BIGSERIAL PRIMARY KEY,
    invoice_number VARCHAR(20) NOT NULL UNIQUE,
    sales_order_id BIGINT NOT NULL REFERENCES sales_orders(id),
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    usd_exchange_rate DECIMAL(10,4),
    notes TEXT,
    is_printed BOOLEAN NOT NULL DEFAULT FALSE,
    printed_at TIMESTAMPTZ,
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    subtotal DECIMAL(18,4),
    tax_amount DECIMAL(18,4),
    total DECIMAL(18,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    
    CONSTRAINT chk_cancelled_reason CHECK (NOT is_cancelled OR cancellation_reason IS NOT NULL)
);

CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_order ON invoices(sales_order_id);
CREATE INDEX idx_invoices_date ON invoices(invoice_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_cancelled ON invoices(is_cancelled) WHERE deleted_at IS NULL;

COMMENT ON TABLE invoices IS 'Sales invoices (Facturas)';
COMMENT ON COLUMN invoices.usd_exchange_rate IS 'USD to local currency rate at invoice time';

-- ==============================================================================
-- DELIVERY NOTES
-- ==============================================================================

CREATE TABLE delivery_notes (
    id BIGSERIAL PRIMARY KEY,
    delivery_number VARCHAR(20) NOT NULL UNIQUE,
    sales_order_id BIGINT NOT NULL REFERENCES sales_orders(id),
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transporter_id INTEGER REFERENCES transporters(id),
    weight_kg DECIMAL(10,2),
    packages_count INTEGER,
    declared_value DECIMAL(18,2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    
    CONSTRAINT chk_weight_positive CHECK (weight_kg IS NULL OR weight_kg > 0),
    CONSTRAINT chk_packages_positive CHECK (packages_count IS NULL OR packages_count > 0)
);

CREATE INDEX idx_delivery_notes_number ON delivery_notes(delivery_number);
CREATE INDEX idx_delivery_notes_order ON delivery_notes(sales_order_id);
CREATE INDEX idx_delivery_notes_date ON delivery_notes(delivery_date) WHERE deleted_at IS NULL;

COMMENT ON TABLE delivery_notes IS 'Delivery/shipment notes (Remitos)';

-- ==============================================================================
-- STOCK MOVEMENTS
-- ==============================================================================

CREATE TABLE stock_movements (
    id BIGSERIAL PRIMARY KEY,
    article_id BIGINT NOT NULL REFERENCES articles(id),
    movement_type stock_movement_type NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    reference_type VARCHAR(50),
    reference_id BIGINT,
    notes TEXT,
    movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_article ON stock_movements(article_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(movement_date);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

COMMENT ON TABLE stock_movements IS 'Complete audit trail of all inventory movements';
COMMENT ON COLUMN stock_movements.quantity IS 'Positive for additions, negative for reductions';
COMMENT ON COLUMN stock_movements.reference_type IS 'Type of document (INVOICE, DELIVERY_NOTE, ADJUSTMENT, etc.)';
COMMENT ON COLUMN stock_movements.reference_id IS 'ID of the referenced document';

-- ==============================================================================
-- CURRENT ACCOUNT MOVEMENTS
-- ==============================================================================

CREATE TABLE account_movements (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    movement_type movement_type NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    reference_type VARCHAR(50),
    reference_id BIGINT,
    payment_method_id INTEGER REFERENCES payment_methods(id),
    payment_data JSONB,
    notes TEXT,
    movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id)
);

CREATE INDEX idx_account_movements_client ON account_movements(client_id);
CREATE INDEX idx_account_movements_date ON account_movements(movement_date);
CREATE INDEX idx_account_movements_reference ON account_movements(reference_type, reference_id);
CREATE INDEX idx_account_movements_payment_data ON account_movements USING gin(payment_data);

COMMENT ON TABLE account_movements IS 'Client account movements (charges and payments)';
COMMENT ON COLUMN account_movements.amount IS 'Positive for charges, negative for payments';
COMMENT ON COLUMN account_movements.payment_data IS 'Flexible JSON for check numbers, transfer IDs, etc.';

-- ==============================================================================
-- MATERIALIZED VIEWS
-- ==============================================================================

-- Client current balances
CREATE MATERIALIZED VIEW client_balances AS
SELECT 
    c.id,
    c.code,
    c.business_name,
    c.cuit,
    COALESCE(SUM(am.amount), 0) AS current_balance,
    MAX(am.movement_date) AS last_movement_date,
    COUNT(am.id) AS total_movements
FROM clients c
LEFT JOIN account_movements am ON am.client_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.code, c.business_name, c.cuit;

CREATE UNIQUE INDEX idx_client_balances_id ON client_balances(id);
CREATE INDEX idx_client_balances_code ON client_balances(code);

COMMENT ON MATERIALIZED VIEW client_balances IS 'Current account balances per client (refresh after payment/invoice operations)';

-- Article stock levels with category
CREATE MATERIALIZED VIEW article_stock_levels AS
SELECT 
    a.id,
    a.code,
    a.description,
    a.quantity,
    a.minimum_stock,
    a.unit_price,
    c.name AS category_name,
    CASE 
        WHEN a.quantity <= 0 THEN 'OUT_OF_STOCK'
        WHEN a.quantity <= a.minimum_stock THEN 'LOW_STOCK'
        ELSE 'NORMAL'
    END AS stock_status
FROM articles a
INNER JOIN categories c ON c.id = a.category_id
WHERE a.deleted_at IS NULL AND a.is_active = TRUE;

CREATE UNIQUE INDEX idx_article_stock_levels_id ON article_stock_levels(id);
CREATE INDEX idx_article_stock_levels_status ON article_stock_levels(stock_status);

COMMENT ON MATERIALIZED VIEW article_stock_levels IS 'Current stock levels with alerts (refresh periodically)';

-- ==============================================================================
-- FUNCTIONS & TRIGGERS
-- ==============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON sales_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_notes_updated_at BEFORE UPDATE ON delivery_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transporters_updated_at BEFORE UPDATE ON transporters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- INITIAL GRANTS (adjust for your security model)
-- ==============================================================================

-- Note: Railway uses 'postgres' user by default, so no additional grants needed
-- For local development with spisa_user, uncomment these lines:
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO spisa_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO spisa_user;

-- ==============================================================================
-- SCHEMA VERSION TRACKING
-- ==============================================================================

CREATE TABLE schema_version (
    version VARCHAR(20) PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_version (version, description) 
VALUES ('1.0.0', 'Initial schema creation with all core tables');

-- ==============================================================================
-- END OF SCHEMA
-- ==============================================================================

