-- ============================================================================
-- PostgreSQL Function: Agréger toutes les données gamme en 1 seule requête
-- ============================================================================
-- 
-- Problème: 7 requêtes REST API parallèles = 23 secondes (overhead réseau)
-- Solution: 1 function PostgreSQL qui retourne tout en JSON en <500ms
-- 
-- Cette function remplace 7 appels REST par 1 seul appel RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION get_gamme_page_data(p_pg_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSON;
    v_seo_gamme JSON;
    v_catalog_gamme JSON;
    v_seo_conseil JSON[];
    v_seo_info JSON[];
    v_seo_equip JSON[];
    v_cross_gamme JSON[];
    v_blog_advice JSON[];
BEGIN
    -- 1. __seo_gamme (LIMIT 1)
    -- sg_pg_id est TEXT, donc cast p_pg_id en TEXT
    SELECT row_to_json(t) INTO v_seo_gamme
    FROM (
        SELECT *
        FROM public.__seo_gamme
        WHERE sg_pg_id = p_pg_id::TEXT
        LIMIT 1
    ) t;

    -- 2. catalog_gamme (LIMIT 1)
    -- mc_pg_id est TEXT aussi (toutes les colonnes *_pg_id sont TEXT)
    SELECT row_to_json(t) INTO v_catalog_gamme
    FROM (
        SELECT *
        FROM public.catalog_gamme
        WHERE mc_pg_id = p_pg_id::TEXT
        LIMIT 1
    ) t;

    -- 3. __seo_gamme_conseil (ORDER BY sgc_id)
    -- sgc_pg_id est TEXT
    SELECT ARRAY_AGG(row_to_json(t) ORDER BY t.sgc_id) INTO v_seo_conseil
    FROM (
        SELECT *
        FROM public.__seo_gamme_conseil
        WHERE sgc_pg_id = p_pg_id::TEXT
        ORDER BY sgc_id
    ) t;

    -- 4. __seo_gamme_info (ORDER BY sgi_id)
    -- sgi_pg_id est TEXT
    SELECT ARRAY_AGG(row_to_json(t) ORDER BY t.sgi_id) INTO v_seo_info
    FROM (
        SELECT *
        FROM public.__seo_gamme_info
        WHERE sgi_pg_id = p_pg_id::TEXT
        ORDER BY sgi_id
    ) t;

    -- 5. __seo_equip_gamme (ORDER BY seg_id LIMIT 4)
    -- seg_pg_id est TEXT
    SELECT ARRAY_AGG(row_to_json(t) ORDER BY t.seg_id) INTO v_seo_equip
    FROM (
        SELECT *
        FROM public.__seo_equip_gamme
        WHERE seg_pg_id = p_pg_id::TEXT
        ORDER BY seg_id
        LIMIT 4
    ) t;

    -- 6. __cross_gamme_car_new (cgc_level = 1 pour motorisations, ORDER BY cgc_id)
    -- cgc_pg_id est TEXT, cgc_level doit être '1' pour les motorisations affichées
    SELECT ARRAY_AGG(row_to_json(t) ORDER BY t.cgc_id) INTO v_cross_gamme
    FROM (
        SELECT *
        FROM public.__cross_gamme_car_new
        WHERE cgc_pg_id = p_pg_id::TEXT
          AND cgc_level = '1'
        ORDER BY cgc_id
    ) t;

    -- 7. __blog_advice
    -- ba_pg_id est TEXT
    SELECT ARRAY_AGG(row_to_json(t)) INTO v_blog_advice
    FROM (
        SELECT *
        FROM public.__blog_advice
        WHERE ba_pg_id = p_pg_id::TEXT
    ) t;

    -- Construire le JSON final
    v_result := json_build_object(
        'seo_gamme', v_seo_gamme,
        'catalog_gamme', v_catalog_gamme,
        'seo_conseil', COALESCE(v_seo_conseil, ARRAY[]::JSON[]),
        'seo_info', COALESCE(v_seo_info, ARRAY[]::JSON[]),
        'seo_equip', COALESCE(v_seo_equip, ARRAY[]::JSON[]),
        'cross_gamme', COALESCE(v_cross_gamme, ARRAY[]::JSON[]),
        'blog_advice', COALESCE(v_blog_advice, ARRAY[]::JSON[])
    );

    RETURN v_result;
END;
$$;

-- Ajouter un commentaire descriptif
COMMENT ON FUNCTION get_gamme_page_data(INTEGER) IS 
  'Agrège toutes les données gamme (SEO, catalogue, motorisations) en 1 requête. Remplace 7 appels REST API (23s) par 1 RPC (<500ms)';


-- ============================================================================
-- EXEMPLE D'UTILISATION
-- ============================================================================
-- Via SQL Editor:
-- SELECT get_gamme_page_data(402);

-- Via Supabase client (NestJS):
-- const { data } = await supabase.rpc('get_gamme_page_data', { p_pg_id: 402 });


-- ============================================================================
-- TEST DE PERFORMANCE
-- ============================================================================
-- Mesurer le temps d'exécution:
EXPLAIN ANALYZE
SELECT get_gamme_page_data(402);

-- Vérifier le résultat:
SELECT get_gamme_page_data(402) AS result;


-- ============================================================================
-- RÉSULTAT ATTENDU
-- ============================================================================
-- Avant: 7 requêtes REST = 23 secondes
-- Après: 1 RPC PostgreSQL = <500ms (réduction 98%)
-- 
-- Avantages:
-- - 1 seul round-trip réseau au lieu de 7
-- - Exécution dans PostgreSQL (pas d'overhead REST API)
-- - Utilise les indexes créés précédemment
-- - Transactionnel (cohérence des données)
-- ============================================================================
