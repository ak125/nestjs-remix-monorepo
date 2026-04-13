-- =====================================================================
-- 20260414_session_b_filter_schema.sql
-- =====================================================================
-- Session B (§12 plan) — CREATE _filter schema + empty exclusion table
--
-- Purpose: ultra-safe pollution marker for pieces_relation_type.
-- This file creates ONLY the sibling schema and empty table.
-- Population is done by 20260414_session_b_populate_pollution_filter.sql
-- Function patch is done by 20260414_session_b_patch_listing_function.sql
--
-- Rollback: DROP SCHEMA _filter CASCADE;
--
-- See:
--   /home/deploy/.claude/plans/swirling-giggling-scott.md §12
--   .spec/reports/session-b-sampling-20260413.md
-- =====================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS _filter;

CREATE TABLE IF NOT EXISTS _filter.rtp_pollution_ids (
  piece_id          INTEGER PRIMARY KEY,
  signal_s1_count   INTEGER NOT NULL,
  signal_s3_artnr   TEXT,
  signal_s3_dlnr    INTEGER,
  marked_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes             TEXT
);

COMMENT ON TABLE _filter.rtp_pollution_ids IS
  'Session B 2026-04: exclusion list for pollution in pieces_relation_type. '
  'Populated by 3-signal intersection (S1 volume>5000 + S2 piece_year=2025 + S3 orphan t400). '
  'Rollback: TRUNCATE. See /home/deploy/.claude/plans/swirling-giggling-scott.md §12';

CREATE INDEX IF NOT EXISTS idx_rtp_pollution_ids_marked_at
  ON _filter.rtp_pollution_ids(marked_at DESC);

COMMIT;
