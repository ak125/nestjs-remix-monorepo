-- ⚡ FONCTION RPC ULTRA-OPTIMISÉE : Récupère TOUTES les données d'une page gamme en 1 SEULE requête
-- Remplace 15+ requêtes REST API par 1 appel RPC
-- Objectif : passer de 138s à <5s
-- CORRECTION: Les colonnes *_pg_id sont de type TEXT, donc on convertit p_pg_id en TEXT
--
-- 📊 SYSTÈMES DE NIVEAUX (CGC_LEVEL) :
-- Niveau 1 = VEDETTES : Véhicules les plus consultés → Section "Motorisations compatibles" (grille)
-- Niveau 2 = SECONDAIRES : Véhicules populaires → Page marque constructeur
-- Niveau 3 = EXHAUSTIF : Toutes gammes compatibles → Page type véhicule
-- Niveau 5 = BLOG : Véhicules cités dans articles/guides → Section blog de la page gamme

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
        'cgc_modele_id', cgc_modele_id,
        'cgc_level', cgc_level
      ))
      FROM __cross_gamme_car_new
      WHERE cgc_pg_id = v_pg_id_text
        AND cgc_level = '1'  -- Level 1 uniquement (véhicules vedettes)
    ),
    'equipementiers', (
      SELECT jsonb_agg(sub)
      FROM (
        SELECT 
          seg.seg_pm_id,
          seg.seg_content,
          pm.pm_name,
          pm.pm_logo
        FROM __seo_equip_gamme seg
        INNER JOIN pieces_marque pm ON pm.pm_id::TEXT = seg.seg_pm_id
        WHERE seg.seg_pg_id = v_pg_id_text
          AND seg.seg_content IS NOT NULL
        LIMIT 6
      ) sub
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
  -- ✅ ENRICHI: Joint __seo_gamme pour récupérer sg_descrip (descriptions riches)
  -- ✅ Ordre par mc_sort (même ordre que la page catalogue/index)
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
            COALESCE(sg.sg_descrip, '') as description,
            COALESCE(sg.sg_title, '') as meta_description,
            cg.mc_sort
          FROM catalog_gamme cg
          INNER JOIN pieces_gamme pg ON cg.mc_pg_id::INTEGER = pg.pg_id
          LEFT JOIN __seo_gamme sg ON sg.sg_pg_id = cg.mc_pg_id
          WHERE cg.mc_mf_prime = v_mf_id
            AND cg.mc_pg_id != v_pg_id_text
            AND pg.pg_display = '1'
          ORDER BY cg.mc_sort::INTEGER ASC, pg.pg_name ASC
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
  -- MOTORISATIONS ENRICHIES - Section grille principale (CGC_LEVEL = 1)
  -- 🎯 DIVERSITÉ PAR MARQUE : Sélectionne max 3 véhicules par marque depuis level 1
  -- Garantit une représentation équilibrée des 7 marques vedettes
  -- ========================================
  v_result := v_result || jsonb_build_object(
    'motorisations_enriched', (
      SELECT jsonb_agg(sub)
      FROM (
        WITH ranked_vehicles AS (
          SELECT
            cgc.cgc_level,
            -- AUTO_TYPE (motorisation)
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
            -- AUTO_MODELE
            am.modele_id,
            am.modele_alias,
            am.modele_name,
            am.modele_name_meta,
            am.modele_pic,
            am.modele_body,
            am.modele_year_from,
            am.modele_year_to,
            -- AUTO_MARQUE
            amarq.marque_id,
            amarq.marque_alias,
            amarq.marque_name,
            amarq.marque_name_meta,
            amarq.marque_logo,
            -- Numéroter les véhicules par marque (par popularité = cgc_id croissant)
            ROW_NUMBER() OVER (
              PARTITION BY amarq.marque_id 
              ORDER BY cgc.cgc_id::INTEGER ASC
            ) AS rn_per_brand,
            cgc.cgc_id::INTEGER AS cgc_order
          FROM __cross_gamme_car_new cgc
          INNER JOIN auto_type at ON at.type_id = cgc.cgc_type_id
          INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
          INNER JOIN auto_marque amarq ON amarq.marque_id::SMALLINT = am.modele_marque_id
          WHERE cgc.cgc_pg_id = v_pg_id_text
            AND cgc.cgc_level = '1'  -- Level 1 uniquement (véhicules vedettes)
            AND at.type_display = '1'
            AND am.modele_display = 1
            AND amarq.marque_display >= 1
        )
        SELECT
          cgc_level,
          type_id,
          type_alias,
          type_name,
          type_name_meta,
          type_power_ps,
          type_power_kw,
          type_fuel,
          type_engine,
          type_liter,
          type_body,
          type_year_from,
          type_month_from,
          type_year_to,
          type_month_to,
          modele_id,
          modele_alias,
          modele_name,
          modele_name_meta,
          modele_pic,
          modele_body,
          modele_year_from,
          modele_year_to,
          marque_id,
          marque_alias,
          marque_name,
          marque_name_meta,
          marque_logo
        FROM ranked_vehicles
        WHERE rn_per_brand <= 3  -- Max 3 véhicules par marque pour diversité
        ORDER BY cgc_order ASC  -- Ordre par popularité (cgc_id = ordre d'insertion)
        LIMIT 20
      ) sub
    ),
    -- ========================================
    -- MOTORISATIONS BLOG - Section blog/guide d'achat (CGC_LEVEL = 5)
    -- Véhicules cités dans les articles de blog liés à cette gamme
    -- ========================================
    'motorisations_blog', (
      SELECT jsonb_agg(sub)
      FROM (
        SELECT
          cgc.cgc_level,
          at.type_id,
          at.type_alias,
          at.type_name,
          at.type_power_ps,
          at.type_year_from,
          at.type_year_to,
          am.modele_id,
          am.modele_alias,
          am.modele_name,
          am.modele_pic,
          amarq.marque_id,
          amarq.marque_alias,
          amarq.marque_name,
          amarq.marque_logo
        FROM __cross_gamme_car_new cgc
        INNER JOIN auto_type at ON at.type_id = cgc.cgc_type_id
        INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
        INNER JOIN auto_marque amarq ON amarq.marque_id::SMALLINT = am.modele_marque_id
        WHERE cgc.cgc_pg_id = v_pg_id_text
          AND cgc.cgc_level = '5'  -- Niveau 5 pour section blog
          AND at.type_display = '1'
          AND am.modele_display = 1
          AND amarq.marque_display >= 1
        ORDER BY amarq.marque_name, am.modele_name
        LIMIT 10
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
    ),
    -- ========================================
    -- STATISTIQUES CGC_LEVEL (pour debug et monitoring)
    -- ========================================
    'cgc_level_stats', (
      SELECT jsonb_build_object(
        'level_1', COALESCE((SELECT COUNT(*) FROM __cross_gamme_car_new WHERE cgc_pg_id = v_pg_id_text AND cgc_level = '1'), 0),
        'level_2', COALESCE((SELECT COUNT(*) FROM __cross_gamme_car_new WHERE cgc_pg_id = v_pg_id_text AND cgc_level = '2'), 0),
        'level_3', COALESCE((SELECT COUNT(*) FROM __cross_gamme_car_new WHERE cgc_pg_id = v_pg_id_text AND cgc_level = '3'), 0),
        'level_5', COALESCE((SELECT COUNT(*) FROM __cross_gamme_car_new WHERE cgc_pg_id = v_pg_id_text AND cgc_level = '5'), 0),
        'total', COALESCE((SELECT COUNT(*) FROM __cross_gamme_car_new WHERE cgc_pg_id = v_pg_id_text), 0),
        'distinct_brands', COALESCE((
          SELECT COUNT(DISTINCT amarq.marque_id)
          FROM __cross_gamme_car_new cgc
          INNER JOIN auto_type at ON at.type_id = cgc.cgc_type_id
          INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
          INNER JOIN auto_marque amarq ON amarq.marque_id::SMALLINT = am.modele_marque_id
          WHERE cgc.cgc_pg_id = v_pg_id_text
            AND cgc.cgc_level = '1'  -- Level 1 uniquement
            AND at.type_display = '1'
            AND am.modele_display = 1
            AND amarq.marque_display >= 1
        ), 0)
      )
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

COMMENT ON FUNCTION get_gamme_page_data_optimized IS '⚡ RPC optimisée page gamme (1 requête au lieu de 15+). CGC_LEVEL: 1=motorisations grille, 2=page marque, 3=page type, 5=section blog';
