-- Rollback : drop __seo_reality_audit
DROP INDEX IF EXISTS idx_reality_audit_pg_id;
DROP INDEX IF EXISTS idx_reality_audit_captured;
DROP TABLE IF EXISTS __seo_reality_audit;
