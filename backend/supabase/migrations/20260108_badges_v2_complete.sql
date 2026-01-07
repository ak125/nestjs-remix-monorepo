-- ============================================================================
-- MIGRATION: Badges SEO v2 Complete (11 badges)
-- ============================================================================
-- Upgrade de Phase 1 vers v2 Complete:
-- - Ajout des colonnes pour les 11 badges
-- - Mise à jour de la RPC pour calculer tous les badges
--
-- Date: 2026-01-08
-- ============================================================================

-- 1. Ajouter les nouvelles colonnes pour les 11 badges
ALTER TABLE gamme_aggregates
  -- Phase 2 existants (priority_score, catalog_issues, smart_actions)
  ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS catalog_issues TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS smart_actions JSONB DEFAULT '[]'::jsonb,

  -- Badges Pilotage
  ADD COLUMN IF NOT EXISTS index_policy VARCHAR(20) DEFAULT 'NOINDEX',
  ADD COLUMN IF NOT EXISTS final_priority VARCHAR(15) DEFAULT 'P3',

  -- Badges Potentiel
  ADD COLUMN IF NOT EXISTS potential_level VARCHAR(10) DEFAULT 'LOW',
  ADD COLUMN IF NOT EXISTS demand_level VARCHAR(10) DEFAULT 'LOW',
  ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(10) DEFAULT 'MED',
  ADD COLUMN IF NOT EXISTS intent_type VARCHAR(10) DEFAULT 'COMPARE',

  -- Badges Réalité Intra-Gamme
  ADD COLUMN IF NOT EXISTS catalog_status VARCHAR(20) DEFAULT 'EMPTY',
  ADD COLUMN IF NOT EXISTS vehicle_coverage VARCHAR(20) DEFAULT 'EMPTY',
  ADD COLUMN IF NOT EXISTS content_depth VARCHAR(20) DEFAULT 'THIN',
  ADD COLUMN IF NOT EXISTS freshness_status VARCHAR(20) DEFAULT 'EXPIRED',
  ADD COLUMN IF NOT EXISTS cluster_health VARCHAR(20) DEFAULT 'ISOLATED',
  ADD COLUMN IF NOT EXISTS topic_purity VARCHAR(20) DEFAULT 'PURE',

  -- Exécutabilité
  ADD COLUMN IF NOT EXISTS execution_status VARCHAR(10) DEFAULT 'FAIL',

  -- Dates fraîcheur additionnelles
  ADD COLUMN IF NOT EXISTS last_content_update TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_product_update TIMESTAMPTZ;

-- 2. Index pour les nouveaux badges
CREATE INDEX IF NOT EXISTS idx_ga_priority_score ON gamme_aggregates(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_ga_index_policy ON gamme_aggregates(index_policy);
CREATE INDEX IF NOT EXISTS idx_ga_final_priority ON gamme_aggregates(final_priority);
CREATE INDEX IF NOT EXISTS idx_ga_execution_status ON gamme_aggregates(execution_status);
CREATE INDEX IF NOT EXISTS idx_ga_catalog_status ON gamme_aggregates(catalog_status);

-- 3. Commentaires
COMMENT ON COLUMN gamme_aggregates.priority_score IS 'Score de priorité SEO (0-100)';
COMMENT ON COLUMN gamme_aggregates.catalog_issues IS 'Liste des problèmes détectés (NO_PRODUCTS, NO_VEHICLES, etc.)';
COMMENT ON COLUMN gamme_aggregates.smart_actions IS 'Actions suggérées avec priorité [{action, priority}]';
COMMENT ON COLUMN gamme_aggregates.index_policy IS 'Politique indexation: INDEX, SOFT-INDEX, NOINDEX';
COMMENT ON COLUMN gamme_aggregates.final_priority IS 'Verdict final: P1, P1-PENDING, P2, P3';
COMMENT ON COLUMN gamme_aggregates.execution_status IS 'État exécution: PASS, WARN, FAIL';

-- ============================================================================
-- 4. Nouvelle RPC refresh_gamme_aggregates v2
-- ============================================================================
-- IMPORTANT: DROP d'abord car le type de retour a changé
DROP FUNCTION IF EXISTS refresh_gamme_aggregates(INTEGER);

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
AS $$
BEGIN
  -- INSERT...SELECT avec calcul de tous les badges v2
  INSERT INTO gamme_aggregates (
    ga_pg_id,
    -- KPIs de base
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
    -- Phase 2 badges
    priority_score,
    catalog_issues,
    smart_actions,
    -- 11 badges v2
    index_policy,
    potential_level,
    demand_level,
    difficulty_level,
    intent_type,
    catalog_status,
    vehicle_coverage,
    content_depth,
    freshness_status,
    cluster_health,
    topic_purity,
    execution_status,
    final_priority,
    -- Timestamps
    computed_at,
    source_updated_at
  )
  SELECT
    pg.pg_id,

    -- ===== KPIs de base =====
    COALESCE(prod.cnt_products, 0) as products_total,
    COALESCE(veh.cnt_vehicles, 0) as vehicles_total,
    (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) as content_words_total,
    COALESCE(prod.cnt_products, 0) as products_direct,
    0 as products_via_vehicles,
    COALESCE(vlevel.json_vlevel_counts, '{"V1":0,"V2":0,"V3":0,"V4":0,"V5":0}'::jsonb) as vlevel_counts,
    COALESCE(seo.cnt_seo_words, 0) as seo_content_raw_words,
    jsonb_build_object(
      'seo', COALESCE(seo.cnt_seo_words, 0),
      'conseil', COALESCE(conseil.cnt_conseil_words, 0),
      'switches', 0,
      'purchaseGuide', COALESCE(guide.cnt_guide_words, 0)
    ) as content_breakdown,
    pg.pg_level,
    pg.pg_top,

    -- ===== Priority Score (0-100) =====
    LEAST(100, (
      CASE WHEN pg.pg_top = '1' THEN 30 ELSE 0 END +
      CASE WHEN pg.pg_level = '1' THEN 20 ELSE 0 END +
      LEAST(COALESCE(prod.cnt_products, 0) / 50, 20) +
      LEAST(COALESCE(veh.cnt_vehicles, 0) / 10, 15) +
      LEAST((COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) / 100, 15)
    ))::INTEGER as priority_score,

    -- ===== Catalog Issues (JSONB Array) =====
    to_jsonb(ARRAY_REMOVE(ARRAY[
      CASE WHEN COALESCE(prod.cnt_products, 0) = 0 THEN 'NO_PRODUCTS' END,
      CASE WHEN COALESCE(veh.cnt_vehicles, 0) = 0 AND pg.pg_level = '1' THEN 'NO_VEHICLES' END,
      CASE WHEN (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) < 300 THEN 'CONTENT_THIN' END,
      CASE WHEN pg.pg_display = '1' AND COALESCE(prod.cnt_products, 0) = 0 THEN 'EMPTY_PAGE' END,
      CASE WHEN COALESCE(guide.cnt_guide_words, 0) = 0 AND pg.pg_top = '1' THEN 'NO_PURCHASE_GUIDE' END
    ], NULL)) as catalog_issues,

    -- ===== Smart Actions (JSONB Array) =====
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
    ) as smart_actions,

    -- ===== 1. Index Policy =====
    CASE
      WHEN pg.pg_level = '1' THEN 'INDEX'
      WHEN pg.pg_level = '2' AND pg.pg_sitemap = '1' THEN 'SOFT-INDEX'
      ELSE 'NOINDEX'
    END as index_policy,

    -- ===== 2. Potential Level =====
    CASE
      WHEN pg.pg_top = '1' THEN 'HIGH'
      WHEN pg.pg_level = '1' THEN 'MID'
      ELSE 'LOW'
    END as potential_level,

    -- ===== 3. Demand Level (basé sur V-Level search volume) =====
    CASE
      WHEN COALESCE(vlevel.total_search_volume, 0) >= 1000 THEN 'HIGH'
      WHEN COALESCE(vlevel.total_search_volume, 0) >= 100 THEN 'MID'
      ELSE 'LOW'
    END as demand_level,

    -- ===== 4. Difficulty (placeholder) =====
    'MED' as difficulty_level,

    -- ===== 5. Intent Type =====
    CASE
      WHEN pg.pg_top = '1' THEN 'BUY'
      WHEN (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) > 1000 THEN 'INFO'
      ELSE 'COMPARE'
    END as intent_type,

    -- ===== 6. Catalog Status =====
    CASE
      WHEN COALESCE(prod.cnt_products, 0) > 50 THEN 'OK'
      WHEN COALESCE(prod.cnt_products, 0) > 0 THEN 'LOW'
      ELSE 'EMPTY'
    END as catalog_status,

    -- ===== 7. Vehicle Coverage =====
    CASE
      WHEN COALESCE(veh.cnt_vehicles, 0) > 100 THEN 'COVERED'
      WHEN COALESCE(veh.cnt_vehicles, 0) > 0 THEN 'PARTIAL'
      ELSE 'EMPTY'
    END as vehicle_coverage,

    -- ===== 8. Content Depth =====
    CASE
      WHEN (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) >= 1000 THEN 'RICH'
      WHEN (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) >= 300 THEN 'OK'
      ELSE 'THIN'
    END as content_depth,

    -- ===== 9. Freshness Status (pas de timestamp source, défaut STALE) =====
    'STALE' as freshness_status,

    -- ===== 10. Cluster Health =====
    CASE
      WHEN COALESCE((vlevel.json_vlevel_counts->>'V1')::int, 0) > 0
           AND COALESCE((vlevel.json_vlevel_counts->>'V2')::int, 0) > 0 THEN 'STRONG'
      WHEN COALESCE((vlevel.json_vlevel_counts->>'V1')::int, 0) > 0
           OR COALESCE((vlevel.json_vlevel_counts->>'V2')::int, 0) > 0 THEN 'MISSING'
      ELSE 'ISOLATED'
    END as cluster_health,

    -- ===== 11. Topic Purity (placeholder) =====
    'PURE' as topic_purity,

    -- ===== Execution Status (agrégé) =====
    CASE
      WHEN COALESCE(prod.cnt_products, 0) > 0
           AND COALESCE(veh.cnt_vehicles, 0) > 0
           AND (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) >= 300 THEN 'PASS'
      WHEN COALESCE(prod.cnt_products, 0) > 0
           OR COALESCE(veh.cnt_vehicles, 0) > 0 THEN 'WARN'
      ELSE 'FAIL'
    END as execution_status,

    -- ===== Final Priority (verdict) =====
    CASE
      WHEN pg.pg_top = '1' AND (
           COALESCE(prod.cnt_products, 0) > 0
           AND COALESCE(veh.cnt_vehicles, 0) > 0
           AND (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) >= 300
      ) THEN 'P1'
      WHEN pg.pg_top = '1' THEN 'P1-PENDING'
      WHEN pg.pg_level = '1' AND (
           COALESCE(prod.cnt_products, 0) > 0
           AND COALESCE(veh.cnt_vehicles, 0) > 0
           AND (COALESCE(seo.cnt_seo_words, 0) + COALESCE(conseil.cnt_conseil_words, 0) + COALESCE(guide.cnt_guide_words, 0)) >= 300
      ) THEN 'P2'
      WHEN pg.pg_level = '1' AND (
           COALESCE(prod.cnt_products, 0) = 0
           AND COALESCE(veh.cnt_vehicles, 0) = 0
      ) THEN 'SOFT-INDEX'
      ELSE 'P3'
    END as final_priority,

    -- Timestamps
    NOW() as computed_at,
    NOW() as source_updated_at

  FROM (
    SELECT DISTINCT mc_pg_id::INTEGER as gamme_id FROM catalog_gamme
    WHERE p_pg_id IS NULL OR mc_pg_id::INTEGER = p_pg_id
  ) cg
  JOIN pieces_gamme pg ON pg.pg_id = cg.gamme_id

  -- Products direct
  LEFT JOIN (
    SELECT piece_pg_id as gamme_id, COUNT(*)::INTEGER as cnt_products
    FROM pieces WHERE piece_pg_id IS NOT NULL
    GROUP BY piece_pg_id
  ) prod ON prod.gamme_id = pg.pg_id

  -- Vehicles total
  LEFT JOIN (
    SELECT cgc_pg_id::INTEGER as gamme_id, COUNT(*)::INTEGER as cnt_vehicles
    FROM __cross_gamme_car WHERE cgc_level IN ('1', '2', '3')
    GROUP BY cgc_pg_id
  ) veh ON veh.gamme_id = pg.pg_id

  -- V-Level counts + search volume
  LEFT JOIN (
    SELECT gsm.pg_id as gamme_id,
      jsonb_build_object(
        'V1', COUNT(*) FILTER (WHERE gsm.v_level = 'V1'),
        'V2', COUNT(*) FILTER (WHERE gsm.v_level = 'V2'),
        'V3', COUNT(*) FILTER (WHERE gsm.v_level = 'V3'),
        'V4', COUNT(*) FILTER (WHERE gsm.v_level = 'V4'),
        'V5', COUNT(*) FILTER (WHERE gsm.v_level = 'V5')
      ) as json_vlevel_counts,
      SUM(COALESCE(gsm.search_volume, 0))::INTEGER as total_search_volume
    FROM gamme_seo_metrics gsm GROUP BY gsm.pg_id
  ) vlevel ON vlevel.gamme_id = pg.pg_id

  -- SEO words (pas de colonne last_update dans __seo_gamme)
  -- Note: pas de GROUP BY car une seule ligne par sg_pg_id
  LEFT JOIN (
    SELECT sg_pg_id::INTEGER as gamme_id,
      COALESCE(array_length(regexp_split_to_array(COALESCE(sg_content, ''), '\s+'), 1), 0) as cnt_seo_words
    FROM __seo_gamme
  ) seo ON seo.gamme_id = pg.pg_id

  -- Conseil words (pas de colonne timestamp dans __seo_gamme_conseil)
  LEFT JOIN (
    SELECT sgc_pg_id::INTEGER as gamme_id,
      SUM(COALESCE(array_length(regexp_split_to_array(COALESCE(sgc_title, '') || ' ' || COALESCE(sgc_content, ''), '\s+'), 1), 0))::INTEGER as cnt_conseil_words
    FROM __seo_gamme_conseil GROUP BY sgc_pg_id
  ) conseil ON conseil.gamme_id = pg.pg_id

  -- Purchase guide words
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
    -- Phase 2
    priority_score = EXCLUDED.priority_score,
    catalog_issues = EXCLUDED.catalog_issues,
    smart_actions = EXCLUDED.smart_actions,
    -- 11 badges v2
    index_policy = EXCLUDED.index_policy,
    potential_level = EXCLUDED.potential_level,
    demand_level = EXCLUDED.demand_level,
    difficulty_level = EXCLUDED.difficulty_level,
    intent_type = EXCLUDED.intent_type,
    catalog_status = EXCLUDED.catalog_status,
    vehicle_coverage = EXCLUDED.vehicle_coverage,
    content_depth = EXCLUDED.content_depth,
    freshness_status = EXCLUDED.freshness_status,
    cluster_health = EXCLUDED.cluster_health,
    topic_purity = EXCLUDED.topic_purity,
    execution_status = EXCLUDED.execution_status,
    final_priority = EXCLUDED.final_priority,
    computed_at = NOW(),
    source_updated_at = EXCLUDED.source_updated_at;

  -- Return summary (avec casts explicites VARCHAR → TEXT)
  RETURN QUERY
  SELECT
    ga.ga_pg_id,
    ga.products_total,
    ga.vehicles_total,
    ga.content_words_total,
    ga.priority_score,
    ga.final_priority::TEXT,      -- VARCHAR(15) → TEXT
    ga.execution_status::TEXT,    -- VARCHAR(10) → TEXT
    'OK'::TEXT
  FROM gamme_aggregates ga
  WHERE p_pg_id IS NULL OR ga.ga_pg_id = p_pg_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_gamme_aggregates(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION refresh_gamme_aggregates(INTEGER) TO authenticated;

COMMENT ON FUNCTION refresh_gamme_aggregates IS 'Recalcule les KPIs agrégés + 11 badges v2 pour les gammes du catalog';
