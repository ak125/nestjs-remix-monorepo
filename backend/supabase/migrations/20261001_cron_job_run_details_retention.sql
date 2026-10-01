-- Migration : rétention 90 jours de `cron.job_run_details`, planifiée par pg_cron,
-- en conservant toujours la dernière exécution de chaque job.
--
-- CONSTAT (mesuré en lecture seule le 2026-10-01) :
--   `cron.log_run` = on : pg_cron journalise chaque exécution et ne purge jamais son
--   journal. 56 895 lignes (10 Mo) depuis le 2026-01-06, ≈ 2 260 par semaine pour les
--   19 jobs actifs ; 27 813 ont plus de 90 jours. Aucun job ne purge la table.
--
-- CONSOMMATEURS : aucune fonction, vue ni code applicatif ne lit la table (les deux
--   fonctions qui la citent, `__rls_reconcile_internal_tables` et
--   `detect_cwv_aggregation_coverage_gap`, ne la citent qu'en commentaire ou en texte
--   d'aide). Les lecteurs sont les preuves d'exécution :
--   `.spec/00-canon/repository-registry/automation-reality.yaml` (dernière exécution
--   par job), le check `scheduled-orchestrator-drift` de `runtime-truth-audit`
--   (`never_ran` = aucune ligne pour un job présent) et la règle d'ADR-045
--   (« actif » = un run `succeeded` postérieur à l'application).
--
-- POURQUOI 90 JOURS ET LA DERNIÈRE EXÉCUTION DE CHAQUE JOB :
--   Le job le plus espacé est mensuel (`seo-ensure-monthly-partitions`, `0 3 1 * *`).
--   Une purge à 7 jours effacerait sa seule exécution trois semaines par mois, et le
--   check `never_ran` le déclarerait faussement jamais lancé. 90 jours couvrent au
--   moins deux exécutions mensuelles et s'alignent sur `soft-404-events-retention`.
--   Garder `max(runid)` par `jobid` rend la preuve indépendante de toute périodicité
--   future : la dernière exécution d'un job n'est jamais purgée, quel que soit son âge.
--   `runid` vient de `cron.runid_seq` (pas de 1, cache 1, sans cycle) : le plus grand
--   `runid` d'un job est sa dernière exécution, sans ex æquo possible.
--   Le prédicat porte sur `start_time`, la colonne sur laquelle toutes les sondes
--   ordonnent ; une ligne sans `start_time` (job jamais démarré) n'est pas purgée
--   (aucune le 2026-10-01).
--
-- PLACEMENT : pg_cron, là où vit la donnée — DELETE local, déterministe, sans I/O
--   externe. Même forme que `soft-404-events-retention`
--   (`20260929_soft_404_events_retention_cron.sql`) : convergence exact-match /
--   fail-closed et marqueur de provenance. Créneau 03:30 UTC : aucun job quotidien,
--   hebdomadaire ni mensuel à cette minute. `cron.timezone` = GMT.
--
-- DROITS : `cron.job_run_details` appartient à `supabase_admin` ; `postgres` y a
--   DELETE. La table porte la politique RLS de pg_cron (`username = CURRENT_USER`) ;
--   `postgres` a BYPASSRLS, donc le job, lancé sous `postgres`, voit toutes les lignes.
--
-- COÛT : le prédicat mesuré en lecture seule (EXPLAIN ANALYZE, 2026-10-01) sur
--   56 898 lignes prend 44 ms (deux parcours séquentiels, sous-requête hachée, tout en
--   cache) ; ≈ 30 000 lignes en régime établi. Aucun index n'est ajouté : la table
--   appartient à l'extension et pg_cron y écrit à chaque exécution de job. Le DELETE
--   prend un verrou ROW EXCLUSIVE, qui ne bloque pas les écritures de pg_cron.
--   `cron.use_background_workers` = off : le job passe par une connexion sous
--   `postgres` et hérite des 60 s de `statement_timeout` de ce rôle.
--
-- IRRÉVERSIBLE : le premier run, à 03:30 UTC après l'application, supprime
--   ≈ 27 800 lignes (prévision du 2026-10-01 : 27 802 ; 11 lignes de plus de 90 jours
--   restent comme dernière exécution de leur job), dont 20 des 22 échecs journalisés,
--   tous antérieurs à J-90. `.down.sql` retire le job, il ne restaure aucune ligne.
--
-- Vérification après application puis après le premier 03:30 UTC (lecture seule) :
--   SELECT j.jobname, j.schedule, j.active, r.status, r.return_message, r.end_time
--   FROM cron.job j
--   LEFT JOIN LATERAL (SELECT * FROM cron.job_run_details d WHERE d.jobid = j.jobid
--                      ORDER BY d.start_time DESC LIMIT 1) r ON true
--   WHERE j.jobname = 'cron-job-run-details-retention';
--     -- attendu : succeeded, 'DELETE <n>'
--   SELECT count(*) FROM cron.job_run_details
--   WHERE start_time < now() - interval '90 days'
--     AND runid NOT IN (SELECT max(runid) FROM cron.job_run_details GROUP BY jobid);
--     -- attendu : 0
--   SELECT count(*) FROM cron.job j
--   WHERE NOT EXISTS (SELECT 1 FROM cron.job_run_details d WHERE d.jobid = j.jobid);
--     -- attendu : inchangé par la purge (seuls les jobs jamais lancés)

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  v_job cron.job%ROWTYPE;
  v_expected_command text := $cmd$/* migration:20261001_cron_job_run_details_retention */
DELETE FROM cron.job_run_details
WHERE start_time < now() - interval '90 days'
  AND runid NOT IN (SELECT max(runid) FROM cron.job_run_details GROUP BY jobid);
$cmd$;
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'cron-job-run-details-retention' AND username <> current_user
  ) THEN
    RAISE EXCEPTION 'cron-job-run-details-retention already exists under another owner — refusing to create a duplicate';
  END IF;

  SELECT * INTO v_job
  FROM cron.job
  WHERE jobname = 'cron-job-run-details-retention' AND username = current_user;

  IF NOT FOUND THEN
    PERFORM cron.schedule('cron-job-run-details-retention', '30 3 * * *', v_expected_command);
  ELSIF v_job.schedule <> '30 3 * * *'
     OR btrim(v_job.command) <> btrim(v_expected_command)
     OR v_job.active IS NOT TRUE THEN
    RAISE EXCEPTION 'Unexpected existing definition for cron-job-run-details-retention — refusing to overwrite';
  END IF;
END;
$$;
