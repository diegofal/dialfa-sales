-- Migration: Seed payment terms
-- Delete all existing payment terms and their discounts first
DELETE FROM category_payment_discounts;
DELETE FROM payment_terms;

-- Reset sequence
ALTER SEQUENCE payment_terms_id_seq RESTART WITH 1;

-- Insert payment terms based on business requirements
INSERT INTO payment_terms (code, name, days, is_active, created_at, updated_at) VALUES
('CONTADO', 'Pago Contado', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('30_DIAS', 'Pago a 30 Días', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

