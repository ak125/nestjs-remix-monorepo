-- ============================================================================
-- Tier C ROLLBACK — restore pmi_display='1' for rows soft-hidden by Tier C.
-- Source of truth: pieces_media_img_tier_c_flipped_20260523 (audit table
-- populated by tier-c-softhide-malformed-p1.sql).
-- Safe to rerun (idempotent: only re-flips rows currently at '0').
-- ============================================================================

BEGIN;

UPDATE pieces_media_img m
SET pmi_display = '1'
FROM pieces_media_img_tier_c_flipped_20260523 f
WHERE m.pmi_piece_id = f.pmi_piece_id
  AND m.pmi_name = f.pmi_name
  AND m.pmi_display = '0';

SELECT
  (SELECT count(*) FROM pieces_media_img_tier_c_flipped_20260523) AS audit_rows,
  (SELECT count(*) FROM pieces_media_img m
     WHERE EXISTS (SELECT 1 FROM pieces_media_img_tier_c_flipped_20260523 f
                   WHERE f.pmi_piece_id = m.pmi_piece_id AND f.pmi_name = m.pmi_name)
       AND m.pmi_display = '1') AS restored;

COMMIT;
