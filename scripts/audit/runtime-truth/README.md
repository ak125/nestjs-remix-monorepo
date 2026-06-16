# Runtime-Truth deterministic runners (Trust Ledger PR-B0a)

Deterministic SQL/AST ports of the `runtime-truth-audit` skill checks. The skill
remains the **source of logic** (`.claude/skills/runtime-truth-audit/checks/*.md`);
these runners are the **recurrent, reproducible** implementation (no LLM in CI).

Each runner emits one contract JSON to `audit-reports/runtime-truth/<check>.json`
(schema: [`contract.ts`](contract.ts)), consumed by
[`scripts/audit/build-trust-ledger.ts`](../build-trust-ledger.ts) — coverage
`MANUAL → RECURRING`; `health_status` carries the real result. **Two axes:**
`coverage_status` (does a check exist) ≠ `health_status` (its result).

Report-only: writes **nothing** to the database. DB access is via the existing
supabase-js layer calling governed read-only `__gov_*` introspection RPCs — no
`pg` dependency, no new connection secret.

## Checks

| Check | RPC | Severity | Detects |
|---|---|---|---|
| `pg-stable-write` | `__gov_m7_stable_function_volatility()` | critical | STABLE/IMMUTABLE functions that write (PostgREST read-only tx ⇒ silent 5xx, incident #693) |
| `partition-cron-gap` | `__gov_m8_partition_coverage()` | critical | RANGE-partitioned tables about to exhaust partitions, no DEFAULT, no rotation cron ("no partition found", incidents #697/#698) |
| `rpc-registry-drift` | `__gov_m9_callable_functions()` | medium | code calls `.rpc('x')` where `x` exists in no schema (silent feature breakage; found 7 live — incl. `increment_advice_views`, `execute_sql`) |
| `rpc-overload-ambiguity` | `__gov_m10_overload_ambiguity()` | critical | public, non-extension functions with PostgREST-ambiguous overloads → PGRST203 "could not choose the best candidate" (the create_order_atomic 24-day checkout outage, #993; guard skill #997) |

_Roadmap (same framework): `attribution-write-gap`, `nest-dead-services`, `orphan-runtime-flags`._

## Run

```bash
# env-gated: needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY; degrades to skip without
tsx scripts/audit/runtime-truth/pg-stable-write.ts
```

No creds ⇒ skips (PR lane). RPC absent ⇒ emits `health_status: UNKNOWN` (never crashes).

## Owner-gated steps (deploy-after-migrate)

1. **Apply** the read-only migration `backend/supabase/migrations/20260614_gov_m7_stable_function_volatility_rpc.sql` (additive, `SECURITY DEFINER`, `service_role` only). Until applied, the runner reports `UNKNOWN`.
2. **Wire recurrence** — a scheduled CI job invoking the runner (`.github/workflows/*`) is owner-gated and lands separately (Livrable C / a dedicated B0a workflow).

## Test

```bash
tsx --test scripts/audit/runtime-truth/*.test.ts   # pure logic, no live DB
```
