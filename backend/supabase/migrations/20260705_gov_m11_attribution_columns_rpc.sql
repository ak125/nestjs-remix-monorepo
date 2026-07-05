-- =====================================================
-- __gov_m11_attribution_columns — read-only introspection RPC
-- Date: 2026-07-05
-- Refs: __gov_m1..m10 (governed introspection family — same pattern)
--       .claude/skills/runtime-truth-audit/checks/attribution-write-gap.md (logic source)
--       #695 (orl_website_url attribution orpheline en runtime, 2026-05-22)
-- =====================================================
--
-- Why: the deterministic `attribution-write-gap` runner must list attribution /
-- tracking columns (by naming convention) and their table write-traffic to detect
-- columns declared in schema but never written by runtime code. information_schema
-- + pg_stat_user_tables are NOT reachable via PostgREST, so we EXTEND the governed
-- __gov_* family with one read-only function. Per-column writer detection is done
-- by the runner via a repo grep of backend/src; this RPC provides the candidate
-- set + table-level insert/update counters (n_tup_ins / n_tup_upd) as anti-false-
-- positive corroboration (a grep-missed dynamic writer still bumps n_tup_ins).
--
-- Returns one row per public BASE-TABLE column whose name matches an attribution
-- convention (ends with _url/_referrer/_source/_campaign, or contains utm_ /
-- attribution), with its table's live insert/update counters.
--
-- Security: EXECUTE restricted to service_role. Report-only; no mutation.

set lock_timeout = '2s';
set statement_timeout = '10s';

create or replace function public.__gov_m11_attribution_columns()
  returns table (table_name text, column_name text, n_tup_ins bigint, n_tup_upd bigint)
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  select c.table_name::text,
         c.column_name::text,
         coalesce(s.n_tup_ins, 0)::bigint as n_tup_ins,
         coalesce(s.n_tup_upd, 0)::bigint as n_tup_upd
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema
   and t.table_name = c.table_name
   and t.table_type = 'BASE TABLE'
  left join pg_stat_user_tables s
    on s.schemaname = c.table_schema
   and s.relname = c.table_name
  where c.table_schema = 'public'
    and (
      c.column_name ~ '(_url|_referrer|_source|_campaign)$'
      or c.column_name ~ '(^|_)utm_'
      or c.column_name like '%attribution%'
    )
  order by c.table_name, c.column_name;
$function$;

revoke all on function public.__gov_m11_attribution_columns() from public;
-- Supabase ALTER DEFAULT PRIVILEGES grants EXECUTE to anon/authenticated on every new
-- public function; `revoke ... from public` does NOT remove those direct grants, so we
-- must revoke them explicitly to actually reach service_role-only (verified 2026-07-01).
revoke execute on function public.__gov_m11_attribution_columns() from anon, authenticated;
grant execute on function public.__gov_m11_attribution_columns() to service_role;

comment on function public.__gov_m11_attribution_columns() is
  'Read-only introspection (Trust Ledger B0a): public base-table columns matching attribution naming conventions + their table insert/update traffic (#695 orphan-attribution class). Consumed by scripts/audit/runtime-truth/attribution-write-gap.ts. service_role only.';
