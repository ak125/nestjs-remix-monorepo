-- Migration : tuning du détecteur de couverture CWV (suite #811 / 20260601).
--
-- Pré-requis : 20260601_seo_cwv_aggregation_coverage_alert.sql (#811) DOIT être
-- appliquée AVANT (elle crée la fonction + le job @ '35 3 * * *'). Cette migration
-- de tuning ne remplace PAS l'application de #811 — elle la fait évoluer.
--
-- Deux changements :
--  (1) detect_cwv_aggregation_coverage_gap() → CREATE OR REPLACE pour AJOUTER
--      l'AUTO-RÉSOLUTION (couverture rétablie ⇒ resolved_at sur les alertes
--      ouvertes) + corriger le hint (orchestration = pg_cron, pas BullMQ).
--      Aligne le RUM sur la doctrine CWV OPEN → STILL_OPEN → RESOLVED (ADR-063).
--  (2) job pg_cron 'cwv-aggregation-coverage-check' : transition CONTRÔLÉE
--      '35 3 * * *' (#811) → '35 * * * *' (horaire) via cron.alter_job — détection
--      en quelques heures (grâce 2 h + seuil 2 h) au lieu de jusqu'à 24 h.
--
-- Convergence fail-closed : le job de couverture est le SEUL hand-off délibéré
-- (créé par #811, modifié ici). On vérifie l'état EXACT attendu de #811 avant
-- d'altérer ; toute autre définition → RAISE EXCEPTION. Garde homonyme (autre owner).
-- Ne crée ni ne supprime le job (il appartient à #811).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- =============================================================================
-- (1) Fonction : auto-résolution + hint corrigé (reste identique à #811)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.detect_cwv_aggregation_coverage_gap(
  p_window_hours INT DEFAULT 48,   -- borne = TTL raw + fenêtre auto-heal pg_cron
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

  -- Sous le seuil → couverture saine. AUTO-RÉSOLUTION des alertes ouvertes
  -- (le détecteur tourne désormais à l'heure ; sans ça une alerte resterait
  -- ouverte après récupération et le gate « 0 alerte ouverte » échouerait).
  IF v_missing_hours < p_min_missing THEN
    UPDATE public.__seo_event_log
    SET resolved_at = now(),
        payload = payload || jsonb_build_object(
          'resolution_kind', 'coverage_restored',
          'resolved_by',     'detect_cwv_aggregation_coverage_gap',
          'resolved_at',     now()
        )
    WHERE event_type = 'anomaly_detected'
      AND resolved_at IS NULL
      AND payload->>'alert_kind' = 'cwv_aggregation_coverage_gap';

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
      'hint',                'raw humain présent dans __seo_cwv_raw mais non agrégé dans __seo_cwv_hourly. Orchestration = pg_cron (jobs cwv-hourly-aggregation @ :05 / cwv-daily-rum-aggregation @ 00:15 UTC, ADR-045). Vérifier cron.job_run_details (dernier statut) + cron.log_run=on. Backfill OWNER si besoin : aggregate_cwv_hourly(<hour>) puis aggregate_cwv_daily_rum(<date>) AVANT purge raw (TTL ~48h).'
    )
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  alerts_inserted := v_count;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.detect_cwv_aggregation_coverage_gap(INT, INT, INT) IS
  'Bloc 4 follow-up (#811 + tune 20260626) — READ-ONLY/ALERTING + AUTO-RESOLVE. Détecte des heures raw humaines (TTL ~48h) non agrégées dans __seo_cwv_hourly → anomaly_detected (alert_kind=cwv_aggregation_coverage_gap) dans __seo_event_log, dédupliqué ; résout automatiquement les alertes ouvertes quand la couverture est rétablie (OPEN→RESOLVED). Orchestration pg_cron (ADR-045). Ne backfille pas / ne mute pas raw.';

GRANT EXECUTE ON FUNCTION public.detect_cwv_aggregation_coverage_gap(INT, INT, INT) TO service_role;

-- =============================================================================
-- (2) Transition contrôlée du job de couverture : #811 '35 3 * * *' → '35 * * * *'
-- =============================================================================
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
    RAISE EXCEPTION 'cwv-aggregation-coverage-check not found — apply #811 (20260601_seo_cwv_aggregation_coverage_alert.sql) FIRST';
  ELSIF v_job.schedule = '35 * * * *' AND btrim(v_job.command) = btrim(v_expected_cmd) THEN
    NULL;  -- already tuned (re-apply) = no-op
  ELSIF v_job.schedule = '35 3 * * *' AND btrim(v_job.command) = btrim(v_expected_cmd) THEN
    PERFORM cron.alter_job(v_job.jobid, schedule := '35 * * * *');  -- #811 → hourly
  ELSE
    RAISE EXCEPTION 'cwv-aggregation-coverage-check has an unexpected definition (schedule=%) — refusing to alter', v_job.schedule;
  END IF;
END;
$$;
