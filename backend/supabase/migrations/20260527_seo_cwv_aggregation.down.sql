-- Rollback bloc 4 — tables agg + RPCs + cron.
-- Idempotent.

SELECT cron.unschedule('cwv-hourly-rotation')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cwv-hourly-rotation');

SELECT cron.unschedule('cwv-daily-rum-rotation')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cwv-daily-rum-rotation');

DROP FUNCTION IF EXISTS public.aggregate_cwv_hourly(TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.aggregate_cwv_daily_rum(DATE);
DROP FUNCTION IF EXISTS public.maintain_cwv_hourly_partitions(INT, INT);
DROP FUNCTION IF EXISTS public.maintain_cwv_daily_rum_partitions(INT, INT);

DROP TABLE IF EXISTS __seo_cwv_hourly CASCADE;
DROP TABLE IF EXISTS __seo_cwv_daily_rum CASCADE;
