-- Rollback PR-A2 — drop __seo_content_audit table
-- Date: 2026-05-16

BEGIN;

DROP TABLE IF EXISTS __seo_content_audit;

COMMIT;
