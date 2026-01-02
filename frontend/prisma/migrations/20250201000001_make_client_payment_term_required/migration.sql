-- Make payment_term_id NOT NULL for clients
-- First, set default payment term for clients without one

-- Get the first active payment term (usually "Pago Contado")
DO $$
DECLARE
    default_payment_term_id INTEGER;
BEGIN
    SELECT id INTO default_payment_term_id 
    FROM payment_terms 
    WHERE is_active = true 
    ORDER BY days ASC 
    LIMIT 1;
    
    -- Update clients without payment_term_id
    UPDATE clients 
    SET payment_term_id = default_payment_term_id 
    WHERE payment_term_id IS NULL;
    
    -- Make column NOT NULL
    ALTER TABLE clients 
    ALTER COLUMN payment_term_id SET NOT NULL;
END $$;
