-- INV-010: pieces-list-fk-piece
-- Domain: D1-catalog
-- Severity: high
-- Description: pieces_list.pl_piece_id must reference existing piece
-- Tables: pieces_list, pieces
-- Returns 0 rows when invariant holds.

SELECT pl.pl_id FROM pieces_list pl LEFT JOIN pieces p ON pl.pl_piece_id = p.p_id WHERE pl.pl_piece_id IS NOT NULL AND p.p_id IS NULL;
