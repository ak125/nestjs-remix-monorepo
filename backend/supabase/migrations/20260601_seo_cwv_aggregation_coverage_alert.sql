-- Migration : detect_cwv_aggregation_coverage_gap() + pg_cron alert.
--
-- Plan bloc 4 — follow-up #3 (suite PR #803). Détecte le trou SILENCIEUX
-- raw → hourly : des heures présentes dans __seo_cwv_raw (ua_class='human',
-- TTL ~48h) mais JAMAIS agrégées dans __seo_cwv_hourly. C'est exactement le
-- gap qui, le 2026-05-31, n'a agrégé que 22 / 150 samples LCP (85% perdus) et
-- a failli purger 178 samples du 2026-05-30 — cause : scheduler d'agrégation
-- BullMQ off/absent SANS signal (cf. SEO_CWV_AGGREGATION_ENABLED, PR #803).
--
-- Mode : READ-ONLY / ALERTING. La fonction NE backfille PAS, NE mute PAS le
-- raw, NE touche PAS le scheduler. Elle émet une alerte dans __seo_event_log
-- (sink canon, identique à detect_cwv_trend_divergence), dédupliquée sur les
-- événements ouverts (resolved_at IS NULL). Le backfill reste une action
-- OWNER via aggregate_cwv_hourly(<hour>) + aggregate_cwv_daily_rum(<date>)
-- tant que le raw (TTL ~48h) n'est pas purgé.
--
-- Taxonomie : réutilise l'enum existant seo_event_type='anomaly_detected' +
-- discriminant payload.alert_kind='cwv_aggregation_coverage_gap'. Aucun
-- ALTER TYPE ADD VALUE → migration 100% réversible. Sévérité 'high'.
--
-- Anti-régression PR #697 : fonction + pg_cron ATOMIQUES, idempotents.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- =============================================================================
-- Détecteur : heures raw humaines non agrégées dans hourly → alerte event_log
-- =============================================================================

CREATE OR REPLACE FUNCTION public.detect_cwv_aggregation_coverage_gap(
  p_window_hours INT DEFAULT 48,   -- borne = TTL raw (au-delà : partition purgée)
  p_grace_hours  INT DEFAULT 2,    -- heures récentes pas encore agrégées (job @ :05 + retries)
  p_min_missing  INT DEFAULT 2     -- seuil anti-flapping : 1 heure isolée = transient toléré
)
RETURNS TABLE(alerts_inserted INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count         INT := 0;
  v_missing_hours INT := 0;
  v_oldest        TIMESTAMPTZ;
  v_newest        TIMESTAMPTZ;
  v_rows_at_risk  BIGINT := 0;
BEGIN
  -- Heures avec du raw HUMAIN (ce que l'agrégation traite) mais SANS ligne
  -- correspondante dans __seo_cwv_hourly, en excluant les p_grace_hours plus
  -- récentes (qui peuvent légitimement ne pas être encore agrégées).
  WITH raw_hours AS (
    SELECT date_trunc('hour', received_at) AS hr, count(*)::BIGINT AS n
    FROM __seo_cwv_raw
    WHERE received_at >= now() - make_interval(hours => p_window_hours)
      AND ua_class = 'human'
      AND date_trunc('hour', received_at)
            < date_trunc('hour', now()) - make_interval(hours => p_grace_hours)
    GROUP BY 1
  ),
  missing AS (
    SELECT rh.hr, rh.n
    FROM raw_hours rh
    WHERE NOT EXISTS (
      SELECT 1 FROM __seo_cwv_hourly h WHERE h.hour = rh.hr
    )
  )
  SELECT count(*), min(hr), max(hr), COALESCE(sum(n), 0)
  INTO v_missing_hours, v_oldest, v_newest, v_rows_at_risk
  FROM missing;

  -- Sous le seuil → pas de bruit (heure transitoire isolée tolérée).
  IF v_missing_hours < p_min_missing THEN
    alerts_inserted := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Dédup : ne pas ré-alerter si une alerte de couverture est déjà OUVERTE (7j).
  IF EXISTS (
    SELECT 1 FROM __seo_event_log e
    WHERE e.event_type = 'anomaly_detected'
      AND e.resolved_at IS NULL
      AND e.created_at >= now() - INTERVAL '7 days'
      AND e.payload->>'alert_kind' = 'cwv_aggregation_coverage_gap'
  ) THEN
    alerts_inserted := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO __seo_event_log (event_type, entity_url, severity, payload)
  VALUES (
    'anomaly_detected'::seo_event_type,
    NULL,
    'high'::seo_severity,
    jsonb_build_object(
      'alert_kind',          'cwv_aggregation_coverage_gap',
      'missing_hours',       v_missing_hours,
      'oldest_missing_hour', v_oldest,
      'newest_missing_hour', v_newest,
      'raw_rows_at_risk',    v_rows_at_risk,
      'window_hours',        p_window_hours,
      'grace_hours',         p_grace_hours,
      'hint',                'raw humain présent dans __seo_cwv_raw mais non agrégé dans __seo_cwv_hourly. Backfill OWNER : aggregate_cwv_hourly(<hour>) puis aggregate_cwv_daily_rum(<date>) AVANT purge raw (TTL ~48h). Vérifier SEO_CWV_AGGREGATION_ENABLED + worker BullMQ.'
    )
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  alerts_inserted := v_count;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.detect_cwv_aggregation_coverage_gap(INT, INT, INT) IS
  'Bloc 4 follow-up (#3) — READ-ONLY/ALERTING. Détecte des heures raw humaines (TTL ~48h) non agrégées dans __seo_cwv_hourly et émet anomaly_detected (payload.alert_kind=cwv_aggregation_coverage_gap) dans __seo_event_log, dédupliqué sur événements ouverts. Ne backfille pas / ne mute pas raw / ne touche pas le scheduler. Mirror de detect_cwv_trend_divergence.';

GRANT EXECUTE ON FUNCTION public.detect_cwv_aggregation_coverage_gap(INT, INT, INT) TO service_role;

-- =============================================================================
-- pg_cron : quotidien 03:35 UTC (après agg hourly @ :05 + daily_rum @ 03:15).
-- Le gap reste backfillable tant que le raw (TTL ~48h) n'est pas purgé.
-- =============================================================================

SELECT cron.schedule(
  'cwv-aggregation-coverage-check',
  '35 3 * * *',
  $cron$SELECT public.detect_cwv_aggregation_coverage_gap();$cron$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cwv-aggregation-coverage-check'
);
