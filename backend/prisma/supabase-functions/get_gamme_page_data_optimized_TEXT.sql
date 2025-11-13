-- =========================================
-- SOLUTION SIMPLE : p_pg_id en TEXT directement
-- =========================================
DROP FUNCTION IF EXISTS get_gamme_page_data_optimized(INTEGER);
DROP FUNCTION IF EXISTS get_gamme_page_data_optimized(TEXT);
DROP FUNCTION IF EXISTS get_gamme_page_data_optimized;

-- ⚡ FONCTION RPC ULTRA-OPTIMISÉE : Récupère TOUTES les données d'une page gamme en 1 SEULE requête
-- SOLUTION: Accepter directement TEXT au lieu d'INTEGER pour éviter les conversions
CREATE FUNCTION get_gamme_page_data_optimized(p_pg_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_result JSONB;
  v_mf_id TEXT;
BEGIN
  -- ========================================
  -- RÉCUPÉRATION DONNÉES DE BASE (1 requête composite)
  -- ========================================
  SELECT jsonb_build_object(
    'catalog', (
      SELECT json_build_object(
        'mc_mf_prime', mc_mf_prime
      )
      FROM catalog_gamme
      WHERE mc_pg_id = p_pg_id
      LIMIT 1
    ),
    'seo', (
      SELECT json_build_object(
        'sg_title', sg_title,
        'sg_descrip', sg_descrip,
        'sg_keywords', sg_keywords,
        'sg_h1', sg_h1,
        'sg_content', sg_content
      )
      FROM __seo_gamme
      WHERE sg_pg_id = p_pg_id
      LIMIT 1
    ),
    'conseils', (
      SELECT json_agg(json_build_object(
        'sgc_id', sgc_id,
        'sgc_title', sgc_title,
        'sgc_content', sgc_content
      ))
      FROM __seo_gamme_conseil
      WHERE sgc_pg_id = p_pg_id
    ),
    'informations', (
      SELECT json_agg(json_build_object(
        'sgi_content', sgi_content
      ))
      FROM __seo_gamme_info
      WHERE sgi_pg_id = p_pg_id
    ),
    'motorisations', (
      SELECT json_agg(json_build_object(
        'cgc_type_id', cgc_type_id,
        'cgc_id', cgc_id,
        'cgc_modele_id', cgc_modele_id
      ))
      FROM __cross_gamme_car_new
      WHERE cgc_pg_id = p_pg_id
        AND cgc_level = '1'
    ),
    'equipementiers', (
      SELECT json_agg(json_build_object(
        'seg_pm_id', seg_pm_id,
        'seg_content', seg_content
      ))
      FROM __seo_equip_gamme
      WHERE seg_pg_id = p_pg_id
        AND seg_content IS NOT NULL
      LIMIT 4
    ),
    'blog', (
      SELECT json_build_object(
        'ba_id', ba_id,
        'ba_h1', ba_h1,
        'ba_alias', ba_alias,
        'ba_preview', ba_preview,
        'ba_wall', ba_wall,
        'ba_update', ba_update
      )
      FROM __blog_advice
      WHERE ba_pg_id = p_pg_id
      ORDER BY ba_update DESC, ba_create DESC
      LIMIT 1
    )
  ) INTO v_result;

  -- Récupérer mf_id pour les queries suivantes
  SELECT mc_mf_prime INTO v_mf_id
  FROM catalog_gamme
  WHERE mc_pg_id = p_pg_id
  LIMIT 1;

  -- ========================================
  -- CATALOGUE MÊME FAMILLE (TEMPORAIREMENT DÉSACTIVÉ)
  -- ========================================
  IF v_mf_id IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'famille_info', (
        SELECT json_build_object(
          'mf_id', mf_id,
          'mf_name', mf_name,
          'mf_name_meta', mf_name_meta
        )
        FROM catalog_family
        WHERE mf_id = v_mf_id
          AND CAST(mf_display AS TEXT) = '1'
        LIMIT 1
      )
    );
  END IF;

  -- ========================================
  -- MOTORISATIONS ENRICHIES (avec marque/modèle/type en une seule query)
  -- ========================================
  v_result := v_result || jsonb_build_object(
    'motorisations_enriched', (
      SELECT json_agg(motorisation_data ORDER BY marque_name, modele_name, type_year_from)
      FROM (
        SELECT 
          json_build_object(
            'type_id', at.type_id,
            'type_name', at.type_name,
            'type_power_ps', at.type_power_ps,
            'type_year_from', at.type_year_from,
            'type_year_to', at.type_year_to,
            'modele_id', am.modele_id,
            'modele_name', am.modele_name,
            'marque_id', amarq.marque_id,
            'marque_name', amarq.marque_name
          ) as motorisation_data,
          amarq.marque_name,
          am.modele_name,
          at.type_year_from
        FROM __cross_gamme_car_new cgc
        INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id::TEXT
        INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id::TEXT
        INNER JOIN auto_marque amarq ON amarq.marque_id::TEXT = am.modele_marque_id::TEXT
        WHERE cgc.cgc_pg_id = p_pg_id
          AND cgc.cgc_level = '1'
          AND at.type_display = '1'
          AND am.modele_display = '1'
          AND amarq.marque_display = '1'
      ) subquery
    ),
    'seo_fragments_1', (
      SELECT json_agg(
        json_build_object(
          'sis_id', sis_id,
          'sis_content', sis_content
        )
        ORDER BY sis_id
      )
      FROM __seo_item_switch
      WHERE sis_pg_id = p_pg_id
        AND sis_alias = '1'
    ),
    'seo_fragments_2', (
      SELECT json_agg(
        json_build_object(
          'sis_id', sis_id,
          'sis_content', sis_content
        )
        ORDER BY sis_id
      )
      FROM __seo_item_switch
      WHERE sis_pg_id = p_pg_id
        AND sis_alias = '2'
      LIMIT 50
    )
  );

  RETURN v_result;
END;
$$;

-- =========================================
-- PERMISSIONS
-- =========================================
GRANT EXECUTE ON FUNCTION get_gamme_page_data_optimized(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_gamme_page_data_optimized(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_gamme_page_data_optimized(TEXT) TO service_role;

COMMENT ON FUNCTION get_gamme_page_data_optimized IS '⚡ Fonction RPC optimisée : récupère toutes les données d''une page gamme en 1 seule requête HTTP au lieu de 15+';
