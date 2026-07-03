-- =====================================================
-- increment_advice_views — atomic view counter for __blog_advice
-- Date: 2026-07-03
-- Refs: audit/runtime-truth-report-2026-07-02.md (finding #3)
--       audit/runtime-truth-remediation-proposal-2026-07-02.md (Lot C)
--       20260614_gov_m9_callable_functions_rpc.sql (names this RPC as absent /
--         "silent feature breakage"; introspection that detects the drift)
--       backend/src/modules/blog/services/advice.service.ts (caller: incrementViews)
-- =====================================================
--
-- Why: advice.service.ts calls `.rpc('increment_advice_views', { advice_id })` on
-- every public advice-page view, but the function never existed. postgrest-js
-- resolves an absent RPC to { data:null, error:PGRST202 } WITHOUT throwing, so the
-- call's try/catch never fired and the non-atomic fallback (read-modify-write) was
-- the only path — best-effort, race-prone, and doubly silent. `ba_visit` was, in
-- practice, incremented only via the fallback (when writes were allowed at all).
--
-- This creates the atomic increment the caller always intended. `ba_id` and
-- `ba_visit` are TEXT columns holding numeric strings, so the counter is parsed,
-- incremented, and re-serialized in a single UPDATE (no lost-update race).
--
-- VOLATILE (not STABLE): this function WRITES. A STABLE function that mutates is an
-- anti-pattern — PostgREST may route STABLE calls through a read-only transaction.
--
-- SECURITY DEFINER: __blog_advice has RLS enabled. The advice-view route is public
-- (anon) and the PREPROD backend runs as anon (ADR-028 READ_ONLY). Neither can
-- UPDATE under RLS, so the increment runs as the function owner. The mutation is
-- fully bounded: single row by primary key, single column, parameterized (no
-- injection surface), rate-limited upstream by the global Cloudflare throttler.
--
-- Grants: EXECUTE to anon + authenticated (public route) + service_role (backend).
-- Unlike the service_role-only __gov_* introspection family, this RPC is meant to
-- be reachable from the public page-view path.

set lock_timeout = '2s';
set statement_timeout = '10s';

create or replace function public.increment_advice_views(advice_id text)
  returns void
  language sql
  volatile
  security definer
  set search_path to 'public'
as $function$
  update public.__blog_advice
     set ba_visit = (coalesce(nullif(ba_visit, '')::int, 0) + 1)::text
   where ba_id = advice_id;
$function$;

-- Supabase ALTER DEFAULT PRIVILEGES grants EXECUTE to anon/authenticated on every
-- new public function; `revoke ... from public` does NOT remove those direct grants.
-- We intentionally KEEP anon/authenticated here (public advice-view route), then
-- re-assert the full intended grant set explicitly (auditable, no implicit reliance).
revoke all on function public.increment_advice_views(text) from public;
grant execute on function public.increment_advice_views(text) to anon, authenticated, service_role;

comment on function public.increment_advice_views(text) is
  'Atomic view counter for __blog_advice (runtime-truth #3, Lot C): increments ba_visit for the given ba_id in a single UPDATE. VOLATILE + SECURITY DEFINER (RLS-enabled table, public/anon caller). Replaces the race-prone read-modify-write fallback in advice.service.ts. EXECUTE: anon, authenticated, service_role.';
