-- ============================================================================
-- 20260621_pricing_partition_rotation_cron.sql
--
-- OPS migration différée (cf. 20260523_pricing_decision_snapshot_and_offers.sql
-- ligne 116 : « Called by pg_cron (governed in a separate ops migration once
-- cron is scheduled) »). Câble la ROTATION manquante des 3 tables mensuelles du
-- Pricing Control Plane.
--
-- Finding runtime-truth-p0 (audit 2026-06-21) :
--   pricing_decision_snapshot + supplier_offer_snapshot ont une fonction
--   maintain_* MAIS aucun cron ; pieces_price_history n'a NI fonction NI cron.
--   Partitions s'arrêtent au 2026-08-01 → falaise « no partition found for row »
--   si l'écriture démarre (tables actuellement n_tup_ins=0, donc préventif).
--
-- Pattern aligné sur 20260522_seo_snapshot_partition_rotation.sql (cron quotidien
-- idempotent `cron.schedule(...) WHERE NOT EXISTS`) + maintain_*_partitions +1 mois.
-- Additive, idempotente, reversible (cf. .down.sql). search_path pinné (advisor).
-- assume_in_transaction (squawk) : PAS de BEGIN/COMMIT explicite.
-- Rollback : 20260621_pricing_partition_rotation_cron.down.sql
-- ============================================================================

SET lock_timeout = '5s';
SET statement_timeout = '15s';

-- ----------------------------------------------------------------------------
-- 1) Fonction de maintenance manquante pour pieces_price_history
--    (modèle identique à maintain_pricing_decision_snapshot_partitions, sans GIN
--     car pieces_price_history n'a pas de colonne jsonb). PARTITION BY RANGE(created_at).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.maintain_pieces_price_history_partitions()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_next_month DATE := date_trunc('month', now() + INTERVAL '1 month')::date;
  v_after      DATE := date_trunc('month', now() + INTERVAL '2 month')::date;
  v_part_name  TEXT := 'pieces_price_history_' || to_char(v_next_month, 'YYYY_MM');
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF pieces_price_history FOR VALUES FROM (%L) TO (%L);',
    v_part_name, v_next_month, v_after
  );
  RETURN format('ensured %s', v_part_name);
END $$;

COMMENT ON FUNCTION public.maintain_pieces_price_history_partitions IS
  'Idempotently pre-creates the next monthly partition of pieces_price_history. Scheduled daily via pg_cron (cf. 20260621_pricing_partition_rotation_cron.sql).';

GRANT EXECUTE ON FUNCTION public.maintain_pieces_price_history_partitions() TO service_role;

-- ----------------------------------------------------------------------------
-- 2) Backfill immédiat (idempotent : CREATE TABLE IF NOT EXISTS) — crée la
--    partition du mois prochain pour les 3 tables dès l'application.
-- ----------------------------------------------------------------------------
SELECT public.maintain_pieces_price_history_partitions();
SELECT public.maintain_pricing_decision_snapshot_partitions();
SELECT public.maintain_supplier_offer_snapshot_partitions();

-- ----------------------------------------------------------------------------
-- 3) Crons quotidiens idempotents (pattern snapshot-partition-rotation @ 02:20).
--    Staggered 02:25/02:30/02:35 UTC. `WHERE NOT EXISTS` préserve toute
--    modification manuelle ultérieure.
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'pieces-price-history-partition-rotation',
  '25 2 * * *',
  $cron$SELECT public.maintain_pieces_price_history_partitions();$cron$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'pieces-price-history-partition-rotation'
);

SELECT cron.schedule(
  'pricing-decision-snapshot-partition-rotation',
  '30 2 * * *',
  $cron$SELECT public.maintain_pricing_decision_snapshot_partitions();$cron$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'pricing-decision-snapshot-partition-rotation'
);

SELECT cron.schedule(
  'supplier-offer-snapshot-partition-rotation',
  '35 2 * * *',
  $cron$SELECT public.maintain_supplier_offer_snapshot_partitions();$cron$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'supplier-offer-snapshot-partition-rotation'
);

-- ----------------------------------------------------------------------------
-- Vérification post-apply (manuelle) :
--   SELECT jobname, schedule, active FROM cron.job
--     WHERE jobname LIKE '%-partition-rotation' ORDER BY jobname;
--   -- attendu : 3 nouveaux jobs actifs (+ snapshot-partition-rotation préexistant)
--   SELECT inhrelid::regclass FROM pg_inherits
--     WHERE inhparent = 'pieces_price_history'::regclass ORDER BY 1;
--   -- attendu : la partition du mois prochain présente
-- ----------------------------------------------------------------------------
