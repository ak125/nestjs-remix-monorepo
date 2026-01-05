-- ============================================================================
-- Migration: Supprimer le champ 'url' inutile de get_pieces_for_type_gamme
-- ============================================================================
-- Raison: Le champ 'url' génère des URLs /piece/{id}/{slug}.html qui:
--   1. Ne sont pas utilisées dans le frontend
--   2. Ne sont pas dans le sitemap
--   3. Génèrent des 404 (177k erreurs Google Search Console)
--
-- Solution: Supprimer ce champ inutile plutôt que le "corriger"
-- ============================================================================

-- Modifier la fonction pour supprimer le champ url
-- On utilise une approche ciblée: on modifie uniquement les parties concernées

-- Note: Cette migration supprime le champ 'url' de la sortie JSON
-- Les lignes concernées dans la fonction originale:
--   - Ligne 430-434: génération URL dans assembled_pieces
--   - Ligne 509: 'url', url dans grouped.pieces
--   - Ligne 648: 'url', url dans pieces final

-- Pour appliquer ce changement, nous devons recréer la fonction complète
-- Voir le fichier backend/sql/003-create-rpc-get-pieces-for-type-gamme.sql
-- et supprimer les 3 occurrences du champ 'url'

-- IMPORTANT: Cette migration est un marqueur.
-- Pour l'appliquer, exécuter manuellement:
--   1. Éditer backend/sql/003-create-rpc-get-pieces-for-type-gamme.sql
--   2. Supprimer les lignes 430-434 (génération url)
--   3. Supprimer ", 'url', url" aux lignes 509 et 648
--   4. Exécuter le fichier SQL modifié sur la base de données

-- Vérification post-migration:
-- SELECT jsonb_object_keys(pieces->0) FROM (
--   SELECT (get_pieces_for_type_gamme(33302, 402))->'pieces' as pieces
-- ) t;
-- Le champ 'url' ne doit plus apparaître

SELECT 'Migration marker: remove unused url field from get_pieces_for_type_gamme' as status;
