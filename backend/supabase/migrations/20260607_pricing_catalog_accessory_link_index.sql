-- =====================================================
-- catalog_accessory_link — read-path index (étape PR-2a)
-- Date: 2026-06-07
-- Ref: 20260607_pricing_catalog_accessory_link.sql (#889 — the data model this indexes).
--
-- WHY: the R2 "Accessoires" block (AccessoryProductsService) looks up the accessory gammes
--   of a main hub via  WHERE pg_parent_gamme_id = <main_pg_id> AND pg_level IN ('4','5').
--   This partial index serves that lookup. PR-1 deliberately deferred it here.
--
-- ADDITIF. Idempotent (CREATE INDEX IF NOT EXISTS). Forward-only. NOT applied here —
-- owner-gated. No data mutation.
-- =====================================================

-- squawk-ignore-file require-concurrent-index-creation
--   pieces_gamme is a SMALL table (~9.7k rows). A plain CREATE INDEX takes a brief SHARE
--   lock (<100 ms) — negligible. CONCURRENTLY cannot run inside a transactional migration
--   (squawk assume_in_transaction=true), and is unnecessary at this row count. The partial
--   predicate keeps the index tiny (only linked accessories carry pg_parent_gamme_id).

set lock_timeout = '2s';
set statement_timeout = '120s';

CREATE INDEX IF NOT EXISTS idx_pieces_gamme_parent_main
  ON pieces_gamme (pg_parent_gamme_id)
  WHERE pg_parent_gamme_id IS NOT NULL;

COMMENT ON INDEX idx_pieces_gamme_parent_main IS
  'Read-path for the R2 accessories block: find accessory gammes of a main hub (WHERE pg_parent_gamme_id = main). Partial (only linked accessories).';
