-- Migration: Cleanup orphan TecDoc records (type_id >= 100K without parent)
-- Context: After remap, 535 orphan records remained (55 in auto_type_number_code, 480 in __cross_gamme_car_new)
-- Safety: Archives created first in _archive schema. Rollback = INSERT FROM _archive tables.
-- Executed: 2026-03-27

-- 1. Archive orphans (safety net)
CREATE TABLE IF NOT EXISTS _archive.orphan_tnc_20260327 AS
SELECT * FROM auto_type_number_code
WHERE tnc_type_id::int >= 100000
  AND NOT EXISTS (SELECT 1 FROM auto_type WHERE type_id = tnc_type_id);

CREATE TABLE IF NOT EXISTS _archive.orphan_cgc_20260327 AS
SELECT * FROM __cross_gamme_car_new
WHERE cgc_type_id::int >= 100000
  AND NOT EXISTS (SELECT 1 FROM auto_type WHERE type_id = cgc_type_id);

-- 2. Delete orphans
DELETE FROM auto_type_number_code WHERE tnc_type_id::int >= 100000
  AND NOT EXISTS (SELECT 1 FROM auto_type WHERE type_id = tnc_type_id);

DELETE FROM __cross_gamme_car_new WHERE cgc_type_id::int >= 100000
  AND NOT EXISTS (SELECT 1 FROM auto_type WHERE type_id = cgc_type_id);
