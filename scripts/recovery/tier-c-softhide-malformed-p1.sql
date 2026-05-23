-- ============================================================================
-- Tier C — soft-hide malformed image rows for displayed P1 pieces
-- Plan: .claude/plans/utiliser-superpower-je-tiens-vivid-feather.md (v3)
-- ADR: (vault, pending) Recovery pieces_media_img corruption post-TecDoc 2026
--
-- Context: Tier A (relink intra-DB) = 0 yield (refs new, no historical match).
-- Tier B (TecDoc images upstream) = infeasible (t216 absent, suppliers absent,
-- old refs equally orphaned in Supabase Storage). Tier C = immediate UX fix:
-- hide rows that resolve to imgproxy 400 ("Source image is unreachable"),
-- letting the frontend fall back to /upload/articles/no.png gracefully.
--
-- Scope: VALEO (4820) + SKF (4290) + MAGNETI (2910), displayed pieces only.
-- Affected rows estimate: ~7 300 (one malformed row per displayed broken piece).
-- Backup: pieces_media_img_p1_backup_20260523 (created Phase 0a, 17 951 rows).
--
-- Idempotent: WHERE clause excludes already-hidden rows; rerun = no-op.
-- Reversible: see tier-c-softhide-malformed-p1.rollback.sql
-- ============================================================================

BEGIN;

-- Pre-check: snapshot the about-to-flip row IDs into a transient audit table
-- so rollback is unambiguous (independent of backup table containing display='1'
-- rows that were NOT in scope — e.g., well-formed MAGNETI ones).
CREATE TABLE IF NOT EXISTS pieces_media_img_tier_c_flipped_20260523 (
  pmi_piece_id text NOT NULL,
  pmi_name text NOT NULL,
  pmi_piece_id_i int,
  pmi_pm_id text,
  pmi_folder text,
  flipped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pmi_piece_id, pmi_name)
);

WITH p1 AS (
  SELECT piece_id FROM pieces
  WHERE piece_pm_id IN (4820, 4290, 2910) AND piece_display = true
),
to_flip AS (
  SELECT m.pmi_piece_id, m.pmi_name, m.pmi_piece_id_i, m.pmi_pm_id, m.pmi_folder
  FROM pieces_media_img m
  WHERE m.pmi_display = '1'
    AND m.pmi_piece_id_i IN (SELECT piece_id FROM p1)
    AND (coalesce(m.pmi_folder, '') = '' OR m.pmi_name !~ '\.')
)
INSERT INTO pieces_media_img_tier_c_flipped_20260523
  (pmi_piece_id, pmi_name, pmi_piece_id_i, pmi_pm_id, pmi_folder)
SELECT pmi_piece_id, pmi_name, pmi_piece_id_i, pmi_pm_id, pmi_folder FROM to_flip
ON CONFLICT (pmi_piece_id, pmi_name) DO NOTHING;

-- Soft-hide: only rows recorded in the audit table this run
UPDATE pieces_media_img m
SET pmi_display = '0'
FROM pieces_media_img_tier_c_flipped_20260523 f
WHERE m.pmi_piece_id = f.pmi_piece_id
  AND m.pmi_name = f.pmi_name
  AND m.pmi_display = '1';

-- Post-flip metric
SELECT
  (SELECT count(*) FROM pieces_media_img_tier_c_flipped_20260523) AS audit_rows,
  (SELECT count(*) FROM pieces_media_img m
     JOIN pieces p ON p.piece_id = m.pmi_piece_id_i
     WHERE p.piece_pm_id IN (4820, 4290, 2910) AND p.piece_display = true
       AND m.pmi_display = '1'
       AND (coalesce(m.pmi_folder,'') = '' OR m.pmi_name !~ '\.')) AS residual_malformed_displayed;

COMMIT;
