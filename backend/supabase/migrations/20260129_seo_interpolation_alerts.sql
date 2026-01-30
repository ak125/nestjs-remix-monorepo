-- ============================================================
-- Migration: Table d'alertes pour interpolation SEO
-- Date: 2026-01-29
-- Objectif: Stocker les alertes de variables non-interpolées
--           pour monitoring et dashboard admin
-- ============================================================

-- 1. Table principale d'alertes
CREATE TABLE IF NOT EXISTS __seo_interpolation_alerts (
  id SERIAL PRIMARY KEY,
  pg_id INTEGER NOT NULL,
  type_id INTEGER NOT NULL,
  field TEXT NOT NULL,
  uninterpolated_vars TEXT[] NOT NULL DEFAULT '{}',
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  raw_value TEXT,
  source TEXT, -- 'rm-builder', 'unified-page-data', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_seo_alerts_created
  ON __seo_interpolation_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_alerts_pg_id
  ON __seo_interpolation_alerts(pg_id);

CREATE INDEX IF NOT EXISTS idx_seo_alerts_type_id
  ON __seo_interpolation_alerts(type_id);

CREATE INDEX IF NOT EXISTS idx_seo_alerts_pg_created
  ON __seo_interpolation_alerts(pg_id, created_at DESC);

-- 3. Vue pour dashboard admin - alertes des dernières 24h
CREATE OR REPLACE VIEW v_seo_interpolation_alerts_24h AS
SELECT
  pg_id,
  COUNT(*) as alert_count,
  SUM(occurrence_count) as total_occurrences,
  array_agg(DISTINCT field) as affected_fields,
  -- Aggréger les variables non-interpolées uniques
  (
    SELECT array_agg(DISTINCT v)
    FROM __seo_interpolation_alerts a2
    CROSS JOIN LATERAL unnest(a2.uninterpolated_vars) AS v
    WHERE a2.pg_id = a.pg_id
      AND a2.created_at > NOW() - INTERVAL '24 hours'
  ) as vars_affected,
  MAX(created_at) as last_alert
FROM __seo_interpolation_alerts a
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY pg_id
ORDER BY alert_count DESC;

-- 4. Vue pour dashboard admin - alertes par gamme (7 jours)
CREATE OR REPLACE VIEW v_seo_interpolation_alerts_weekly AS
SELECT
  a.pg_id,
  pg.pg_name as gamme_name,
  COUNT(*) as alert_count,
  SUM(a.occurrence_count) as total_occurrences,
  array_agg(DISTINCT a.field) as affected_fields,
  MAX(a.created_at) as last_alert
FROM __seo_interpolation_alerts a
LEFT JOIN pieces_gamme pg ON pg.pg_id = a.pg_id
WHERE a.created_at > NOW() - INTERVAL '7 days'
GROUP BY a.pg_id, pg.pg_name
ORDER BY alert_count DESC
LIMIT 50;

-- 5. Fonction pour purger les alertes anciennes (>30 jours)
CREATE OR REPLACE FUNCTION purge_seo_interpolation_alerts(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM __seo_interpolation_alerts
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Purged % SEO interpolation alerts older than % days', deleted_count, days_to_keep;

  RETURN deleted_count;
END;
$$;

-- 6. Fonction pour obtenir les stats d'interpolation par gamme
CREATE OR REPLACE FUNCTION get_seo_interpolation_stats(p_days INTEGER DEFAULT 7)
RETURNS TABLE(
  pg_id INTEGER,
  gamme_name TEXT,
  alert_count BIGINT,
  unique_vars_count BIGINT,
  most_common_vars TEXT[],
  last_alert TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.pg_id::INTEGER,
    COALESCE(pg.pg_name, 'Gamme #' || a.pg_id::TEXT)::TEXT as gamme_name,
    COUNT(*)::BIGINT as alert_count,
    (
      SELECT COUNT(DISTINCT v)::BIGINT
      FROM __seo_interpolation_alerts a2
      CROSS JOIN LATERAL unnest(a2.uninterpolated_vars) AS v
      WHERE a2.pg_id = a.pg_id
        AND a2.created_at > NOW() - (p_days || ' days')::INTERVAL
    ) as unique_vars_count,
    (
      SELECT array_agg(v ORDER BY cnt DESC)
      FROM (
        SELECT v, COUNT(*) as cnt
        FROM __seo_interpolation_alerts a2
        CROSS JOIN LATERAL unnest(a2.uninterpolated_vars) AS v
        WHERE a2.pg_id = a.pg_id
          AND a2.created_at > NOW() - (p_days || ' days')::INTERVAL
        GROUP BY v
        ORDER BY cnt DESC
        LIMIT 5
      ) top_vars
    )::TEXT[] as most_common_vars,
    MAX(a.created_at)::TIMESTAMPTZ as last_alert
  FROM __seo_interpolation_alerts a
  LEFT JOIN pieces_gamme pg ON pg.pg_id = a.pg_id
  WHERE a.created_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY a.pg_id, pg.pg_name
  ORDER BY COUNT(*) DESC
  LIMIT 100;
END;
$$;

-- 7. Commentaires pour documentation
COMMENT ON TABLE __seo_interpolation_alerts IS
  'Alertes de variables SEO non-interpolées pour monitoring et dashboard admin';

COMMENT ON COLUMN __seo_interpolation_alerts.uninterpolated_vars IS
  'Liste des variables non-interpolées (ex: #VMarque#, %gamme_name%)';

COMMENT ON COLUMN __seo_interpolation_alerts.occurrence_count IS
  'Nombre de fois où cette alerte a été vue (agrégé par batch)';

COMMENT ON COLUMN __seo_interpolation_alerts.source IS
  'Service qui a généré l''alerte (rm-builder, unified-page-data, etc.)';

COMMENT ON VIEW v_seo_interpolation_alerts_24h IS
  'Vue agrégée des alertes SEO des dernières 24h pour dashboard admin';

COMMENT ON FUNCTION purge_seo_interpolation_alerts IS
  'Purge les alertes SEO plus anciennes que N jours (défaut: 30)';

COMMENT ON FUNCTION get_seo_interpolation_stats IS
  'Statistiques d''interpolation SEO par gamme sur N jours';

-- ============================================================
-- Vérification
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260129_seo_interpolation_alerts complétée';
  RAISE NOTICE 'Tables créées: __seo_interpolation_alerts';
  RAISE NOTICE 'Vues créées: v_seo_interpolation_alerts_24h, v_seo_interpolation_alerts_weekly';
  RAISE NOTICE 'Fonctions créées: purge_seo_interpolation_alerts, get_seo_interpolation_stats';
END;
$$;
