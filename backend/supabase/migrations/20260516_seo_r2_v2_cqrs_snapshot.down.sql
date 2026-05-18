-- =============================================================================
-- ROLLBACK : ADR-072 R2 v2 CQRS Snapshot Artifact + Outbox + R8 Snapshot Store
-- =============================================================================
--
-- Rollback intentionnel (rare). Squawk excludes .down.sql par défaut
-- (cf .squawk.toml `excluded_paths = ["**/*.down.sql"]`).
--
-- Ordre inverse (FK dependencies) :
--   1. Pointers FK columns (ALTER TABLE DROP COLUMN)
--   2. Tables snapshot (DROP TABLE CASCADE)
-- =============================================================================

SET LOCAL lock_timeout       = '5s';
SET LOCAL statement_timeout  = '60s';

-- 1. Drop pointers FK
ALTER TABLE public.__seo_r2_pages DROP COLUMN IF EXISTS current_snapshot_id;
ALTER TABLE public.__seo_r8_pages DROP COLUMN IF EXISTS current_snapshot_id;

-- 2. Drop tables (CASCADE pour nettoyer indexes + grants)
DROP TABLE IF EXISTS public.__seo_outbox_event CASCADE;
DROP TABLE IF EXISTS public.__seo_r2_page_snapshot CASCADE;
DROP TABLE IF EXISTS public.__seo_r8_snapshot_store CASCADE;
