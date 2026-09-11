-- =============================================================================
-- Fixture — chaîne RUM CWV (raw → hourly → daily_rum → détecteur) telle qu'elle
-- est en PROD avant la migration 20260911_seo_cwv_daily_rum_exact_p75.sql
--
-- Ce n'est PAS une copie des données : c'est une reproduction fidèle de ce qui
-- décide du comportement — colonnes, contraintes, partitionnement et corps des
-- trois fonctions. Relevé en lecture seule sur la base live le 2026-09-11 :
--   pg_get_functiondef (aggregate_cwv_hourly, aggregate_cwv_daily_rum,
--   detect_cwv_trend_divergence), pg_attribute / pg_constraint / pg_indexes.
-- Les corps des fonctions sont recopiés verbatim. Les index sans effet sur le
-- comportement testé (session, requête horaire) sont omis. Les droits EXECUTE
-- sont des préconditions du test, posées explicitement.
--
-- S'applique sur un PostgreSQL jetable. Ne cible JAMAIS la base de production.
-- =============================================================================

-- --- Rôles API (mêmes noms qu'en Supabase) -----------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')          THEN CREATE ROLE anon NOLOGIN;          END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role')  THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Précondition de test : EXECUTE par défaut pour les rôles API sur les nouvelles
-- fonctions de public. Les assertions de droits après migration prouvent ainsi les
-- REVOKE explicites, y compris si une fonction venait à être recréée.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- --- Journal d'événements (colonnes live ; seuls les libellés utilisés) -------
CREATE TYPE public.seo_event_type AS ENUM ('anomaly_detected', 'cwv.alert.internal_regression');
CREATE TYPE public.seo_severity   AS ENUM ('critical', 'high', 'medium', 'low', 'info');

CREATE TABLE public.__seo_event_log (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type  public.seo_event_type NOT NULL,
  entity_url  text,
  severity    public.seo_severity NOT NULL DEFAULT 'info'::public.seo_severity,
  payload     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  ack_at      timestamptz,
  resolved_at timestamptz
);

-- --- __seo_cwv_raw (partitions journalières UTC) -----------------------------
CREATE TABLE public.__seo_cwv_raw (
  received_at          timestamptz NOT NULL DEFAULT now(),
  session_id           text NOT NULL CHECK (char_length(session_id) >= 8 AND char_length(session_id) <= 64),
  surface              text NOT NULL CHECK (surface = ANY (ARRAY['R2_PRODUCT','R2_GAMME_VEHICLE','R3_GUIDE','R5_DIAGNOSTIC','R8_VEHICLE','SEARCH','HOME','CART','CHECKOUT','PAYMENT','ACCOUNT','OTHER'])),
  route_group          text NOT NULL CHECK (route_group = ANY (ARRAY['pieces_product','pieces_gamme_vehicle','r3_guide','r5_diagnostic','r8_vehicle','marques_listing','search','cart','checkout','payment','account','home','other'])),
  priority_tier        text NOT NULL CHECK (priority_tier = ANY (ARRAY['CWV_P0','CWV_P1','CWV_P2'])),
  funnel_step          text NOT NULL,
  previous_funnel_step text,
  url                  text NOT NULL CHECK (char_length(url) <= 2000),
  metric               text NOT NULL CHECK (metric = ANY (ARRAY['LCP','INP','CLS','FCP','TTFB'])),
  value                real NOT NULL CHECK (value >= 0 AND value <= 60000),
  device               text NOT NULL CHECK (device = ANY (ARRAY['mobile','desktop','tablet','unknown'])),
  ua_class             text NOT NULL CHECK (ua_class = ANY (ARRAY['human','bot_search','bot_ai','bot_other'])),
  attribution          jsonb,
  nav_type             text NOT NULL CHECK (nav_type = ANY (ARRAY['navigate','reload','back_forward','prerender','restore','unknown']))
) PARTITION BY RANGE (received_at);
ALTER TABLE public.__seo_cwv_raw ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_seo_cwv_raw_recv_surf_tier ON public.__seo_cwv_raw (received_at, surface, priority_tier);

-- --- __seo_cwv_hourly (partitions journalières) ------------------------------
CREATE TABLE public.__seo_cwv_hourly (
  hour          timestamptz NOT NULL,
  surface       text NOT NULL,
  route_group   text NOT NULL,
  priority_tier text NOT NULL CHECK (priority_tier = ANY (ARRAY['CWV_P0','CWV_P1','CWV_P2'])),
  device        text NOT NULL CHECK (device = ANY (ARRAY['mobile','desktop','tablet','unknown'])),
  metric        text NOT NULL CHECK (metric = ANY (ARRAY['LCP','INP','CLS','FCP','TTFB'])),
  ua_class      text NOT NULL DEFAULT 'human' CHECK (ua_class = ANY (ARRAY['human','bot_search','bot_ai','bot_other'])),
  sample_count  bigint NOT NULL,
  p50_value     real,
  p75_value     real,
  p95_value     real,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hour, surface, route_group, device, metric, ua_class)
) PARTITION BY RANGE (hour);
ALTER TABLE public.__seo_cwv_hourly ENABLE ROW LEVEL SECURITY;

-- --- __seo_cwv_daily_rum (partitions mensuelles) -----------------------------
CREATE TABLE public.__seo_cwv_daily_rum (
  date          date NOT NULL,
  surface       text NOT NULL,
  route_group   text NOT NULL,
  priority_tier text NOT NULL CHECK (priority_tier = ANY (ARRAY['CWV_P0','CWV_P1','CWV_P2'])),
  device        text NOT NULL CHECK (device = ANY (ARRAY['mobile','desktop','tablet','unknown'])),
  metric        text NOT NULL CHECK (metric = ANY (ARRAY['LCP','INP','CLS','FCP','TTFB'])),
  ua_class      text NOT NULL DEFAULT 'human' CHECK (ua_class = ANY (ARRAY['human','bot_search','bot_ai','bot_other'])),
  sample_count  bigint NOT NULL,
  p50_value     real,
  p75_value     real,
  p95_value     real,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, surface, route_group, device, metric, ua_class)
) PARTITION BY RANGE (date);
ALTER TABLE public.__seo_cwv_daily_rum ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_seo_cwv_daily_rum_query ON public.__seo_cwv_daily_rum (priority_tier, surface, date DESC) WHERE ua_class = 'human';

-- Partitions autour de la date courante (même nommage que les fonctions de rotation).
DO $$
DECLARE
  v_day   date;
  v_month date;
BEGIN
  FOR v_day IN SELECT generate_series(CURRENT_DATE - 5, CURRENT_DATE + 1, interval '1 day')::date LOOP
    EXECUTE format('CREATE TABLE public.%I PARTITION OF public.__seo_cwv_raw FOR VALUES FROM (%L) TO (%L)',
                   '__seo_cwv_raw_p' || to_char(v_day, 'YYYYMMDD'), v_day::text, (v_day + 1)::text);
    EXECUTE format('CREATE TABLE public.%I PARTITION OF public.__seo_cwv_hourly FOR VALUES FROM (%L) TO (%L)',
                   '__seo_cwv_hourly_p' || to_char(v_day, 'YYYYMMDD'), v_day::text, (v_day + 1)::text);
  END LOOP;
  FOR v_month IN SELECT generate_series(date_trunc('month', CURRENT_DATE - 40), date_trunc('month', CURRENT_DATE + 1), interval '1 month')::date LOOP
    EXECUTE format('CREATE TABLE public.%I PARTITION OF public.__seo_cwv_daily_rum FOR VALUES FROM (%L) TO (%L)',
                   '__seo_cwv_daily_rum_' || to_char(v_month, 'YYYY_MM'), v_month::text, (v_month + interval '1 month')::date::text);
  END LOOP;
END $$;

-- --- Fonctions : corps verbatim de pg_get_functiondef (live, 2026-09-11) -------
CREATE OR REPLACE FUNCTION public.aggregate_cwv_hourly(p_target_hour timestamp with time zone)
 RETURNS TABLE(rows_upserted integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted INT := 0;
BEGIN
  WITH agg AS (
    SELECT
      date_trunc('hour', received_at) AS hour,
      surface,
      route_group,
      priority_tier,
      device,
      metric,
      ua_class,
      count(*)::BIGINT AS sample_count,
      percentile_cont(0.50) WITHIN GROUP (ORDER BY value)::REAL AS p50_value,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY value)::REAL AS p75_value,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY value)::REAL AS p95_value
    FROM __seo_cwv_raw
    WHERE received_at >= p_target_hour
      AND received_at <  p_target_hour + INTERVAL '1 hour'
      AND ua_class = 'human'
    GROUP BY 1, 2, 3, 4, 5, 6, 7
  )
  INSERT INTO __seo_cwv_hourly (hour, surface, route_group, priority_tier, device, metric, ua_class, sample_count, p50_value, p75_value, p95_value, fetched_at)
  SELECT hour, surface, route_group, priority_tier, device, metric, ua_class, sample_count, p50_value, p75_value, p95_value, now()
  FROM agg
  ON CONFLICT (hour, surface, route_group, device, metric, ua_class) DO UPDATE
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

CREATE OR REPLACE FUNCTION public.aggregate_cwv_daily_rum(p_target_date date)
 RETURNS TABLE(rows_upserted integer)
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

CREATE OR REPLACE FUNCTION public.detect_cwv_trend_divergence()
 RETURNS TABLE(alerts_inserted integer)
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

-- --- Préconditions de droits EXECUTE -----------------------------------------
-- aggregate_cwv_daily_rum : EXECUTE par défaut (précondition ci-dessus), que la
-- migration doit restreindre à service_role.
-- aggregate_cwv_hourly : hors des assertions de droits, réservée à service_role.
-- detect_cwv_trend_divergence : droits de 20260616_vague5_revoke_safe_trigger_cron_execute.
REVOKE EXECUTE ON FUNCTION public.aggregate_cwv_hourly(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.aggregate_cwv_hourly(timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION public.detect_cwv_trend_divergence() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.detect_cwv_trend_divergence() TO service_role;
