-- ADR-072 PR 2D-3 — Down migration : drop admin job table + helpers.

DROP FUNCTION IF EXISTS public.__seo_admin_job_transition(UUID, TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.__seo_admin_job_accept(TEXT, TEXT, JSONB, TEXT, TEXT);
DROP TABLE IF EXISTS public.__seo_admin_job;
