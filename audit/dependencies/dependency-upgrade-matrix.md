# Dependency Upgrade Matrix — PR-9a snapshot (2026-05-17)

> Generated from `audit/dependencies/dependency-modernization-inventory.json`.
> Rule: **No global latest upgrade. One family per PR. One rollback. One CI proof. One runtime-risk analysis. No cross-family PR. Rollback drillable inside RTO. Perf baseline mandatory where required. User impact declared up front. Recovery sequence written and rehearsed. State surface declared. Canary aborts quantitative. Parallel window capped. Peer clusters frozen — wildcards never reach the artifact. Data loss class named, not conflated with rollback complexity. Runtime entrypoints declared. On-call team named. Canary duration bounded. Automated orchestrators NEVER initiate rollback when human approval is required.**

The 12 tables below are **generated** by `scripts/audit/render-dependency-modernization-matrix.ts`
between `<!-- AUTO-TABLE -->` fence markers. Do not hand-edit the table bodies —
edit `family-overlay.yaml` and re-run the renderer.

Prose surrounding the tables (reading guides, callouts) is human-edited.

---

## Table 1 — Upgrade plan (what / why / how)

<!-- AUTO-TABLE:upgrade-plan START -->
| Family | Blast radius | Target major | PR | Upgrade strategy | Runtime criticality |
| --- | --- | --- | --- | --- | --- |
| auth-session-passport | auth | see source_url | pr-9e | abstraction-first | critical |
| data-supabase | data | see source_url | deferred | staged-rollout | critical |
| internal-workspace | internal | workspace | deferred | in-place | medium |
| observability-otel | observability | see source_url | deferred | in-place | medium |
| queues-bullmq | queues | 5.x | pr-9d | staged-rollout | high |
| runtime-backend-nest | runtime-backend | 11.x | pr-9f | staged-rollout | critical |
| runtime-backend-platform-fastify | runtime-backend | fastify-5.x | pr-9g | spike-only | medium |
| runtime-frontend-remix-vite | runtime-frontend | see source_url | deferred | staged-rollout | critical |
| tooling-prettier-husky | tooling | see source_url | deferred | in-place | low |
| tooling-typescript-eslint | tooling | locked-at-execution | pr-9b | in-place | low |
| tooling-typescript-go | tooling | tsc-go-preview | deferred | benchmark-only | low |
| validation-zod | validation | 4.x | pr-9c | staged-rollout | high |
<!-- AUTO-TABLE:upgrade-plan END -->

## Table 2 — Execution metadata (how to ship)

<!-- AUTO-TABLE:execution START -->
| Family | Soak (h) | Node | Deployment sequence | Production approved |
| --- | --- | --- | --- | --- |
| auth-session-passport | 48 | >=20 | dual-runtime, canary, full-rollout | ✓ |
| data-supabase | 72 | >=20 | canary, full-rollout | ✓ |
| internal-workspace | 0 | >=20 | n/a | ✓ |
| observability-otel | 0 | >=20 | n/a | ✓ |
| queues-bullmq | 48 | >=20 | workers-first, api-second, full-rollout | ✓ |
| runtime-backend-nest | 72 | >=20 | canary, full-rollout | ✓ |
| runtime-backend-platform-fastify | 0 | >=20 | n/a | ✗ |
| runtime-frontend-remix-vite | 72 | >=20 | n/a | ✓ |
| tooling-prettier-husky | 0 | >=20 | n/a | ✓ |
| tooling-typescript-eslint | 0 | >=20 | n/a | ✓ |
| tooling-typescript-go | 0 | >=20 | n/a | ✗ |
| validation-zod | 24 | >=20 | api-second, canary, full-rollout | ✓ |
<!-- AUTO-TABLE:execution END -->

## Table 3 — Governance metadata (rollback / blockers / observability)

<!-- AUTO-TABLE:governance START -->
| Family | Rollback complexity | Migration blockers | Observability requirements |
| --- | --- | --- | --- |
| auth-session-passport | dangerous | Node20Required, ConnectRedisV8RedisClientV4Required, AuthServiceAbstractionMerged | sentry, session-roundtrip, structured-logs |
| data-supabase | dangerous | Node20Required, SupabaseRealtimeV2Compatible | sentry, structured-logs, health-endpoint |
| internal-workspace | moderate | [] | structured-logs |
| observability-otel | moderate | Node20Required | structured-logs, traces |
| queues-bullmq | dangerous | Node20Required, RedisServerCompatibilityVerified | queue-metrics, structured-logs, sentry |
| runtime-backend-nest | dangerous | Node20Required, Express5CompatibilityAuditPassed, RxJS7Required, PR9eMerged | sentry, structured-logs, health-endpoint, traces |
| runtime-backend-platform-fastify | trivial | PR9fMerged | structured-logs |
| runtime-frontend-remix-vite | dangerous | React19Stable, Vite6EcosystemReady, Node20Required | sentry, structured-logs, synthetic-crawler |
| tooling-prettier-husky | trivial | [] | [] |
| tooling-typescript-eslint | trivial | Node20Required | [] |
| tooling-typescript-go | trivial | NotProductionReady | [] |
| validation-zod | moderate | Node20Required, TypeScript5xRequired | sentry, structured-logs |
<!-- AUTO-TABLE:governance END -->

**Reading guide:**
- `rollback_complexity: dangerous` ⇒ PR body MUST contain a written rollback runbook.
- `migration_blockers` ⇒ every token MUST resolve to a merged PR / verified configuration / shipped upstream release BEFORE opening the family's PR.
- `observability_requirements` ⇒ every signal MUST be live and ingesting from the PREPROD container (49.12.233.2:3200) BEFORE the family's prod tag — CI green is not enough.

## Table 4 — Operational metadata (data migration / dual runtime / RTO / ownership / perf baseline)

<!-- AUTO-TABLE:operational START -->
| Family | Data migration | Dual runtime | RTO (min) | Owner domain | Perf baseline |
| --- | --- | --- | --- | --- | --- |
| auth-session-passport | yes | full | 30 | auth, backend-runtime | no |
| data-supabase | yes | partial | 30 | data, backend-runtime | no |
| internal-workspace | no | none | 15 | platform-tooling | no |
| observability-otel | no | full | 15 | observability | no |
| queues-bullmq | yes | partial | 60 | queues, backend-runtime | no |
| runtime-backend-nest | no | none | 60 | backend-runtime, platform-tooling | yes |
| runtime-backend-platform-fastify | no | full | 5 | backend-runtime | yes |
| runtime-frontend-remix-vite | no | none | 60 | frontend-runtime | yes |
| tooling-prettier-husky | no | none | 5 | platform-tooling | no |
| tooling-typescript-eslint | no | none | 30 | platform-tooling | no |
| tooling-typescript-go | no | full | 5 | platform-tooling | yes |
| validation-zod | no | none | 15 | platform-validation, backend-runtime | no |
<!-- AUTO-TABLE:operational END -->

**Reading guide:**
- `data_migration_required: yes` ⇒ rollback runbook MUST cover the data-side rollback.
- `supports_dual_runtime`: `full` ⇒ may use `dual-runtime` deployment stage; `partial` ⇒ split deployment; `none` ⇒ atomic swap mandatory, banner/maintenance window needed.
- `rollback_rto_minutes` ⇒ rollback runbook MUST be drillable inside this window. Drill on the PREPROD container once during the soak period.
- `upgrade_owner_domain` ⇒ map to `repository-registry` ownership domains (ADR-058). Every domain MUST have a named human owner via CODEOWNERS / ownership.yaml — never `__unassigned__`.
- `requires_perf_baseline: yes` ⇒ PR body MUST contain before/after measurement on `/api/_perf` or equivalent baseline. No baseline = no merge.

## Table 5 — Control-plane metadata (machine-readable for orchestrators / CI / PR validators)

<!-- AUTO-TABLE:control-plane START -->
| Family | Runbook required | User impact | Perf metrics | Recovery sequence |
| --- | --- | --- | --- | --- |
| auth-session-passport | true | forced-signout, banner-display | [] | deploy-banner, disable-canary, rollback-api, invalidate-new-format-cookies, verify-session-roundtrip |
| data-supabase | true | short-api-restart | [] | disable-canary, rollback-api, supabase-realtime-channel-rollback, verify-health-endpoint |
| internal-workspace | false | none | [] | changeset-rollback, rebuild |
| observability-otel | false | none | [] | revert-pr, verify-log-format |
| queues-bullmq | true | queue-delay | [] | disable-canary, rollback-workers, drain-v5-queue, re-emit-repeatables, rollback-api, verify-queue-metrics |
| runtime-backend-nest | true | short-api-restart | cold-start, p99, memory | disable-canary, rollback-api, prepare-express-ratchet-pr, prepare-rxjs-ratchet-pr, verify-health-endpoint, verify-traces-continuity |
| runtime-backend-platform-fastify | false | none | cold-start, p99, memory | revert-spike-branch |
| runtime-frontend-remix-vite | true | page-reload-required, cdn-cache-flush | hydration-time, lcp, bundle-size | revert-pr, cdn-flush, redeploy, verify-synthetic-crawler |
| tooling-prettier-husky | false | none | [] | revert-pr |
| tooling-typescript-eslint | false | none | [] | revert-pr, regenerate-types |
| tooling-typescript-go | false | none | build-time, memory | revert-benchmark-branch |
| validation-zod | false | short-api-restart | [] | disable-canary, rollback-api, redeploy, verify-form-submit-smoke |
<!-- AUTO-TABLE:control-plane END -->

**Reading guide:**
- `rollback_runbook_required: true` ⇒ PR validators / CI / orchestrators consume this directly. Schema invariant: `rollback_complexity: dangerous` forces this to `true` — cannot be relaxed.
- `expected_user_impact` ⇒ release notes + customer comms + support triage MUST mention each impact token. `[none]` is explicit.
- `perf_baseline_metrics` ⇒ exactly which numbers to capture. Schema invariant: `requires_perf_baseline: true` (on production-approved families) forces this to be non-empty.
- `estimated_recovery_sequence` ⇒ ordered, drillable on the PREPROD container during the soak window. Schema invariant: `dangerous` forces this to be non-empty. Each step is a kebab-case token greppable across PRs.

## Table 6 — State + canary metadata (state surface / abort thresholds / parallel windows)

<!-- AUTO-TABLE:state-canary START -->
| Family | Stateful surface | Rollback validation checks | Canary abort conditions | Runtime state coupling | Safe parallel window (min) |
| --- | --- | --- | --- | --- | --- |
| auth-session-passport | redis-sessions, cookies | session-roundtrip, no-sentry-spike, health-endpoint-ok | sentry-error-rate-spike, session-roundtrip-fail, p99-regression-20pct | redis, cookies | 1440 |
| data-supabase | realtime-channels | health-endpoint-ok, no-sentry-spike | sentry-error-rate-spike, p99-regression-20pct, health-endpoint-fail | realtime-channels | 120 |
| internal-workspace | none | none | [] | none | 0 |
| observability-otel | none | traces-continuity | [] | none | 1440 |
| queues-bullmq | repeatable-jobs, redis-cache | queue-depth-stable, no-sentry-spike, health-endpoint-ok | queue-backlog-growth, sentry-error-rate-spike, p99-regression-20pct | redis, queue-ids | 60 |
| runtime-backend-nest | none | health-endpoint-ok, traces-continuity, no-sentry-spike | p99-regression-20pct, cold-start-regression-30pct, sentry-error-rate-spike, health-endpoint-fail | none | 0 |
| runtime-backend-platform-fastify | none | none | [] | none | 1440 |
| runtime-frontend-remix-vite | hydration-cache | synthetic-crawler-green, no-sentry-spike | [] | cdn, dom | 0 |
| tooling-prettier-husky | none | none | [] | none | 0 |
| tooling-typescript-eslint | none | none | [] | none | 0 |
| tooling-typescript-go | none | none | [] | none | 1440 |
| validation-zod | none | form-submit-smoke, no-sentry-spike | sentry-error-rate-spike, p99-regression-15pct | none | 0 |
<!-- AUTO-TABLE:state-canary END -->

**Reading guide:**
- `stateful_surface` ⇒ "where the state actually lives" — incident triage starts here.
- `rollback_validation_checks` ⇒ "rollback is not done until these pass" — drill on the PREPROD container during soak.
- `canary_abort_conditions` ⇒ "what makes us pull the plug" — quantitative thresholds, not vibes.
- `runtime_state_coupling` ⇒ "what primitives we touch" — drives blast analysis at PR-review time.
- `safe_parallel_window_minutes` ⇒ "max minutes the dual-runtime can be live" — infinite dual-runtime is a lie; banner / canary coordination caps this. `0` = atomic swap (dual_runtime=none).

## Table 7 — Orchestration metadata (data loss / runtime entrypoints / on-call / canary duration / human approval)

<!-- AUTO-TABLE:orchestration START -->
| Family | Data loss risk | Runtime entrypoints | Operational owner | Canary duration (min) | Human approval |
| --- | --- | --- | --- | --- | --- |
| auth-session-passport | partial-loss | api, ssr | auth-team | 120 | true |
| data-supabase | partial-loss | api, workers | data-team | 60 | true |
| internal-workspace | none | build-only | platform-tooling-team | 0 | false |
| observability-otel | none | api, workers | observability-team | 0 | false |
| queues-bullmq | replayable | workers, cron | queues-team | 0 | true |
| runtime-backend-nest | none | api, workers, cron, ssr | backend-runtime-team | 60 | true |
| runtime-backend-platform-fastify | none | api | backend-runtime-team | 0 | false |
| runtime-frontend-remix-vite | none | ssr, edge | frontend-runtime-team | 0 | true |
| tooling-prettier-husky | none | build-only | platform-tooling-team | 0 | false |
| tooling-typescript-eslint | none | build-only | platform-tooling-team | 0 | false |
| tooling-typescript-go | none | build-only | platform-tooling-team | 0 | false |
| validation-zod | none | api, workers, ssr | platform-validation-team | 60 | false |
<!-- AUTO-TABLE:orchestration END -->

**Reading guide:**
- `rollback_data_loss_risk`: `none` ⇒ rollback is loss-free; `replayable` ⇒ state re-emission required; `partial-loss` ⇒ user-visible state lost but data not destroyed; `irreversible` ⇒ data destruction (none in PR-9 scope).
- `runtime_entrypoints`: drives canary sequencing.
- `operational_owner`: kebab-case team slug ending in `-team`. Maps to PagerDuty schedule / Slack on-call channel.
- `estimated_canary_duration_minutes`: > 0 if `canary` in `deployment_sequence` (schema-enforced). Drives canary-watchdog timeout.
- `rollback_requires_human_approval`: `true` ⇒ automated orchestrators may DETECT abort conditions but a human INITIATES the recovery sequence.

## Table 8 — Lifecycle + planning metadata (drill audit / incompat / cost / SLO)

<!-- AUTO-TABLE:lifecycle-planning START -->
| Family | Drill (tested_at / commit) | Known incompatible families | Engineer days | Review load | Runtime SLO impact |
| --- | --- | --- | --- | --- | --- |
| auth-session-passport | null / null | data-supabase | 14 | extreme | auth-success-rate, api-p99 |
| data-supabase | null / null | auth-session-passport | 7 | high | api-p99, realtime-latency |
| internal-workspace | null / null | [] | 1 | low | [] |
| observability-otel | null / null | [] | 3 | low | [] |
| queues-bullmq | null / null | runtime-backend-nest | 7 | high | queue-latency, queue-throughput |
| runtime-backend-nest | null / null | runtime-backend-platform-fastify, queues-bullmq | 12 | extreme | api-p99, cold-start, container-startup |
| runtime-backend-platform-fastify | null / null | runtime-backend-nest | 5 | medium | [] |
| runtime-frontend-remix-vite | null / null | [] | 21 | extreme | lcp, hydration-time |
| tooling-prettier-husky | null / null | [] | 2 | low | [] |
| tooling-typescript-eslint | null / null | [] | 5 | medium | [] |
| tooling-typescript-go | null / null | [] | 3 | low | [] |
| validation-zod | null / null | [] | 10 | high | api-p99 |
<!-- AUTO-TABLE:lifecycle-planning END -->

**Reading guide:**
- `rollback_tested_at` + `rollback_drill_commit` are NULL at PR-9a generation time. The actual upgrade PR (PR-9b..9g) MUST set them BEFORE the prod tag.
- `known_incompatible_families`: orchestrators MUST NOT schedule these in parallel.
- `upgrade_cost_estimate`: total engineer-days = sum across families — informs sprint capacity and review-board scheduling.
- `runtime_slo_impact`: the SLOs whose error budget is consumed during the upgrade window. Critical/high families MUST declare at least one (schema-enforced).

## Table 9 — Runtime DAG + canary auto-evaluation (DAG edges / preconditions / SLI queries / state version / blast scope)

<!-- AUTO-TABLE:runtime-dag START -->
| Family | depends_on_runtime | Rollback preconditions | SLI queries (count) | State schema version | Rollback blast scope |
| --- | --- | --- | --- | --- | --- |
| auth-session-passport | [] | banner-deployed, dual-runtime-active, canary-disabled | 2 | session-v7 | api, sessions |
| data-supabase | auth-session-passport | no-realtime-active, canary-disabled | 2 | supabase-v2 | api, workers, realtime |
| internal-workspace | [] | [] | 0 | n/a | none |
| observability-otel | [] | [] | 0 | n/a | none |
| queues-bullmq | [] | queue-drained, no-active-migrations, canary-disabled | 2 | bullmq-v4 | workers, queue, api |
| runtime-backend-nest | auth-session-passport, validation-zod, queues-bullmq | canary-disabled, express-ratchet-pr-ready, rxjs-ratchet-pr-ready | 3 | n/a | api, workers, sessions, ssr |
| runtime-backend-platform-fastify | runtime-backend-nest | [] | 0 | n/a | none |
| runtime-frontend-remix-vite | [] | cdn-purge-ready, canary-disabled | 2 | n/a | ssr, cdn |
| tooling-prettier-husky | [] | [] | 0 | n/a | none |
| tooling-typescript-eslint | [] | [] | 0 | n/a | none |
| tooling-typescript-go | [] | [] | 0 | n/a | none |
| validation-zod | [] | canary-disabled | 1 | n/a | api, workers, ssr |
<!-- AUTO-TABLE:runtime-dag END -->

**Reading guide:**
- `depends_on_runtime`: runtime DAG edges, orthogonal to `migration_blockers` (PR sequencing) and `known_incompatible_families` (parallel scheduling).
- `rollback_preconditions`: hard preconditions that MUST hold before rollback may begin. Schema-enforced: `dangerous` ⇒ at least one.
- `observability_sli_queries`: SLO ID → Prometheus/Loki query. Empty at PR-9a time is OK (fill at PR-9b..9g kickoff).
- `state_schema_version`: identifier of the persisted-state shape. `n/a` means stateless. Drift detection between rolled-back code and live state uses this.
- `rollback_blast_scope`: surfaces TOUCHED by rollback.

## Table 10 — Platform-engineering metadata (capabilities / failure domain / confidence / transition strategy / comms)

<!-- AUTO-TABLE:platform-engineering START -->
| Family | Runtime capabilities | Failure domain | Rollback confidence | State transition strategy | Incident comm protocol |
| --- | --- | --- | --- | --- | --- |
| auth-session-passport | supports-canary, supports-dual-write | authentication | theoretical | dual-write | status-page, banner, email-notification |
| data-supabase | supports-canary | data-layer | theoretical | lazy-migration | status-page |
| internal-workspace | supports-feature-flag | tooling | theoretical | none | none |
| observability-otel | none | observability | theoretical | none | none |
| queues-bullmq | supports-feature-flag | queues | theoretical | replay | status-page, support-ticket-tag |
| runtime-backend-nest | supports-canary | api-runtime | theoretical | none | status-page, slack-channel |
| runtime-backend-platform-fastify | supports-shadow | api-runtime | theoretical | none | none |
| runtime-frontend-remix-vite | supports-canary | seo-rendering, frontend-ssr | theoretical | hard-cut | status-page, banner |
| tooling-prettier-husky | none | tooling | theoretical | none | none |
| tooling-typescript-eslint | none | tooling | theoretical | none | none |
| tooling-typescript-go | supports-shadow | tooling | theoretical | none | none |
| validation-zod | supports-canary | api-runtime | theoretical | none | status-page |
<!-- AUTO-TABLE:platform-engineering END -->

**Reading guide:**
- `runtime_capabilities`: orchestrators consult this list BEFORE scheduling — replaces heuristic inference from `deployment_sequence`.
- `failure_domain`: abstract incident-routing category. Multiple domains OK.
- `rollback_confidence_level`: ALL families start `theoretical` at PR-9a. Each PR-9b..9g MUST elevate to at least `drilled` before prod tag.
- `state_transition_strategy`: NOT inferable from `data_migration_required` alone — must be NAMED. Schema-enforced: `data_migration_required: true` ⇒ strategy ≠ `none`.
- `incident_comm_protocol`: schema-enforced — any non-`none` `expected_user_impact` ⇒ at least one comm protocol.

## Table 11 — Contract + orchestration metadata (compat contracts / freeze window / orchestrator policy / lineage / state compat window)

<!-- AUTO-TABLE:contract-orchestration START -->
| Family | Compatibility contracts | Freeze window | Orchestrator policy | Lineage supersedes | State compat window (min) |
| --- | --- | --- | --- | --- | --- |
| auth-session-passport | session-cookie-v7, connect-redis-v7 | 22:00→06:00 | {manual-only, canary-only} | [] | 1440 |
| data-supabase | supabase-v2 | 22:00→06:00 | {manual-only, staged} | [] | 120 |
| internal-workspace | [] | null | {auto-allowed, staged} | [] | 0 |
| observability-otel | pino-v8 | null | {auto-allowed, staged} | [] | 1440 |
| queues-bullmq | bullmq-jobid-v4, ioredis-v5 | 22:00→06:00 | {manual-only, staged} | [] | 120 |
| runtime-backend-nest | nestjs-v10, express-v4, rxjs-v6 | 22:00→06:00 | {manual-only, canary-only} | [] | 0 |
| runtime-backend-platform-fastify | nestjs-platform-fastify-v0 | null | {manual-only, staged} | [] | 0 |
| runtime-frontend-remix-vite | remix-v2, vite-v5, react-v18 | 22:00→06:00 | {manual-only, atomic} | [] | 0 |
| tooling-prettier-husky | prettier-v3 | null | {auto-allowed, atomic} | [] | 0 |
| tooling-typescript-eslint | typescript-v5 | null | {manual-only, atomic} | [] | 0 |
| tooling-typescript-go | [] | null | {auto-allowed, staged} | [] | 0 |
| validation-zod | zod-v3 | null | {auto-allowed, staged} | [] | 0 |
<!-- AUTO-TABLE:contract-orchestration END -->

**Reading guide:**
- `compatibility_contracts`: versioned wire/state contracts. PR-9b..9g supersede these with `-v(N+1)`.
- `runtime_freeze_window`: stateful families (queues / auth / Nest / Remix / data) deploy overnight only.
- `orchestrator_policy.rollback_mode`: schema-enforced to `manual-only` when `rollback_requires_human_approval: true`.
- `dependency_lineage.supersedes`: empty at PR-9a (first iteration). PR-9b..9g will populate.
- `state_compatibility_window_minutes`: window during which old + new state shapes can both be read by the receiving code. `dual-write` ⇒ schema-enforced `> 0`.

## Table 12 — Budget + reconciliation + lock + grace + expiry

<!-- AUTO-TABLE:budget-reconciliation START -->
| Family | Runtime budget constraints | Duplicate resolution | Lock scope | Grace period (min) | Contract expiry |
| --- | --- | --- | --- | --- | --- |
| auth-session-passport | {} | latest-write-wins | sessions-table, auth | 30 | 2026-12-31 |
| data-supabase | {} | latest-write-wins | realtime-channels, data-layer | 30 | 2027-06-30 |
| internal-workspace | {} | n/a | [] | 0 | null |
| observability-otel | {} | n/a | [] | 5 | null |
| queues-bullmq | {} | latest-write-wins | queues, workers | 15 | 2026-12-31 |
| runtime-backend-nest | {p99:10%, memory:15%, cold-start:20%} | n/a | backend-runtime | 20 | 2027-06-30 |
| runtime-backend-platform-fastify | {} | n/a | [] | 0 | null |
| runtime-frontend-remix-vite | {p99:10%, lcp:15%} | n/a | frontend-runtime, cdn-cache | 30 | null |
| tooling-prettier-husky | {} | n/a | [] | 0 | null |
| tooling-typescript-eslint | {} | n/a | [] | 0 | null |
| tooling-typescript-go | {memory:50%} | n/a | [] | 0 | null |
| validation-zod | {} | n/a | validation | 5 | null |
<!-- AUTO-TABLE:budget-reconciliation END -->

**Reading guide:**
- `runtime_budget_constraints`: percent regression caps. Canary watchdogs read these as hard abort triggers. Empty `{}` for spike/benchmark families (they measure without gating).
- `state_reconciliation_strategy.duplicate_resolution`: schema-enforced `≠ n/a` when `state_transition_strategy ∈ {dual-write, replay}`.
- `orchestrator_lock_scope`: orchestrators MUST acquire ALL listed locks before deploy.
- `rollback_observability_grace_period_minutes`: silence alerts for this window after rollback completes.
- `runtime_contract_expiry`: ISO date by which the family's CURRENT compatibility contracts MUST be superseded. Prevents dual-write zombies.

---

## Peer dependency clusters (frozen at generation time — resolved against deps.json)

> **Central rule #24:** The overlay may use patterns (`@nestjs/*`, `eslint-plugin-*`) for ergonomics, but the inventory artifact emits `peer_dependency_cluster_resolved` — the explicit, sorted, deterministic list expanded against `audit/registry/deps.json`. **Wildcards never reach the artifact.** Future agents read the resolved list, never the patterns.

<!-- AUTO-TABLE:peer-clusters START -->
| Family | Overlay patterns | Resolved members (frozen) |
| --- | --- | --- |
| auth-session-passport | passport, @nestjs/passport, passport-local, passport-jwt, express-session, connect-redis, @nestjs/jwt | @nestjs/jwt, @nestjs/passport, connect-redis, express-session, passport, passport-jwt, passport-local |
| data-supabase | @supabase/supabase-js | @supabase/supabase-js |
| observability-otel | pino, pino-pretty | pino, pino-pretty |
| queues-bullmq | bullmq, @nestjs/bullmq, @nestjs/bull, bull, ioredis | @nestjs/bull, @nestjs/bullmq, bull, bullmq, ioredis |
| runtime-backend-nest | @nestjs/*, rxjs, reflect-metadata, body-parser | @nestjs/bull, @nestjs/bullmq, @nestjs/cache-manager, @nestjs/cli, @nestjs/common, @nestjs/config, @nestjs/core, @nestjs/event-emitter, @nestjs/jwt, @nestjs/passport, @nestjs/platform-express, @nestjs/platform-socket.io, @nestjs/schedule, @nestjs/schematics, @nestjs/swagger, @nestjs/testing, @nestjs/throttler, @nestjs/websockets, body-parser, reflect-metadata, rxjs |
| runtime-backend-platform-fastify | @nestjs/platform-fastify | @nestjs/platform-fastify |
| runtime-frontend-remix-vite | @remix-run/*, react, react-dom, vite | @remix-run/dev, @remix-run/eslint-config, @remix-run/express, @remix-run/node, @remix-run/react, @remix-run/serve, @remix-run/server-runtime, react, react-dom, vite |
| tooling-typescript-eslint | typescript, eslint, @typescript-eslint/*, eslint-plugin-*, eslint-config-prettier | @typescript-eslint/eslint-plugin, @typescript-eslint/parser, eslint, eslint-config-prettier, eslint-plugin-import, eslint-plugin-jsx-a11y, eslint-plugin-prettier, eslint-plugin-react, eslint-plugin-react-hooks, eslint-plugin-storybook, typescript |
| validation-zod | zod, zod-to-json-schema | zod, zod-to-json-schema |
<!-- AUTO-TABLE:peer-clusters END -->

> **Partial cluster upgrade is forbidden** (central rule #6). Splitting a cluster across two PRs causes peer-dep deadlock.
> **Wildcard freeze drill:** between two generator runs, `peer_dependency_cluster_resolved` MUST be byte-identical for unchanged `deps.json`. Drift = upstream added/removed a peer package — flag in PR review.

## Divergence callouts

The inventory flags packages installed at 2+ specifier strings or 2+ resolved
versions. These MUST be aligned **before** the family's upgrade PR (otherwise
the upgrade just propagates drift). Read the `divergences` array in the JSON
artifact for the canonical list.

## Experimental / non-prod-approved (hard veto)

Two families have `production_approved: false` and **must never be promoted to
production** regardless of CI signal:

| Family | Reason |
|---|---|
| `runtime-backend-platform-fastify` | `spike-only` — parallel branch to measure Fastify cold-start/p99. Production swap = separate PR-9h after evidence review. |
| `tooling-typescript-go` | `benchmark-only` — TS native (Go) port observation. Build-speed measurement only. Never a runtime target. |

A future agent reading the overlay must treat `production_approved: false` as
a hard veto on prod tagging — no exceptions.

## Inventory artifact top-level fields (consumed by replay verifiers)

| Field | Value | Source |
|---|---|---|
| `inventoryFormat` | `pr-9-modernization-inventory` | literal |
| `schemaVersion` | `1.0.0` | literal |
| `matrixVersion` | `pr9-v1` | literal |
| `artifact_immutability_hash` | `sha256:<64 hex>` | computed from `deps_registry_sha + overlay_sha + lockfile_sha` |
| `generatedFrom.deps_registry_sha` | `sha256:<64 hex>` | file SHA |
| `generatedFrom.overlay_sha` | `sha256:<64 hex>` | file SHA |
| `generatedFrom.lockfile_sha` | `sha256:<64 hex>` | file SHA |

**Replay determinism contract:** two generator runs with byte-identical inputs MUST produce identical `artifact_immutability_hash`. Drift = inputs changed — investigate before consuming the artifact.
