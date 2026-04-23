-- INV-065: pieces-active-has-price
-- Domain: D6-consistency
-- Severity: medium
-- Description: Active pieces should have at least one price record
-- Tables: pieces, pieces_price
-- Returns 0 rows when invariant holds.

SELECT p.p_id FROM pieces p WHERE p.p_status = 'active' AND NOT EXISTS (SELECT 1 FROM pieces_price pp WHERE pp.pp_piece_id = p.p_id);
