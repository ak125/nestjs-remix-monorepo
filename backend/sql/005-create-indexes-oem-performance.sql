-- ============================================================================
-- INDEX CRITIQUES POUR PERFORMANCE OEM - get_pieces_for_type_gamme_v2
-- ============================================================================
-- 
-- ⚠️  IMPORTANT: Exécuter ces commandes HORS HEURES DE POINTE
--     Ces index peuvent bloquer les écritures pendant quelques secondes
--     Durée estimée: 1-5 minutes selon la taille des tables
--
-- 💡 NOTE: Si vous avez accès à psql directement, utilisez CONCURRENTLY:
--     CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xxx ON table(...);
--     (ne bloque pas les écritures mais prend plus de temps)
--
-- 📊 TABLES CONCERNÉES:
--     - pieces_ref_search (~millions de lignes) - Index composite pour OEM refs
--     - pieces_ref_brand (~centaines de lignes) - Index fonctionnel UPPER()
--     - pieces_price - Index pour DISTINCT ON optimisé
--     - pieces_media_img - Index pour images triées
--     - __seo_gamme_car - Index pour SEO templates
--
-- 🎯 GAIN ATTENDU:
--     - Avant index: Timeout 8s+
--     - Après index: ~200-400ms
--
-- Usage: Exécuter dans Supabase SQL Editor en production
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. INDEX CRITIQUE: pieces_ref_search (table OEM volumineuse)
-- ═══════════════════════════════════════════════════════════════════════════
-- Accélère la CTE oem_refs: prs_piece_id + prs_kind + prs_prb_id
-- Utilisé pour filtrer les refs OEM Type 3 par marque véhicule

CREATE INDEX IF NOT EXISTS idx_prs_piece_kind_prb 
ON pieces_ref_search(prs_piece_id, prs_kind, prs_prb_id);

-- Index additionnel pour recherche par kind seul (fallback)
CREATE INDEX IF NOT EXISTS idx_prs_kind 
ON pieces_ref_search(prs_kind) 
WHERE prs_kind = '3';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. INDEX CRITIQUE: pieces_ref_brand (évite UPPER() scan)
-- ═══════════════════════════════════════════════════════════════════════════
-- Accélère la CTE oem_brand: UPPER(prb_name) = 'BMW'
-- Index fonctionnel pour éviter le full scan avec UPPER()

CREATE INDEX IF NOT EXISTS idx_prb_name_upper 
ON pieces_ref_brand(UPPER(prb_name));

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. INDEX IMPORTANT: pieces_price (DISTINCT ON optimisé)
-- ═══════════════════════════════════════════════════════════════════════════
-- Accélère la CTE best_prices avec DISTINCT ON (pri_piece_id)
-- Filtre partiel sur pri_dispo = '1' pour réduire la taille de l'index

CREATE INDEX IF NOT EXISTS idx_pieces_price_piece_dispo_type 
ON pieces_price(pri_piece_id, pri_dispo, pri_type DESC NULLS LAST) 
WHERE pri_dispo = '1';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. INDEX IMPORTANT: pieces_media_img (DISTINCT ON + ORDER BY)
-- ═══════════════════════════════════════════════════════════════════════════
-- Accélère la CTE first_images avec DISTINCT ON + ORDER BY pmi_sort
-- Filtre partiel sur pmi_display = '1'

CREATE INDEX IF NOT EXISTS idx_pieces_media_img_piece_sort 
ON pieces_media_img(pmi_piece_id, pmi_sort) 
WHERE pmi_display = '1';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. INDEX OPTIONNEL: __seo_gamme_car (SEO templates)
-- ═══════════════════════════════════════════════════════════════════════════
-- Accélère la CTE seo_templates: sgc_pg_id::INTEGER = p_pg_id
-- Petit gain mais utile pour les pages avec beaucoup de gammes

CREATE INDEX IF NOT EXISTS idx_seo_gamme_car_pg_id 
ON __seo_gamme_car((sgc_pg_id::INTEGER));

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. INDEX OPTIONNEL: auto_type_motor_code (codes moteur)
-- ═══════════════════════════════════════════════════════════════════════════
-- Accélère la CTE motor_codes: tmc_type_id::INTEGER = p_type_id

CREATE INDEX IF NOT EXISTS idx_type_motor_code_type 
ON auto_type_motor_code((tmc_type_id::INTEGER));

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. ANALYZE: Mettre à jour les statistiques après création des index
-- ═══════════════════════════════════════════════════════════════════════════
-- Forcer PostgreSQL à utiliser les nouveaux index

ANALYZE pieces_ref_search;
ANALYZE pieces_ref_brand;
ANALYZE pieces_price;
ANALYZE pieces_media_img;
ANALYZE __seo_gamme_car;
ANALYZE auto_type_motor_code;

-- ============================================================================
-- VÉRIFICATION POST-DÉPLOIEMENT
-- ============================================================================
-- Exécuter après création des index pour vérifier qu'ils sont utilisés:
--
-- EXPLAIN ANALYZE SELECT get_pieces_for_type_gamme_v2(9045, 4);
--
-- Chercher dans le plan:
-- - "Index Scan using idx_prs_piece_kind_prb" (bon ✅)
-- - "Seq Scan on pieces_ref_search" (mauvais ❌ = index non utilisé)
--
-- Si Seq Scan persiste après ANALYZE, forcer avec:
-- SET enable_seqscan = off;
-- ============================================================================

-- ============================================================================
-- ROLLBACK (en cas de problème)
-- ============================================================================
-- DROP INDEX CONCURRENTLY IF EXISTS idx_prs_piece_kind_prb;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_prs_kind;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_prb_name_upper;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_pieces_price_piece_dispo_type;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_pieces_media_img_piece_sort;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_seo_gamme_car_pg_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_type_motor_code_type;
-- ============================================================================
