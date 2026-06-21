-- ============================================================================
-- Rollback de 20260621_pricing_partition_rotation_cron.sql
-- Retire les 3 crons + la fonction de maintenance créée. N'efface AUCUNE
-- partition (les CREATE TABLE IF NOT EXISTS sont des données — non détruites).
-- maintain_pricing/supplier_* préexistantes : conservées (créées ailleurs).
-- ============================================================================

BEGIN;

SELECT cron.unschedule('pieces-price-history-partition-rotation')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pieces-price-history-partition-rotation');
SELECT cron.unschedule('pricing-decision-snapshot-partition-rotation')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pricing-decision-snapshot-partition-rotation');
SELECT cron.unschedule('supplier-offer-snapshot-partition-rotation')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'supplier-offer-snapshot-partition-rotation');

DROP FUNCTION IF EXISTS public.maintain_pieces_price_history_partitions();

COMMIT;
