-- Rollback : retire le job de rétention de `__soft_404_events`
-- (20260929_soft_404_events_retention_cron).
--
-- Ne supprime QUE le job possédé par CETTE migration (jobname + owner + marqueur de
-- provenance dans la command) : jamais un job homonyme créé à la main ni celui d'un
-- autre owner. Les lignes déjà purgées ne sont PAS restaurées.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'soft-404-events-retention'
      AND username = current_user
      AND command LIKE '%migration:20260929_soft_404_events_retention_cron%'
  ) THEN
    PERFORM cron.unschedule('soft-404-events-retention');
  END IF;
END;
$$;
