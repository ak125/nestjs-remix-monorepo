-- Rollback PR-X1 (ADR-050) : drop quality history table + RPCs.
-- Usage emergency-only — un incident postmortem est attendu.

DROP FUNCTION IF EXISTS detect_quality_outliers(INT, NUMERIC, TEXT, TEXT); -- APPROVED: rollback file ADR-050 emergency-only
DROP FUNCTION IF EXISTS ensure_next_quality_history_partition(); -- APPROVED: rollback file ADR-050 emergency-only

-- CASCADE drop des partitions enfants
DROP TABLE IF EXISTS __seo_quality_history CASCADE; -- APPROVED: rollback file ADR-050 emergency-only
