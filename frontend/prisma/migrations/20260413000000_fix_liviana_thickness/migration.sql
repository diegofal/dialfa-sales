-- Fix Liviana articles that conflict with STD articles
-- Livianas have the same type+thickness+size as their STD counterparts,
-- causing the matcher to pick the wrong article.
-- Solution: set thickness to 'LIV' to distinguish them.

-- Codo 90° R.L. Liviano (CL*) — currently type=90D LR ELBOW, thick=STD
-- Conflicts with CRL90* (Codo R.L. 90° STD)
UPDATE articles SET thickness = 'LIV'
WHERE is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%CODO 90%'
  AND UPPER(description) LIKE '%R.L.%'
  AND UPPER(description) LIKE '%LIV%';

-- Codo 45° Liviano (CL45*) — currently type=45D LR ELBOW, thick=STD
-- Conflicts with C45* (Codo 45° STD)
UPDATE articles SET thickness = 'LIV'
WHERE is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%CODO 45%'
  AND UPPER(description) LIKE '%LIVIAN%';

-- Tee Liviana (TL*) — currently type=TEE, thick=STD
-- Conflicts with T* (Tee STD)
UPDATE articles SET thickness = 'LIV'
WHERE is_active = true AND deleted_at IS NULL
  AND UPPER(description) LIKE '%TEE%LIVIAN%';
