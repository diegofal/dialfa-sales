-- Update existing sales orders to inherit payment_term_id from their clients
-- This ensures all historical orders have the correct payment term

UPDATE sales_orders so
SET payment_term_id = c.payment_term_id
FROM clients c
WHERE so.client_id = c.id
  AND so.payment_term_id IS NULL
  AND so.deleted_at IS NULL;
