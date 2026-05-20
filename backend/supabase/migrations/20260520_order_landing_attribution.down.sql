-- Reversal of 20260520_order_landing_attribution.sql
DROP INDEX IF EXISTS idx_xtr_order_landing_source;
ALTER TABLE ___xtr_order DROP CONSTRAINT IF EXISTS chk_xtr_order_landing_source;
ALTER TABLE ___xtr_order
    DROP COLUMN IF EXISTS landing_source,
    DROP COLUMN IF EXISTS landing_path,
    DROP COLUMN IF EXISTS landing_first_seen_at;
