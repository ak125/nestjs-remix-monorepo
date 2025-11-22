-- 🧹 Phase 2: Nettoyage des <p> avec attributs style/class
-- Script SQL pour Supabase PostgreSQL
-- Date: 2025-11-22

BEGIN;

-- ============================================
-- 🎯 NETTOYAGE DES <p> AVEC ATTRIBUTS
-- ============================================

-- Pattern: <p style="...">contenu</p> → contenu
UPDATE __seo_gamme_car
SET sgc_content = regexp_replace(
  sgc_content, 
  '<p\s+[^>]*>(.*?)</p>',
  '\1',
  'gi'
)
WHERE sgc_content ~ '<p\s+[^>]+>';

-- Pattern: <p class="...">contenu</p> → contenu
UPDATE __seo_gamme_car
SET sgc_h1 = regexp_replace(
  sgc_h1, 
  '<p\s+[^>]*>(.*?)</p>',
  '\1',
  'gi'
)
WHERE sgc_h1 ~ '<p\s+[^>]+>';

-- Même chose pour title
UPDATE __seo_gamme_car
SET sgc_title = regexp_replace(
  sgc_title, 
  '<p\s+[^>]*>(.*?)</p>',
  '\1',
  'gi'
)
WHERE sgc_title ~ '<p\s+[^>]+>';

-- Même chose pour descrip
UPDATE __seo_gamme_car
SET sgc_descrip = regexp_replace(
  sgc_descrip, 
  '<p\s+[^>]*>(.*?)</p>',
  '\1',
  'gi'
)
WHERE sgc_descrip ~ '<p\s+[^>]+>';

-- ============================================
-- 📊 VÉRIFICATION
-- ============================================

SELECT '✅ Nettoyage <p> avec attributs terminé' as status;

SELECT 
  count(*) FILTER (WHERE sgc_content ~ '<p\s+') as content_avec_p_style,
  count(*) FILTER (WHERE sgc_h1 ~ '<p\s+') as h1_avec_p_style
FROM __seo_gamme_car;

-- ============================================
-- 🔍 EXEMPLES APRÈS NETTOYAGE
-- ============================================

SELECT 
  sgc_pg_id as pg_id,
  left(sgc_h1, 100) as h1_preview,
  left(sgc_content, 150) as content_preview
FROM __seo_gamme_car
WHERE sgc_pg_id::text = '479'
LIMIT 3;

COMMIT;
