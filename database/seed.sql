-- SPISA Database Seed Data
-- Version: 1.0
-- Date: October 1, 2025
--
-- Initial data for lookup tables and system configuration

-- ==============================================================================
-- PROVINCES (Argentina)
-- ==============================================================================

INSERT INTO provinces (name, code) VALUES
    ('Buenos Aires', 'BA'),
    ('Ciudad Autónoma de Buenos Aires', 'CABA'),
    ('Catamarca', 'CT'),
    ('Chaco', 'CC'),
    ('Chubut', 'CH'),
    ('Córdoba', 'CB'),
    ('Corrientes', 'CR'),
    ('Entre Ríos', 'ER'),
    ('Formosa', 'FO'),
    ('Jujuy', 'JY'),
    ('La Pampa', 'LP'),
    ('La Rioja', 'LR'),
    ('Mendoza', 'MZ'),
    ('Misiones', 'MI'),
    ('Neuquén', 'NQ'),
    ('Río Negro', 'RN'),
    ('Salta', 'SA'),
    ('San Juan', 'SJ'),
    ('San Luis', 'SL'),
    ('Santa Cruz', 'SC'),
    ('Santa Fe', 'SF'),
    ('Santiago del Estero', 'SE'),
    ('Tierra del Fuego', 'TF'),
    ('Tucumán', 'TM');

-- ==============================================================================
-- TAX CONDITIONS (IVA)
-- ==============================================================================

INSERT INTO tax_conditions (name, description) VALUES
    ('Responsable Inscripto', 'IVA registered taxpayer'),
    ('Monotributo', 'Simplified tax regime'),
    ('Exento', 'Tax exempt'),
    ('Consumidor Final', 'Final consumer'),
    ('Responsable No Inscripto', 'Non-registered taxpayer'),
    ('No Responsable', 'Non-responsible');

-- ==============================================================================
-- OPERATION TYPES
-- ==============================================================================

INSERT INTO operation_types (name, description) VALUES
    ('Contado', 'Cash payment'),
    ('Cuenta Corriente', 'Current account'),
    ('Mixta', 'Mixed payment terms');

-- ==============================================================================
-- PAYMENT METHODS
-- ==============================================================================

INSERT INTO payment_methods (name, requires_check_data) VALUES
    ('Efectivo', FALSE),
    ('Cheque', TRUE),
    ('Transferencia Bancaria', FALSE),
    ('Tarjeta de Débito', FALSE),
    ('Tarjeta de Crédito', FALSE),
    ('Mercado Pago', FALSE);

-- ==============================================================================
-- DEFAULT ADMIN USER
-- ==============================================================================
-- Password: Admin123! (you should change this immediately after first login)
-- Hash generated with BCrypt

INSERT INTO users (username, email, password_hash, full_name, role, is_active) VALUES
    ('admin', 'admin@spisa.local', '$2a$11$vXdK7kqX4h5fIVmGpY5mDeZLx5hCpRqQy7x5KqXcP5dM5JQVmH7qK', 'Administrator', 'ADMIN', TRUE);

-- ==============================================================================
-- DEFAULT CATEGORIES (examples - adjust to your business)
-- ==============================================================================

INSERT INTO categories (code, name, description, default_discount_percent) VALUES
    ('BRI', 'Bridas', 'Bridas y accesorios', 0),
    ('ESP', 'Espárragos', 'Espárragos de diferentes medidas', 0),
    ('VAL', 'Válvulas', 'Válvulas industriales', 0),
    ('ACC', 'Accesorios', 'Accesorios generales', 0),
    ('TUB', 'Tubos', 'Tubería y accesorios', 0),
    ('CON', 'Conexiones', 'Conexiones y fittings', 0);

-- ==============================================================================
-- SAMPLE TRANSPORTER (optional)
-- ==============================================================================

INSERT INTO transporters (name, address, phone) VALUES
    ('Transporte Ejemplo S.A.', 'Av. Ejemplo 1234', '011-4444-5555');

-- ==============================================================================
-- CONFIGURATION NOTES
-- ==============================================================================

COMMENT ON TABLE provinces IS 'Seeded with all 24 Argentine provinces';
COMMENT ON TABLE tax_conditions IS 'Common Argentina tax conditions';
COMMENT ON TABLE payment_methods IS 'Standard payment methods';
COMMENT ON TABLE users IS 'Contains default admin user (change password immediately)';
COMMENT ON TABLE categories IS 'Sample categories - adjust to your inventory';

-- ==============================================================================
-- POST-SEED VERIFICATION
-- ==============================================================================

DO $$
DECLARE
    province_count INTEGER;
    tax_count INTEGER;
    payment_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO province_count FROM provinces;
    SELECT COUNT(*) INTO tax_count FROM tax_conditions;
    SELECT COUNT(*) INTO payment_count FROM payment_methods;
    
    RAISE NOTICE 'Seed data loaded:';
    RAISE NOTICE '  Provinces: %', province_count;
    RAISE NOTICE '  Tax Conditions: %', tax_count;
    RAISE NOTICE '  Payment Methods: %', payment_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Default admin credentials:';
    RAISE NOTICE '  Username: admin';
    RAISE NOTICE '  Password: Admin123!';
    RAISE NOTICE '  *** CHANGE THIS PASSWORD IMMEDIATELY ***';
END $$;

