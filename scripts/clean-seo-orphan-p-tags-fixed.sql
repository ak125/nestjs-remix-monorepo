-- 🧹 Nettoyage des balises <p> orphelines dans __seo_gamme_car
-- Script SQL pour Supabase PostgreSQL
-- Date: 2025-11-22

-- ============================================
-- 🎯 OBJECTIF: Nettoyer les patterns suivants
-- ============================================
-- Pattern 1: <p>Kit d'embrayage FIAT DOBLO...</p> → Kit d'embrayage FIAT DOBLO...
-- Pattern 2: <p>Batterie RENAULT CLIO</p> → Batterie RENAULT CLIO
-- Pattern 3: <p>Plaquette de frein pour CITROËN</p> → Plaquette de frein pour CITROËN

BEGIN;

-- ============================================
-- 1️⃣ NETTOYAGE DU SGC_H1
-- ============================================

-- Supprimer <p>...</p> qui entoure TOUT le H1
UPDATE __seo_gamme_car
SET sgc_h1 = regexp_replace(sgc_h1, '^\s*<p>(.*)</p>\s*$', '\1', 'is')
WHERE sgc_h1 ~ '^\s*<p>.*</p>\s*$';

-- Supprimer <p> vides
UPDATE __seo_gamme_car
SET sgc_h1 = regexp_replace(sgc_h1, '<p>\s*</p>', '', 'gi')
WHERE sgc_h1 ~ '<p>\s*</p>';

SELECT '✅ H1 nettoyé: ' || count(*) || ' lignes' 
FROM __seo_gamme_car 
WHERE sgc_h1 ~ '<p>';

-- ============================================
-- 2️⃣ NETTOYAGE DU SGC_TITLE
-- ============================================

UPDATE __seo_gamme_car
SET sgc_title = regexp_replace(sgc_title, '^\s*<p>(.*)</p>\s*$', '\1', 'is')
WHERE sgc_title ~ '^\s*<p>.*</p>\s*$';

UPDATE __seo_gamme_car
SET sgc_title = regexp_replace(sgc_title, '<p>\s*</p>', '', 'gi')
WHERE sgc_title ~ '<p>\s*</p>';

SELECT '✅ Title nettoyé: ' || count(*) || ' lignes' 
FROM __seo_gamme_car 
WHERE sgc_title ~ '<p>';

-- ============================================
-- 3️⃣ NETTOYAGE DU SGC_DESCRIP
-- ============================================

UPDATE __seo_gamme_car
SET sgc_descrip = regexp_replace(sgc_descrip, '^\s*<p>(.*)</p>\s*$', '\1', 'is')
WHERE sgc_descrip ~ '^\s*<p>.*</p>\s*$';

UPDATE __seo_gamme_car
SET sgc_descrip = regexp_replace(sgc_descrip, '<p>\s*</p>', '', 'gi')
WHERE sgc_descrip ~ '<p>\s*</p>';

SELECT '✅ Description nettoyée: ' || count(*) || ' lignes' 
FROM __seo_gamme_car 
WHERE sgc_descrip ~ '<p>';

-- ============================================
-- 4️⃣ NETTOYAGE DU SGC_CONTENT (le plus important)
-- ============================================

-- Pattern 1: <p> qui entoure TOUT le contenu
UPDATE __seo_gamme_car
SET sgc_content = regexp_replace(sgc_content, '^\s*<p>(.*)</p>\s*$', '\1', 'is')
WHERE sgc_content ~ '^\s*<p>.*</p>\s*$'
  AND sgc_content NOT LIKE '%</p>%<p>%'; -- Éviter de casser les contenus avec plusieurs <p>

-- Pattern 2: Première <p> avec titre de gamme + "pour"
UPDATE __seo_gamme_car
SET sgc_content = regexp_replace(sgc_content, '^<p>([^<]+pour\s+[A-Z].+?)</p>\s*', '\1\n', 'i')
WHERE sgc_content ~ '^<p>[^<]+pour\s+[A-Z].+?</p>';

-- Pattern 3: Première <p> avec marque automobile
UPDATE __seo_gamme_car
SET sgc_content = regexp_replace(
  sgc_content, 
  '^<p>([A-Z][^<]+?(RENAULT|CITROËN|PEUGEOT|BMW|AUDI|VOLKSWAGEN|MERCEDES|FIAT|ALFA|FORD|OPEL|TOYOTA|NISSAN|HONDA|MAZDA|HYUNDAI|KIA|VOLVO)[^<]+?)</p>\s*',
  '\1\n',
  'i'
)
WHERE sgc_content ~ '^<p>[A-Z].+?(RENAULT|CITROËN|PEUGEOT|BMW|AUDI|VOLKSWAGEN|MERCEDES|FIAT|ALFA|FORD|OPEL|TOYOTA|NISSAN|HONDA|MAZDA|HYUNDAI|KIA|VOLVO)';

-- Supprimer <p> vides dans content
UPDATE __seo_gamme_car
SET sgc_content = regexp_replace(sgc_content, '<p>\s*</p>', '', 'gi')
WHERE sgc_content ~ '<p>\s*</p>';

-- ============================================
-- 📊 RAPPORT FINAL
-- ============================================

SELECT '📊 STATISTIQUES APRÈS NETTOYAGE' as rapport;

SELECT 
  'H1' as champ,
  count(*) as total_lignes,
  count(*) FILTER (WHERE sgc_h1 ~ '<p>') as avec_p_restantes,
  round(100.0 * count(*) FILTER (WHERE sgc_h1 ~ '<p>') / NULLIF(count(*), 0), 2) || '%' as pourcentage
FROM __seo_gamme_car
WHERE sgc_h1 IS NOT NULL

UNION ALL

SELECT 
  'Title' as champ,
  count(*) as total_lignes,
  count(*) FILTER (WHERE sgc_title ~ '<p>') as avec_p_restantes,
  round(100.0 * count(*) FILTER (WHERE sgc_title ~ '<p>') / NULLIF(count(*), 0), 2) || '%' as pourcentage
FROM __seo_gamme_car
WHERE sgc_title IS NOT NULL

UNION ALL

SELECT 
  'Description' as champ,
  count(*) as total_lignes,
  count(*) FILTER (WHERE sgc_descrip ~ '<p>') as avec_p_restantes,
  round(100.0 * count(*) FILTER (WHERE sgc_descrip ~ '<p>') / NULLIF(count(*), 0), 2) || '%' as pourcentage
FROM __seo_gamme_car
WHERE sgc_descrip IS NOT NULL

UNION ALL

SELECT 
  'Content' as champ,
  count(*) as total_lignes,
  count(*) FILTER (WHERE sgc_content ~ '<p>') as avec_p_restantes,
  round(100.0 * count(*) FILTER (WHERE sgc_content ~ '<p>') / NULLIF(count(*), 0), 2) || '%' as pourcentage
FROM __seo_gamme_car
WHERE sgc_content IS NOT NULL;

-- ============================================
-- 🔍 EXEMPLES DE CONTENU NETTOYÉ
-- ============================================

SELECT '🔍 EXEMPLES (gamme 479 - Kit embrayage):' as exemples;

SELECT 
  sgc_pg_id as pg_id,
  left(sgc_h1, 80) as h1_preview,
  left(sgc_content, 100) as content_preview
FROM __seo_gamme_car
WHERE sgc_pg_id::text = '479'
LIMIT 3;

COMMIT;

-- ============================================
-- ⚠️ ROLLBACK EN CAS D'ERREUR
-- ============================================
-- Si quelque chose ne va pas, annuler avec:
-- ROLLBACK;
