-- Rollback PR-C — drop __seo_policy_evaluations
BEGIN;
DROP TABLE IF EXISTS __seo_policy_evaluations;
COMMIT;
