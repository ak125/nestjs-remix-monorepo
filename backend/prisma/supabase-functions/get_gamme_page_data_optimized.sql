-- ⚡ FONCTION RPC ULTRA-OPTIMISÉE : Récupère TOUTES les données d'une page gamme en 1 SEULE requête
-- Remplace 15+ requêtes REST API par 1 appel RPC
-- Objectif : passer de 138s à <5s
-- CORRECTION: Les colonnes *_pg_id sont de type TEXT, donc on convertit p_pg_id en TEXT

CREATE OR REPLACE FUNCTION get_gamme_page_data_optimized(p_pg_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_result JSONB;  -- JSONB pour supporter l'opérateur ||
  v_mf_id TEXT;
  v_pg_id_text TEXT;
BEGIN
  -- Convertir l'INTEGER en TEXT une seule fois
  v_pg_id_text := p_pg_id::TEXT;
  
  -- ========================================
  -- RÉCUPÉRATION DONNÉES DE BASE (1 requête composite)
  -- ========================================
  SELECT jsonb_build_object(
    'page_info', (
      SELECT jsonb_build_object(
        'pg_id', pg_id,
        'pg_name', pg_name,
        'pg_name_meta', pg_name_meta,
        'pg_alias', pg_alias,
        'pg_pic', pg_pic,
        'pg_img', pg_img,
        'pg_wall', pg_wall,
        'pg_level', pg_level,
        'pg_relfollow', pg_relfollow
      )
      FROM pieces_gamme
      WHERE pg_id = p_pg_id
      LIMIT 1
    ),
    'catalog', (
      SELECT jsonb_build_object(
        'mc_mf_prime', mc_mf_prime
      )
      FROM catalog_gamme
      WHERE mc_pg_id = v_pg_id_text
      LIMIT 1
    ),
    'seo', (
      SELECT jsonb_build_object(
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
      SELECT jsonb_agg(jsonb_build_object(
        'sgc_id', sgc_id,
        'sgc_title', sgc_title,
        'sgc_content', sgc_content
      ))
      FROM __seo_gamme_conseil
      WHERE sgc_pg_id = v_pg_id_text
    ),
    'informations', (
      SELECT jsonb_agg(jsonb_build_object(
        'sgi_content', sgi_content
      ))
      FROM __seo_gamme_info
      WHERE sgi_pg_id = v_pg_id_text
    ),
    'motorisations', (
      SELECT jsonb_agg(jsonb_build_object(
        'cgc_type_id', cgc_type_id,
        'cgc_id', cgc_id,
        'cgc_modele_id', cgc_modele_id
      ))
      FROM __cross_gamme_car_new
      WHERE cgc_pg_id = v_pg_id_text
        AND cgc_level = '1'
    ),
    'equipementiers', (
      SELECT jsonb_agg(jsonb_build_object(
        'seg_pm_id', seg_pm_id,
        'seg_content', seg_content
      ))
      FROM __seo_equip_gamme
      WHERE seg_pg_id = v_pg_id_text
        AND seg_content IS NOT NULL
      LIMIT 4
    ),
    'blog', (
      SELECT jsonb_build_object(
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
    v_result := v_result || jsonb_build_object(
      'catalogue_famille', (
        SELECT jsonb_agg(sub)
        FROM (
          SELECT 
            pg.pg_id,
            pg.pg_name,
            pg.pg_alias,
            pg.pg_pic,
            '' as description,
            '' as meta_description
          FROM catalog_gamme cg
          INNER JOIN pieces_gamme pg ON cg.mc_pg_id::INTEGER = pg.pg_id
          WHERE cg.mc_mf_prime = v_mf_id
            AND cg.mc_pg_id != v_pg_id_text
            AND pg.pg_display = '1'
          ORDER BY pg.pg_name ASC
          LIMIT 20
        ) sub
      ),
      'famille_info', (
        SELECT jsonb_build_object(
          'mf_id', mf_id,
          'mf_name', mf_name,
          'mf_name_meta', mf_name_meta,
          'mf_pic', mf_pic,
          'mf_description', mf_description
        )
        FROM catalog_family
        WHERE mf_id = v_mf_id
          AND mf_display = '1'
        LIMIT 1
      )
    );
  END IF;

  -- ========================================
  -- SEO VALIDATION (comptages famille/gamme pour robots)
  -- Logique PHP: family_count >= 3 ET gamme_count >= 5 → index, follow
  -- ========================================
  v_result := v_result || jsonb_build_object(
    'seo_validation', (
      SELECT jsonb_build_object(
        'family_count', COALESCE((
          SELECT COUNT(DISTINCT mc_mf_id)::INTEGER 
          FROM catalog_gamme 
          WHERE mc_mf_prime = v_mf_id
        ), 0),
        'gamme_count', COALESCE((
          SELECT COUNT(DISTINCT mc_pg_id)::INTEGER 
          FROM catalog_gamme 
          WHERE mc_mf_prime = v_mf_id
        ), 0)
      )
    )
  );

  -- ========================================
  -- MOTORISATIONS ENRICHIES (avec 17 champs véhicule complets)
  -- Ajout: type_alias, type_fuel, type_engine, type_liter, type_body, mois
  -- Ajout: modele_alias, modele_pic, modele_body
  -- Ajout: marque_alias, marque_logo, marque_name_meta
  -- ========================================
  v_result := v_result || jsonb_build_object(
    'motorisations_enriched', (
      SELECT jsonb_agg(sub)
      FROM (
        SELECT
          -- AUTO_TYPE (motorisation) - 12 champs
          at.type_id,
          at.type_alias,
          at.type_name,
          at.type_name_meta,
          at.type_power_ps,
          at.type_power_kw,
          at.type_fuel,
          at.type_engine,
          at.type_liter,
          at.type_body,
          at.type_year_from,
          at.type_month_from,
          at.type_year_to,
          at.type_month_to,
          -- AUTO_MODELE (modèle) - 7 champs
          am.modele_id,
          am.modele_alias,
          am.modele_name,
          am.modele_name_meta,
          am.modele_pic,
          am.modele_body,
          am.modele_year_from,
          am.modele_year_to,
          -- AUTO_MARQUE (marque) - 5 champs
          amarq.marque_id,
          amarq.marque_alias,
          amarq.marque_name,
          amarq.marque_name_meta,
          amarq.marque_logo
        FROM __cross_gamme_car_new cgc
        INNER JOIN auto_type at ON at.type_id = cgc.cgc_type_id
        INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
        INNER JOIN auto_marque amarq ON amarq.marque_id::SMALLINT = am.modele_marque_id
        WHERE cgc.cgc_pg_id = v_pg_id_text
          AND cgc.cgc_level = '1'
          AND at.type_display = '1'
          AND am.modele_display = 1
          AND amarq.marque_display >= 1
        ORDER BY amarq.marque_name, am.modele_name, at.type_year_from
      ) sub
    ),
    'seo_fragments_1', (
      SELECT jsonb_agg(sub)
      FROM (
        SELECT sis_id, sis_content
        FROM __seo_item_switch
        WHERE sis_pg_id = v_pg_id_text
          AND sis_alias = '1'
        ORDER BY sis_id
      ) sub
    ),
    'seo_fragments_2', (
      SELECT jsonb_agg(sub)
      FROM (
        SELECT sis_id, sis_content
        FROM __seo_item_switch
        WHERE sis_pg_id = v_pg_id_text
          AND sis_alias = '2'
        ORDER BY sis_id
        LIMIT 50
      ) sub
    ),
    'seo_fragments_3', (
      SELECT jsonb_agg(sub)
      FROM (
        SELECT sis_id, sis_content
        FROM __seo_item_switch
        WHERE sis_pg_id = '0'
          AND sis_alias = '3'
        ORDER BY sis_id
      ) sub
    )
  );

  -- Reconvertir JSONB en JSON pour la compatibilité avec le type de retour
  RETURN v_result::JSON;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_gamme_page_data_optimized(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_gamme_page_data_optimized(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_gamme_page_data_optimized(INTEGER) TO service_role;

COMMENT ON FUNCTION get_gamme_page_data_optimized IS '⚡ Fonction RPC optimisée : récupère toutes les données d''une page gamme en 1 seule requête HTTP au lieu de 15+';
