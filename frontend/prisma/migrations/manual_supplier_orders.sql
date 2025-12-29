-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  contact_name VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(50),
  address VARCHAR(300),
  notes TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ(6) DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ(6) DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ(6),
  created_by INTEGER,
  updated_by INTEGER
);

CREATE INDEX IF NOT EXISTS "IX_suppliers_code" ON suppliers(code);
CREATE INDEX IF NOT EXISTS "IX_suppliers_name" ON suppliers(name);

-- Add foreign key to articles table
ALTER TABLE articles 
ADD CONSTRAINT "f_k_articles__suppliers_supplier_id" 
FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "IX_articles_supplier_id" ON articles(supplier_id);

-- Create supplier_orders table
CREATE TABLE IF NOT EXISTS supplier_orders (
  id BIGSERIAL PRIMARY KEY,
  order_number VARCHAR(20) UNIQUE NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON UPDATE NO ACTION,
  status VARCHAR(20) DEFAULT 'draft' NOT NULL,
  order_date TIMESTAMPTZ(6) DEFAULT NOW() NOT NULL,
  expected_delivery_date TIMESTAMPTZ(6),
  actual_delivery_date TIMESTAMPTZ(6),
  total_items INTEGER DEFAULT 0 NOT NULL,
  total_quantity INTEGER DEFAULT 0 NOT NULL,
  estimated_sale_time_months DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMPTZ(6) DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ(6) DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ(6),
  created_by INTEGER,
  updated_by INTEGER
);

CREATE INDEX IF NOT EXISTS "IX_supplier_orders_supplier_id" ON supplier_orders(supplier_id);
CREATE INDEX IF NOT EXISTS "IX_supplier_orders_status" ON supplier_orders(status);
CREATE INDEX IF NOT EXISTS "IX_supplier_orders_order_date" ON supplier_orders(order_date);

-- Create supplier_order_items table
CREATE TABLE IF NOT EXISTS supplier_order_items (
  id BIGSERIAL PRIMARY KEY,
  supplier_order_id BIGINT NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  article_id BIGINT NOT NULL REFERENCES articles(id) ON UPDATE NO ACTION,
  article_code VARCHAR(50) NOT NULL,
  article_description VARCHAR(500) NOT NULL,
  quantity INTEGER NOT NULL,
  current_stock DECIMAL(12, 3) NOT NULL,
  minimum_stock DECIMAL(12, 3) NOT NULL,
  avg_monthly_sales DECIMAL(10, 2),
  estimated_sale_time DECIMAL(10, 2),
  received_quantity INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ(6) DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "IX_supplier_order_items_supplier_order_id" ON supplier_order_items(supplier_order_id);
CREATE INDEX IF NOT EXISTS "IX_supplier_order_items_article_id" ON supplier_order_items(article_id);





