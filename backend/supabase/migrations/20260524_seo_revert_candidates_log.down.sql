-- Rollback PR-E revert log
BEGIN;
DROP TABLE IF EXISTS __seo_revert_candidates_log;
COMMIT;
