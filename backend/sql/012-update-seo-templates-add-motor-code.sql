-- ============================================================================
-- Script d'ajout de #VCodeMoteur# dans les templates SEO
-- ============================================================================
-- Objectif: Intégrer les codes moteur (K9K, M4R, etc.) dans le H1 et content
-- pour améliorer le référencement long-tail sur les recherches techniques
--
-- Variables disponibles:
-- #VCodeMoteur# → "K9K 752" ou "K9K 752, K9K 836" (plusieurs codes séparés par virgule)
--
-- Usage depuis NestJS: Exécuter ce script via Supabase Dashboard ou migration
-- ============================================================================

-- ============================================================================
-- ÉTAPE 1: Vérification de l'existant (à exécuter en SELECT avant UPDATE)
-- ============================================================================

-- Vérifier combien de templates seront impactés
-- SELECT COUNT(*) as total_templates,
--        COUNT(*) FILTER (WHERE sgc_h1 NOT LIKE '%#VCodeMoteur#%') as without_motor_code
-- FROM "__seo_gamme_car";

-- Voir quelques exemples de H1 actuels
-- SELECT sgc_pg_id, sgc_h1, sgc_content
-- FROM "__seo_gamme_car"
-- LIMIT 5;

-- ============================================================================
-- ÉTAPE 2: Mise à jour du H1 - Ajout badge code moteur à la fin
-- ============================================================================
-- Format: "Plaquettes de frein Renault Clio 3 1.5 dCi"
--      → "Plaquettes de frein Renault Clio 3 1.5 dCi - Moteur #VCodeMoteur#"
--
-- Note: Le badge ne s'affichera QUE si le véhicule a des codes moteur (la variable
-- sera remplacée par une chaîne vide si pas de code moteur)

-- Option A: Ajouter "Moteur #VCodeMoteur#" à la fin du H1 existant
-- UPDATE "__seo_gamme_car"
-- SET sgc_h1 = CONCAT(sgc_h1, ' <span class="motor-badge">#VCodeMoteur#</span>')
-- WHERE sgc_h1 IS NOT NULL
--   AND sgc_h1 NOT LIKE '%#VCodeMoteur#%';

-- Option B: Ajouter entre parenthèses (plus discret)
-- UPDATE "__seo_gamme_car"
-- SET sgc_h1 = CONCAT(sgc_h1, ' (#VCodeMoteur#)')
-- WHERE sgc_h1 IS NOT NULL
--   AND sgc_h1 NOT LIKE '%#VCodeMoteur#%';

-- ============================================================================
-- ÉTAPE 3: Mise à jour du content - Ajout mention code moteur
-- ============================================================================
-- Ajouter un paragraphe sur les codes moteur dans le content SEO

-- Option A: Ajouter à la fin du content existant
-- UPDATE "__seo_gamme_car"
-- SET sgc_content = CONCAT(
--   sgc_content,
--   '<p class="motor-codes-seo">Pièces compatibles avec les moteurs <strong>#VCodeMoteur#</strong> de votre #VMarque# #VModele#.</p>'
-- )
-- WHERE sgc_content IS NOT NULL
--   AND sgc_content NOT LIKE '%#VCodeMoteur#%';

-- ============================================================================
-- REQUÊTES PRÊTES À EXÉCUTER (décommenter pour appliquer)
-- ============================================================================

-- 1️⃣ MISE À JOUR H1: Ajouter badge discret avec code moteur
/*
UPDATE "__seo_gamme_car"
SET sgc_h1 = CASE
  WHEN sgc_h1 LIKE '%#VCodeMoteur#%' THEN sgc_h1  -- Déjà présent, ne pas modifier
  ELSE CONCAT(sgc_h1, ' - #VCodeMoteur#')
END
WHERE sgc_h1 IS NOT NULL;
*/

-- 2️⃣ MISE À JOUR CONTENT: Ajouter paragraphe technique
/*
UPDATE "__seo_gamme_car"
SET sgc_content = CASE
  WHEN sgc_content LIKE '%#VCodeMoteur#%' THEN sgc_content  -- Déjà présent
  WHEN sgc_content IS NULL OR sgc_content = '' THEN '<p>Pièces compatibles moteur <strong>#VCodeMoteur#</strong>.</p>'
  ELSE CONCAT(
    sgc_content,
    E'\n<p class="motor-codes-seo">Ces pièces sont compatibles avec les véhicules équipés du moteur <strong>#VCodeMoteur#</strong>. Vérifiez la correspondance avec votre #VMarque# #VModele# #VType#.</p>'
  )
END
WHERE sgc_pg_id IS NOT NULL;
*/

-- ============================================================================
-- SCRIPT DE ROLLBACK (si besoin de revenir en arrière)
-- ============================================================================
/*
-- Rollback H1
UPDATE "__seo_gamme_car"
SET sgc_h1 = REPLACE(sgc_h1, ' - #VCodeMoteur#', '')
WHERE sgc_h1 LIKE '%- #VCodeMoteur#%';

-- Rollback content
UPDATE "__seo_gamme_car"
SET sgc_content = REGEXP_REPLACE(
  sgc_content,
  E'<p class="motor-codes-seo">.*?</p>',
  '',
  'g'
)
WHERE sgc_content LIKE '%motor-codes-seo%';
*/

-- ============================================================================
-- VÉRIFICATION POST-MISE À JOUR
-- ============================================================================

-- Compter les templates mis à jour
-- SELECT COUNT(*) as templates_with_motor_code
-- FROM "__seo_gamme_car"
-- WHERE sgc_h1 LIKE '%#VCodeMoteur#%' OR sgc_content LIKE '%#VCodeMoteur#%';

-- Voir quelques exemples après mise à jour
-- SELECT sgc_pg_id, sgc_h1, LEFT(sgc_content, 200) as content_preview
-- FROM "__seo_gamme_car"
-- WHERE sgc_h1 LIKE '%#VCodeMoteur#%'
-- LIMIT 5;
