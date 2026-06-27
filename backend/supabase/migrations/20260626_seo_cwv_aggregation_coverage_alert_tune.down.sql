-- Rollback du tuning : restaure l'état #811 (20260601) du détecteur de couverture.
--  (1) Fonction → version #811 (sans auto-résolution, hint d'origine).
--  (2) Job 'cwv-aggregation-coverage-check' → schedule '35 3 * * *' (#811).
-- Ne supprime PAS le job (il appartient à #811). Fail-closed sur owner homonyme.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- (1) Restaurer la fonction #811 (identique à 20260601_seo_cwv_aggregation_coverage_alert.sql)
CREATE OR REPLACE FUNCTION public.detect_cwv_aggregation_coverage_gap(
  p_window_hours INT DEFAULT 48,
  p_grace_hours  INT DEFAULT 2,
  p_min_missing  INT DEFAULT 2
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

  IF v_missing_hours < p_min_missing THEN
    alerts_inserted := 0;
    RETURN NEXT;
    RETURN;
  END IF;

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

-- (2) Job → schedule #811 '35 3 * * *' (transition inverse, fail-closed, jamais delete)
DO $$
DECLARE
  v_job cron.job%ROWTYPE;
  v_expected_cmd text := 'SELECT public.detect_cwv_aggregation_coverage_gap();';
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cwv-aggregation-coverage-check' AND username <> current_user) THEN
    RAISE EXCEPTION 'cwv-aggregation-coverage-check exists under another owner — refusing to alter';
  END IF;

  SELECT * INTO v_job FROM cron.job WHERE jobname = 'cwv-aggregation-coverage-check' AND username = current_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cwv-aggregation-coverage-check not found — nothing to revert';
  ELSIF v_job.schedule = '35 3 * * *' AND btrim(v_job.command) = btrim(v_expected_cmd) THEN
    NULL;  -- already at #811 schedule = no-op
  ELSIF v_job.schedule = '35 * * * *' AND btrim(v_job.command) = btrim(v_expected_cmd) THEN
    PERFORM cron.alter_job(v_job.jobid, schedule := '35 3 * * *');
  ELSE
    RAISE EXCEPTION 'cwv-aggregation-coverage-check has an unexpected definition (schedule=%) — refusing to alter', v_job.schedule;
  END IF;
END;
$$;
