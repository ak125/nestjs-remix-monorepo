-- Rollback : retire les 2 cron d'agrégation CWV RUM (20260626_seo_cwv_aggregation_cron).
--
-- Ne supprime QUE les jobs possédés par CETTE migration (jobname + owner +
-- marqueur de provenance dans la command) → jamais un job homonyme créé à la
-- main ni un job d'un autre owner. N'affecte PAS les RPC aggregate_cwv_* (20260527)
-- ni les cron de rotation de partitions.

DO $$
DECLARE
  v_jobname text;
BEGIN
  FOREACH v_jobname IN ARRAY ARRAY['cwv-hourly-aggregation', 'cwv-daily-rum-aggregation'] LOOP
    IF EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname = v_jobname
        AND username = current_user
        AND command LIKE '%migration:20260626_seo_cwv_aggregation_cron%'
    ) THEN
      PERFORM cron.unschedule(v_jobname);
    END IF;
  END LOOP;
END;
$$;
