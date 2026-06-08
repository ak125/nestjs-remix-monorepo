-- =====================================================
-- DECOMMISSION catalog_accessory_link — revert of #889 + #892
-- Date: 2026-06-08
--
-- WHY: the accessory→parent relationship is ALREADY expressed natively by
--   pieces_relation_type.rtp_pg_pid (parent gamme). The catalog's R2 RPC already
--   surfaces an accessory gamme's pieces under its parent when the relation rows
--   carry rtp_pg_id=<parent> + rtp_pg_pid=<accessory gamme> — e.g. plaquette 402
--   ← gamme 1164 "Accessoires de plaquette" (106 sellable pieces, shown as the
--   "Accessoires de plaquette" group). The pg_parent_gamme_id gamme-level link +
--   AccessoryProductsService + R2 component (#889/#892) were a redundant PARALLEL
--   system → reverted in code; this drops the now-inert DB objects.
--
-- INERT: the feature flag SHOW_ACCESSORY_BLOCKS_ON_R2 was OFF and NO runtime path
--   ever called these objects, so dropping them changes no live behavior.
--
-- ⚠️ NOT applied automatically — owner-gated (DROP). Apply after review.
--    Re-creatable by re-applying 20260607_pricing_catalog_accessory_link*.sql (kept
--    in history). pg_parent_gamme_id (a PRE-EXISTING column) is preserved, not dropped.
-- =====================================================

-- squawk-ignore-file ban-drop-table
--   pieces_gamme_link_history is the journal of the (now-reverted) accessory-link
--   pilot. It holds only the single pilot batch row; no runtime reads it. Removing
--   it is the purpose of this decommission. Forward-only, owner-gated.
-- squawk-ignore-file require-concurrent-index-deletion
--   idx_pieces_gamme_parent_main is a tiny partial index on pieces_gamme (~9.7k rows);
--   a plain DROP INDEX takes a brief ACCESS EXCLUSIVE lock (<100 ms). DROP INDEX
--   CONCURRENTLY cannot run inside a transactional migration (assume_in_transaction=true)
--   — symmetric with the CREATE in 20260607_pricing_catalog_accessory_link_index.sql.

set lock_timeout = '2s';
set statement_timeout = '60s';

-- 1) Reset the journaled pilot link (1330 → 82) back to NULL.
--    Idempotent + guarded: only the exact pilot value is touched.
UPDATE pieces_gamme
   SET pg_parent_gamme_id = NULL
 WHERE pg_id = 1330 AND pg_parent_gamme_id = 82;

-- 2) Drop the governed RPCs (never called by runtime; flag was OFF).
DROP FUNCTION IF EXISTS catalog_accessory_link_activate(UUID, INTEGER, INTEGER[], TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS catalog_accessory_link_rollback_batch(UUID);

-- 3) Drop the read-path index + the journal table.
DROP INDEX IF EXISTS idx_pieces_gamme_parent_main;
DROP TABLE IF EXISTS pieces_gamme_link_history;

-- 4) Remove the documentation comment added by #889 (the column itself is preserved).
COMMENT ON COLUMN pieces_gamme.pg_parent_gamme_id IS NULL;
