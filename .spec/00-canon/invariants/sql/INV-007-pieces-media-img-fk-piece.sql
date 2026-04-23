-- INV-007: pieces-media-img-fk-piece
-- Domain: D1-catalog
-- Severity: high
-- Description: pieces_media_img.pmi_piece_id must reference existing piece
-- Tables: pieces_media_img, pieces
-- Returns 0 rows when invariant holds.

SELECT pmi.pmi_id FROM pieces_media_img pmi LEFT JOIN pieces p ON pmi.pmi_piece_id = p.p_id WHERE pmi.pmi_piece_id IS NOT NULL AND p.p_id IS NULL;
