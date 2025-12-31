-- Migration: Seed category payment discounts
-- This migration sets up the initial discount structure for categories based on payment terms

-- First, clear any existing category payment discounts
DELETE FROM category_payment_discounts;

-- Insert discounts for Accesorios (ACCESORIOS PARA SOLDAR)
INSERT INTO category_payment_discounts (category_id, payment_term_id, discount_percent, created_at, updated_at)
SELECT 
    c.id as category_id,
    pt.id as payment_term_id,
    CASE 
        WHEN pt.code = 'CONTADO' THEN 30.00
        WHEN pt.code = '30_DIAS' THEN 20.00
    END as discount_percent,
    CURRENT_TIMESTAMP as created_at,
    CURRENT_TIMESTAMP as updated_at
FROM categories c
CROSS JOIN payment_terms pt
WHERE c.name = 'Accesorios'
  AND pt.code IN ('CONTADO', '30_DIAS');

-- Insert discounts for Bridas (BRIDAS)
INSERT INTO category_payment_discounts (category_id, payment_term_id, discount_percent, created_at, updated_at)
SELECT 
    c.id as category_id,
    pt.id as payment_term_id,
    CASE 
        WHEN pt.code = 'CONTADO' THEN 35.00
        WHEN pt.code = '30_DIAS' THEN 30.00
    END as discount_percent,
    CURRENT_TIMESTAMP as created_at,
    CURRENT_TIMESTAMP as updated_at
FROM categories c
CROSS JOIN payment_terms pt
WHERE c.name = 'Bridas'
  AND pt.code IN ('CONTADO', '30_DIAS');

-- Insert discounts for Espárragos, Nipples y Accesorio forjado (ESPARRAGOS, FORJADOS Y NIPLES)
INSERT INTO category_payment_discounts (category_id, payment_term_id, discount_percent, created_at, updated_at)
SELECT 
    c.id as category_id,
    pt.id as payment_term_id,
    CASE 
        WHEN pt.code = 'CONTADO' THEN 15.00
        WHEN pt.code = '30_DIAS' THEN 10.00
    END as discount_percent,
    CURRENT_TIMESTAMP as created_at,
    CURRENT_TIMESTAMP as updated_at
FROM categories c
CROSS JOIN payment_terms pt
WHERE (c.name = 'Espárragos' OR c.name = 'Nipples' OR c.name = 'Accesorio forjado')
  AND pt.code IN ('CONTADO', '30_DIAS');

