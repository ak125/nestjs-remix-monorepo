-- ============================================================================
-- MIGRATION: upgrade_rpc_freshness_v21
-- ============================================================================
-- Upgrade refresh_gamme_aggregates RPC de v2 vers v2.1
--
-- Changements:
--   1. freshness_status dynamique (FRESH/STALE/EXPIRED) au lieu de 'STALE' en dur
--   2. FIX: sg_updated_at au lieu de sg_update (colonne inexistante)
--   3. FIX: sgc_enriched_at au lieu de sgc_id::timestamptz (crash UUID)
--   4. FIX: SUM() aggregate pour seo word count (multiple rows per sg_pg_id)
--   5. FIX: ::TEXT casts dans RETURN QUERY (varchar vs text mismatch)
--   6. AJOUT: sgpg_updated_at dans le calcul freshness (3 sources)
--   7. SECURITE: GRANT service_role uniquement (pas authenticated)
--   8. catalog_issues wrappé dans to_jsonb() pour compatibilité colonne jsonb
--
-- Date: 2026-03-01
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_gamme_aggregates(p_pg_id INTEGER DEFAULT NULL)
RETURNS TABLE (
  out_pg_id INTEGER,
  out_products_total INTEGER,
  out_vehicles_total INTEGER,
  out_content_words_total INTEGER,
  out_priority_score INTEGER,
  out_final_priority TEXT,
  out_execution_status TEXT,
  out_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO gamme_aggregates (
    ga_pg_id,
    products_total, vehicles_total, content_words_total,
    products_direct, products_via_vehicles, vlevel_counts,
    seo_content_raw_words, content_breakdown, pg_level, pg_top,
    priority_score, catalog_issues, smart_actions,
    index_policy, potential_level, demand_level, difficulty_level, intent_type,
    catalog_status, vehicle_coverage, content_depth,
    freshness_status,
    cluster_health, topic_purity, execution_status, final_priority,
    last_content_update, last_product_update,
    computed_at, source_updated_at
  )
  SELECT
    pg.pg_id,

    COALESCE(prod.cnt_products, 0),
    COALESCE(veh.cnt_vehicles, 0),
    (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)),
    COALESCE(prod.cnt_products, 0),
    0,
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

    -- Priority Score (0-100)
    LEAST(100, (
      CASE WHEN pg.pg_top = '1' THEN 30 ELSE 0 END +
      CASE WHEN pg.pg_level = '1' THEN 20 ELSE 0 END +
      LEAST(COALESCE(prod.cnt_products, 0) / 50, 20) +
      LEAST(COALESCE(veh.cnt_vehicles, 0) / 10, 15) +
      LEAST((COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) / 100, 15)
    ))::INTEGER,

    -- Catalog Issues (jsonb)
    to_jsonb(ARRAY_REMOVE(ARRAY[
      CASE WHEN COALESCE(prod.cnt_products, 0) = 0 THEN 'NO_PRODUCTS' END,
      CASE WHEN COALESCE(veh.cnt_vehicles, 0) = 0 AND pg.pg_level = '1' THEN 'NO_VEHICLES' END,
      CASE WHEN (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) < 300 THEN 'CONTENT_THIN' END,
      CASE WHEN pg.pg_display = '1' AND COALESCE(prod.cnt_products, 0) = 0 THEN 'EMPTY_PAGE' END,
      CASE WHEN COALESCE(guide.cnt_guide_words, 0) = 0 AND pg.pg_top = '1' THEN 'NO_PURCHASE_GUIDE' END
    ], NULL)),

    -- Smart Actions
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('action', action, 'priority', priority)), '[]'::jsonb)
      FROM (
        SELECT 'CHECK_PRODUCTS' as action, 'CRITICAL' as priority WHERE COALESCE(prod.cnt_products, 0) = 0
        UNION ALL
        SELECT 'ADD_CONTENT', 'HIGH' WHERE (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) < 300
        UNION ALL
        SELECT 'ADD_VEHICLES', 'HIGH' WHERE COALESCE(veh.cnt_vehicles, 0) = 0 AND pg.pg_level = '1'
        UNION ALL
        SELECT 'CREATE_VLEVELS', 'MEDIUM' WHERE pg.pg_top = '1' AND COALESCE((vlevel.json_vlevel_counts->>'V1')::int, 0) = 0
        UNION ALL
        SELECT 'ADD_PURCHASE_GUIDE', 'LOW' WHERE COALESCE(guide.cnt_guide_words, 0) = 0 AND pg.pg_top = '1'
      ) actions
    ),

    -- Badges
    CASE WHEN pg.pg_level = '1' THEN 'INDEX' WHEN pg.pg_level = '2' AND pg.pg_sitemap = '1' THEN 'SOFT-INDEX' ELSE 'NOINDEX' END,
    CASE WHEN pg.pg_top = '1' THEN 'HIGH' WHEN pg.pg_level = '1' THEN 'MID' ELSE 'LOW' END,
    CASE WHEN COALESCE(vlevel.total_search_volume, 0) >= 1000 THEN 'HIGH' WHEN COALESCE(vlevel.total_search_volume, 0) >= 100 THEN 'MID' ELSE 'LOW' END,
    'MED',
    CASE WHEN pg.pg_top = '1' THEN 'BUY' WHEN (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) > 1000 THEN 'INFO' ELSE 'COMPARE' END,
    CASE WHEN COALESCE(prod.cnt_products, 0) > 50 THEN 'OK' WHEN COALESCE(prod.cnt_products, 0) > 0 THEN 'LOW' ELSE 'EMPTY' END,
    CASE WHEN COALESCE(veh.cnt_vehicles, 0) > 100 THEN 'COVERED' WHEN COALESCE(veh.cnt_vehicles, 0) > 0 THEN 'PARTIAL' ELSE 'EMPTY' END,
    CASE WHEN (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) >= 1000 THEN 'RICH' WHEN (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) >= 300 THEN 'OK' ELSE 'THIN' END,

    -- Freshness Status (DYNAMIQUE v2.1 — 3 sources)
    CASE
      WHEN GREATEST(
        COALESCE(seo.last_update, '2020-01-01'::timestamptz),
        COALESCE(conseil.last_update, '2020-01-01'::timestamptz),
        COALESCE(guide.last_update, '2020-01-01'::timestamptz)
      ) > NOW() - INTERVAL '90 days' THEN 'FRESH'
      WHEN GREATEST(
        COALESCE(seo.last_update, '2020-01-01'::timestamptz),
        COALESCE(conseil.last_update, '2020-01-01'::timestamptz),
        COALESCE(guide.last_update, '2020-01-01'::timestamptz)
      ) > NOW() - INTERVAL '180 days' THEN 'STALE'
      ELSE 'EXPIRED'
    END,

    CASE WHEN COALESCE((vlevel.json_vlevel_counts->>'V1')::int, 0) > 0 AND COALESCE((vlevel.json_vlevel_counts->>'V2')::int, 0) > 0 THEN 'STRONG' WHEN COALESCE((vlevel.json_vlevel_counts->>'V1')::int, 0) > 0 OR COALESCE((vlevel.json_vlevel_counts->>'V2')::int, 0) > 0 THEN 'MISSING' ELSE 'ISOLATED' END,
    'PURE',
    CASE WHEN COALESCE(prod.cnt_products, 0) > 0 AND COALESCE(veh.cnt_vehicles, 0) > 0 AND (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) >= 300 THEN 'PASS' WHEN COALESCE(prod.cnt_products, 0) > 0 OR COALESCE(veh.cnt_vehicles, 0) > 0 THEN 'WARN' ELSE 'FAIL' END,

    CASE
      WHEN pg.pg_top = '1' AND COALESCE(prod.cnt_products, 0) > 0 AND COALESCE(veh.cnt_vehicles, 0) > 0 AND (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) >= 300 THEN 'P1'
      WHEN pg.pg_top = '1' THEN 'P1-PENDING'
      WHEN pg.pg_level = '1' AND COALESCE(prod.cnt_products, 0) > 0 AND COALESCE(veh.cnt_vehicles, 0) > 0 AND (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) >= 300 THEN 'P2'
      WHEN pg.pg_level = '1' AND COALESCE(prod.cnt_products, 0) = 0 AND COALESCE(veh.cnt_vehicles, 0) = 0 THEN 'SOFT-INDEX'
      ELSE 'P3'
    END,

    -- Timestamps
    GREATEST(COALESCE(seo.last_update, '2020-01-01'::timestamptz), COALESCE(conseil.last_update, '2020-01-01'::timestamptz), COALESCE(guide.last_update, '2020-01-01'::timestamptz)),
    NULL,
    NOW(),
    GREATEST(COALESCE(seo.last_update, '2020-01-01'::timestamptz), COALESCE(conseil.last_update, '2020-01-01'::timestamptz), COALESCE(guide.last_update, '2020-01-01'::timestamptz))

  FROM (
    SELECT DISTINCT mc_pg_id::INTEGER as gamme_id FROM catalog_gamme
    WHERE p_pg_id IS NULL OR mc_pg_id::INTEGER = p_pg_id
  ) cg
  JOIN pieces_gamme pg ON pg.pg_id = cg.gamme_id
  LEFT JOIN (SELECT piece_pg_id as gamme_id, COUNT(*)::INTEGER as cnt_products FROM pieces WHERE piece_pg_id IS NOT NULL GROUP BY piece_pg_id) prod ON prod.gamme_id = pg.pg_id
  LEFT JOIN (SELECT cgc_pg_id::INTEGER as gamme_id, COUNT(*)::INTEGER as cnt_vehicles FROM __cross_gamme_car WHERE cgc_level IN ('1', '2', '3') GROUP BY cgc_pg_id) veh ON veh.gamme_id = pg.pg_id
  LEFT JOIN (SELECT gsm.pg_id as gamme_id, jsonb_build_object('V1', COUNT(*) FILTER (WHERE gsm.v_level = 'V1'), 'V2', COUNT(*) FILTER (WHERE gsm.v_level = 'V2'), 'V3', COUNT(*) FILTER (WHERE gsm.v_level = 'V3'), 'V4', COUNT(*) FILTER (WHERE gsm.v_level = 'V4'), 'V5', COUNT(*) FILTER (WHERE gsm.v_level = 'V5')) as json_vlevel_counts, SUM(COALESCE(gsm.search_volume, 0))::INTEGER as total_search_volume FROM gamme_seo_metrics gsm GROUP BY gsm.pg_id) vlevel ON vlevel.gamme_id = pg.pg_id
  -- FIX v2.1: SUM() + sg_updated_at (not sg_update)
  LEFT JOIN (SELECT sg_pg_id::INTEGER as gamme_id, SUM(COALESCE(array_length(regexp_split_to_array(COALESCE(sg_content, ''), '\s+'), 1), 0))::INTEGER as cnt_seo_words, MAX(sg_updated_at) as last_update FROM __seo_gamme GROUP BY sg_pg_id) seo ON seo.gamme_id = pg.pg_id
  -- FIX v2.1: sgc_enriched_at (not sgc_id::timestamptz)
  LEFT JOIN (SELECT sgc_pg_id::INTEGER as gamme_id, SUM(COALESCE(array_length(regexp_split_to_array(COALESCE(sgc_title, '') || ' ' || COALESCE(sgc_content, ''), '\s+'), 1), 0))::INTEGER as cnt_conseil_words, MAX(sgc_enriched_at) as last_update FROM __seo_gamme_conseil GROUP BY sgc_pg_id) conseil ON conseil.gamme_id = pg.pg_id
  -- NEW v2.1: sgpg_updated_at for freshness
  LEFT JOIN (SELECT sgpg_pg_id::INTEGER as gamme_id, SUM(COALESCE(array_length(regexp_split_to_array(COALESCE(sgpg_intro_role, '') || ' ' || COALESCE(sgpg_how_to_choose, ''), '\s+'), 1), 0))::INTEGER as cnt_guide_words, MAX(sgpg_updated_at::timestamptz) as last_update FROM __seo_gamme_purchase_guide GROUP BY sgpg_pg_id) guide ON guide.gamme_id = pg.pg_id

  ON CONFLICT (ga_pg_id) DO UPDATE SET
    products_total = EXCLUDED.products_total, vehicles_total = EXCLUDED.vehicles_total,
    content_words_total = EXCLUDED.content_words_total, products_direct = EXCLUDED.products_direct,
    vlevel_counts = EXCLUDED.vlevel_counts, seo_content_raw_words = EXCLUDED.seo_content_raw_words,
    content_breakdown = EXCLUDED.content_breakdown, pg_level = EXCLUDED.pg_level, pg_top = EXCLUDED.pg_top,
    priority_score = EXCLUDED.priority_score, catalog_issues = EXCLUDED.catalog_issues,
    smart_actions = EXCLUDED.smart_actions, index_policy = EXCLUDED.index_policy,
    potential_level = EXCLUDED.potential_level, demand_level = EXCLUDED.demand_level,
    difficulty_level = EXCLUDED.difficulty_level, intent_type = EXCLUDED.intent_type,
    catalog_status = EXCLUDED.catalog_status, vehicle_coverage = EXCLUDED.vehicle_coverage,
    content_depth = EXCLUDED.content_depth, freshness_status = EXCLUDED.freshness_status,
    cluster_health = EXCLUDED.cluster_health, topic_purity = EXCLUDED.topic_purity,
    execution_status = EXCLUDED.execution_status, final_priority = EXCLUDED.final_priority,
    last_content_update = EXCLUDED.last_content_update, last_product_update = EXCLUDED.last_product_update,
    computed_at = NOW(), source_updated_at = EXCLUDED.source_updated_at;

  -- FIX v2.1: explicit ::TEXT casts for varchar columns
  RETURN QUERY
  SELECT
    ga.ga_pg_id,
    ga.products_total,
    ga.vehicles_total,
    ga.content_words_total,
    ga.priority_score,
    ga.final_priority::TEXT,
    ga.execution_status::TEXT,
    'OK'::TEXT
  FROM gamme_aggregates ga
  WHERE p_pg_id IS NULL OR ga.ga_pg_id = p_pg_id;
END;
$$;

-- Grants: service_role + postgres UNIQUEMENT
GRANT EXECUTE ON FUNCTION refresh_gamme_aggregates(INTEGER) TO service_role;

COMMENT ON FUNCTION refresh_gamme_aggregates IS 'RPC v2.1 — Recalcule KPIs + 11 badges + freshness dynamique pour gamme_aggregates';
