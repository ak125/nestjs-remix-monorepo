-- 📁 backend/explore-gamme-direct.sql
-- 🔍 Script SQL direct pour explorer les tables gammes

-- 1. Explorer la structure de pieces_gamme
SELECT 
  'pieces_gamme' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'pieces_gamme' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Compter les enregistrements pieces_gamme
SELECT 
  'pieces_gamme' as table_name,
  COUNT(*) as total_records
FROM pieces_gamme;

-- 3. Échantillon de données pieces_gamme
SELECT *
FROM pieces_gamme
LIMIT 3;

-- 4. Explorer la structure de catalog_gamme
SELECT 
  'catalog_gamme' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'catalog_gamme' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Compter les enregistrements catalog_gamme
SELECT 
  'catalog_gamme' as table_name,
  COUNT(*) as total_records
FROM catalog_gamme;

-- 6. Échantillon de données catalog_gamme
SELECT *
FROM catalog_gamme
LIMIT 3;

-- 7. Rechercher d'autres tables avec 'gamme' dans le nom
SELECT 
  table_name,
  CASE 
    WHEN table_name LIKE '%gamme%' THEN 'Contient gamme'
    ELSE 'Autre'
  END as type_table
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%gamme%'
ORDER BY table_name;