-- Script SQL pour vérifier la table __seo_gamme_conseil

-- 1. Compter le nombre total de conseils
SELECT 'Total conseils' as info, COUNT(*) as count FROM __seo_gamme_conseil;

-- 2. Voir quelques exemples
SELECT 
  sgc_id,
  sgc_pg_id,
  sgc_title,
  LEFT(sgc_content, 100) as content_preview
FROM __seo_gamme_conseil
LIMIT 10;

-- 3. Vérifier les types de données de sgc_pg_id
SELECT DISTINCT 
  sgc_pg_id,
  pg_name,
  pg_alias
FROM __seo_gamme_conseil
JOIN pieces_gamme ON pieces_gamme.pg_id::text = __seo_gamme_conseil.sgc_pg_id
LIMIT 10;
