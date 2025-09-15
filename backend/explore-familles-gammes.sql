-- 📁 backend/explore-familles-gammes.sql
-- 🔍 Script SQL pour explorer les tables de familles de gammes

-- 1. Explorer __seo_family_gamme_car_switch (semble être pour les familles)
SELECT 
  'seo_family_gamme_car_switch' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = '__seo_family_gamme_car_switch' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Échantillon de données seo_family_gamme_car_switch
SELECT *
FROM __seo_family_gamme_car_switch
LIMIT 10;

-- 3. Explorer __seo_equip_gamme (équipements par gamme)
SELECT 
  'seo_equip_gamme' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = '__seo_equip_gamme' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Échantillon de données seo_equip_gamme
SELECT *
FROM __seo_equip_gamme
LIMIT 10;

-- 5. Explorer catalog_gamme pour voir s'il y a une hiérarchie
SELECT 
  'catalog_gamme' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'catalog_gamme' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. Échantillon catalog_gamme
SELECT *
FROM catalog_gamme
LIMIT 10;

-- 7. Chercher des colonnes qui pourraient indiquer une famille/catégorie parent
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name LIKE '%gamme%'
  AND (
    column_name LIKE '%family%' OR 
    column_name LIKE '%famille%' OR 
    column_name LIKE '%parent%' OR 
    column_name LIKE '%category%' OR
    column_name LIKE '%groupe%' OR
    column_name LIKE '%type%'
  )
ORDER BY table_name, column_name;