-- Rollback : __seo_cwv_raw + cron + fn.
--
-- Idempotent (mirror up).

SELECT cron.unschedule('cwv-raw-rotation')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cwv-raw-rotation'
);

DROP FUNCTION IF EXISTS public.maintain_cwv_raw_partitions(INT, INT);
DROP TABLE IF EXISTS __seo_cwv_raw CASCADE;
