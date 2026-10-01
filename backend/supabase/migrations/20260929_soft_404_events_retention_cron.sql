-- Migration : rétention 90 jours de `__soft_404_events`, planifiée par pg_cron.
--
-- CONSTAT (mesuré en lecture seule le 2026-09-29 vers 13:50Z) :
--   ADR-076 (accepted) fixe la télémétrie soft-404 à « Rétention 90j ». Le runbook
--   vault `runbooks/soft-404-telemetry.md` renvoie la purge à « un cron à câbler
--   post-merge dans `seo-routines` ». Ce `seo-routines` n'a jamais existé, et aucun
--   job pg_cron ne purge la table : la rétention décidée n'est appliquée par personne
--   depuis le 2026-05-19 (première ligne).
--   État : 656 592 lignes, 117 Mo, dont 159 114 de plus de 90 jours (≈ 24 %) ;
--   ≈ 3 700 lignes par jour ; `n_tup_del` = 0.
--   La colonne `referrer` peut porter un domaine externe : c'est la raison que le
--   runbook donne à la limite de 90 jours.
--
-- PLACEMENT : pg_cron, là où vit la donnée — le DELETE est local à la base,
--   déterministe, sans I/O externe. Même forme que `error-logs-retention` (job 11,
--   `20260420_error_logs_dedicated_table.sql`, dernier run réussi 2026-09-29 03:00Z),
--   convergence exact-match / fail-closed de `20260626_seo_cwv_aggregation_cron.sql`.
--   Créneau 03:20 UTC : libre (03:00 = 2 jobs, 03:10 dimanche = 1 job). `cron.timezone`
--   = GMT et `TimeZone` = UTC (fichier de configuration, sans surcharge de base ni de
--   rôle) : `interval '90 days'` vaut exactement 2 160 h. Le prédicat est celui de la
--   purge manuelle du runbook, à l'identique.
--
-- CONSOMMATEURS de la table : la vue `v_soft_404_demand_30d` (fenêtre de 30 jours,
--   non affectée) et le writer `track_soft_404_event` (INSERT du beacon). Aucun
--   trigger, aucune clé étrangère entrante. `__rls_reconcile_internal_tables` la cite
--   pour ses droits, pas pour ses lignes.
--
-- COÛT : le DELETE prend un verrou ROW EXCLUSIVE, qui ne bloque ni les lectures ni
--   les INSERT du beacon. Le planificateur lit le prédicat `ts < …` par un parcours
--   complet d'`idx_soft404_pair_ts` (48 ms pour compter les 159 114 lignes). Aucun
--   index n'est ajouté : il coûterait à chaque INSERT du beacon pour un job quotidien.
--   Le job hérite des 60 s de `statement_timeout` du rôle `postgres` : un dépassement
--   annule le DELETE en entier et apparaît en `failed` dans `cron.job_run_details`.
--   Les lignes mortes (159 114 > seuil autovacuum de ≈ 131 000) déclenchent
--   l'autovacuum ; l'espace est réutilisé par les INSERT suivants.
--
-- IRRÉVERSIBLE : le premier run, à 03:20 UTC après l'application, supprime les
--   ≈ 159 000 lignes antérieures à J-90, puis ≈ 3 700 par jour. `.down.sql` retire le
--   job, il ne restaure aucune ligne.
--
-- Vérification après application puis après le premier 03:20 UTC (lecture seule) :
--   SELECT j.jobname, j.schedule, j.active, r.status, r.return_message, r.end_time
--   FROM cron.job j
--   LEFT JOIN LATERAL (SELECT * FROM cron.job_run_details d WHERE d.jobid = j.jobid
--                      ORDER BY d.start_time DESC LIMIT 1) r ON true
--   WHERE j.jobname = 'soft-404-events-retention';
--     -- attendu : succeeded, 'DELETE <n>'
--   SELECT count(*) FROM public.__soft_404_events
--   WHERE ts < now() - interval '90 days';              -- attendu : 0

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  v_job cron.job%ROWTYPE;
  v_expected_command text := $cmd$/* migration:20260929_soft_404_events_retention_cron */
DELETE FROM public.__soft_404_events WHERE ts < now() - interval '90 days';
$cmd$;
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'soft-404-events-retention' AND username <> current_user
  ) THEN
    RAISE EXCEPTION 'soft-404-events-retention already exists under another owner — refusing to create a duplicate';
  END IF;

  SELECT * INTO v_job
  FROM cron.job
  WHERE jobname = 'soft-404-events-retention' AND username = current_user;

  IF NOT FOUND THEN
    PERFORM cron.schedule('soft-404-events-retention', '20 3 * * *', v_expected_command);
  ELSIF v_job.schedule <> '20 3 * * *'
     OR btrim(v_job.command) <> btrim(v_expected_command)
     OR v_job.active IS NOT TRUE THEN
    RAISE EXCEPTION 'Unexpected existing definition for soft-404-events-retention — refusing to overwrite';
  END IF;
END;
$$;
