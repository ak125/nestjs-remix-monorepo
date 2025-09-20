-- Test pour comprendre la structure des tables gammes
-- Tester la jointure catalog_gamme -> pieces_gamme

-- 1. Structure de catalog_gamme
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'catalog_gamme' 
ORDER BY ordinal_position;

-- 2. Structure de pieces_gamme  
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'pieces_gamme'
ORDER BY ordinal_position;

-- 3. Échantillon catalog_gamme
SELECT * FROM catalog_gamme LIMIT 3;

-- 4. Échantillon pieces_gamme
SELECT * FROM pieces_gamme LIMIT 3;

-- 5. Test jointure possible mc_pg_id -> pg_id
SELECT 
  cg.mc_pg_id,
  pg.pg_id,
  pg.pg_lib_fr
FROM catalog_gamme cg
LEFT JOIN pieces_gamme pg ON cg.mc_pg_id::text = pg.pg_id::text
LIMIT 5;