-- Add discount_percent to supplier_order_items
ALTER TABLE supplier_order_items ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0;

-- Add use_category_discounts to supplier_orders
ALTER TABLE supplier_orders ADD COLUMN use_category_discounts BOOLEAN DEFAULT true;
