-- =========================================
-- ÉTAPE 1: SUPPRIMER L'ANCIENNE FONCTION
-- =========================================
DROP FUNCTION IF EXISTS get_gamme_page_data_optimized(INTEGER);
DROP FUNCTION IF EXISTS get_gamme_page_data_optimized(TEXT);
DROP FUNCTION IF EXISTS get_gamme_page_data_optimized;

-- =========================================
-- ÉTAPE 2: CRÉER LA NOUVELLE FONCTION
-- =========================================

-- ⚡ FONCTION RPC ULTRA-OPTIMISÉE : Récupère TOUTES les données d'une page gamme en 1 SEULE requête
-- Remplace 15+ requêtes REST API par 1 appel RPC
-- Objectif : passer de 138s à <5s
-- CORRECTION: Les colonnes *_pg_id sont de type TEXT, donc on convertit p_pg_id en TEXT

CREATE FUNCTION get_gamme_page_data_optimized(p_pg_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_result JSON;
  v_mf_id TEXT;
  v_pg_id_text TEXT;
BEGIN
  -- Convertir l'INTEGER en TEXT une seule fois
  v_pg_id_text := p_pg_id::TEXT;
  
  -- ========================================
  -- RÉCUPÉRATION DONNÉES DE BASE (1 requête composite)
  -- ========================================
  SELECT json_build_object(
    'catalog', (
      SELECT json_build_object(
        'mc_mf_prime', mc_mf_prime
      )
      FROM catalog_gamme
      WHERE mc_pg_id = v_pg_id_text
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
      WHERE sg_pg_id = v_pg_id_text
      LIMIT 1
    ),
    'conseils', (
      SELECT json_agg(json_build_object(
        'sgc_id', sgc_id,
        'sgc_title', sgc_title,
        'sgc_content', sgc_content
      ))
      FROM __seo_gamme_conseil
      WHERE sgc_pg_id = v_pg_id_text
    ),
    'informations', (
      SELECT json_agg(json_build_object(
        'sgi_content', sgi_content
      ))
      FROM __seo_gamme_info
      WHERE sgi_pg_id = v_pg_id_text
    ),
    'motorisations', (
      SELECT json_agg(json_build_object(
        'cgc_type_id', cgc_type_id,
        'cgc_id', cgc_id,
        'cgc_modele_id', cgc_modele_id
      ))
      FROM __cross_gamme_car_new
      WHERE cgc_pg_id = v_pg_id_text
        AND cgc_level = '1'
    ),
    'equipementiers', (
      SELECT json_agg(json_build_object(
        'seg_pm_id', seg_pm_id,
        'seg_content', seg_content
      ))
      FROM __seo_equip_gamme
      WHERE seg_pg_id = v_pg_id_text
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
      WHERE ba_pg_id = v_pg_id_text
      ORDER BY ba_update DESC, ba_create DESC
      LIMIT 1
    )
  ) INTO v_result;

  -- Récupérer mf_id pour les queries suivantes
  SELECT mc_mf_prime INTO v_mf_id
  FROM catalog_gamme
  WHERE mc_pg_id = v_pg_id_text
  LIMIT 1;

  -- ========================================
  -- CATALOGUE MÊME FAMILLE (si mf_id trouvé)
  -- ========================================
  IF v_mf_id IS NOT NULL THEN
    v_result := v_result || json_build_object(
      'catalogue_famille', (
        SELECT json_agg(
          json_build_object(
            'pg_id', pg.pg_id,
            'pg_name', pg.pg_name,
            'pg_alias', pg.pg_alias,
            'pg_pic', pg.pg_pic,
            'description', '',
            'meta_description', ''
          )
        )
        FROM catalog_gamme cg
        INNER JOIN pieces_gamme pg ON cg.mc_pg_id = pg.pg_id::TEXT
        WHERE cg.mc_mf_prime = v_mf_id
          AND cg.mc_pg_id != v_pg_id_text
          AND pg.pg_display::TEXT = '1'
        ORDER BY pg.pg_name ASC
        LIMIT 20
      ),
      'famille_info', (
        SELECT json_build_object(
          'mf_id', mf_id,
          'mf_name', mf_name,
          'mf_name_meta', mf_name_meta,
          'mf_color_primary', mf_color_primary,
          'mf_color_secondary', mf_color_secondary
        )
        FROM catalog_family
        WHERE mf_id = v_mf_id
          AND mf_display::TEXT = '1'
        LIMIT 1
      )
    );
  END IF;

  -- ========================================
  -- MOTORISATIONS ENRICHIES (avec marque/modèle/type en une seule query)
  -- ========================================
  v_result := v_result || json_build_object(
    'motorisations_enriched', (
      SELECT json_agg(
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
        )
      )
      FROM __cross_gamme_car_new cgc
      INNER JOIN auto_type at ON at.type_id = cgc.cgc_type_id
      INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
      INNER JOIN auto_marque amarq ON amarq.marque_id = am.modele_marque_id
      WHERE cgc.cgc_pg_id = v_pg_id_text
        AND cgc.cgc_level = '1'
        AND at.type_display = '1'
        AND am.modele_display = '1'
        AND amarq.marque_display = '1'
      ORDER BY amarq.marque_name, am.modele_name, at.type_year_from
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
      WHERE sis_pg_id = v_pg_id_text
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
      WHERE sis_pg_id = v_pg_id_text
        AND sis_alias = '2'
      LIMIT 50
    )
  );

  RETURN v_result;
END;
$$;

-- =========================================
-- ÉTAPE 3: DONNER LES PERMISSIONS
-- =========================================
GRANT EXECUTE ON FUNCTION get_gamme_page_data_optimized(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_gamme_page_data_optimized(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_gamme_page_data_optimized(INTEGER) TO service_role;

COMMENT ON FUNCTION get_gamme_page_data_optimized IS '⚡ Fonction RPC optimisée : récupère toutes les données d''une page gamme en 1 seule requête HTTP au lieu de 15+';
