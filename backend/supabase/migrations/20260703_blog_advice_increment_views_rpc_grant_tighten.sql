-- =====================================================
-- increment_advice_views — tighten EXECUTE to service_role only (least privilege)
-- Date: 2026-07-03
-- Refs: 20260703_blog_advice_increment_views_rpc.sql (creates the function)
--       Supabase security advisor 0028/0029 (anon|authenticated_security_definer_function_executable)
--       PR #1212 (merged d46d9bf9b) — follow-up hardening
-- =====================================================
--
-- Why: the initial migration granted EXECUTE to anon + authenticated + service_role.
-- Evidence says anon/authenticated are an over-grant AND a latent risk:
--   * The only caller is the NestJS backend (advice.service.ts), which uses the
--     service_role key in PROD and DEV. No client-side / anon caller exists.
--   * READ_ONLY (PREPROD, ADR-028 Option D) is enforced via anon-key + RLS, and a
--     SECURITY DEFINER function BYPASSES RLS. So an anon-executable DEFINER writer is
--     a path for PREPROD (which runs as anon) to write view-counts into the shared DB —
--     unlike the old read-modify-write fallback, which RLS correctly blocked.
--
-- Revoking anon/authenticated leaves the real (service_role) path untouched. A
-- non-service_role caller is now refused at the DB layer; advice.service.ts already
-- handles that observably (error captured → non-atomic fallback → logger.debug).
-- Also clears advisors 0028 + 0029.

set lock_timeout = '2s';
set statement_timeout = '10s';

revoke execute on function public.increment_advice_views(text) from anon, authenticated;
