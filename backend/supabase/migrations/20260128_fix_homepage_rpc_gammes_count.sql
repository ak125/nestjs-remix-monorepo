-- ============================================================================
-- Migration: Fix stats.total_gammes in get_homepage_data_optimized
-- ============================================================================
-- Problem: stats.total_gammes was counting ALL gammes in pieces_gamme (4205)
--          instead of only gammes linked to catalog_gamme (~230)
--
-- Fix: Use COUNT(DISTINCT) on catalog_gamme joined with pieces_gamme
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
    -- FIX: total_gammes now counts only catalog-linked gammes
    -- ========================================
    'stats', jsonb_build_object(
      'total_equipementiers', (SELECT COUNT(DISTINCT pm_name) FROM pieces_marque WHERE pm_display = '1'),
      'total_brands', (SELECT COUNT(*) FROM auto_marque WHERE marque_display = '1'),
      'total_families', (SELECT COUNT(*) FROM catalog_family WHERE mf_display = '1'),
      'total_gammes', (SELECT COUNT(DISTINCT cg.mc_pg_id) FROM catalog_gamme cg INNER JOIN pieces_gamme pg ON cg.mc_pg_id = pg.pg_id::TEXT WHERE pg.pg_display = '1')
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

-- Permissions (réaffirmer pour être sûr)
GRANT EXECUTE ON FUNCTION get_homepage_data_optimized() TO authenticated;
GRANT EXECUTE ON FUNCTION get_homepage_data_optimized() TO anon;
GRANT EXECUTE ON FUNCTION get_homepage_data_optimized() TO service_role;
