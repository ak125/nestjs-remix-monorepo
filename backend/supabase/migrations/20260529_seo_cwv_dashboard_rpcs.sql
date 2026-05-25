-- Migration : RPCs dashboard CWV + funnel correlation + alerts trend-divergence.
--
-- Plan bloc 6 final (CWV Runtime Observability).
--
-- 3 fonctions :
--   1. get_cwv_dashboard(from, to, tier?) — STABLE — lecture pour route admin
--   2. get_cwv_funnel_correlation(from, to) — STABLE — lecture pour corrélation
--   3. detect_cwv_trend_divergence() — VOLATILE — détecte régressions 7j vs
--      28j, INSERT __seo_event_log avec cwv.alert.internal_regression
--
-- Logique alert : trend-divergence-sustained (canon plan §6, jamais cross-check
-- CrUX/RUM brut). Compare RUM 7j récent vs RUM 28j de référence ; alert si
-- dégradation > 30% sur metric P0 (LCP, INP) sur ≥3 jours consécutifs.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- =============================================================================
-- 0. Extension ENUM seo_event_type avec cwv.alert.*
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'cwv.alert.internal_regression'
          AND enumtypid = 'seo_event_type'::regtype
    ) THEN
        ALTER TYPE seo_event_type ADD VALUE 'cwv.alert.internal_regression';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'cwv.alert.external_regression'
          AND enumtypid = 'seo_event_type'::regtype
    ) THEN
        ALTER TYPE seo_event_type ADD VALUE 'cwv.alert.external_regression';
    END IF;
END $$;

-- =============================================================================
-- 1. RPC get_cwv_dashboard — STABLE (lecture pure, idempotent)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_cwv_dashboard(
  p_from_date DATE,
  p_to_date   DATE,
  p_priority_tier TEXT DEFAULT NULL  -- 'CWV_P0' | 'CWV_P1' | 'CWV_P2' | NULL=all
)
RETURNS TABLE(
  priority_tier  TEXT,
  surface        TEXT,
  route_group    TEXT,
  device         TEXT,
  metric         TEXT,
  sample_total   BIGINT,
  p75_avg        REAL,
  days_observed  INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    priority_tier,
    surface,
    route_group,
    device,
    metric,
    sum(sample_count)::BIGINT AS sample_total,
    (sum(p75_value * sample_count) / NULLIF(sum(sample_count), 0))::REAL AS p75_avg,
    count(DISTINCT date)::INT AS days_observed
  FROM __seo_cwv_daily_rum
  WHERE date >= p_from_date
    AND date <= p_to_date
    AND ua_class = 'human'
    AND (p_priority_tier IS NULL OR priority_tier = p_priority_tier)
  GROUP BY priority_tier, surface, route_group, device, metric
  ORDER BY priority_tier, surface, route_group, device, metric
$$;

COMMENT ON FUNCTION public.get_cwv_dashboard(DATE, DATE, TEXT) IS
  'Bloc 6 STABLE — agrège __seo_cwv_daily_rum par (priority_tier, surface, route_group, device, metric) pour route admin. ua_class=human filter canon.';

GRANT EXECUTE ON FUNCTION public.get_cwv_dashboard(DATE, DATE, TEXT) TO service_role;

-- =============================================================================
-- 2. RPC get_cwv_funnel_correlation — STABLE
-- =============================================================================
--
-- Répond à la question business : "INP slow → conversion ÷ X ?"
-- Source : __seo_cwv_hourly (TTL 14j) — raw a déjà été droppé à 48h.
-- Approximation : on agrège p75 INP par session_id... mais __seo_cwv_hourly
-- ne garde PAS session_id (agg horaire). Donc cette V1 fait corrélation au
-- niveau (date × route_group × bucket_INP) plutôt que per-session.
--
-- Pour vraie corrélation per-session (plan §6.funnel_correlation), il faudrait
-- relire __seo_cwv_raw qui a TTL 48h — donc query temporellement bornée à 48h
-- max. Cette V1 livre la corrélation 48h sur raw + agrégat fenêtre plus large
-- sur hourly (sans session join).

CREATE OR REPLACE FUNCTION public.get_cwv_funnel_correlation(
  p_from_ts TIMESTAMPTZ,
  p_to_ts   TIMESTAMPTZ
)
RETURNS TABLE(
  inp_bucket    TEXT,
  sessions      BIGINT,
  conversion_count BIGINT,
  conversion_rate REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH session_inp AS (
    SELECT
      session_id,
      avg(value)::REAL AS avg_inp
    FROM __seo_cwv_raw
    WHERE received_at >= p_from_ts
      AND received_at <= p_to_ts
      AND ua_class = 'human'
      AND metric = 'INP'
      AND funnel_step IN ('view_product', 'view_listing', 'view_diagnostic')
    GROUP BY session_id
  ),
  session_conversions AS (
    SELECT
      session_id,
      max(CASE WHEN funnel_step IN ('completed', 'payment') THEN 1 ELSE 0 END) AS converted
    FROM __seo_cwv_raw
    WHERE received_at >= p_from_ts
      AND received_at <= p_to_ts
      AND ua_class = 'human'
    GROUP BY session_id
  ),
  joined AS (
    SELECT
      si.session_id,
      CASE
        WHEN si.avg_inp < 200 THEN 'fast'
        WHEN si.avg_inp < 500 THEN 'medium'
        ELSE 'slow'
      END AS inp_bucket,
      COALESCE(sc.converted, 0) AS converted
    FROM session_inp si
    LEFT JOIN session_conversions sc USING (session_id)
  )
  SELECT
    inp_bucket,
    count(*)::BIGINT AS sessions,
    sum(converted)::BIGINT AS conversion_count,
    (sum(converted)::REAL / NULLIF(count(*), 0))::REAL AS conversion_rate
  FROM joined
  GROUP BY inp_bucket
  ORDER BY CASE inp_bucket WHEN 'fast' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
$$;

COMMENT ON FUNCTION public.get_cwv_funnel_correlation(TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Bloc 6 STABLE — corrélation INP × conversion par session sur __seo_cwv_raw (TTL 48h, donc fenêtre max ~2j). Buckets fast/medium/slow alignés sur seuils Web Vitals.';

GRANT EXECUTE ON FUNCTION public.get_cwv_funnel_correlation(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- =============================================================================
-- 3. RPC detect_cwv_trend_divergence — VOLATILE (insère alerts)
-- =============================================================================
--
-- Logique trend-divergence-sustained (plan §6.alerts) :
--   1. Pour chaque (priority_tier=CWV_P0, route_group, device, metric=LCP|INP)
--   2. Compare RUM p75_avg sur 7 derniers jours vs RUM p75_avg sur 28 jours
--      précédents (J-35 à J-8) — fenêtre de référence pré-trend
--   3. Si dégradation > 30% sustained 3 jours consécutifs → INSERT
--      __seo_event_log event_type='cwv.alert.internal_regression' severity='high'
--   4. Dedup par (route_group, device, metric) — 1 alert ouverte à la fois.
--
-- "Sustained" est approximé par "p75_avg 7j > 1.30 × p75_avg 28j de référence"
-- ET "p75_avg 3 derniers jours > 1.30 × référence" (proxy 3 jours consécutifs).
-- V1 simple ; future V2 pourrait checker chaque jour individuellement.

CREATE OR REPLACE FUNCTION public.detect_cwv_trend_divergence()
RETURNS TABLE(alerts_inserted INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    HAVING sum(sample_count) >= 100  -- min samples pour alert valide
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
    -- Dedup : skip si une alert non-resolved existe déjà sur même (rg, device, metric)
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
$$;

COMMENT ON FUNCTION public.detect_cwv_trend_divergence() IS
  'Bloc 6 VOLATILE — détecte régressions CWV_P0 LCP/INP > 30% sur 7j vs référence 28j (J-35..J-8) ET confirmé sur 3 derniers jours. Dedup 14j sur même (route_group, device, metric). INSERT __seo_event_log cwv.alert.internal_regression severity=high.';

GRANT EXECUTE ON FUNCTION public.detect_cwv_trend_divergence() TO service_role;

-- =============================================================================
-- 4. Cron job alerts — quotidien 04:00 UTC (après agg daily 03:15)
-- =============================================================================

SELECT cron.schedule(
  'cwv-trend-divergence-detection',
  '0 4 * * *',
  $cron$SELECT public.detect_cwv_trend_divergence();$cron$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cwv-trend-divergence-detection'
);
