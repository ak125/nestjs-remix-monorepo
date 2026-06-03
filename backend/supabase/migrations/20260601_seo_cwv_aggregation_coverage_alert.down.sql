-- Down — retire le cron + la fonction de détection coverage-gap.
-- Aucun enum ajouté (réutilise anomaly_detected) → réversibilité totale.

SELECT cron.unschedule('cwv-aggregation-coverage-check')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cwv-aggregation-coverage-check'
);

DROP FUNCTION IF EXISTS public.detect_cwv_aggregation_coverage_gap(INT, INT, INT);
