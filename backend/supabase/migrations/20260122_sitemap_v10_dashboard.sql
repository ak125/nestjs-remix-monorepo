-- =====================================================
-- SITEMAP V10 DASHBOARD - VUES & TABLES ADDITIONNELLES
-- Date: 2026-01-22
-- =====================================================
--
-- Complète la migration V10 Enterprise avec:
-- - v_seo_dashboard_kpis (KPIs agrégés pour Metabase)
-- - __seo_index_history (tracking historique indexation)
-- - RPC functions pour alertes
-- =====================================================

-- 1) VUE KPIs DASHBOARD
-- Fournit tous les KPIs en une seule requête pour performance
CREATE OR REPLACE VIEW v_seo_dashboard_kpis AS
SELECT
  -- Counts par bucket température
  COUNT(*) FILTER (WHERE s.bucket = 'hot') AS hot_count,
  COUNT(*) FILTER (WHERE s.bucket = 'new') AS new_count,
  COUNT(*) FILTER (WHERE s.bucket = 'stable') AS stable_count,
  COUNT(*) FILTER (WHERE s.bucket = 'cold') AS cold_count,
  COUNT(*) FILTER (WHERE s.bucket = 'exclude') AS exclude_count,
  COUNT(*) AS total_scored,

  -- Index status (via v_seo_url_health)
  COUNT(*) FILTER (WHERE h.index_status = 'indexed') AS indexed_count,
  COUNT(*) FILTER (WHERE h.index_status IS NOT NULL AND h.index_status != 'indexed') AS not_indexed_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE h.index_status = 'indexed') /
    NULLIF(COUNT(*) FILTER (WHERE h.index_status IS NOT NULL), 0),
    1
  ) AS pct_indexed,

  -- Risques élevés
  COUNT(*) FILTER (WHERE s.orphan_risk > 50) AS high_orphan_risk_count,
  COUNT(*) FILTER (WHERE s.confusion_risk > 30) AS high_confusion_risk_count,
  COUNT(*) FILTER (WHERE s.duplication_risk > 50) AS high_duplication_risk_count,

  -- HOT pages non indexées (alerte critique)
  COUNT(*) FILTER (WHERE s.bucket = 'hot' AND (h.index_status IS NULL OR h.index_status != 'indexed')) AS hot_not_indexed_count,

  -- Moyennes scores
  ROUND(AVG(s.score_total), 1) AS avg_score,
  ROUND(AVG(s.inbound_links), 1) AS avg_inbound_links,
  ROUND(AVG(s.orphan_risk), 1) AS avg_orphan_risk,

  -- Timestamp pour cache invalidation
  NOW() AS computed_at
FROM __seo_entity_score_v10 s
LEFT JOIN v_seo_url_health h ON h.url = s.url;

COMMENT ON VIEW v_seo_dashboard_kpis IS 'KPIs agrégés pour dashboard Metabase/Looker - SEO V10';

-- 2) TABLE HISTORIQUE INDEXATION
-- Permet de tracker les pertes/gains d'indexation dans le temps
CREATE TABLE IF NOT EXISTS __seo_index_history (
  id BIGSERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  index_status TEXT NOT NULL,  -- 'indexed', 'not_indexed', 'unknown'

  -- Timestamps événements
  first_indexed_at TIMESTAMPTZ,
  last_indexed_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,  -- Quand passé de indexed → not_indexed

  -- Snapshot quotidien
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Metadata
  source TEXT DEFAULT 'gsc',  -- 'gsc' (Google Search Console), 'manual', 'api'

  UNIQUE(url, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_seo_index_history_date ON __seo_index_history(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_seo_index_history_status ON __seo_index_history(index_status, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_seo_index_history_lost ON __seo_index_history(lost_at) WHERE lost_at IS NOT NULL;

COMMENT ON TABLE __seo_index_history IS 'Historique snapshots quotidiens du statut d''indexation pour tracking pertes';

-- 3) VUE PERTES D'INDEXATION (7 derniers jours)
CREATE OR REPLACE VIEW v_seo_index_losses_7d AS
SELECT
  h.url,
  h.lost_at,
  h.snapshot_date,
  s.score_total,
  s.bucket,
  p.page_type
FROM __seo_index_history h
LEFT JOIN __seo_entity_score_v10 s ON s.url = h.url
LEFT JOIN __seo_page p ON p.url = h.url
WHERE h.lost_at IS NOT NULL
  AND h.lost_at > NOW() - INTERVAL '7 days'
ORDER BY s.score_total DESC NULLS LAST;

COMMENT ON VIEW v_seo_index_losses_7d IS 'Pages ayant perdu leur indexation dans les 7 derniers jours';

-- 4) VUE CRAWL GOOGLEBOT STATS (7 jours)
CREATE OR REPLACE VIEW v_seo_crawl_stats_7d AS
SELECT
  DATE(crawled_at) AS crawl_date,
  COUNT(*) AS total_crawls,
  COUNT(DISTINCT url) AS unique_urls,
  ROUND(AVG(response_ms)) AS avg_response_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_ms) AS median_response_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_ms) AS p95_response_ms,
  COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) AS count_2xx,
  COUNT(*) FILTER (WHERE status_code >= 300 AND status_code < 400) AS count_3xx,
  COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500) AS count_4xx,
  COUNT(*) FILTER (WHERE status_code >= 500) AS count_5xx,
  SUM(bytes_sent) AS total_bytes
FROM __seo_crawl_log
WHERE is_googlebot = TRUE
  AND crawled_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(crawled_at)
ORDER BY crawl_date DESC;

COMMENT ON VIEW v_seo_crawl_stats_7d IS 'Statistiques crawl Googlebot agrégées par jour (7 jours)';

-- 5) FONCTION RPC: Alertes SEO critiques
CREATE OR REPLACE FUNCTION get_seo_critical_alerts()
RETURNS TABLE (
  alert_type TEXT,
  severity TEXT,  -- 'critical', 'warning', 'info'
  count BIGINT,
  description TEXT,
  action_url TEXT
) AS $$
BEGIN
  -- Alerte 1: Pages HOT non indexées
  RETURN QUERY
  SELECT
    'hot_not_indexed'::TEXT,
    'critical'::TEXT,
    COUNT(*)::BIGINT,
    'Pages prioritaires (HOT) non indexées par Google'::TEXT,
    '/admin/seo/hot-not-indexed'::TEXT
  FROM __seo_entity_score_v10 s
  LEFT JOIN v_seo_url_health h ON h.url = s.url
  WHERE s.bucket = 'hot'
    AND (h.index_status IS NULL OR h.index_status != 'indexed');

  -- Alerte 2: Violations bloquantes récentes
  RETURN QUERY
  SELECT
    'blocking_violations'::TEXT,
    'critical'::TEXT,
    COUNT(DISTINCT sql_record_id)::BIGINT,
    'Pages avec violations SEO bloquantes (7 derniers jours)'::TEXT,
    '/admin/seo/violations'::TEXT
  FROM __seo_quality_log
  WHERE sql_severity = 'block'
    AND sql_created_at > NOW() - INTERVAL '7 days';

  -- Alerte 3: Pages orphelines à haut score
  RETURN QUERY
  SELECT
    'high_score_orphans'::TEXT,
    'warning'::TEXT,
    COUNT(*)::BIGINT,
    'Pages à fort potentiel (score > 80) sans liens internes'::TEXT,
    '/admin/seo/orphans'::TEXT
  FROM __seo_entity_score_v10
  WHERE score_total > 80
    AND orphan_risk > 70;

  -- Alerte 4: Erreurs crawl Googlebot
  RETURN QUERY
  SELECT
    'googlebot_errors'::TEXT,
    'warning'::TEXT,
    COUNT(DISTINCT url)::BIGINT,
    'URLs avec erreurs 4xx/5xx lors du crawl Googlebot (24h)'::TEXT,
    '/admin/seo/crawl-errors'::TEXT
  FROM __seo_crawl_log
  WHERE is_googlebot = TRUE
    AND status_code >= 400
    AND crawled_at > NOW() - INTERVAL '24 hours';

  -- Alerte 5: Pertes d'indexation récentes
  RETURN QUERY
  SELECT
    'index_losses'::TEXT,
    'warning'::TEXT,
    COUNT(*)::BIGINT,
    'Pages ayant perdu leur indexation récemment'::TEXT,
    '/admin/seo/index-losses'::TEXT
  FROM __seo_index_history
  WHERE lost_at IS NOT NULL
    AND lost_at > NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_seo_critical_alerts IS 'Retourne les alertes SEO critiques pour dashboard';

-- 6) FONCTION RPC: Snapshot quotidien indexation
-- À appeler par un job BullMQ quotidien
CREATE OR REPLACE FUNCTION snapshot_index_status()
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  -- Insert/Update snapshot pour aujourd'hui
  INSERT INTO __seo_index_history (url, index_status, snapshot_date, first_indexed_at, last_indexed_at, lost_at)
  SELECT
    h.url,
    h.index_status,
    CURRENT_DATE,
    -- first_indexed_at: garder l'ancien si existe, sinon NOW si indexed
    COALESCE(
      (SELECT first_indexed_at FROM __seo_index_history WHERE url = h.url ORDER BY snapshot_date DESC LIMIT 1),
      CASE WHEN h.index_status = 'indexed' THEN NOW() ELSE NULL END
    ),
    -- last_indexed_at: NOW si indexed
    CASE WHEN h.index_status = 'indexed' THEN NOW() ELSE
      (SELECT last_indexed_at FROM __seo_index_history WHERE url = h.url ORDER BY snapshot_date DESC LIMIT 1)
    END,
    -- lost_at: détecter perte (était indexed, maintenant non)
    CASE
      WHEN h.index_status != 'indexed' AND EXISTS (
        SELECT 1 FROM __seo_index_history ih
        WHERE ih.url = h.url
          AND ih.index_status = 'indexed'
          AND ih.snapshot_date < CURRENT_DATE
        ORDER BY ih.snapshot_date DESC LIMIT 1
      ) THEN NOW()
      ELSE NULL
    END
  FROM v_seo_url_health h
  WHERE h.is_indexable_hint = TRUE
  ON CONFLICT (url, snapshot_date) DO UPDATE SET
    index_status = EXCLUDED.index_status,
    last_indexed_at = EXCLUDED.last_indexed_at,
    lost_at = COALESCE(__seo_index_history.lost_at, EXCLUDED.lost_at);

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION snapshot_index_status IS 'Crée un snapshot quotidien du statut d''indexation pour tracking';

-- 7) VUE: File d'attente opérationnelle
CREATE OR REPLACE VIEW v_seo_operational_queue AS
SELECT
  'FIX_BLOCKER' AS action_type,
  1 AS priority,
  q.sql_record_id AS url,
  q.sql_rule_id AS rule,
  s.score_total,
  s.bucket,
  q.sql_created_at AS detected_at
FROM __seo_quality_log q
JOIN __seo_entity_score_v10 s ON s.url = q.sql_record_id
WHERE q.sql_severity = 'block'
  AND q.sql_created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT
  'ADD_INTERNAL_LINKS' AS action_type,
  2 AS priority,
  s.url,
  'orphan_risk_high' AS rule,
  s.score_total,
  s.bucket,
  s.updated_at AS detected_at
FROM __seo_entity_score_v10 s
WHERE s.bucket IN ('hot', 'new')
  AND s.orphan_risk > 50

UNION ALL

SELECT
  'CHECK_INDEX' AS action_type,
  3 AS priority,
  h.url,
  'hot_not_indexed' AS rule,
  h.score_total,
  h.bucket,
  h.last_googlebot_crawl_at AS detected_at
FROM v_seo_url_health h
WHERE h.bucket = 'hot'
  AND (h.index_status IS NULL OR h.index_status != 'indexed')
  AND h.last_googlebot_crawl_at > NOW() - INTERVAL '30 days'

ORDER BY priority, score_total DESC NULLS LAST;

COMMENT ON VIEW v_seo_operational_queue IS 'File d''attente des actions SEO prioritaires';

-- =====================================================
-- GRANTS (ajuster selon besoins)
-- =====================================================

-- Pour dashboard Metabase (lecture seule)
-- GRANT SELECT ON v_seo_dashboard_kpis TO metabase_readonly;
-- GRANT SELECT ON v_seo_index_losses_7d TO metabase_readonly;
-- GRANT SELECT ON v_seo_crawl_stats_7d TO metabase_readonly;
-- GRANT SELECT ON v_seo_operational_queue TO metabase_readonly;
-- GRANT EXECUTE ON FUNCTION get_seo_critical_alerts TO metabase_readonly;
