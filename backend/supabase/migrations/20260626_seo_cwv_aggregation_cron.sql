-- Migration : pg_cron pour l'agrégation CWV RUM (raw → hourly → daily_rum).
--
-- PROBLÈME (mesuré 2026-06-26, audit runtime-truth) :
--   __seo_cwv_raw afflue en continu (beacon PROD), mais __seo_cwv_hourly était
--   VIDE et __seo_cwv_daily_rum FIGÉ depuis 2026-06-03 → 20 j de données déjà
--   perdues (raw TTL ~48 h) et la collecte courante à risque de purge.
--
-- CAUSE RACINE (architecturale, pas une valeur de flag) :
--   L'agrégation était un repeatable **Bull v4** (`@nestjs/bull` + `bull@4`,
--   CwvAggregationSchedulerService, queue `seo-monitor`) gardé par
--   SEO_CWV_AGGREGATION_ENABLED, sur un worker DEV mort. DEV = poste opérateur,
--   pas un host runtime (deployment.md). Une chaîne de données PROD ne doit pas
--   dépendre du poste DEV. Le bloc 20260527 avait mis les ROTATIONS de
--   partitions sous pg_cron mais PAS l'agrégation elle-même — ce trou est comblé ici.
--
-- SOLUTION (robuste, découplée de l'app) :
--   Planifier les RPC VOLATILE existantes aggregate_cwv_hourly(timestamptz) /
--   aggregate_cwv_daily_rum(date) directement via pg_cron, là où vit la donnée.
--   Toujours-actif, survit aux restarts/déploiements, zéro dépendance Bull/flag/DEV.
--   Bull v4 sera retiré dans une PR de clôture séparée (D1) — pg_cron devient le
--   SEUL orchestrateur. ADR-045 (amendement 2026-06-26) gouverne ce placement.
--
-- AUTO-HEAL = 48 h : l'hourly réagrège les 48 dernières heures complètes (pas
--   juste la précédente). UPSERT idempotent → réagréger une heure faite est un
--   no-op sûr ; une panne de plusieurs heures (cron/DB/maintenance) se rattrape
--   seule au tick suivant tant que le raw (TTL ~48 h) n'est pas purgé. La fenêtre
--   d'auto-heal (48 h) = la fenêtre du détecteur de couverture (#811) = le TTL raw.
--
-- CONVERGENCE (exact-match / fail-closed — pas d'écrasement aveugle) :
--   Pour CHAQUE job : absent → créer ; présent à la définition EXACTE attendue
--   (schedule + command + active, marqueur de provenance inclus) → no-op ; présent
--   avec toute autre définition → RAISE EXCEPTION (jamais d'alter_job d'un état
--   inconnu : le .down ne saurait pas le restaurer). Garde aussi contre un job
--   HOMONYME appartenant à un autre owner.
--
-- PROVENANCE : chaque command porte le marqueur stable
--   /* migration:20260626_seo_cwv_aggregation_cron */ → réapplication idempotente,
--   et le .down ne supprime QUE le job possédé par cette migration.
--
-- SÉCURITÉ / SCOPE :
--   - Additif pur. Aucune table, aucune RPC modifiée. Réutilise les RPC (20260527)
--     + pg_cron déjà actif. 100 % réversible (down = cron.unschedule ciblé).
--   - Horaires sans chevauchement des rotations (cwv-*-rotation @ 02:55/03:00/03:10) :
--     agrégation hourly @ :05, daily @ 00:15 UTC.
--   - daily @ 00:15 : la dernière heure de J-1 (23:00) a été agrégée à 00:05 par
--     l'hourly → J-1 est complet en hourly avant le rollup. (Le choix n'est PAS
--     justifié par « après les rotations » — 00:15 leur est antérieur.)
--
-- Anti-régression PR #697 : blocs ATOMIQUES, idempotents.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- =============================================================================
-- 1. Cron agrégation HORAIRE : toutes les heures à HH:05 UTC.
--    Réagrège les 48 dernières heures complètes (UTC-explicite, auto-heal 48 h).
-- =============================================================================
DO $$
DECLARE
  v_job cron.job%ROWTYPE;
  v_expected_command text := $cmd$/* migration:20260626_seo_cwv_aggregation_cron */
SELECT public.aggregate_cwv_hourly(
  date_trunc('hour', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' - make_interval(hours => h)
)
FROM generate_series(1, 48) AS gs(h);
$cmd$;
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cwv-hourly-aggregation' AND username <> current_user) THEN
    RAISE EXCEPTION 'cwv-hourly-aggregation already exists under another owner — refusing to create a duplicate';
  END IF;

  SELECT * INTO v_job FROM cron.job WHERE jobname = 'cwv-hourly-aggregation' AND username = current_user;

  IF NOT FOUND THEN
    PERFORM cron.schedule('cwv-hourly-aggregation', '5 * * * *', v_expected_command);
  ELSIF v_job.schedule <> '5 * * * *'
     OR btrim(v_job.command) <> btrim(v_expected_command)
     OR v_job.active IS NOT TRUE THEN
    RAISE EXCEPTION 'Unexpected existing definition for cwv-hourly-aggregation (drift / missing provenance marker) — refusing to overwrite';
  END IF;  -- exact match (provenance marker included) = no-op
END;
$$;

-- =============================================================================
-- 2. Cron agrégation JOURNALIÈRE : tous les jours à 00:15 UTC.
--    Réagrège hier + avant-hier (UTC-explicite, auto-heal). Idempotent (UPSERT).
-- =============================================================================
DO $$
DECLARE
  v_job cron.job%ROWTYPE;
  v_expected_command text := $cmd$/* migration:20260626_seo_cwv_aggregation_cron */
SELECT public.aggregate_cwv_daily_rum(((now() AT TIME ZONE 'UTC')::date - d))
FROM generate_series(1, 2) AS gs(d);
$cmd$;
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cwv-daily-rum-aggregation' AND username <> current_user) THEN
    RAISE EXCEPTION 'cwv-daily-rum-aggregation already exists under another owner — refusing to create a duplicate';
  END IF;

  SELECT * INTO v_job FROM cron.job WHERE jobname = 'cwv-daily-rum-aggregation' AND username = current_user;

  IF NOT FOUND THEN
    PERFORM cron.schedule('cwv-daily-rum-aggregation', '15 0 * * *', v_expected_command);
  ELSIF v_job.schedule <> '15 0 * * *'
     OR btrim(v_job.command) <> btrim(v_expected_command)
     OR v_job.active IS NOT TRUE THEN
    RAISE EXCEPTION 'Unexpected existing definition for cwv-daily-rum-aggregation (drift / missing provenance marker) — refusing to overwrite';
  END IF;  -- exact match (provenance marker included) = no-op
END;
$$;
