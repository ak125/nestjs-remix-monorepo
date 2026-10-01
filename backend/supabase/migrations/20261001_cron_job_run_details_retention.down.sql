-- Rollback : retire le job de rétention de `cron.job_run_details`
-- (20261001_cron_job_run_details_retention).
--
-- Ne supprime QUE le job possédé par CETTE migration (jobname + owner + marqueur de
-- provenance dans la command) : jamais un job homonyme créé à la main ni celui d'un
-- autre owner. Les lignes déjà purgées ne sont PAS restaurées.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'cron-job-run-details-retention'
      AND username = current_user
      AND command LIKE '%migration:20261001_cron_job_run_details_retention%'
  ) THEN
    PERFORM cron.unschedule('cron-job-run-details-retention');
  END IF;
END;
$$;
