-- ==========================================
-- SCRIPT: Audit et Correction Gammes Manquantes
-- Date: 13 octobre 2025
-- ==========================================

-- ==========================================
-- ÉTAPE 1: IDENTIFIER LES GAMMES MANQUANTES
-- ==========================================

-- Trouver toutes les gammes référencées dans pieces mais absentes de pieces_gamme
SELECT 
  p.piece_pg_id as gamme_id_manquante,
  COUNT(*) as nb_produits,
  COUNT(CASE WHEN p.piece_display = true THEN 1 END) as nb_produits_actifs,
  -- Essayer de déduire le nom le plus commun
  MODE() WITHIN GROUP (ORDER BY p.piece_name) as nom_produit_type
FROM pieces p
LEFT JOIN pieces_gamme pg ON pg.pg_id = p.piece_pg_id
WHERE pg.pg_id IS NULL
  AND p.piece_pg_id IS NOT NULL
GROUP BY p.piece_pg_id
ORDER BY nb_produits DESC
LIMIT 50;

-- ==========================================
-- RÉSULTAT ATTENDU (exemple):
-- ==========================================
-- gamme_id_manquante | nb_produits | nb_produits_actifs | nom_produit_type
-- -------------------|-------------|-------------------|------------------
-- 82                 | 133159      | 133159           | 1 Disque de frein
-- ...

-- ==========================================
-- ÉTAPE 2: CRÉER LA GAMME ID 82
-- ==========================================

-- Insérer la gamme "Disque de frein" avec ID 82
INSERT INTO pieces_gamme (pg_id, pg_name, pg_display, pg_created_at)
VALUES (82, 'Disque de frein', '1', NOW())
ON CONFLICT (pg_id) DO NOTHING;

-- Vérifier l'insertion
SELECT pg_id, pg_name, pg_display 
FROM pieces_gamme 
WHERE pg_id = 82;

-- ==========================================
-- ÉTAPE 3: CRÉER TOUTES LES GAMMES MANQUANTES
-- ==========================================

-- Créer automatiquement toutes les gammes manquantes avec un nom générique
-- ATTENTION: À exécuter SEULEMENT si vous voulez créer toutes les gammes d'un coup
/*
INSERT INTO pieces_gamme (pg_id, pg_name, pg_display, pg_created_at)
SELECT DISTINCT 
  p.piece_pg_id,
  'Gamme ' || p.piece_pg_id AS pg_name,
  '1' AS pg_display,
  NOW() AS pg_created_at
FROM pieces p
LEFT JOIN pieces_gamme pg ON pg.pg_id = p.piece_pg_id
WHERE pg.pg_id IS NULL
  AND p.piece_pg_id IS NOT NULL
ON CONFLICT (pg_id) DO NOTHING;
*/

-- ==========================================
-- ÉTAPE 4: VÉRIFIER LES RÉSULTATS
-- ==========================================

-- Compter les gammes avant
SELECT COUNT(*) as nb_gammes_avant FROM pieces_gamme;

-- Compter les gammes après (à exécuter après INSERT)
SELECT COUNT(*) as nb_gammes_apres FROM pieces_gamme;

-- Vérifier que la gamme 82 existe et a des produits
SELECT 
  pg.pg_id,
  pg.pg_name,
  COUNT(p.piece_id) as nb_produits,
  COUNT(CASE WHEN p.piece_display = true THEN 1 END) as nb_actifs
FROM pieces_gamme pg
LEFT JOIN pieces p ON p.piece_pg_id = pg.pg_id
WHERE pg.pg_id = 82
GROUP BY pg.pg_id, pg.pg_name;

-- ==========================================
-- ÉTAPE 5: AUDIT COMPLET POST-CORRECTION
-- ==========================================

-- Vérifier qu'il ne reste plus de gammes manquantes
SELECT COUNT(DISTINCT p.piece_pg_id) as gammes_manquantes_restantes
FROM pieces p
LEFT JOIN pieces_gamme pg ON pg.pg_id = p.piece_pg_id
WHERE pg.pg_id IS NULL
  AND p.piece_pg_id IS NOT NULL;

-- Devrait retourner 0 après correction complète

-- ==========================================
-- ÉTAPE 6: STATISTIQUES FINALES
-- ==========================================

-- Distribution des produits par gamme (top 20)
SELECT 
  pg.pg_id,
  pg.pg_name,
  COUNT(p.piece_id) as nb_produits,
  COUNT(CASE WHEN p.piece_display = true THEN 1 END) as nb_actifs,
  ROUND(100.0 * COUNT(p.piece_id) / SUM(COUNT(p.piece_id)) OVER (), 2) as pourcentage
FROM pieces_gamme pg
LEFT JOIN pieces p ON p.piece_pg_id = pg.pg_id
GROUP BY pg.pg_id, pg.pg_name
HAVING COUNT(p.piece_id) > 0
ORDER BY nb_produits DESC
LIMIT 20;

-- ==========================================
-- NOTES IMPORTANTES
-- ==========================================

/*
AVANT D'EXÉCUTER CE SCRIPT:

1. ✅ SAUVEGARDER LA BASE DE DONNÉES:
   pg_dump -U postgres -d your_database > backup_before_gammes.sql

2. ✅ EXÉCUTER EN TRANSACTION:
   BEGIN;
   -- Exécuter les INSERT
   ROLLBACK;  -- Pour annuler si problème
   -- Ou COMMIT; pour valider

3. ⚠️ IMPACT:
   - Créer la gamme 82 : AUCUN IMPACT (simple ajout)
   - Créer toutes les gammes : Peut ajouter ~50-200 gammes
   - Les filtres frontend afficheront immédiatement les nouvelles gammes

4. ✅ TEST APRÈS CORRECTION:
   curl "http://localhost:3000/api/products/filters/lists" | jq '.gammes[] | select(.id == "82")'
   
   Devrait retourner:
   {
     "id": "82",
     "name": "Disque de frein"
   }

5. ✅ VÉRIFICATION API:
   curl "http://localhost:3000/api/products/admin/list?gammeId=82&limit=1"
   
   Devrait retourner:
   {
     "pagination": { "total": 133159 },
     "products": [...]
   }
*/

-- ==========================================
-- COMMANDES RAPIDES
-- ==========================================

-- ✅ FIX MINIMAL (seulement gamme 82):
-- INSERT INTO pieces_gamme (pg_id, pg_name, pg_display) VALUES (82, 'Disque de frein', '1');

-- ✅ FIX COMPLET (toutes les gammes):
-- Décommenter le bloc INSERT de l'ÉTAPE 3

-- ✅ ROLLBACK SI ERREUR:
-- ROLLBACK;

-- ✅ VALIDATION:
-- SELECT pg_id, pg_name FROM pieces_gamme WHERE pg_id = 82;
