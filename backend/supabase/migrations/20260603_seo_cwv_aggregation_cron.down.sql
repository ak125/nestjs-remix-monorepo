-- Rollback : retire les 2 cron d'agrégation CWV RUM (20260603_seo_cwv_aggregation_cron).
-- Idempotent : unschedule seulement si le job existe (pas d'erreur sinon).
-- N'affecte PAS les RPC aggregate_cwv_* (20260527) ni les cron de rotation.

SELECT cron.unschedule('cwv-hourly-aggregation')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cwv-hourly-aggregation');

SELECT cron.unschedule('cwv-daily-rum-aggregation')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cwv-daily-rum-aggregation');
