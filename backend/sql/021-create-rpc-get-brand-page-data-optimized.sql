-- ============================================================================
-- 🚀 RPC OPTIMISÉE: get_brand_page_data_optimized
-- ============================================================================
-- Combine 6 appels API en 1 seule requête PostgreSQL pour les pages marques
-- Performance: <100ms vs 400-800ms avec appels séquentiels
--
-- Remplace:
-- - /api/vehicles/brands/{id}
-- - /api/seo/marque/{id}
-- - /api/vehicles/brand/{alias}/bestsellers (vehicles)
-- - /api/vehicles/brand/{alias}/bestsellers (parts)
-- - /api/blog/marque/{id}
-- - /api/vehicles/brand/{id}/maillage
-- ============================================================================

CREATE OR REPLACE FUNCTION get_brand_page_data_optimized(p_marque_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_result JSONB;
  v_brand JSONB;
  v_seo JSONB;
  v_vehicles JSONB;
  v_parts JSONB;
  v_blog JSONB;
  v_related_brands JSONB;
  v_popular_gammes JSONB;
BEGIN
  -- ========================================
  -- SECTION 1: BRAND DATA (auto_marque)
  -- ========================================
  SELECT jsonb_build_object(
    'marque_id', marque_id,
    'marque_name', marque_name,
    'marque_name_meta', marque_name_meta,
    'marque_name_meta_title', marque_name_meta_title,
    'marque_alias', marque_alias,
    'marque_logo', marque_logo,
    'marque_display', marque_display,
    'marque_relfollow', marque_relfollow
  )
  INTO v_brand
  FROM auto_marque
  WHERE marque_id = p_marque_id
    AND marque_display = '1';

  -- Si marque non trouvée, retourner erreur
  IF v_brand IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Marque non trouvée ou désactivée'
    )::JSON;
  END IF;

  -- ========================================
  -- SECTION 2: SEO DATA (__seo_marque)
  -- ========================================
  SELECT COALESCE(jsonb_build_object(
    'sm_title', sm_title,
    'sm_descrip', sm_descrip,
    'sm_keywords', sm_keywords,
    'sm_h1', sm_h1,
    'sm_content', sm_content
  ), '{}'::jsonb)
  INTO v_seo
  FROM __seo_marque
  WHERE sm_marque_id = p_marque_id::TEXT
  LIMIT 1;

  IF v_seo IS NULL THEN
    v_seo := '{}'::jsonb;
  END IF;

  -- ========================================
  -- SECTION 3: POPULAR VEHICLES (__cross_gamme_car_new)
  -- ========================================
  SELECT COALESCE(jsonb_agg(vehicle_data), '[]'::jsonb)
  INTO v_vehicles
  FROM (
    SELECT DISTINCT ON (at.type_id)
      jsonb_build_object(
        'type_id', at.type_id,
        'type_alias', at.type_alias,
        'type_name', at.type_name,
        'type_name_meta', at.type_name_meta,
        'type_power_ps', at.type_power_ps,
        'type_fuel', at.type_fuel,
        'type_year_from', at.type_year_from,
        'type_month_from', at.type_month_from,
        'type_year_to', at.type_year_to,
        'type_month_to', at.type_month_to,
        'modele_id', am.modele_id,
        'modele_alias', am.modele_alias,
        'modele_name', am.modele_name,
        'modele_name_meta', am.modele_name_meta,
        'modele_pic', am.modele_pic,
        'marque_id', amb.marque_id,
        'marque_alias', amb.marque_alias,
        'marque_name', amb.marque_name,
        'marque_name_meta_title', amb.marque_name_meta_title,
        'vehicle_url', '/constructeurs/' || amb.marque_alias || '/' || am.modele_alias || '/' || at.type_alias || '-' || at.type_id || '.html',
        'image_url', 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-modeles/' || amb.marque_alias || '/' || COALESCE(am.modele_pic, 'no.png')
      ) AS vehicle_data
    FROM __cross_gamme_car_new cgc
    INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id
    INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
    INNER JOIN auto_marque amb ON amb.marque_id = am.modele_marque_id
    WHERE cgc.cgc_level = '2'
      AND cgc.cgc_marque_id = p_marque_id::TEXT
      AND am.modele_display = 1
      AND at.type_display = '1'
    ORDER BY at.type_id DESC
    LIMIT 12
  ) sub;

  -- ========================================
  -- SECTION 4: POPULAR PARTS (__cross_gamme_car_new + pieces_gamme)
  -- ========================================
  SELECT COALESCE(jsonb_agg(part_data), '[]'::jsonb)
  INTO v_parts
  FROM (
    SELECT DISTINCT ON (pg.pg_id)
      jsonb_build_object(
        'pg_id', pg.pg_id,
        'pg_alias', pg.pg_alias,
        'pg_name', pg.pg_name,
        'pg_name_meta', pg.pg_name_meta,
        'pg_img', pg.pg_img,
        'pg_top', pg.pg_top,
        'type_id', at.type_id,
        'type_name', at.type_name,
        'type_alias', at.type_alias,
        'modele_name', am.modele_name,
        'modele_alias', am.modele_alias,
        'marque_name', amb.marque_name,
        'marque_alias', amb.marque_alias,
        'part_url', '/pieces/' || pg.pg_alias || '/' || amb.marque_alias || '/' || am.modele_alias || '/' || at.type_alias || '-' || at.type_id || '.html',
        'image_url', 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/gammes-produits/catalogue/' || COALESCE(pg.pg_img, 'no.png')
      ) AS part_data
    FROM __cross_gamme_car_new cgc
    INNER JOIN pieces_gamme pg ON pg.pg_id::TEXT = cgc.cgc_pg_id
    INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id
    INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
    INNER JOIN auto_marque amb ON amb.marque_id::TEXT = cgc.cgc_marque_id
    WHERE cgc.cgc_level = '1'
      AND cgc.cgc_marque_id = p_marque_id::TEXT
      AND pg.pg_display = '1'
    ORDER BY pg.pg_id, pg.pg_top DESC
    LIMIT 12
  ) sub;

  -- ========================================
  -- SECTION 5: BLOG CONTENT (__blog_seo_marque)
  -- ========================================
  SELECT COALESCE(jsonb_build_object(
    'bsm_h1', bsm_h1,
    'bsm_content', bsm_content,
    'bsm_descrip', bsm_descrip
  ), '{}'::jsonb)
  INTO v_blog
  FROM __blog_seo_marque
  WHERE bsm_marque_id = p_marque_id::TEXT
  LIMIT 1;

  IF v_blog IS NULL THEN
    v_blog := '{}'::jsonb;
  END IF;

  -- ========================================
  -- SECTION 6: RELATED BRANDS (marques populaires)
  -- ========================================
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'marque_id', marque_id,
      'marque_name', marque_name,
      'marque_alias', marque_alias,
      'marque_logo', marque_logo
    ) ORDER BY marque_name
  ), '[]'::jsonb)
  INTO v_related_brands
  FROM (
    SELECT marque_id, marque_name, marque_alias, marque_logo
    FROM auto_marque
    WHERE marque_display = '1'
      AND marque_id != p_marque_id
    ORDER BY marque_top DESC NULLS LAST, marque_name
    LIMIT 8
  ) sub;

  -- ========================================
  -- SECTION 7: POPULAR GAMMES (gammes les plus demandées)
  -- ========================================
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'pg_id', pg_id,
      'pg_name', pg_name,
      'pg_alias', pg_alias,
      'pg_img', pg_img
    ) ORDER BY pg_top DESC NULLS LAST
  ), '[]'::jsonb)
  INTO v_popular_gammes
  FROM (
    SELECT DISTINCT pg.pg_id, pg.pg_name, pg.pg_alias, pg.pg_img, pg.pg_top
    FROM pieces_gamme pg
    WHERE pg.pg_display = '1'
      AND pg.pg_display = '1'
      AND pg.pg_level IN ('1', '2')
    ORDER BY pg.pg_top DESC NULLS LAST
    LIMIT 12
  ) sub;

  -- ========================================
  -- BUILD FINAL RESULT
  -- ========================================
  v_result := jsonb_build_object(
    'success', true,
    'brand', v_brand,
    'seo', v_seo,
    'popular_vehicles', v_vehicles,
    'popular_parts', v_parts,
    'blog_content', v_blog,
    'related_brands', v_related_brands,
    'popular_gammes', v_popular_gammes,
    '_meta', jsonb_build_object(
      'total_vehicles', jsonb_array_length(v_vehicles),
      'total_parts', jsonb_array_length(v_parts),
      'total_related_brands', jsonb_array_length(v_related_brands),
      'total_popular_gammes', jsonb_array_length(v_popular_gammes)
    )
  );

  RETURN v_result::JSON;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE
    )::JSON;
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_brand_page_data_optimized(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_brand_page_data_optimized(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_brand_page_data_optimized(INTEGER) TO service_role;

-- ============================================================================
-- COMMENT
-- ============================================================================
COMMENT ON FUNCTION get_brand_page_data_optimized(INTEGER) IS
  'RPC optimisée pour pages marques constructeurs.
   Combine 6 appels API en 1 seule requête PostgreSQL.
   Performance: <100ms vs 400-800ms.
   Retourne: brand, seo, popular_vehicles, popular_parts, blog_content, related_brands, popular_gammes';

-- ============================================================================
-- TEST
-- ============================================================================
-- SELECT * FROM get_brand_page_data_optimized(140); -- Renault
-- SELECT * FROM get_brand_page_data_optimized(33);  -- BMW
