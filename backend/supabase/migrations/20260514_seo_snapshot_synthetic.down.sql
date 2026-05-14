-- Down : drop __seo_snapshot_synthetic + toutes ses partitions.
-- ADR-064 PR-2A-1 rollback.

BEGIN;

DROP TABLE IF EXISTS public.__seo_snapshot_synthetic CASCADE;

COMMIT;
