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
-- 1️⃣ NETTOYAGE DU H1
-- ============================================

-- Supprimer <p>...</p> qui entoure TOUT le H1
UPDATE __seo_gamme_car
SET h1 = regexp_replace(h1, '^\s*<p>(.*)</p>\s*$', '\1', 'is')
WHERE h1 ~ '^\s*<p>.*</p>\s*$';

-- Supprimer <p> vides
UPDATE __seo_gamme_car
SET h1 = regexp_replace(h1, '<p>\s*</p>', '', 'gi')
WHERE h1 ~ '<p>\s*</p>';

SELECT '✅ H1 nettoyé: ' || count(*) || ' lignes' 
FROM __seo_gamme_car 
WHERE h1 ~ '<p>';

-- ============================================
-- 2️⃣ NETTOYAGE DU TITLE
-- ============================================

UPDATE __seo_gamme_car
SET title = regexp_replace(title, '^\s*<p>(.*)</p>\s*$', '\1', 'is')
WHERE title ~ '^\s*<p>.*</p>\s*$';

UPDATE __seo_gamme_car
SET title = regexp_replace(title, '<p>\s*</p>', '', 'gi')
WHERE title ~ '<p>\s*</p>';

SELECT '✅ Title nettoyé: ' || count(*) || ' lignes' 
FROM __seo_gamme_car 
WHERE title ~ '<p>';

-- ============================================
-- 3️⃣ NETTOYAGE DE LA DESCRIPTION
-- ============================================

UPDATE __seo_gamme_car
SET description = regexp_replace(description, '^\s*<p>(.*)</p>\s*$', '\1', 'is')
WHERE description ~ '^\s*<p>.*</p>\s*$';

UPDATE __seo_gamme_car
SET description = regexp_replace(description, '<p>\s*</p>', '', 'gi')
WHERE description ~ '<p>\s*</p>';

SELECT '✅ Description nettoyée: ' || count(*) || ' lignes' 
FROM __seo_gamme_car 
WHERE description ~ '<p>';

-- ============================================
-- 4️⃣ NETTOYAGE DU CONTENT (le plus important)
-- ============================================

-- Pattern 1: <p> qui entoure TOUT le contenu
UPDATE __seo_gamme_car
SET content = regexp_replace(content, '^\s*<p>(.*)</p>\s*$', '\1', 'is')
WHERE content ~ '^\s*<p>.*</p>\s*$'
  AND content NOT LIKE '%</p>%<p>%'; -- Éviter de casser les contenus avec plusieurs <p>

-- Pattern 2: Première <p> avec titre de gamme + "pour"
UPDATE __seo_gamme_car
SET content = regexp_replace(content, '^<p>([^<]+pour\s+[A-Z].+?)</p>\s*', '\1\n', 'i')
WHERE content ~ '^<p>[^<]+pour\s+[A-Z].+?</p>';

-- Pattern 3: Première <p> avec marque automobile
UPDATE __seo_gamme_car
SET content = regexp_replace(
  content, 
  '^<p>([A-Z][^<]+?(RENAULT|CITROËN|PEUGEOT|BMW|AUDI|VOLKSWAGEN|MERCEDES|FIAT|ALFA|FORD|OPEL|TOYOTA|NISSAN|HONDA|MAZDA|HYUNDAI|KIA|VOLVO)[^<]+?)</p>\s*',
  '\1\n',
  'i'
)
WHERE content ~ '^<p>[A-Z].+?(RENAULT|CITROËN|PEUGEOT|BMW|AUDI|VOLKSWAGEN|MERCEDES|FIAT|ALFA|FORD|OPEL|TOYOTA|NISSAN|HONDA|MAZDA|HYUNDAI|KIA|VOLVO)';

-- Supprimer <p> vides dans content
UPDATE __seo_gamme_car
SET content = regexp_replace(content, '<p>\s*</p>', '', 'gi')
WHERE content ~ '<p>\s*</p>';

-- ============================================
-- 📊 RAPPORT FINAL
-- ============================================

SELECT '📊 STATISTIQUES APRÈS NETTOYAGE' as rapport;

SELECT 
  'H1' as champ,
  count(*) as total_lignes,
  count(*) FILTER (WHERE h1 ~ '<p>') as avec_p_restantes,
  round(100.0 * count(*) FILTER (WHERE h1 ~ '<p>') / count(*), 2) || '%' as pourcentage
FROM __seo_gamme_car
WHERE h1 IS NOT NULL

UNION ALL

SELECT 
  'Title' as champ,
  count(*) as total_lignes,
  count(*) FILTER (WHERE title ~ '<p>') as avec_p_restantes,
  round(100.0 * count(*) FILTER (WHERE title ~ '<p>') / count(*), 2) || '%' as pourcentage
FROM __seo_gamme_car
WHERE title IS NOT NULL

UNION ALL

SELECT 
  'Description' as champ,
  count(*) as total_lignes,
  count(*) FILTER (WHERE description ~ '<p>') as avec_p_restantes,
  round(100.0 * count(*) FILTER (WHERE description ~ '<p>') / count(*), 2) || '%' as pourcentage
FROM __seo_gamme_car
WHERE description IS NOT NULL

UNION ALL

SELECT 
  'Content' as champ,
  count(*) as total_lignes,
  count(*) FILTER (WHERE content ~ '<p>') as avec_p_restantes,
  round(100.0 * count(*) FILTER (WHERE content ~ '<p>') / count(*), 2) || '%' as pourcentage
FROM __seo_gamme_car
WHERE content IS NOT NULL;

-- ============================================
-- 🔍 EXEMPLES DE CONTENU NETTOYÉ
-- ============================================

SELECT '🔍 EXEMPLES (gamme 479 - Kit embrayage):' as exemples;

SELECT 
  pg_id,
  left(h1, 80) as h1_preview,
  left(content, 100) as content_preview
FROM __seo_gamme_car
WHERE pg_id = 479
LIMIT 3;

COMMIT;

-- ============================================
-- ⚠️ ROLLBACK EN CAS D'ERREUR
-- ============================================
-- Si quelque chose ne va pas, annuler avec:
-- ROLLBACK;
