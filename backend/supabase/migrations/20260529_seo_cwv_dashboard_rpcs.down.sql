-- Rollback bloc 6 — RPCs dashboard + funnel + alerts trend divergence.
-- ENUM values cwv.alert.* restent inertes (PG ne DROP pas les enums simplement).

SELECT cron.unschedule('cwv-trend-divergence-detection')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cwv-trend-divergence-detection');

DROP FUNCTION IF EXISTS public.get_cwv_dashboard(DATE, DATE, TEXT);
DROP FUNCTION IF EXISTS public.get_cwv_funnel_correlation(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.detect_cwv_trend_divergence();
