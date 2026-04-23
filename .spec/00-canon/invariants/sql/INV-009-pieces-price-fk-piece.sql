-- INV-009: pieces-price-fk-piece
-- Domain: D1-catalog
-- Severity: high
-- Description: pieces_price.pp_piece_id must reference existing piece
-- Tables: pieces_price, pieces
-- Returns 0 rows when invariant holds.

SELECT pp.pp_id FROM pieces_price pp LEFT JOIN pieces p ON pp.pp_piece_id = p.p_id WHERE pp.pp_piece_id IS NOT NULL AND p.p_id IS NULL;
