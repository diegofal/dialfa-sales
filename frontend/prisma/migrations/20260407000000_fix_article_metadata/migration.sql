-- Fix articles with NULL type by deriving from description
-- Total: 291 articles across 22 categories

-- =============================================
-- BUTT-WELD FITTINGS (missing type)
-- =============================================

-- Codo 45° E.P. (Extra Pesado / XS)
UPDATE articles SET type = '45D LR ELBOW', thickness = 'XS'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%CODO 45%' AND UPPER(description) LIKE '%E.P.%';

-- Codo 45° Liviano
UPDATE articles SET type = '45D LR ELBOW'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%CODO 45%' AND UPPER(description) LIKE '%LIVIAN%';

-- Codo 90° R.L. Liviano
UPDATE articles SET type = '90D LR ELBOW'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%CODO 90%' AND UPPER(description) LIKE '%R.L.%' AND UPPER(description) LIKE '%LIV%';

-- Codo R.L. 90° E.P.
UPDATE articles SET type = '90D LR ELBOW', thickness = 'XS'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%R.L.%' AND UPPER(description) LIKE '%90%' AND UPPER(description) LIKE '%E.P.%';

-- Codo 90° R.L. Sch. 160
UPDATE articles SET type = '90D LR ELBOW'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%90%' AND UPPER(description) LIKE '%R.L.%' AND UPPER(description) LIKE '%SCH%160%';

-- Codo 180° R.L.
UPDATE articles SET type = 'ELBOW_180'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%CODO 180%'
   OR (type IS NULL AND is_active = true AND deleted_at IS NULL
       AND UPPER(description) LIKE '%180%' AND UPPER(description) LIKE '%R.L.%');

-- Reducción Concéntrica E.P.
UPDATE articles SET type = 'CON. RED.'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%REDUCCI_N CONC_NTRICA%';

-- Reducción Excéntrica E.P.
UPDATE articles SET type = 'EXC. RED.'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%REDUCCI_N EXC_NTRICA%';

-- Tee de Reducción
UPDATE articles SET type = 'RED. TEE'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%TEE%REDUCCI_N%';

-- Tee Liviana
UPDATE articles SET type = 'TEE'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%TEE%LIVIAN%';

-- Tapa S-3000 Roscada (forged caps)
UPDATE articles SET type = 'CAP'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%TAPA S-%';

-- =============================================
-- BRIDAS (missing type)
-- =============================================

-- Bridas DIN
UPDATE articles SET type = 'BRIDA DIN'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%BRIDA%DIN%BAR%';

-- Bridas JIS
UPDATE articles SET type = 'BRIDA JIS'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%BRIDA%JIS%';

-- Bridas Livianas Ciegas (before plain Liviana to avoid partial match)
UPDATE articles SET type = 'BRIDA LIVIANA CIEGA'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%BRIDA%LIVIAN%CIEGA%';

-- Bridas Livianas Lap Joint (before plain Liviana)
UPDATE articles SET type = 'BRIDA LIVIANA LAP JOINT'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%BRIDA%LIVIAN%LAP%JOINT%';

-- Bridas Livianas (plain, after ciegas and lap joint)
UPDATE articles SET type = 'BRIDA LIVIANA'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%BRIDA%LIVIAN%'
  AND UPPER(description) NOT LIKE '%CIEGA%'
  AND UPPER(description) NOT LIKE '%LAP%JOINT%';

-- Brida Lap Joint S-150
UPDATE articles SET type = 'LAP JOINT', series = 150
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%BRIDA%LAP%JOINT%S%150%'
   OR (type IS NULL AND is_active = true AND deleted_at IS NULL
       AND UPPER(description) LIKE '%BRIDA%L_J_%S%150%');

-- Brida de reduccion SORF
UPDATE articles SET type = 'SORF', series = 150
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%BRIDA%REDUCCI_N%SORF%';

-- Brida Porta Placa
UPDATE articles SET type = 'PORTA PLACA'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%PORTA%PLACA%';

-- Brida W.N.R.F. (catch any remaining)
UPDATE articles SET type = 'W.N.R.F.'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%W.N.R.F%';

-- =============================================
-- FORGED FITTINGS & HARDWARE (missing type)
-- =============================================

-- Bulon c/tuerca
UPDATE articles SET type = 'BULON'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%BULON%TUERCA%';

-- Nipple BSPT (long, with SCH)
UPDATE articles SET type = 'NIPPLE BSPT'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%NIPPLE%BSPT%';

-- Nipple NPT (long, with SCH)
UPDATE articles SET type = 'NIPPLE NPT'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%NIPPLE%NPT%';

-- Varilla (rods)
UPDATE articles SET type = 'VARILLA'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%VARILLA%';

-- Lotes (bulk items)
UPDATE articles SET type = 'LOTE'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%LOTE DE%';

-- Kilos de material de rezago
UPDATE articles SET type = 'REZAGO'
WHERE type IS NULL AND is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%KILOS%MATERIAL%REZAGO%';

-- =============================================
-- FIX SUSPICIOUS NULL SERIES (4 articles)
-- =============================================

-- CODO 90 S-6000 ROSCADOS BSPT (id 3466) — missing series
UPDATE articles SET series = 6000
WHERE id = 3466 AND series IS NULL;

-- CODO 90° S-6000 ROSCADO NPT (id 1852) — missing series
UPDATE articles SET series = 6000
WHERE id = 1852 AND series IS NULL;

-- Brida Ciegas Flat Face S-150 (id 1685) — missing series
UPDATE articles SET series = 150
WHERE id = 1685 AND series IS NULL;

-- Bridas ciega S-600 (id 1997) — missing series
UPDATE articles SET series = 600
WHERE id = 1997 AND series IS NULL;

-- =============================================
-- FIX 3 REMAINING "???" ARTICLES (typos)
-- =============================================

-- "Brida L:J: S-150 de 8" → LAP JOINT
UPDATE articles SET type = 'LAP JOINT', series = 150
WHERE id = 2445 AND type IS NULL;

-- "Bridas Livanas Ciegas de 2 1/2" → BRIDA LIVIANA CIEGA (typo: Livanas)
UPDATE articles SET type = 'BRIDA LIVIANA CIEGA'
WHERE id = 4492 AND type IS NULL;

-- "Bridas S150 Lap Joint de 2" → LAP JOINT
UPDATE articles SET type = 'LAP JOINT', series = 150
WHERE id = 2444 AND type IS NULL;
