-- Migration : __seo_cwv_hourly + __seo_cwv_daily_rum + RPCs d'agrégation.
--
-- Plan bloc 4 (CWV Runtime Observability). Pipeline :
--   __seo_cwv_raw (TTL 48h, bloc 3)
--     → __seo_cwv_hourly  (TTL 14j, agg horaire)
--     → __seo_cwv_daily_rum (TTL 12mo, agg journalier, source primaire dashboards)
--
-- IMPORTANT — naming : __seo_cwv_daily_rum (et non __seo_cwv_daily) pour
-- éviter la collision sémantique avec la table existante __seo_cwv_daily qui
-- stocke des **lab data** (PageSpeed via CwvFetcherService). Le plan owner
-- voulait étendre __seo_cwv_daily mais le PK change + collision sémantique
-- rend cette approche risquée. Table dédiée RUM = canon "un diagnostic, une
-- table" — cohérent avec la doctrine bloc 2 V1A/V1B split.
--
-- RPCs VOLATILE (canon `reference_postgrest_stable_function_write_readonly`) :
-- elles ÉCRIVENT, donc défaut LANGUAGE plpgsql sans STABLE/IMMUTABLE = VOLATILE.
--
-- Anti-régression PR #697 : 2 fns rotation + 2 pg_cron jobs ATOMIQUES.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- =============================================================================
-- 1. Table __seo_cwv_hourly — partitions daily, TTL 14j
-- =============================================================================

CREATE TABLE IF NOT EXISTS __seo_cwv_hourly (
  hour                  TIMESTAMPTZ NOT NULL,         -- truncated to hour (UTC)
  surface               TEXT NOT NULL,
  route_group           TEXT NOT NULL,
  priority_tier         TEXT NOT NULL CHECK (priority_tier IN ('CWV_P0', 'CWV_P1', 'CWV_P2')),
  device                TEXT NOT NULL CHECK (device IN ('mobile', 'desktop', 'tablet', 'unknown')),
  metric                TEXT NOT NULL CHECK (metric IN ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')),
  -- ua_class fixed 'human' (canon — bots redirigés vers __seo_event_log bloc 3)
  -- on stocke pour rétrocompat queries cross-class si besoin futur (V1.1+).
  ua_class              TEXT NOT NULL DEFAULT 'human' CHECK (ua_class IN ('human', 'bot_search', 'bot_ai', 'bot_other')),

  -- Percentiles (mesurés via percentile_cont sur __seo_cwv_raw)
  sample_count          BIGINT NOT NULL,
  p50_value             REAL,
  p75_value             REAL,
  p95_value             REAL,

  fetched_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (hour, surface, route_group, device, metric, ua_class)
) PARTITION BY RANGE (hour);

COMMENT ON TABLE __seo_cwv_hourly IS
  'Bloc 4 — agrégat horaire CWV par (surface × route_group × device × metric × ua_class). Source : __seo_cwv_raw (48h TTL, bloc 3). Partitions daily, TTL 14j.';

ALTER TABLE __seo_cwv_hourly ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_seo_cwv_hourly_pk_query
  ON __seo_cwv_hourly (priority_tier, surface, hour DESC)
  WHERE ua_class = 'human';

-- =============================================================================
-- 2. Table __seo_cwv_daily_rum — partitions monthly, TTL 12mo
-- =============================================================================

CREATE TABLE IF NOT EXISTS __seo_cwv_daily_rum (
  date                  DATE NOT NULL,                -- UTC day
  surface               TEXT NOT NULL,
  route_group           TEXT NOT NULL,
  priority_tier         TEXT NOT NULL CHECK (priority_tier IN ('CWV_P0', 'CWV_P1', 'CWV_P2')),
  device                TEXT NOT NULL CHECK (device IN ('mobile', 'desktop', 'tablet', 'unknown')),
  metric                TEXT NOT NULL CHECK (metric IN ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')),
  ua_class              TEXT NOT NULL DEFAULT 'human' CHECK (ua_class IN ('human', 'bot_search', 'bot_ai', 'bot_other')),

  sample_count          BIGINT NOT NULL,
  -- Approximation V1 : weighted-avg-by-sample sur les percentiles horaires.
  -- Pas mathématiquement exact sans la distribution raw (déjà droppé à 48h),
  -- acceptable pour top-N ranking et trend SLO. Documenté ici comme tradeoff.
  p50_value             REAL,
  p75_value             REAL,
  p95_value             REAL,

  fetched_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, surface, route_group, device, metric, ua_class)
) PARTITION BY RANGE (date);

COMMENT ON TABLE __seo_cwv_daily_rum IS
  'Bloc 4 — agrégat journalier CWV (RUM). Source : __seo_cwv_hourly via aggregate_cwv_daily_rum() RPC (weighted-avg approximation). Partitions monthly, TTL 12mo. Distinct de __seo_cwv_daily (lab PageSpeed, table existante).';

ALTER TABLE __seo_cwv_daily_rum ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_seo_cwv_daily_rum_query
  ON __seo_cwv_daily_rum (priority_tier, surface, date DESC)
  WHERE ua_class = 'human';

-- =============================================================================
-- 3. RPC aggregate_cwv_hourly(target_hour TIMESTAMPTZ) VOLATILE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.aggregate_cwv_hourly(
  p_target_hour TIMESTAMPTZ
)
RETURNS TABLE(rows_upserted INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INT := 0;
BEGIN
  -- Aggregate __seo_cwv_raw → __seo_cwv_hourly (UPSERT idempotent).
  -- Filtre ua_class='human' canon (bots dans __seo_event_log).
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
$$;

COMMENT ON FUNCTION public.aggregate_cwv_hourly(TIMESTAMPTZ) IS
  'Bloc 4 VOLATILE — agrège 1h de __seo_cwv_raw vers __seo_cwv_hourly. Filtre ua_class=human. Idempotent (UPSERT).';

GRANT EXECUTE ON FUNCTION public.aggregate_cwv_hourly(TIMESTAMPTZ) TO service_role;

-- =============================================================================
-- 4. RPC aggregate_cwv_daily_rum(target_date DATE) VOLATILE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.aggregate_cwv_daily_rum(
  p_target_date DATE
)
RETURNS TABLE(rows_upserted INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INT := 0;
BEGIN
  -- Aggregate __seo_cwv_hourly (24h) → __seo_cwv_daily_rum (UPSERT).
  -- Approximation V1 : weighted-avg-by-sample sur percentiles horaires.
  -- Mathématiquement non-exact (sans distribution raw), suffit pour
  -- top-N ranking + trend SLO. Documenté tradeoff bloc 4.
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
$$;

COMMENT ON FUNCTION public.aggregate_cwv_daily_rum(DATE) IS
  'Bloc 4 VOLATILE — agrège 24h de __seo_cwv_hourly vers __seo_cwv_daily_rum (weighted-avg V1 approx). Idempotent (UPSERT).';

GRANT EXECUTE ON FUNCTION public.aggregate_cwv_daily_rum(DATE) TO service_role;

-- =============================================================================
-- 5. Fonction rotation __seo_cwv_hourly (daily partitions, TTL 14j)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.maintain_cwv_hourly_partitions(
  p_lookahead_days INT DEFAULT 3,
  p_retention_days INT DEFAULT 14
)
RETURNS TABLE(action TEXT, partition_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent TEXT := '__seo_cwv_hourly';
  v_day    DATE;
  v_next   DATE;
  v_last   DATE;
  v_part   TEXT;
  v_child  RECORD;
  v_cutoff DATE := (CURRENT_DATE - make_interval(days => p_retention_days))::date;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = v_parent AND n.nspname = 'public' AND c.relkind = 'p'
  ) THEN
    RETURN;
  END IF;

  v_day  := CURRENT_DATE;
  v_last := CURRENT_DATE + make_interval(days => p_lookahead_days);
  WHILE v_day <= v_last LOOP
    v_next := (v_day + INTERVAL '1 day')::date;
    v_part := v_parent || '_p' || to_char(v_day, 'YYYYMMDD');
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = v_part AND n.nspname = 'public'
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
        v_part, v_parent, v_day::text, v_next::text
      );
      action := 'created'; partition_name := v_part; RETURN NEXT;
    END IF;
    v_day := v_next;
  END LOOP;

  FOR v_child IN
    SELECT c.relname
    FROM pg_inherits i
    JOIN pg_class p     ON p.oid = i.inhparent
    JOIN pg_class c     ON c.oid = i.inhrelid
    JOIN pg_namespace n ON n.oid = p.relnamespace
    WHERE p.relname = v_parent AND n.nspname = 'public'
      AND c.relname ~ ('^' || v_parent || '_p\d{8}$')
  LOOP
    IF to_date(right(v_child.relname, 8), 'YYYYMMDD') < v_cutoff THEN
      EXECUTE format('DROP TABLE IF EXISTS public.%I', v_child.relname);
      action := 'dropped'; partition_name := v_child.relname; RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintain_cwv_hourly_partitions(INT, INT) TO service_role;

-- =============================================================================
-- 6. Fonction rotation __seo_cwv_daily_rum (monthly partitions, TTL 12mo)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.maintain_cwv_daily_rum_partitions(
  p_lookahead_months INT DEFAULT 3,
  p_retention_months INT DEFAULT 12
)
RETURNS TABLE(action TEXT, partition_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent TEXT := '__seo_cwv_daily_rum';
  v_month  DATE;
  v_next   DATE;
  v_last   DATE;
  v_part   TEXT;
  v_child  RECORD;
  v_cutoff DATE := date_trunc('month', CURRENT_DATE - make_interval(months => p_retention_months))::date;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = v_parent AND n.nspname = 'public' AND c.relkind = 'p'
  ) THEN
    RETURN;
  END IF;

  v_month := date_trunc('month', CURRENT_DATE)::date;
  v_last  := date_trunc('month', CURRENT_DATE)::date + make_interval(months => p_lookahead_months);
  WHILE v_month <= v_last LOOP
    v_next := (v_month + INTERVAL '1 month')::date;
    v_part := v_parent || '_' || to_char(v_month, 'YYYY_MM');
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = v_part AND n.nspname = 'public'
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
        v_part, v_parent, v_month::text, v_next::text
      );
      action := 'created'; partition_name := v_part; RETURN NEXT;
    END IF;
    v_month := v_next;
  END LOOP;

  FOR v_child IN
    SELECT c.relname
    FROM pg_inherits i
    JOIN pg_class p     ON p.oid = i.inhparent
    JOIN pg_class c     ON c.oid = i.inhrelid
    JOIN pg_namespace n ON n.oid = p.relnamespace
    WHERE p.relname = v_parent AND n.nspname = 'public'
      AND c.relname ~ ('^' || v_parent || '_\d{4}_\d{2}$')
  LOOP
    IF to_date(right(v_child.relname, 7), 'YYYY_MM') < v_cutoff THEN
      EXECUTE format('DROP TABLE IF EXISTS public.%I', v_child.relname);
      action := 'dropped'; partition_name := v_child.relname; RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintain_cwv_daily_rum_partitions(INT, INT) TO service_role;

-- =============================================================================
-- 7. Backfill + cron jobs (atomique)
-- =============================================================================

SELECT public.maintain_cwv_hourly_partitions();
SELECT public.maintain_cwv_daily_rum_partitions();

-- Cron rotation __seo_cwv_hourly : quotidien 03:00 UTC
SELECT cron.schedule(
  'cwv-hourly-rotation',
  '0 3 * * *',
  $cron$SELECT public.maintain_cwv_hourly_partitions();$cron$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cwv-hourly-rotation'
);

-- Cron rotation __seo_cwv_daily_rum : hebdo dimanche 03:10 UTC
SELECT cron.schedule(
  'cwv-daily-rum-rotation',
  '10 3 * * 0',
  $cron$SELECT public.maintain_cwv_daily_rum_partitions();$cron$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cwv-daily-rum-rotation'
);
