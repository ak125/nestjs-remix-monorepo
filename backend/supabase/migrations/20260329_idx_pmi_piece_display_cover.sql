-- Covering partial index on pieces_media_img for RM Page V2 RPC
-- Eliminates heap fetches for the first_images CTE (1074ms → 17ms)
-- Query pattern: DISTINCT ON (pmi_piece_id) ... WHERE pmi_display = '1' ORDER BY pmi_piece_id, pmi_sort

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pmi_piece_display_cover
ON pieces_media_img (pmi_piece_id, pmi_sort)
INCLUDE (pmi_folder, pmi_name)
WHERE pmi_display = '1';
