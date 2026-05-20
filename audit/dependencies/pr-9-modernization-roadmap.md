# PR-9 Modernization Roadmap (PR-9a → PR-9g)

> **See also: [`phase-progression-rules.md`](phase-progression-rules.md)** — meta-rules governing PR-9a → PR-12 evidence-gated progression. No phase may expand its perimeter without evidence produced by the previous phase. PR-9b is the smoke test of the entire control plane.

> **Locked sequence. Locked scope per PR. Locked rules** (see `README.md` for the 54 central rules; abbreviated below):
> - one family / one rollback / one CI proof / one runtime-risk analysis
> - no cross-family PR (rule #2)
> - `requires_staging_soak: true` ⇒ observe `staging_soak_hours` on the PREPROD container (49.12.233.2:3200) before any prod tag (rule #3)
> - `production_approved: false` ⇒ NEVER prod (rule #4)
> - verify `node_runtime_requirement` against Dockerfile + CI matrix BEFORE opening the PR (rule #5)
> - upgrade every `peer_dependency_cluster` member together (rule #6) — consume the **resolved** list from `inventory.json`, never the patterns (rule #24)
> - resolve every `migration_blockers` token BEFORE opening the PR (rule #7)
> - `rollback_complexity: dangerous` ⇒ PR body MUST contain a written rollback runbook (rule #8)
> - `observability_requirements` live on the PREPROD container BEFORE prod tag (rule #9)
> - `data_migration_required: true` ⇒ rollback runbook includes data-side rollback (rule #10)
> - `supports_dual_runtime` drives `deployment_sequence` realism (rule #11)
> - rollback runbook MUST be drillable inside `rollback_rto_minutes` (rule #12)
> - `upgrade_owner_domain` MUST map to a named human owner (rule #13)
> - `requires_perf_baseline: true` ⇒ PR body MUST contain before/after measurement (rule #14)
> - `rollback_runbook_required: true` ⇒ machine-readable gate (rule #15)
> - `expected_user_impact` ⇒ release notes + comms + support triage (rule #16)
> - `perf_baseline_metrics` ⇒ named at PR-9a time (rule #17)
> - `estimated_recovery_sequence` ⇒ ordered, drillable on the PREPROD container (rule #18)
> - `stateful_surface` ⇒ where the state lives (rule #19)
> - `rollback_validation_checks` ⇒ rollback isn't done until these pass (rule #20)
> - `canary_abort_conditions` ⇒ quantitative thresholds (rule #21)
> - `runtime_state_coupling` ⇒ runtime primitives touched (rule #22)
> - `safe_parallel_window_minutes` ⇒ infinite dual-runtime is a lie (rule #23)
> - `rollback_data_loss_risk` decouples loss class from complexity (rule #25)
> - `runtime_entrypoints` drives canary sequencing + deploy-tooling routing (rule #26)
> - `operational_owner` (kebab-case `*-team` slug) routes the page (rule #27)
> - `canary` in `deployment_sequence` ⇒ `estimated_canary_duration_minutes > 0` (rule #28)
> - `rollback_requires_human_approval: true` blocks automated orchestrators (rule #29)
> - `rollback_tested_at` + `rollback_drill_commit` MUST be set BEFORE prod tag (rule #30)
> - `known_incompatible_families` MUST NOT be scheduled in parallel (rule #31)
> - `artifact_immutability_hash` is the replay-determinism witness (rule #32)
> - `upgrade_cost_estimate` drives sprint capacity (rule #33)
> - `runtime_slo_impact` declares error-budget consumption (rule #34)
> - `runtime_dependency_edges.depends_on_runtime` declares the runtime DAG (rule #35)
> - `rollback_preconditions` MUST be satisfied before rollback may begin (rule #36)
> - `observability_sli_queries` enables canary auto-evaluation (rule #37)
> - `state_schema_version` enables drift detection (rule #38)
> - `rollback_blast_scope` declares which surfaces are TOUCHED by rollback (rule #39)
> - `runtime_capabilities` declares deploy capabilities explicitly (rule #40)
> - `failure_domain` drives incident routing (rule #41)
> - `rollback_confidence_level` starts `theoretical`; PR-9b..9g elevate to `drilled` (rule #42)
> - `state_transition_strategy` MUST be named (rule #43)
> - `incident_comm_protocol` MUST be declared for any non-`none` user impact (rule #44)
> - `compatibility_contracts` declare versioned wire/state contracts (rule #45)
> - `runtime_freeze_window` blocks deploys outside the named window (rule #46)
> - `orchestrator_policy.rollback_mode` = `manual-only` when human-gated (rule #47)
> - `dependency_lineage.supersedes` builds replay history (rule #48)
> - `state_compatibility_window_minutes` for `dual-write` MUST be `> 0` (rule #49)
> - `runtime_budget_constraints` transform perf baselines into hard canary aborts (rule #50)
> - `state_reconciliation_strategy.duplicate_resolution` MUST be set when `dual-write`/`replay` (rule #51)
> - `orchestrator_lock_scope` MUST be acquired before deploy (rule #52)
> - `rollback_observability_grace_period_minutes` silences alerts during residual-error window (rule #53)
> - `runtime_contract_expiry` prevents dual-write zombies (rule #54)
>
> **Preconditions for the whole series:** PR #567 (PR-8a) shipped. PR-9b..9g hold until PR-8b-1 clarified.

## PR-9a — Control plane (this PR)

- **Family meta:** n/a (audit-only)
- **Scope:** create `audit/dependencies/` (inventory + matrix + roadmap + overlay + README) + generator + schema + tests + matrix codegen.
- **Touches no package.json, no lockfile, no runtime, no Docker, no CI behavior.**
- **CI proof:** existing CI green (no behavioral change). `tsx scripts/audit/build-dependency-modernization-inventory.ts --check` succeeds locally. `tsx scripts/audit/render-dependency-modernization-matrix.ts --check` succeeds locally. `tsx --test scripts/audit/__tests__/*.test.ts` all green.
- **Rollback:** revert the PR. No runtime impact.
- **Runtime risk:** zero (audit-only).

## PR-9b — TypeScript + ESLint

- **Family:** `tooling-typescript-eslint`
- **Family meta:** `upgrade_strategy: in-place`, `runtime_criticality: low`, `requires_staging_soak: false`, `node_runtime_requirement: ">=20"`, `production_approved: true`
- **Rollback complexity:** `trivial` — `git revert` is enough (build-time only).
- **Migration blockers:** `Node20Required`.
- **Observability requirements:** none (build-time only — no runtime signal to gate on).
- **Data migration:** none. **Dual runtime:** `none`. **RTO:** 30 min. **Owner domain:** `platform-tooling`. **Perf baseline:** not required.
- **Control plane:** `rollback_runbook_required: false`. **User impact:** `[none]`. **Perf metrics:** `[]`. **Recovery sequence:** `revert-pr → regenerate-types`.
- **State + canary:** `stateful_surface: [none]`. `rollback_validation_checks: [none]`. `canary_abort_conditions: []`. `runtime_state_coupling: [none]`. `safe_parallel_window_minutes: 0`.
- **Orchestration:** `rollback_data_loss_risk: none`. `runtime_entrypoints: [build-only]`. `operational_owner: platform-tooling-team`. `estimated_canary_duration_minutes: 0`. `rollback_requires_human_approval: false`.
- **Lifecycle:** drill `rollback_tested_at` + `rollback_drill_commit` BEFORE prod tag. `known_incompatible_families: []`. Cost: **5 engineer-days, review_load: medium**. SLO impact: `[]`.
- **Runtime DAG:** `depends_on_runtime: []`. `rollback_preconditions: []`. `observability_sli_queries: {}`. `state_schema_version: n/a`. `rollback_blast_scope: [none]`.
- **Platform:** `runtime_capabilities: [none]`. `failure_domain: [tooling]`. `rollback_confidence_level: theoretical → drilled at PR-9b`. `state_transition_strategy: none`. `incident_comm_protocol: [none]`.
- **Peer cluster patterns:** `typescript`, `eslint`, `@typescript-eslint/*`, `eslint-plugin-*`, `eslint-config-prettier` — consume the RESOLVED list from `peer_dependency_cluster_resolved` in inventory.json, never these patterns (rule #24).
- **Deployment sequence:** n/a (build-time only)
- **Target_major:** locked at execution after compatibility audit (TS 5.x vs TS 6 vs TS 7-Go is a moving target — confirm during PR-9b kickoff, not now)
- **Preconditions:** PR-9a merged. No open `@typescript-eslint/*` divergence in inventory.
- **Scope:** bump every cluster member in one PR. Migrate to ESLint 9 flat config if scope stays manageable, else extract `PR-9b.2 — ESLint 9 flat`.
- **CI proof:** `npm run typecheck && npm run lint` clean across all workspaces. `npm run build` succeeds.
- **Rollback:** revert PR. Lockfile-only revert insufficient (peer-dep drift).
- **Runtime risk:** none — build-time only.

## PR-9c — Zod 4

- **Family:** `validation-zod`
- **Family meta:** `upgrade_strategy: staged-rollout`, `runtime_criticality: high`, `requires_staging_soak: true`, `staging_soak_hours: 24`, `node_runtime_requirement: ">=20"`, `production_approved: true`
- **Rollback complexity:** `moderate` — revert PR; no irreversible data state.
- **Migration blockers:** `Node20Required`, `TypeScript5xRequired` (resolved by PR-9b).
- **Observability requirements:** `sentry`, `structured-logs`.
- **Data migration:** none. **Dual runtime:** `none` (Zod 3+4 cannot cohabit). **RTO:** 15 min. **Owner:** `platform-validation`, `backend-runtime`. **Perf baseline:** not required.
- **Control plane:** `rollback_runbook_required: false`. **User impact:** `[short-api-restart]`. **Perf metrics:** `[]`. **Recovery sequence:** `disable-canary → rollback-api → redeploy → verify-form-submit-smoke`.
- **State + canary:** `stateful_surface: [none]`. `rollback_validation_checks: [form-submit-smoke, no-sentry-spike]`. `canary_abort_conditions: [sentry-error-rate-spike, p99-regression-15pct]`. `runtime_state_coupling: [none]`. `safe_parallel_window_minutes: 0`.
- **Orchestration:** `rollback_data_loss_risk: none`. `runtime_entrypoints: [api, workers, ssr]`. `operational_owner: platform-validation-team`. `estimated_canary_duration_minutes: 60`. `rollback_requires_human_approval: false`.
- **Lifecycle:** drill BEFORE prod tag. `known_incompatible_families: []`. Cost: **10 engineer-days, review_load: high**. SLO: `[api-p99]`.
- **Runtime DAG:** `depends_on_runtime: []`. `rollback_preconditions: [canary-disabled]`. `observability_sli_queries: {api-p99}`. `state_schema_version: n/a`. `rollback_blast_scope: [api, workers, ssr]`.
- **Platform:** `runtime_capabilities: [supports-canary]`. `failure_domain: [api-runtime]`. `rollback_confidence_level: theoretical → drilled at PR-9c`. `state_transition_strategy: none`. `incident_comm_protocol: [status-page]`.
- **Peer cluster:** `zod`, `zod-to-json-schema`.
- **Deployment sequence:** `api-second → canary → full-rollout`
- **Preconditions:** PR-9b merged.
- **Scope:** bump `zod` to 4.x in every workspace simultaneously. Update consumers for defaults / `.email()` / error-formatting API changes.
- **CI proof:** `npm run typecheck && npm run test`. Add 1 sample shape-test per major schema family.
- **PREPROD soak:** 24h on the PREPROD container with synthetic form-submit traffic.
- **Rollback:** revert PR.
- **Runtime risk:** changes parse semantics; every form + DTO path must be re-exercised.

## PR-9d — BullMQ 5

- **Family:** `queues-bullmq`
- **Family meta:** `upgrade_strategy: staged-rollout`, `runtime_criticality: high`, `requires_staging_soak: true`, `staging_soak_hours: 48`, `node_runtime_requirement: ">=20"`, `production_approved: true`
- **Rollback complexity:** **`dangerous`** — Job-ID format change. PR body MUST include the rollback runbook.
- **Migration blockers:** `Node20Required`, `RedisServerCompatibilityVerified`.
- **Observability requirements:** `queue-metrics`, `structured-logs`, `sentry`.
- **Data migration:** **YES** — Job-ID format + repeatable jobs. **Dual runtime:** `partial`. **RTO:** 60 min. **Owner:** `queues`, `backend-runtime`. **Perf baseline:** not required.
- **Control plane:** `rollback_runbook_required: true`. **User impact:** `[queue-delay]`. **Perf metrics:** `[]`. **Recovery sequence:** `disable-canary → rollback-workers → drain-v5-queue → re-emit-repeatables → rollback-api → verify-queue-metrics`.
- **State + canary:** `stateful_surface: [repeatable-jobs, redis-cache]` ⚠️ state to roll back. `rollback_validation_checks: [queue-depth-stable, no-sentry-spike, health-endpoint-ok]`. `canary_abort_conditions: [queue-backlog-growth, sentry-error-rate-spike, p99-regression-20pct]`. `runtime_state_coupling: [redis, queue-ids]`. `safe_parallel_window_minutes: 60` (workers-first lead time cap).
- **Orchestration:** `rollback_data_loss_risk: replayable`. `runtime_entrypoints: [workers, cron]`. `operational_owner: queues-team`. `estimated_canary_duration_minutes: 0` (no canary). **`rollback_requires_human_approval: true`**.
- **Lifecycle:** drill during 48h soak. `known_incompatible_families: [runtime-backend-nest]`. Cost: **7 engineer-days, review_load: high**. SLO: `[queue-latency, queue-throughput]`.
- **Runtime DAG:** `depends_on_runtime: []`. `rollback_preconditions: [queue-drained, no-active-migrations, canary-disabled]`. `observability_sli_queries: {queue-latency, queue-throughput}`. `state_schema_version: bullmq-v4`. `rollback_blast_scope: [workers, queue, api]`.
- **Platform:** `runtime_capabilities: [supports-feature-flag]`. `failure_domain: [queues]`. `rollback_confidence_level: theoretical → drilled at PR-9d`. **`state_transition_strategy: replay`** (Job-ID re-emission). `incident_comm_protocol: [status-page, support-ticket-tag]`.
- **Peer cluster:** `bullmq`, `@nestjs/bullmq`, `@nestjs/bull`, `bull`, `ioredis`.
- **Deployment sequence:** **`workers-first` → `api-second` → `full-rollout`** (deploying API before workers = silent drops).
- **Preconditions:** PR-9c merged. All BullMQ consumers identified.
- **Scope:** bump cluster + update Worker registrations + re-emit repeatable jobs.
- **CI proof:** new smoke harness `tsx scripts/queues/smoke-repeat.ts` (added in PR-9d). Existing BullMQ workers smoke green.
- **PREPROD soak:** 48h on the PREPROD container.
- **Rollback runbook (mandatory in PR body):** (1) revert PR, (2) drain v5 repeatable jobs, (3) re-emit in v4 Job-ID format, (4) verify workers consuming, (5) `queue-metrics` back to baseline.
- **Runtime risk:** queues stop processing if Worker registration drifts. **Workers MUST deploy before API.**

## PR-9e — Auth abstraction

- **Family:** `auth-session-passport`
- **Family meta:** `upgrade_strategy: abstraction-first`, `runtime_criticality: critical`, `requires_staging_soak: true`, `staging_soak_hours: 48`, `node_runtime_requirement: ">=20"`, `production_approved: true`
- **Rollback complexity:** **`dangerous`** — mid-flight session invalidation.
- **Migration blockers:** `Node20Required`, `ConnectRedisV8RedisClientV4Required`, `AuthServiceAbstractionMerged` (Step A merged before Step B opens).
- **Observability requirements:** `sentry`, `session-roundtrip`, `structured-logs`.
- **Data migration:** **YES** — session cookie v7→v8 + Redis key shape. **Dual runtime:** `full`. **RTO:** 30 min. **Owner:** `auth`, `backend-runtime`. **Perf baseline:** not required.
- **Control plane:** `rollback_runbook_required: true`. **User impact:** `[forced-signout, banner-display]` — release notes + banner template mandatory. **Perf metrics:** `[]`. **Recovery sequence:** `deploy-banner → disable-canary → rollback-api → invalidate-new-format-cookies → verify-session-roundtrip`.
- **State + canary:** `stateful_surface: [redis-sessions, cookies]` ⚠️ live user state. `rollback_validation_checks: [session-roundtrip, no-sentry-spike, health-endpoint-ok]`. `canary_abort_conditions: [sentry-error-rate-spike, session-roundtrip-fail, p99-regression-20pct]`. `runtime_state_coupling: [redis, cookies]`. `safe_parallel_window_minutes: 1440` (24h dual-cookie acceptance).
- **Orchestration:** `rollback_data_loss_risk: partial-loss`. `runtime_entrypoints: [api, ssr]`. `operational_owner: auth-team`. `estimated_canary_duration_minutes: 120`. **`rollback_requires_human_approval: true`**.
- **Lifecycle:** drill banner + cookie cleanup during 48h soak. `known_incompatible_families: [data-supabase]`. Cost: **14 engineer-days, review_load: extreme**. SLO: `[auth-success-rate, api-p99]`.
- **Runtime DAG:** `depends_on_runtime: []`. `rollback_preconditions: [banner-deployed, dual-runtime-active, canary-disabled]`. `observability_sli_queries: {auth-success-rate, api-p99}`. `state_schema_version: session-v7`. `rollback_blast_scope: [api, sessions]`.
- **Platform:** `runtime_capabilities: [supports-canary, supports-dual-write]`. `failure_domain: [authentication]`. `rollback_confidence_level: theoretical → drilled at PR-9e (mandatory)`. **`state_transition_strategy: dual-write`**. `incident_comm_protocol: [status-page, banner, email-notification]`.
- **Peer cluster:** `passport`, `@nestjs/passport`, `passport-local`, `passport-jwt`, `express-session`, `connect-redis`, `@nestjs/jwt`.
- **Deployment sequence:** `dual-runtime` → `canary` → `full-rollout`
- **Preconditions:** PR-9d merged.
- **Scope:** Step A (`PR-9e.1`) — introduce `AuthService` abstraction. Step B (`PR-9e.2`) — bump cluster including `connect-redis` v7 → v8.
- **CI proof:** login/logout E2E pass; admin/* smoke pass; session round-trip sample.
- **PREPROD soak:** 48h on the PREPROD container with synthetic login/logout traffic.
- **Rollback runbook (mandatory in PR body):** (1) deploy PROD banner, (2) revert PR, (3) verify connect-redis v7 cookie format accepted, (4) clear new-format cookies, (5) `session-roundtrip` synthetic green.
- **Runtime risk:** session format change ⇒ forced sign-out at deploy boundary. Banner mandatory.

## PR-9f.0 — Express 5 compatibility audit (audit-only, blocks PR-9f)

> **The real risk of Nest 11 is not Nest — it is Express 5.** Passport,
> sessions, body-parser, proxies, legacy middleware and SEO routes all live
> on the Express middleware contract.

- **Family meta:** n/a — **audit-only PR** like PR-9a.
- **Rollback complexity:** `trivial`. **Migration blockers:** none. **Observability requirements:** none.
- **Data migration:** none. **Dual runtime:** n/a. **RTO:** 5 min. **Owner:** `backend-runtime`. **Perf baseline:** not required.
- **Control plane:** `rollback_runbook_required: false`. **User impact:** `[none]`. **Recovery sequence:** `revert-pr`.
- **State + canary:** all `[none]`.
- **Orchestration:** `rollback_data_loss_risk: none`. `runtime_entrypoints: [build-only]` (audit doc). `operational_owner: backend-runtime-team`. `estimated_canary_duration_minutes: 0`. `rollback_requires_human_approval: false`.
- **Lifecycle:** drill n/a. `known_incompatible_families: []`. Cost: **~3 engineer-days**, review_load: medium. SLO: `[]`.
- **Runtime DAG:** all empty.
- **Platform:** `runtime_capabilities: [none]`. `failure_domain: [tooling]`. `rollback_confidence_level: theoretical`. `state_transition_strategy: none`. `incident_comm_protocol: [none]`.
- **Scope:** produce `audit/dependencies/pr-9f.0-express-5-compatibility-audit.md` enumerating every Express 4 contract used in the monorepo and its Express 5 status (Passport / passport-local; `express-session`; `connect-redis` cookie format; custom middleware in `backend/src/**/*.middleware.ts`; `app.use(...)` calls; `body-parser` direct usage; `req.param()` usage; async error handler patterns; trust-proxy + Cloudflare configuration; SEO routes specific patterns).
- **CI proof:** existing CI green.
- **Output verdict (mandatory):** `PASS` or `BLOCKING-FOR-PR9F: <list>`.
- **Why before PR-9f:** the `Express5CompatibilityAuditPassed` migration_blocker on `runtime-backend-nest` cannot be resolved without this audit.

## PR-9f — NestJS 11

- **Family:** `runtime-backend-nest`
- **Family meta:** `upgrade_strategy: staged-rollout`, `runtime_criticality: critical`, `requires_staging_soak: true`, `staging_soak_hours: 72`, `node_runtime_requirement: ">=20"`, `production_approved: true`
- **Rollback complexity:** **`dangerous`** — peer-dep cascade (Express 5, RxJS 7).
- **Migration blockers:** `Node20Required`, **`Express5CompatibilityAuditPassed`** (PR-9f.0 verdict `PASS`), `RxJS7Required`, `PR9eMerged`.
- **Observability requirements:** `sentry`, `structured-logs`, `health-endpoint`, `traces`.
- **Data migration:** none. **Dual runtime:** `none` (Nest 10/11 cannot share DI graph). **RTO:** 60 min. **Owner:** `backend-runtime`, `platform-tooling`. **Perf baseline:** **YES** — `/health` latency + container cold-start baseline mandatory (rule #14).
- **Control plane:** `rollback_runbook_required: true`. **User impact:** `[short-api-restart]`. **Perf metrics:** `[cold-start, p99, memory]` — all three captured before/after. **Recovery sequence:** `disable-canary → rollback-api → prepare-express-ratchet-pr → prepare-rxjs-ratchet-pr → verify-health-endpoint → verify-traces-continuity`.
- **State + canary:** `stateful_surface: [none]`. `rollback_validation_checks: [health-endpoint-ok, traces-continuity, no-sentry-spike]`. `canary_abort_conditions: [p99-regression-20pct, cold-start-regression-30pct, sentry-error-rate-spike, health-endpoint-fail]`. `runtime_state_coupling: [none]`. `safe_parallel_window_minutes: 0` (atomic swap).
- **Orchestration:** `rollback_data_loss_risk: none`. `runtime_entrypoints: [api, workers, cron, ssr]`. `operational_owner: backend-runtime-team`. `estimated_canary_duration_minutes: 60`. **`rollback_requires_human_approval: true`**.
- **Lifecycle:** drill cascade rollback during 72h soak. `known_incompatible_families: [runtime-backend-platform-fastify, queues-bullmq]`. Cost: **12 engineer-days, review_load: extreme**. SLO: `[api-p99, cold-start, container-startup]`.
- **Runtime DAG:** **`depends_on_runtime: [auth-session-passport, validation-zod, queues-bullmq]`**. `rollback_preconditions: [canary-disabled, express-ratchet-pr-ready, rxjs-ratchet-pr-ready]`. `observability_sli_queries: {api-p99, cold-start, container-startup}`. `state_schema_version: n/a`. `rollback_blast_scope: [api, workers, sessions, ssr]` (widest of the series).
- **Platform:** `runtime_capabilities: [supports-canary]`. `failure_domain: [api-runtime]`. `rollback_confidence_level: theoretical → drilled at PR-9f (mandatory)`. `state_transition_strategy: none`. `incident_comm_protocol: [status-page, slack-channel]`.
- **Peer cluster patterns:** `@nestjs/*`, `rxjs`, `reflect-metadata`, `body-parser` — consume the RESOLVED list from `peer_dependency_cluster_resolved` in inventory.json; expect ≥14 `@nestjs/*` members.
- **Deployment sequence:** `canary` → `full-rollout`
- **Preconditions:** PR-9b/c/d/e merged. **PR-9f.0 merged with verdict `PASS`.** `node_runtime_requirement: ">=20"` verified in Dockerfile + `.github/workflows/ci.yml` matrix BEFORE opening.
- **Scope:** bump every cluster member simultaneously, ensure Express 5 + RxJS 7.x peers. Address breaking decorator/metadata API.
- **CI proof:** `npm run build && npm run test && npm run typecheck` green. Container `/health` 200 within 5s. `onModuleInit` ast-grep rule passes.
- **PREPROD soak:** 72h on the PREPROD container.
- **Rollback runbook (mandatory in PR body):** (1) prepare paired rollback PRs for Express 5→4 + RxJS 7→6 ratchets, (2) revert PR-9f, (3) verify `/health` 200 within 5s, (4) run smoke E2E, (5) confirm `traces` continuity, (6) only ratchet Express/RxJS if peer-dep deadlock observed.
- **Runtime risk:** wide blast.

## PR-9g — Fastify spike

- **Family:** `runtime-backend-platform-fastify`
- **Family meta:** `upgrade_strategy: spike-only`, `runtime_criticality: medium` (spike), `requires_staging_soak: false`, `node_runtime_requirement: ">=20"`, **`production_approved: false`** (hard veto)
- **Rollback complexity:** `trivial` (spike branch). **Migration blockers:** `PR9fMerged`. **Observability requirements:** `structured-logs`.
- **Data migration:** none. **Dual runtime:** `full`. **RTO:** 5 min. **Owner:** `backend-runtime`. **Perf baseline:** **YES** — entire purpose is cold-start + p99 evidence.
- **Control plane:** `rollback_runbook_required: false` (spike). **User impact:** `[none]`. **Perf metrics:** `[cold-start, p99, memory]` (empty `runtime_budget_constraints` is intentional — spike MEASURES without GATING). **Recovery sequence:** `revert-spike-branch`.
- **State + canary:** `stateful_surface: [none]`. `rollback_validation_checks: [none]`. `canary_abort_conditions: []`. `runtime_state_coupling: [none]`. `safe_parallel_window_minutes: 1440` (24h spike window).
- **Orchestration:** `rollback_data_loss_risk: none`. `runtime_entrypoints: [api]`. `operational_owner: backend-runtime-team`. `estimated_canary_duration_minutes: 0`. `rollback_requires_human_approval: false`.
- **Lifecycle:** drill n/a. `known_incompatible_families: [runtime-backend-nest]`. Cost: **5 engineer-days, review_load: medium**. SLO: `[]`.
- **Runtime DAG:** `depends_on_runtime: [runtime-backend-nest]`. `rollback_preconditions: []`. `observability_sli_queries: {}` (PR-body evidence). `state_schema_version: n/a`. `rollback_blast_scope: [none]`.
- **Platform:** `runtime_capabilities: [supports-shadow]`. `failure_domain: [api-runtime]`. `rollback_confidence_level: theoretical` (spike). `state_transition_strategy: none`. `incident_comm_protocol: [none]`.
- **Peer cluster:** `@nestjs/platform-fastify` (additive — coexists with `@nestjs/platform-express`).
- **Deployment sequence:** n/a (spike branch only).
- **Preconditions:** PR-9f merged.
- **Scope:** add `@nestjs/platform-fastify` as parallel platform on a separate spike branch. **Do NOT remove `@nestjs/platform-express`.** Compare cold-start + p99 latency on `/api/_perf`.
- **CI proof:** spike-only — measurement evidence in PR description, no SLA gate.
- **Rollback:** revert PR.
- **Runtime risk:** zero in production (`production_approved: false`). Promotion to prod = separate PR-9h after evidence review.

## Decision log

- **2026-05-17** — Locked PR sequence b → g. Deferred frontend/data/observability families (see matrix). Chose audit-only PR-9a (no install, no CI gate, no `npm run` script). 54 central rules. 62 overlay fields per family + 1 generated (`peer_dependency_cluster_resolved`) + 4 top-level inventory fields. 30 Zod cross-field invariants. Generator emits `artifact_immutability_hash` for replay determinism. Wildcards in `peer_dependency_cluster` are EXPANDED at projection time — wildcards never reach the artifact (rule #24).
- **2026-05-17** — Honest-correction pass before merge: `runtime-backend-platform-fastify` budgets emptied (0% caps were degenerate — invariant #50 relaxed for `production_approved: false` families). Added README "DRAFT values requiring validation" section tagging aspirational fields (team slugs, PromQL queries, state versions, contract dates, cost estimates, perf budgets). Added Task 9 (Zod schema + generator unit tests). Added Task 10 (matrix MD codegen between AUTO-TABLE fences, eliminates MD↔YAML drift).
