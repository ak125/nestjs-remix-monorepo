-- INV-008: pieces-ref-ean-fk-piece
-- Domain: D1-catalog
-- Severity: high
-- Description: pieces_ref_ean.pre_piece_id must reference existing piece
-- Tables: pieces_ref_ean, pieces
-- Returns 0 rows when invariant holds.

SELECT pre.pre_id FROM pieces_ref_ean pre LEFT JOIN pieces p ON pre.pre_piece_id = p.p_id WHERE pre.pre_piece_id IS NOT NULL AND p.p_id IS NULL;
