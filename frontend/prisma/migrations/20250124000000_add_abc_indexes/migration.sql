-- Migration: Add indexes for ABC classification performance
-- This migration creates indexes to optimize the ABC classification query
-- that joins invoice_items with invoices and filters by is_printed and invoice_date

-- Index for invoice_items to speed up article_id lookups
CREATE INDEX IF NOT EXISTS idx_invoice_items_article_invoice 
  ON invoice_items(article_id, invoice_id);

-- Index for invoices to speed up filtering by is_printed and invoice_date
-- This is a partial index that only includes non-cancelled invoices
CREATE INDEX IF NOT EXISTS idx_invoices_printed_date 
  ON invoices(is_printed, invoice_date) 
  WHERE is_cancelled = false;

-- Optional: Index for faster aggregation on line_total
CREATE INDEX IF NOT EXISTS idx_invoice_items_line_total 
  ON invoice_items(article_id, line_total);

-- Add comment explaining the purpose
COMMENT ON INDEX idx_invoice_items_article_invoice IS 'Optimizes ABC classification query - speeds up joining invoice_items with articles';
COMMENT ON INDEX idx_invoices_printed_date IS 'Optimizes ABC classification query - speeds up filtering printed invoices by date';
COMMENT ON INDEX idx_invoice_items_line_total IS 'Optimizes ABC classification query - speeds up revenue aggregation';


