-- Rollback PR-D — drop view, RPC, table
BEGIN;
DROP FUNCTION IF EXISTS seo_apply_h1_write(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB);
DROP VIEW IF EXISTS __seo_content_assets_current_v;
DROP TABLE IF EXISTS __seo_content_events;
COMMIT;
