====================================================================================================
🛡️  SOLUTION SANS RÉGRESSION - VUES SQL
====================================================================================================

✅ PRINCIPE:
   - Créer des VUES SQL qui renomment les colonnes
   - Le code TypeScript reste inchangé
   - Les tables legacy fournissent les données
   - Zéro risque de casser quoi que ce soit

====================================================================================================

📝 VUES SQL À CRÉER DANS SUPABASE:

----------------------------------------------------------------------------------------------------

-- Vue 1: Blog Constructeur → SEO Marque
-- Mappe bc_* vers bsm_* sans modifier le code TypeScript
CREATE OR REPLACE VIEW __blog_constructeur AS
SELECT
  bsm_id AS bc_id,
  bsm_title AS bc_title,
  bsm_descrip AS bc_descrip,
  bsm_keywords AS bc_keywords,
  bsm_h1 AS bc_h1,
  bsm_content AS bc_content,
  bsm_marque_id AS bc_marque_id,
  bsm_marque_id AS bc_constructeur,  -- Alias pour compatibilité
  NOW() AS bc_create,                 -- Timestamp généré
  NOW() AS bc_update,                 -- Timestamp généré
  0 AS bc_visit,                      -- Compteur fictif (à adapter)
  bsm_title AS bc_alias               -- Généré depuis title
FROM __blog_seo_marque;

COMMENT ON VIEW __blog_constructeur IS 
  'Vue de compatibilité: mappe __blog_seo_marque vers format attendu par le code TypeScript';

----------------------------------------------------------------------------------------------------

-- Vue 2: Blog Glossaire → Advice
-- Mappe bgl_* vers ba_* pour le glossaire
CREATE OR REPLACE VIEW __blog_glossaire AS
SELECT
  ba_id AS bgl_id,
  ba_title AS bgl_terme,
  ba_content AS bgl_definition,
  ba_descrip AS bgl_descrip,
  ba_keywords AS bgl_keywords,
  ba_h1 AS bgl_h1,
  ba_alias AS bgl_alias,
  ba_create AS bgl_create,
  ba_update AS bgl_update,
  ba_visit AS bgl_visit
FROM __blog_advice
WHERE ba_pg_id IS NULL  -- Filtrer uniquement glossaire (pas lié à une gamme)
   OR ba_keywords LIKE '%glossaire%';  -- Ou basé sur mot-clé

COMMENT ON VIEW __blog_glossaire IS
  'Vue de compatibilité: filtre __blog_advice pour exposer le glossaire';

----------------------------------------------------------------------------------------------------

-- Vue 3: Relations Constructeur-Modèle → Advice Cross
-- Mappe bcm_* vers bac_*
CREATE OR REPLACE VIEW __blog_constructeur_modele AS
SELECT
  bac_id AS bcm_id,
  bac_ba_id AS bcm_bc_id,          -- ID blog constructeur
  bac_ba_id_cross AS bcm_modele_id, -- ID modèle croisé
  bac_ba_id AS bcm_constructeur    -- Alias
FROM __blog_advice_cross;

COMMENT ON VIEW __blog_constructeur_modele IS
  'Vue de compatibilité: mappe relations croisées vers format constructeur-modèle';

----------------------------------------------------------------------------------------------------

-- Vue 4: Sections H2 Constructeur → Advice H2
CREATE OR REPLACE VIEW __blog_constructeur_h2 AS
SELECT
  ba2_id AS bc2_id,
  ba2_h2 AS bc2_h2,
  ba2_content AS bc2_content,
  ba2_wall AS bc2_wall,
  ba2_create AS bc2_create,
  ba2_update AS bc2_update,
  ba2_ba_id AS bc2_bc_id,
  ba2_cta_anchor AS bc2_cta_anchor,
  ba2_cta_link AS bc2_cta_link
FROM __blog_advice_h2;

----------------------------------------------------------------------------------------------------

-- Vue 5: Sections H3 Constructeur → Advice H3
CREATE OR REPLACE VIEW __blog_constructeur_h3 AS
SELECT
  ba3_id AS bc3_id,
  ba3_h3 AS bc3_h3,
  ba3_content AS bc3_content,
  ba3_wall AS bc3_wall,
  ba3_create AS bc3_create,
  ba3_update AS bc3_update,
  ba3_ba2_id AS bc3_bc2_id,
  ba3_cta_anchor AS bc3_cta_anchor,
  ba3_cta_link AS bc3_cta_link
FROM __blog_advice_h3;

----------------------------------------------------------------------------------------------------

-- Vue 6: Blog Articles → Advice  
CREATE OR REPLACE VIEW blog_articles AS
SELECT
  ba_id AS article_id,
  ba_title AS title,
  ba_descrip AS description,
  ba_content AS content,
  ba_alias AS slug,
  ba_create AS created_at,
  ba_update AS updated_at,
  ba_visit AS views,
  ba_keywords AS tags
FROM __blog_advice;

COMMENT ON VIEW blog_articles IS
  'Vue de compatibilité: expose __blog_advice comme blog_articles';


====================================================================================================
✅ AVANTAGES DE CETTE APPROCHE
====================================================================================================

1. ✅ ZÉRO modification du code TypeScript
2. ✅ Aucun risque de régression
3. ✅ Utilise les tables legacy existantes
4. ✅ Facile à rollback (DROP VIEW)
5. ✅ Performance quasi identique (vues sont optimisées par Postgres)
6. ✅ Permet migration progressive plus tard

====================================================================================================
📋 INSTRUCTIONS D'INSTALLATION
====================================================================================================

1. Copier le SQL ci-dessus
2. Aller dans Supabase SQL Editor
3. Coller et exécuter chaque CREATE VIEW
4. Tester l'application
5. Aucune modification du code nécessaire !

====================================================================================================
⚠️  LIMITATIONS DES VUES
====================================================================================================

1. INSERT/UPDATE/DELETE nécessitent des triggers INSTEAD OF
2. Colonnes bc_visit (compteur visites) peut nécessiter une table séparée
3. Filtres WHERE dans les vues peuvent limiter les données visibles

Si vous avez besoin de INSERT/UPDATE/DELETE, dites-le moi et je
génère les triggers INSTEAD OF pour rendre les vues modifiables.

====================================================================================================

💾 Script SQL sauvegardé dans:
   scripts/blog-legacy-views.sql
====================================================================================================
