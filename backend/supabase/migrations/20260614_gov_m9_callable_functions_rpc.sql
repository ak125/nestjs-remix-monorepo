-- =====================================================
-- __gov_m9_callable_functions — read-only introspection RPC
-- Date: 2026-06-14
-- Refs: __gov_m1..m8 (governed introspection family — same pattern)
--       .claude/skills/runtime-truth-audit/checks/rpc-registry-drift.md (logic source)
--       Plan: Trust Ledger PR-B0a rpc-registry-drift runner
-- =====================================================
--
-- Why: the deterministic `rpc-registry-drift` runner scans backend/src for
-- literal `.rpc('<name>')` calls and must verify each name exists as a
-- PostgREST-callable function. supabase-js `.rpc()` resolves against the
-- `public` schema, so a called RPC absent from public FAILS at runtime
-- (silent feature breakage — verified: 5 such calls today, e.g.
-- increment_advice_views, execute_sql). pg_proc is not reachable via PostgREST,
-- so we EXTEND the governed `__gov_*` family with one read-only function.
--
-- Returns the distinct names of all functions in the `public` schema (the set
-- `.rpc()` can resolve). The runner diffs code-called names against this set.
--
-- Security: EXECUTE restricted to service_role. Report-only; no mutation.

set lock_timeout = '2s';
set statement_timeout = '10s';

create or replace function public.__gov_m9_callable_functions()
  returns table (function_name text)
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  select distinct p.proname::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public';
$function$;

revoke all on function public.__gov_m9_callable_functions() from public;
-- Supabase ALTER DEFAULT PRIVILEGES grants EXECUTE to anon/authenticated on every new
-- public function; `revoke ... from public` does NOT remove those direct grants, so we
-- must revoke them explicitly to actually reach service_role-only (verified 2026-07-01).
revoke execute on function public.__gov_m9_callable_functions() from anon, authenticated;
grant execute on function public.__gov_m9_callable_functions() to service_role;

comment on function public.__gov_m9_callable_functions() is
  'Read-only introspection (Trust Ledger B0a): distinct names of all public-schema functions (the set supabase-js .rpc() can resolve). Consumed by scripts/audit/runtime-truth/rpc-registry-drift.ts to detect code calling a non-existent RPC. service_role only.';
