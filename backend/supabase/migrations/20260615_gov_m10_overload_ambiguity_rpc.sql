-- =====================================================
-- __gov_m10_overload_ambiguity — read-only introspection RPC
-- Date: 2026-06-15
-- Refs: __gov_m1..m9 (governed introspection family — same pattern)
--       .claude/skills/runtime-truth-audit/checks/rpc-overload-ambiguity.md (logic source)
--       #993 (create_order_atomic PGRST203 → 24-day checkout outage), guard #997
-- =====================================================
--
-- Why: the deterministic `rpc-overload-ambiguity` runner must detect PostgREST
-- function-overload ambiguity (PGRST203 "could not choose the best candidate
-- function") — the class that broke checkout for 24 days. pg_proc is not
-- reachable via PostgREST, so we EXTEND the governed `__gov_*` family with one
-- read-only function. Postgres is the source of truth for signatures (no
-- SQL-text parsing). Extension-owned functions (pgvector/unaccent) are excluded.
--
-- Returns one row per public, non-extension function whose overloads are
-- ambiguous for a PostgREST named-arg call:
--   - subset_default : arg-names(A) ⊆ arg-names(B) and B's extra args are defaulted
--   - type_only      : two overloads share identical arg-names, differ only by type
--
-- Security: EXECUTE restricted to service_role. Report-only; no mutation.

set lock_timeout = '2s';
set statement_timeout = '10s';

create or replace function public.__gov_m10_overload_ambiguity()
  returns table (function_name text, ambiguity_kind text, overload_count integer)
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  with pub_fns as (
    select p.oid, p.proname,
           coalesce((select array_agg(an order by an)
                     from unnest(p.proargnames[1:p.pronargs]) an), '{}'::text[]) as in_names,
           p.pronargs, p.pronargdefaults
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (
        select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
      )
  ),
  overloaded as (
    select proname from pub_fns group by proname having count(*) > 1
  ),
  ambiguous as (
    select distinct a.proname,
           case when a.in_names <@ b.in_names and b.in_names <@ a.in_names
                then 'type_only' else 'subset_default' end as kind
    from pub_fns a
    join pub_fns b on a.proname = b.proname and a.oid < b.oid
    where a.proname in (select proname from overloaded)
      and (
        (a.in_names <@ b.in_names and (b.pronargs - a.pronargs) <= b.pronargdefaults)
        or (a.in_names <@ b.in_names and b.in_names <@ a.in_names)
      )
  )
  select am.proname::text                          as function_name,
         string_agg(distinct am.kind, ',' order by am.kind)::text as ambiguity_kind,
         (select count(*)::int from pub_fns pf where pf.proname = am.proname) as overload_count
  from ambiguous am
  group by am.proname;
$function$;

revoke all on function public.__gov_m10_overload_ambiguity() from public;
grant execute on function public.__gov_m10_overload_ambiguity() to service_role;

comment on function public.__gov_m10_overload_ambiguity() is
  'Read-only introspection (Trust Ledger B0a): public, non-extension functions with PostgREST-ambiguous overloads (PGRST203 class, #993). Consumed by scripts/audit/runtime-truth/rpc-overload-ambiguity.ts. service_role only.';
