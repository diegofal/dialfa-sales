-- Add cif_percentage column to supplier_orders with default 50
ALTER TABLE supplier_orders ADD COLUMN cif_percentage DECIMAL(5,2) DEFAULT 50;

-- Set default for existing orders
UPDATE supplier_orders SET cif_percentage = 50 WHERE cif_percentage IS NULL;
