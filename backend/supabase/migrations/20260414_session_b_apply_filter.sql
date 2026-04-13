-- =====================================================================
-- Session B — Step B.2 + B.4 : compute 3-signal intersection + populate filter
-- =====================================================================
--
-- Prereq : 20260414_session_b_filter_schema.sql applied
--
-- Three independent signals :
--   S1 : rtp_piece_id with > 5000 relations (volume extreme)
--   S2 : piece_year = '2025' (pollution batch cohort)
--   S3 : source_artnr absent from tecdoc_raw.t400 (orphan)
--
-- A row is marked iff S1 ∧ S2 ∧ S3.
--
-- This is idempotent : rerun re-computes scratch tables and re-inserts
-- via ON CONFLICT DO NOTHING.
-- =====================================================================

-- Drop previous scratch tables if any (idempotent)
DROP TABLE IF EXISTS _filter.signal_s1_volume;
DROP TABLE IF EXISTS _filter.signal_s2_cohort2025;
DROP TABLE IF EXISTS _filter.signal_s3_orphan_t400;

-- Signal S1 : volume extreme (>5000 relations per piece)
-- Expected : ~13 575 rows (matches rapport Phase 1)
CREATE TABLE _filter.signal_s1_volume AS
SELECT rtp_piece_id AS piece_id, COUNT(*)::INTEGER AS n_relations
FROM public.pieces_relation_type
GROUP BY rtp_piece_id
HAVING COUNT(*) > 5000;
CREATE UNIQUE INDEX idx_s1_volume_piece ON _filter.signal_s1_volume(piece_id);

-- Signal S2 : piece_year = '2025' cohort
-- Expected : ~119 702 rows (pieces created in 2025 batch)
CREATE TABLE _filter.signal_s2_cohort2025 AS
SELECT piece_id
FROM public.pieces
WHERE piece_year = '2025';
CREATE UNIQUE INDEX idx_s2_piece ON _filter.signal_s2_cohort2025(piece_id);

-- Signal S3 : computed on S1 ∩ S2 only (perf)
-- For each candidate piece, check that its source_artnr doesn't exist in t400
-- Expected : ~11 929 rows (final intersection)
CREATE TABLE _filter.signal_s3_orphan_t400 AS
SELECT DISTINCT ar.piece_id, ar.source_artnr, ar.source_dlnr
FROM tecdoc_map.article_registry ar
JOIN _filter.signal_s1_volume s1 ON s1.piece_id = ar.piece_id
JOIN _filter.signal_s2_cohort2025 s2 ON s2.piece_id = ar.piece_id
WHERE NOT EXISTS (
  SELECT 1 FROM tecdoc_raw.t400 t
  WHERE t.col_2 = ar.source_dlnr::text AND t.col_1 = ar.source_artnr
);
CREATE UNIQUE INDEX idx_s3_piece ON _filter.signal_s3_orphan_t400(piece_id);

-- Populate the exclusion list (idempotent via ON CONFLICT)
INSERT INTO _filter.rtp_pollution_ids (piece_id, signal_s1_count, signal_s3_artnr, signal_s3_dlnr, notes)
SELECT
  s3.piece_id,
  s1.n_relations,
  s3.source_artnr,
  s3.source_dlnr,
  'session-b 2026-04 multi-signal intersection S1 vol>5000 + S2 year=2025 + S3 orphan t400'
FROM _filter.signal_s3_orphan_t400 s3
JOIN _filter.signal_s1_volume s1 ON s1.piece_id = s3.piece_id
ON CONFLICT (piece_id) DO NOTHING;

-- Verification
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM _filter.rtp_pollution_ids;
  RAISE NOTICE 'rtp_pollution_ids populated with % rows', v_count;
  IF v_count < 5000 OR v_count > 15000 THEN
    RAISE WARNING 'Unexpected count (expected 10k-12k). Investigate before proceeding to B.5.';
  END IF;
END $$;

-- Rollback :
--   TRUNCATE _filter.rtp_pollution_ids;                    -- fast, keeps schema + scratch
--   -- OR --
--   DROP SCHEMA _filter CASCADE;                           -- nuclear
