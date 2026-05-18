-- Down : drop __seo_snapshot_runtime_logs + toutes ses partitions.
-- ADR-064 PR-2A-3 rollback.

DROP TABLE IF EXISTS public.__seo_snapshot_runtime_logs CASCADE;
