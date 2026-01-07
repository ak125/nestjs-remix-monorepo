-- ============================================================================
-- MIGRATION: Create refresh_gamme_aggregates RPC function
-- ============================================================================
-- Phase 1 du système Badges SEO v2: "Fiabiliser la vérité"
-- Cette fonction calcule les KPIs agrégés pour les 221 gammes du catalog
--
-- Sources de données:
-- - catalog_gamme (liste des 221 gammes à traiter)
-- - pieces (products direct)
-- - __cross_gamme_car (vehicles)
-- - gamme_seo_metrics (V-Level)
-- - __seo_gamme (SEO content)
-- - __seo_gamme_conseil (tips)
-- - __seo_gamme_purchase_guide (purchase guide)
--
-- Date: 2026-01-07
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_gamme_aggregates(p_pg_id INTEGER DEFAULT NULL)
RETURNS TABLE (
  out_pg_id INTEGER,
  out_products_total INTEGER,
  out_vehicles_total INTEGER,
  out_content_words_total INTEGER,
  out_status TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Approche optimisée: INSERT...SELECT au lieu de loop row-by-row
  INSERT INTO gamme_aggregates (
    ga_pg_id,
    products_total,
    vehicles_total,
    content_words_total,
    products_direct,
    products_via_vehicles,
    vlevel_counts,
    seo_content_raw_words,
    content_breakdown,
    pg_level,
    pg_top,
    computed_at,
    source_updated_at
  )
  SELECT
    pg.pg_id,
    COALESCE(prod.cnt_products, 0),
    COALESCE(veh.cnt_vehicles, 0),
    COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0),
    COALESCE(prod.cnt_products, 0),
    0, -- products_via_vehicles: calculé séparément si besoin
    COALESCE(vlevel.json_vlevel_counts, '{"V1":0,"V2":0,"V3":0,"V4":0,"V5":0}'::jsonb),
    COALESCE(seo.cnt_seo_words, 0),
    jsonb_build_object(
      'seo', COALESCE(seo.cnt_seo_words, 0),
      'conseil', COALESCE(conseil.cnt_conseil_words, 0),
      'switches', 0,
      'purchaseGuide', COALESCE(guide.cnt_guide_words, 0)
    ),
    pg.pg_level,
    pg.pg_top,
    NOW(),
    NOW()
  FROM (
    SELECT DISTINCT mc_pg_id::INTEGER as gamme_id FROM catalog_gamme
    WHERE p_pg_id IS NULL OR mc_pg_id::INTEGER = p_pg_id
  ) cg
  JOIN pieces_gamme pg ON pg.pg_id = cg.gamme_id

  -- Products direct (piece_pg_id = INTEGER)
  LEFT JOIN (
    SELECT piece_pg_id as gamme_id, COUNT(*)::INTEGER as cnt_products
    FROM pieces WHERE piece_pg_id IS NOT NULL
    GROUP BY piece_pg_id
  ) prod ON prod.gamme_id = pg.pg_id

  -- Vehicles total (cgc_pg_id = TEXT)
  LEFT JOIN (
    SELECT cgc_pg_id::INTEGER as gamme_id, COUNT(*)::INTEGER as cnt_vehicles
    FROM __cross_gamme_car WHERE cgc_level IN ('1', '2', '3')
    GROUP BY cgc_pg_id
  ) veh ON veh.gamme_id = pg.pg_id

  -- V-Level counts (pg_id = INTEGER dans gamme_seo_metrics)
  LEFT JOIN (
    SELECT gsm.pg_id as gamme_id,
      jsonb_build_object(
        'V1', COUNT(*) FILTER (WHERE gsm.v_level = 'V1'),
        'V2', COUNT(*) FILTER (WHERE gsm.v_level = 'V2'),
        'V3', COUNT(*) FILTER (WHERE gsm.v_level = 'V3'),
        'V4', COUNT(*) FILTER (WHERE gsm.v_level = 'V4'),
        'V5', COUNT(*) FILTER (WHERE gsm.v_level = 'V5')
      ) as json_vlevel_counts
    FROM gamme_seo_metrics gsm GROUP BY gsm.pg_id
  ) vlevel ON vlevel.gamme_id = pg.pg_id

  -- SEO words (sg_pg_id = TEXT)
  LEFT JOIN (
    SELECT sg_pg_id::INTEGER as gamme_id,
      COALESCE(array_length(regexp_split_to_array(COALESCE(sg_content, ''), '\s+'), 1), 0) as cnt_seo_words
    FROM __seo_gamme
  ) seo ON seo.gamme_id = pg.pg_id

  -- Conseil words (sgc_pg_id = TEXT)
  LEFT JOIN (
    SELECT sgc_pg_id::INTEGER as gamme_id,
      SUM(COALESCE(array_length(regexp_split_to_array(COALESCE(sgc_title, '') || ' ' || COALESCE(sgc_content, ''), '\s+'), 1), 0))::INTEGER as cnt_conseil_words
    FROM __seo_gamme_conseil GROUP BY sgc_pg_id
  ) conseil ON conseil.gamme_id = pg.pg_id

  -- Purchase guide words (sgpg_pg_id = TEXT)
  LEFT JOIN (
    SELECT sgpg_pg_id::INTEGER as gamme_id,
      COALESCE(array_length(regexp_split_to_array(
        COALESCE(sgpg_intro_role, '') || ' ' || COALESCE(sgpg_how_to_choose, ''), '\s+'
      ), 1), 0) as cnt_guide_words
    FROM __seo_gamme_purchase_guide
  ) guide ON guide.gamme_id = pg.pg_id

  ON CONFLICT (ga_pg_id) DO UPDATE SET
    products_total = EXCLUDED.products_total,
    vehicles_total = EXCLUDED.vehicles_total,
    content_words_total = EXCLUDED.content_words_total,
    products_direct = EXCLUDED.products_direct,
    vlevel_counts = EXCLUDED.vlevel_counts,
    seo_content_raw_words = EXCLUDED.seo_content_raw_words,
    content_breakdown = EXCLUDED.content_breakdown,
    pg_level = EXCLUDED.pg_level,
    pg_top = EXCLUDED.pg_top,
    computed_at = NOW();

  -- Return summary
  RETURN QUERY
  SELECT
    ga.ga_pg_id,
    ga.products_total,
    ga.vehicles_total,
    ga.content_words_total,
    'OK'::TEXT
  FROM gamme_aggregates ga
  WHERE p_pg_id IS NULL OR ga.ga_pg_id = p_pg_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_gamme_aggregates(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION refresh_gamme_aggregates(INTEGER) TO authenticated;

-- Comment
COMMENT ON FUNCTION refresh_gamme_aggregates IS 'Recalcule les KPIs agrégés pour les 221 gammes du catalog (Phase 1 Badges SEO v2)';
