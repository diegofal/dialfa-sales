-- Migración de Todas las Lookup Tables desde SQL Server
-- Ejecutar DESPUÉS de cleanup.sql

-- ============================================================================
-- 1. OPERATION TYPES (Operatorias)
-- ============================================================================
INSERT INTO operation_types (id, name, description, created_at) VALUES 
(1, 'CASH', 'Contado', NOW()),
(2, 'CHECK_30', 'Cheque 30 días', NOW()),
(3, 'CHECK_60', 'Cheque 60 días', NOW()),
(4, 'BANK_TRANSFER', 'Transferencia Bancaria', NOW());

SELECT setval('operation_types_id_seq', 4, true);

-- ============================================================================
-- 2. CATEGORIES (Categorias)
-- ============================================================================
INSERT INTO categories (id, code, name, default_discount_percent, created_at, updated_at) VALUES 
(1, 'ACC', 'Accesorios', 0, NOW(), NOW()),
(2, 'BRD', 'Bridas', 0, NOW(), NOW()),
(3, 'VLV', 'Válvulas', 0, NOW(), NOW()),
(4, 'ESP', 'Espárragos', 0, NOW(), NOW()),
(5, 'SIN', 'Sin Categoria', 0, NOW(), NOW()),
(6, 'CSQ', 'Casquetes grandes', 0, NOW(), NOW()),
(7, 'LPJ', 'LapJoint', 0, NOW(), NOW()),
(9, 'ACF', 'Accesorio forjado', 0, NOW(), NOW()),
(10, 'AJF', 'Ajustes de facturacion', 0, NOW(), NOW()),
(11, 'BRD-D', 'Bridas discontinuadas', 0, NOW(), NOW()),
(12, 'ACC-D', 'Accesorios discontinuados', 0, NOW(), NOW()),
(13, 'NPL', 'Nipples', 0, NOW(), NOW());

SELECT setval('categories_id_seq', 13, true);

-- ============================================================================
-- 3. TRANSPORTERS (Ya migrados, pero aquí está el script completo)
-- ============================================================================
DELETE FROM transporters;

INSERT INTO transporters (id, name, address, created_at, updated_at) VALUES 
(1, 'Sudamerica Express', 'Varela 3578', NOW(), NOW()),
(2, 'COPAR', 'FERRE 3254', NOW(), NOW()),
(3, 'LA SEVILLANITA', 'HERMINIO MASANTONIO 2937', NOW(), NOW()),
(4, 'CRUZ DEL SUR', 'MERCADO CENTRAL', NOW(), NOW()),
(6, 'TRANSGUAZU', 'GRITO DE ASCENCIO 3141', NOW(), NOW()),
(7, 'SNEIDER', 'CHARRUA 3750', NOW(), NOW()),
(8, 'TRADELOG SEDICA', 'TRAFUL 3768 ', NOW(), NOW()),
(9, 'RIVADAVIA', 'PEPIRI 1543', NOW(), NOW()),
(10, 'LUJAN DE CUYO', 'LOS PATOS 2737', NOW(), NOW()),
(11, 'CARNEVALLI', 'SUAREZ 2761', NOW(), NOW()),
(12, 'TLC', 'BERON DE ASTRADA 2576 ', NOW(), NOW()),
(13, 'COLON', 'Esteban Bonorino 3561', NOW(), NOW()),
(14, 'PLUS ULTRA', 'AV. ROCA 2101', NOW(), NOW()),
(15, 'BRIO', 'SAN PEDRITO 3731', NOW(), NOW()),
(16, 'EL CARRIZAL', 'NAVE D1 - MERCADO CENTRAL', NOW(), NOW()),
(17, 'EL PEREGRINO', 'CHUBUT 1289', NOW(), NOW()),
(18, 'Transp. Breccia S.R.L.', 'Av. San Pedrito 3540', NOW(), NOW()),
(20, 'test', 'test', NOW(), NOW()),
(21, 'Dist. Rio Depósito - Luis A. Franco', 'AV. PTE PERON 2761 (EX GAONA) - HAEDO', NOW(), NOW()),
(22, 'TRANSPORTES MARBEC (RETIRA - 4237-9977)', 'Carriego 3046', NOW(), NOW()),
(23, 'Transporte Sur', 'Carlos Maria Ramirez 2204 - Pompeya', NOW(), NOW()),
(24, 'Expreso Argentino', 'Las palmas 2871 - Nueva pompeya - CABA', NOW(), NOW()),
(25, 'Tranporte Arias', 'Av. Cnel. Roca 7556/57', NOW(), NOW()),
(26, 'Transporte Bull', 'Amancio Alcorta 2733', NOW(), NOW()),
(27, 'Transporte Pedrito', 'Alte. Fco. Seguí 273 - Caballito', NOW(), NOW()),
(28, 'Oil & Gas depósito - DIAGONAL 76 NUM 1827 - EX J.M.CAMPOS', 'SAN ANDRES - PARTIDO DE SAN MARTIN', NOW(), NOW()),
(29, 'Transporte SCOR DINA', 'Amancio Alcorta 3473 - Pompeya', NOW(), NOW()),
(30, 'Tranporte Privitera', 'Monasterio 325 - Pque. Patricios - 08:00/17:00', NOW(), NOW()),
(31, 'Fabin (Deposito)', 'Cno. Gral. Belgrano 3845 - 8:00 a 17:00', NOW(), NOW()),
(32, 'INDUSCOR (entregas)', 'Av. O''higgins 3249', NOW(), NOW()),
(33, 'Almuerzo', '12 a 13 hs', NOW(), NOW()),
(34, 'Almuerzo', '13 a 14 hs', NOW(), NOW()),
(35, 'Almuerzo', '12 a 14:30 hs', NOW(), NOW()),
(36, 'Transp. Arias', 'Cnel. Roca 6451 - Cap Fed', NOW(), NOW()),
(37, 'Transp. Orlando Morresi', 'Carlos Berg 3591', NOW(), NOW()),
(38, 'Aceromat deposito', 'Campana 1278 - CABA', NOW(), NOW());

SELECT setval('transporters_id_seq', 38, true);

-- ============================================================================
-- 4. PROVINCES (Provincias)
-- ============================================================================
INSERT INTO provinces (id, name, created_at) VALUES 
(1, 'Buenos Aires', NOW()),
(2, 'Catamarca', NOW()),
(3, 'Chaco', NOW()),
(4, 'Chubut', NOW()),
(5, 'Cordoba', NOW()),
(6, 'Corrientes', NOW()),
(7, 'Entre Rios', NOW()),
(8, 'Formosa', NOW()),
(9, 'Jujuy', NOW()),
(10, 'La Pampa', NOW()),
(11, 'La Rioja', NOW()),
(12, 'Mendoza', NOW()),
(13, 'Misiones', NOW()),
(14, 'Neuquen', NOW()),
(15, 'Rio Negro', NOW()),
(16, 'Salta', NOW()),
(17, 'San Juan', NOW()),
(18, 'San Luis', NOW()),
(19, 'Santa Cruz', NOW()),
(20, 'Santa Fe', NOW()),
(21, 'Santiago del Estero', NOW()),
(22, 'Tierra Del Fuego', NOW()),
(23, 'Tucuman', NOW());

SELECT setval('provinces_id_seq', 23, true);

-- ============================================================================
-- 5. TAX CONDITIONS (Condiciones IVA)
-- ============================================================================
INSERT INTO tax_conditions (id, name, created_at) VALUES 
(1, 'Responsable Inscripto', NOW()),
(2, 'Responsable No Inscripto', NOW()),
(3, 'Exento', NOW());

SELECT setval('tax_conditions_id_seq', 3, true);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
SELECT 'operation_types' as tabla, COUNT(*) as registros FROM operation_types
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'transporters', COUNT(*) FROM transporters
UNION ALL SELECT 'provinces', COUNT(*) FROM provinces
UNION ALL SELECT 'tax_conditions', COUNT(*) FROM tax_conditions
UNION ALL SELECT 'payment_methods', COUNT(*) FROM payment_methods;

