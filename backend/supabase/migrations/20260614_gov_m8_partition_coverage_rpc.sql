-- =====================================================
-- __gov_m8_partition_coverage — read-only introspection RPC
-- Date: 2026-06-14
-- Refs: __gov_m1..m7 (governed introspection family — same pattern)
--       .claude/skills/runtime-truth-audit/checks/partition-cron-gap.md (logic source)
--       reference_partitioned_snapshot_tables_need_premake_cron.md (incidents #697/#698)
--       Plan: Trust Ledger PR-B0a partition-cron-gap runner
-- =====================================================
--
-- Why: the deterministic `partition-cron-gap` runner must read pg_partitioned_table,
-- pg_inherits (partition bounds) and cron.job to detect RANGE-partitioned tables
-- about to exhaust their pre-made partitions (→ "no partition found for row",
-- incidents #697/#698). pg_catalog + the cron schema are NOT reachable via
-- PostgREST, so we EXTEND the governed `__gov_*` family with one read-only
-- function callable through the existing supabase-js `.rpc()` path — no `pg`
-- dependency, no new DB secret.
--
-- Returns one row per RANGE-partitioned public table with the facts the runner
-- classifies (PURE logic): max upper bound, days remaining, default-partition
-- presence (safety net), and whether any partition-maintenance cron exists.
--
-- Security: EXECUTE restricted to service_role (the audit runner's role).
-- Report-only; no data mutation. Itself a STABLE read-only function.

set lock_timeout = '2s';
set statement_timeout = '10s';

create or replace function public.__gov_m8_partition_coverage()
  returns table (
    parent_table      text,
    n_partitions      int,
    has_default       boolean,
    max_upper_bound   date,
    days_remaining    int,
    has_rotation_cron boolean
  )
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  with parts as (
    select parent.relname as tbl,
           pg_get_expr(c.relpartbound, c.oid) as bound
    from pg_partitioned_table pt
    join pg_class parent on parent.oid = pt.partrelid
    join pg_inherits i on i.inhparent = parent.oid
    join pg_class c on c.oid = i.inhrelid
    where pt.partstrat = 'r'
      and parent.relnamespace = 'public'::regnamespace
  ),
  agg as (
    select tbl,
           count(*)::int as n_parts,
           bool_or(bound ilike '%DEFAULT%') as has_default,
           max((substring(bound from 'TO \(''([0-9]{4}-[0-9]{2}-[0-9]{2})'))::date) as max_upper
    from parts
    group by tbl
  )
  select
    a.tbl::text,
    a.n_parts,
    coalesce(a.has_default, false),
    a.max_upper,
    (a.max_upper - current_date)::int as days_remaining,
    exists (
      select 1 from cron.job j
      where j.command ~* '(maintain|ensure_next)[a-z_]*partition'
         or j.command ilike '%' || a.tbl || '%'
    ) as has_rotation_cron
  from agg a;
$function$;

revoke all on function public.__gov_m8_partition_coverage() from public;
grant execute on function public.__gov_m8_partition_coverage() to service_role;

comment on function public.__gov_m8_partition_coverage() is
  'Read-only introspection (Trust Ledger B0a): one row per RANGE-partitioned public table with max upper bound, days_remaining, default-partition presence, and whether a partition-maintenance cron exists. Consumed by scripts/audit/runtime-truth/partition-cron-gap.ts. service_role only.';
