-- Rollback PR-X1 (ADR-050) : drop quality history table + RPCs.
-- Usage emergency-only — un incident postmortem est attendu.

DROP FUNCTION IF EXISTS detect_quality_outliers(INT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS ensure_next_quality_history_partition();

-- CASCADE drop des partitions enfants
DROP TABLE IF EXISTS __seo_quality_history CASCADE;
