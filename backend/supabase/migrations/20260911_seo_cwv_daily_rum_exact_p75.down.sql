-- Rollback : 20260911_seo_cwv_daily_rum_exact_p75 (documentation d'intervention
-- manuelle ; le runner ignore les .down.sql, politique forward-only).
--
-- Restaure les corps de aggregate_cwv_daily_rum et detect_cwv_trend_divergence
-- tels que relevés en live le 2026-09-11 (pg_get_functiondef ; corps verbatim,
-- types de la signature écrits comme dans les migrations 20260527 / 20260911),
-- puis retire les colonnes du bloc exact.
--
-- ATTENTION : DROP COLUMN perd les p75_exact déjà calculés, et ils ne sont pas
-- recalculables pour les journées dont le brut a été purgé (rotation à J+3).
-- Pour neutraliser seulement le détecteur, restaurer la fonction 3 et garder
-- les colonnes.
--
-- Les droits EXECUTE posés par la migration (service_role) sont conservés :
-- CREATE OR REPLACE conserve l'ACL.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.aggregate_cwv_daily_rum(p_target_date DATE)
 RETURNS TABLE(rows_upserted INT)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted INT := 0;
BEGIN
  WITH agg AS (
    SELECT
      p_target_date AS date,
      surface,
      route_group,
      priority_tier,
      device,
      metric,
      ua_class,
      sum(sample_count)::BIGINT AS sample_count,
      (sum(p50_value * sample_count) / NULLIF(sum(sample_count), 0))::REAL AS p50_value,
      (sum(p75_value * sample_count) / NULLIF(sum(sample_count), 0))::REAL AS p75_value,
      (sum(p95_value * sample_count) / NULLIF(sum(sample_count), 0))::REAL AS p95_value
    FROM __seo_cwv_hourly
    WHERE hour >= p_target_date::TIMESTAMPTZ
      AND hour <  (p_target_date + 1)::TIMESTAMPTZ
      AND ua_class = 'human'
    GROUP BY 1, 2, 3, 4, 5, 6, 7
    HAVING sum(sample_count) > 0
  )
  INSERT INTO __seo_cwv_daily_rum (date, surface, route_group, priority_tier, device, metric, ua_class, sample_count, p50_value, p75_value, p95_value, fetched_at)
  SELECT date, surface, route_group, priority_tier, device, metric, ua_class, sample_count, p50_value, p75_value, p95_value, now()
  FROM agg
  ON CONFLICT (date, surface, route_group, device, metric, ua_class) DO UPDATE
  SET sample_count = EXCLUDED.sample_count,
      p50_value    = EXCLUDED.p50_value,
      p75_value    = EXCLUDED.p75_value,
      p95_value    = EXCLUDED.p95_value,
      fetched_at   = now();

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  rows_upserted := v_inserted;
  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.aggregate_cwv_daily_rum(DATE) IS
  'Bloc 4 VOLATILE — agrège 24h de __seo_cwv_hourly vers __seo_cwv_daily_rum (weighted-avg V1 approx). Idempotent (UPSERT).';

CREATE OR REPLACE FUNCTION public.detect_cwv_trend_divergence()
 RETURNS TABLE(alerts_inserted INT)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INT := 0;
BEGIN
  WITH recent AS (
    SELECT
      route_group, device, metric,
      sum(p75_value * sample_count) / NULLIF(sum(sample_count), 0) AS p75_recent,
      sum(sample_count) AS samples_recent
    FROM __seo_cwv_daily_rum
    WHERE date >= CURRENT_DATE - INTERVAL '7 days'
      AND date <  CURRENT_DATE
      AND ua_class = 'human'
      AND priority_tier = 'CWV_P0'
      AND metric IN ('LCP', 'INP')
    GROUP BY route_group, device, metric
    HAVING sum(sample_count) >= 100
  ),
  reference AS (
    SELECT
      route_group, device, metric,
      sum(p75_value * sample_count) / NULLIF(sum(sample_count), 0) AS p75_ref
    FROM __seo_cwv_daily_rum
    WHERE date >= CURRENT_DATE - INTERVAL '35 days'
      AND date <  CURRENT_DATE - INTERVAL '8 days'
      AND ua_class = 'human'
      AND priority_tier = 'CWV_P0'
      AND metric IN ('LCP', 'INP')
    GROUP BY route_group, device, metric
    HAVING sum(sample_count) >= 300
  ),
  recent_3d AS (
    SELECT
      route_group, device, metric,
      sum(p75_value * sample_count) / NULLIF(sum(sample_count), 0) AS p75_3d
    FROM __seo_cwv_daily_rum
    WHERE date >= CURRENT_DATE - INTERVAL '3 days'
      AND date <  CURRENT_DATE
      AND ua_class = 'human'
      AND priority_tier = 'CWV_P0'
      AND metric IN ('LCP', 'INP')
    GROUP BY route_group, device, metric
  ),
  divergent AS (
    SELECT
      r.route_group, r.device, r.metric,
      r.p75_recent, ref.p75_ref, r3.p75_3d,
      r.samples_recent
    FROM recent r
    JOIN reference ref USING (route_group, device, metric)
    JOIN recent_3d r3 USING (route_group, device, metric)
    WHERE r.p75_recent > ref.p75_ref * 1.30
      AND r3.p75_3d   > ref.p75_ref * 1.30
  ),
  not_already_open AS (
    SELECT d.* FROM divergent d
    WHERE NOT EXISTS (
      SELECT 1 FROM __seo_event_log e
      WHERE e.event_type = 'cwv.alert.internal_regression'
        AND e.resolved_at IS NULL
        AND e.created_at >= now() - INTERVAL '14 days'
        AND e.payload->>'route_group' = d.route_group
        AND e.payload->>'device' = d.device
        AND e.payload->>'metric' = d.metric
    )
  )
  INSERT INTO __seo_event_log (event_type, entity_url, severity, payload)
  SELECT
    'cwv.alert.internal_regression'::seo_event_type,
    NULL,
    'high'::seo_severity,
    jsonb_build_object(
      'route_group', route_group,
      'device', device,
      'metric', metric,
      'p75_recent_ms', round(p75_recent::numeric, 0),
      'p75_reference_ms', round(p75_ref::numeric, 0),
      'p75_3d_ms', round(p75_3d::numeric, 0),
      'degradation_pct', round(((p75_recent - p75_ref) / NULLIF(p75_ref, 0) * 100)::numeric, 1),
      'samples_recent', samples_recent
    )
  FROM not_already_open;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  alerts_inserted := v_count;
  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.detect_cwv_trend_divergence() IS
  'Bloc 6 VOLATILE — détecte régressions CWV_P0 LCP/INP > 30% sur 7j vs référence 28j (J-35..J-8) ET confirmé sur 3 derniers jours. Dedup 14j sur même (route_group, device, metric). INSERT __seo_event_log cwv.alert.internal_regression severity=high.';

COMMENT ON TABLE public.__seo_cwv_daily_rum IS
  'Bloc 4 — agrégat journalier CWV (RUM). Source : __seo_cwv_hourly via aggregate_cwv_daily_rum() RPC (weighted-avg approximation). Partitions monthly, TTL 12mo. Distinct de __seo_cwv_daily (lab PageSpeed, table existante).';

ALTER TABLE public.__seo_cwv_daily_rum
  DROP COLUMN IF EXISTS raw_sample_count,
  DROP COLUMN IF EXISTS p75_exact,
  DROP COLUMN IF EXISTS n_exact,
  DROP COLUMN IF EXISTS n_good,
  DROP COLUMN IF EXISTS n_needs_improvement,
  DROP COLUMN IF EXISTS n_poor,
  DROP COLUMN IF EXISTS estimator_version;
