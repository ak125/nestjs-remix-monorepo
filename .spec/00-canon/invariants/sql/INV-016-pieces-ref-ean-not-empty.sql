-- INV-016: pieces-ref-ean-not-empty
-- Domain: D1-catalog
-- Severity: medium
-- Description: pieces_ref_ean must not contain empty or null EAN codes
-- Tables: pieces_ref_ean
-- Returns 0 rows when invariant holds.

SELECT pre_id FROM pieces_ref_ean WHERE pre_ean IS NULL OR pre_ean = '';
