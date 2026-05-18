-- Down : drop __seo_snapshot_cf_analytics + toutes ses partitions.
-- ADR-064 PR-2A-2 rollback.

BEGIN;

DROP TABLE IF EXISTS public.__seo_snapshot_cf_analytics CASCADE;

COMMIT;
