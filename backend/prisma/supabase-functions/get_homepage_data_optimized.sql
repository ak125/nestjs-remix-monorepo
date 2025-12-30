-- ============================================================================
-- RPC Function: get_homepage_data_optimized
-- ============================================================================
-- Purpose: Récupère TOUTES les données de la page d'accueil en 1 seule requête RPC
--          au lieu de 4 appels API séquentiels
--
-- Remplace:
--   1. /api/catalog/equipementiers (équipementiers premium)
--   2. /api/blog/advice?limit=6 (articles conseils populaires)
--   3. /api/catalog/gammes/hierarchy (familles + gammes catalogue)
--   4. /api/brands/brands-logos (marques automobiles avec logos)
--
-- Performance cible: <150ms au lieu de 400-800ms
--
-- Usage depuis NestJS:
--   const { data } = await this.supabase.rpc('get_homepage_data_optimized');
-- ============================================================================

CREATE OR REPLACE FUNCTION get_homepage_data_optimized()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    -- ========================================
    -- SECTION 1: ÉQUIPEMENTIERS PREMIUM (pieces_marque)
    -- Ordre: BOSCH, VALEO, MANN FILTER, etc. puis alphabétique
    -- ========================================
    'equipementiers', (
      SELECT COALESCE(jsonb_agg(sub ORDER BY priority, pm_name), '[]'::jsonb)
      FROM (
        SELECT DISTINCT ON (pm_name)
          pm_id,
          pm_name,
          pm_logo,
          pm_alias,
          CASE pm_name
            WHEN 'BOSCH' THEN 1
            WHEN 'VALEO' THEN 2
            WHEN 'MANN FILTER' THEN 3
            WHEN 'MANN-FILTER' THEN 3
            WHEN 'SKF' THEN 4
            WHEN 'LUK' THEN 5
            WHEN 'SACHS' THEN 6
            WHEN 'BREMBO' THEN 7
            WHEN 'NGK' THEN 8
            WHEN 'CONTINENTAL' THEN 9
            WHEN 'HELLA' THEN 10
            WHEN 'DENSO' THEN 11
            WHEN 'GATES' THEN 12
            WHEN 'FEBI BILSTEIN' THEN 13
            WHEN 'TRW' THEN 14
            WHEN 'DAYCO' THEN 15
            ELSE 999
          END AS priority
        FROM pieces_marque
        WHERE pm_display = '1'
        ORDER BY pm_name, pm_id
      ) sub
      LIMIT 50
    ),

    -- ========================================
    -- SECTION 2: ARTICLES CONSEILS POPULAIRES (__blog_advice)
    -- Top 6 articles par nombre de visites
    -- ========================================
    'blog_articles', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'ba_id', ba.ba_id,
          'ba_title', ba.ba_title,
          'ba_descrip', ba.ba_descrip,
          'ba_alias', ba.ba_alias,
          'ba_preview', ba.ba_preview,
          'ba_visit', ba.ba_visit,
          'ba_create', ba.ba_create,
          'pg_alias', pg.pg_alias,
          'pg_name', pg.pg_name
        )
      ), '[]'::jsonb)
      FROM (
        SELECT ba_id, ba_title, ba_descrip, ba_alias, ba_preview, ba_visit, ba_create, ba_pg_id
        FROM __blog_advice
        ORDER BY ba_visit DESC NULLS LAST, ba_create DESC NULLS LAST
        LIMIT 6
      ) ba
      LEFT JOIN pieces_gamme pg ON pg.pg_id::TEXT = ba.ba_pg_id
    ),

    -- ========================================
    -- SECTION 3: CATALOGUE FAMILLES + GAMMES (catalog_family + catalog_gamme + pieces_gamme)
    -- ========================================
    'catalog', (
      WITH families AS (
        SELECT
          mf_id,
          mf_name,
          COALESCE(mf_name_system, mf_name) AS mf_name_display,
          mf_name_meta,
          mf_description,
          mf_pic,
          mf_sort
        FROM catalog_family
        WHERE mf_display = '1'
      ),
      gammes_by_family AS (
        SELECT
          cg.mc_mf_id,
          jsonb_agg(
            jsonb_build_object(
              'pg_id', pg.pg_id,
              'pg_alias', pg.pg_alias,
              'pg_name', pg.pg_name,
              'pg_name_meta', pg.pg_name_meta,
              'pg_img', pg.pg_img
            ) ORDER BY cg.mc_sort::INTEGER NULLS LAST, pg.pg_name
          ) AS gammes
        FROM catalog_gamme cg
        INNER JOIN pieces_gamme pg ON cg.mc_pg_id = pg.pg_id::TEXT
        WHERE pg.pg_display = '1'
        GROUP BY cg.mc_mf_id
      )
      SELECT jsonb_build_object(
        'families', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'mf_id', f.mf_id,
              'mf_name', f.mf_name_display,
              'mf_name_meta', f.mf_name_meta,
              'mf_description', f.mf_description,
              'mf_pic', f.mf_pic,
              'gammes', COALESCE(g.gammes, '[]'::jsonb),
              'gammes_count', COALESCE(jsonb_array_length(g.gammes), 0)
            ) ORDER BY f.mf_sort::INTEGER NULLS LAST, f.mf_name
          )
          FROM families f
          LEFT JOIN gammes_by_family g ON g.mc_mf_id = f.mf_id
        ), '[]'::jsonb),
        'total_families', (SELECT COUNT(*) FROM families),
        'total_gammes', (SELECT COUNT(*) FROM catalog_gamme WHERE mc_mf_id IS NOT NULL)
      )
    ),

    -- ========================================
    -- SECTION 4: MARQUES AUTOMOBILES AVEC LOGOS (auto_marque)
    -- Top 100 marques actives, triées alphabétiquement
    -- ========================================
    'brands', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'marque_id', marque_id,
          'marque_name', marque_name,
          'marque_alias', marque_alias,
          'marque_logo', marque_logo,
          'marque_top', marque_top
        ) ORDER BY marque_name
      ), '[]'::jsonb)
      FROM auto_marque
      WHERE marque_display = '1'
      LIMIT 100
    ),

    -- ========================================
    -- SECTION 5: STATISTIQUES GLOBALES
    -- ========================================
    'stats', jsonb_build_object(
      'total_equipementiers', (SELECT COUNT(DISTINCT pm_name) FROM pieces_marque WHERE pm_display = '1'),
      'total_brands', (SELECT COUNT(*) FROM auto_marque WHERE marque_display = '1'),
      'total_families', (SELECT COUNT(*) FROM catalog_family WHERE mf_display = '1'),
      'total_gammes', (SELECT COUNT(*) FROM pieces_gamme WHERE pg_display = '1')
    )
  ) INTO v_result;

  -- Ajouter métadonnées de succès
  v_result := v_result || jsonb_build_object(
    'success', true,
    'generated_at', NOW()
  );

  RETURN v_result::JSON;
END;
$$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_homepage_data_optimized() TO authenticated;
GRANT EXECUTE ON FUNCTION get_homepage_data_optimized() TO anon;
GRANT EXECUTE ON FUNCTION get_homepage_data_optimized() TO service_role;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================
COMMENT ON FUNCTION get_homepage_data_optimized IS
  'RPC optimisée page accueil - Combine 4 appels API en 1.
   Performance: <150ms vs 400-800ms.
   Retourne: equipementiers, blog_articles, catalog (families+gammes), brands, stats';

-- ============================================================================
-- TEST (à exécuter dans Supabase SQL Editor)
-- ============================================================================
-- SELECT * FROM get_homepage_data_optimized();
-- Vérifie: equipementiers > 0, blog_articles = 6, catalog.families > 0, brands > 0
