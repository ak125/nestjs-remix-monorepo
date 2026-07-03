-- =====================================================
-- __gov_m7_stable_function_volatility — read-only introspection RPC
-- Date: 2026-06-14
-- Refs: __gov_m1_table_sizes … __gov_m6_unused_indexes (governed introspection
--         family — same pattern: LANGUAGE sql, SECURITY DEFINER, search_path public)
--       .claude/skills/runtime-truth-audit/checks/pg-stable-write.md (logic source)
--       reference_postgrest_stable_function_write_readonly.md (incident #693)
--       Plan: Trust Ledger PR-B0a (deterministic runtime-truth runners)
-- =====================================================
--
-- Why: the deterministic `pg-stable-write` runner (scripts/audit/runtime-truth/)
-- must read pg_proc.{provolatile,prosrc} to detect STABLE/IMMUTABLE functions
-- whose body writes (→ silent 5xx in PostgREST read-only tx — incident #693).
-- The repo accesses the DB only via supabase-js/PostgREST, which CANNOT read
-- pg_catalog. Rather than invent a `pg` dependency + new DB connection secret,
-- we EXTEND the existing governed `__gov_*` family with one read-only function
-- callable through the established supabase-js `.rpc()` path.
--
-- This function is itself a STABLE read-only function (only SELECTs pg_catalog)
-- — i.e. a correct example of the pattern the check enforces.
--
-- Security: unlike __gov_m1..m6 (EXECUTE granted to public/anon), m7 reads
-- function SOURCE, so EXECUTE is restricted to service_role (the audit runner's
-- role) — public/anon are explicitly revoked. Report-only; no data mutation.

set lock_timeout = '2s';
set statement_timeout = '10s';

create or replace function public.__gov_m7_stable_function_volatility()
  returns table (
    function_name text,
    volatility    text,
    writes        boolean,
    write_ops     text
  )
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  select
    p.proname::text as function_name,
    case p.provolatile
      when 's' then 'STABLE'
      when 'i' then 'IMMUTABLE'
      else p.provolatile::text
    end as volatility,
    (
      p.prosrc ~* '\m(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|TRUNCATE|COPY\s+\w+\s+FROM)\M'
      and p.prosrc !~* '(CREATE\s+TEMP|safe-temp-write)'
    ) as writes,
    coalesce(
      (
        select string_agg(distinct m[1], '; ' order by m[1])
        from regexp_matches(
          p.prosrc,
          '(INSERT\s+INTO\s+\S+|UPDATE\s+\w+\s+SET|DELETE\s+FROM\s+\S+|TRUNCATE\s+\S+|COPY\s+\w+\s+FROM)',
          'gi'
        ) as m
      ),
      ''
    ) as write_ops
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.provolatile in ('s', 'i');
$function$;

revoke all on function public.__gov_m7_stable_function_volatility() from public;
-- Supabase ALTER DEFAULT PRIVILEGES grants EXECUTE to anon/authenticated on every new
-- public function; `revoke ... from public` does NOT remove those direct grants, so we
-- must revoke them explicitly to actually reach service_role-only (verified 2026-07-01).
revoke execute on function public.__gov_m7_stable_function_volatility() from anon, authenticated;
grant execute on function public.__gov_m7_stable_function_volatility() to service_role;

comment on function public.__gov_m7_stable_function_volatility() is
  'Read-only introspection (Trust Ledger B0a): one row per STABLE/IMMUTABLE public function with a writes flag (body contains INSERT/UPDATE/DELETE/TRUNCATE/COPY, excluding TEMP). Consumed by scripts/audit/runtime-truth/pg-stable-write.ts. service_role only.';
