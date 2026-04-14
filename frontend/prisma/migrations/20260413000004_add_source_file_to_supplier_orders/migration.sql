-- Add source_file to track which CSV/Excel was imported
ALTER TABLE supplier_orders ADD COLUMN source_file VARCHAR(500);
