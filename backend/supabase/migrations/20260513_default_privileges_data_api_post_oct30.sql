-- =============================================================================
-- ALTER DEFAULT PRIVILEGES — Supabase Data API auto-expose deprecation
-- =============================================================================
--
-- Context: Supabase deprecates the public schema auto-expose default.
--   - 2026-05-30 : enforced on NEW projects only
--   - 2026-10-30 : enforced on ALL EXISTING projects (this one included)
--
-- After 2026-10-30, every table created without an explicit GRANT will return
-- PostgREST error 42501 to supabase.from() / supabase.rpc() callers.
--
-- This migration sets DEFAULT privileges for FUTURE objects in schema `public`
-- so that the backend (service_role) keeps working transparently. Frontend
-- exposure (anon / authenticated) is INTENTIONALLY left to per-table explicit
-- GRANTs — forcing a security review (RLS + scope) at table creation time.
--
-- Function defaults are also left out on purpose: the codebase has ~217
-- migrations following the explicit "GRANT EXECUTE ON FUNCTION ... TO ..."
-- pattern. Keeping that discipline avoids auto-exposing SECURITY DEFINER
-- helpers.
--
-- Idempotent: ALTER DEFAULT PRIVILEGES is replace-on-conflict semantics.
-- Scope: schema `public` only. `_archive`, `kg_*`, etc. are NOT touched.
--
-- References:
--   - https://supabase.com/blog/data-api-access-changes (newsletter 2026-05)
--   - Memory: feedback_supabase_grant_explicit_for_new_projects.md
-- =============================================================================

-- Tables: backend (NestJS via service_role) gets full DML by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

-- Sequences: USAGE + SELECT so SERIAL / IDENTITY inserts work for service_role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

-- DELIBERATELY OMITTED:
--   * ON TABLES TO anon, authenticated     — force per-table GRANT + RLS review
--   * ON FUNCTIONS TO any role             — keep explicit RPC exposure pattern
--   * ON SCHEMAS                           — schema usage is handled at role level
--
-- Convention going forward (post 2026-10-30):
--   Every new table / view / RPC exposed via the Data API MUST ship its
--   migration with an explicit GRANT block, e.g.:
--
--     GRANT SELECT ON public.my_new_table TO anon, authenticated;
--     ALTER TABLE public.my_new_table ENABLE ROW LEVEL SECURITY;
--     CREATE POLICY "..." ON public.my_new_table FOR SELECT ...;
--
--     GRANT EXECUTE ON FUNCTION public.my_new_rpc(...) TO anon, authenticated, service_role;
