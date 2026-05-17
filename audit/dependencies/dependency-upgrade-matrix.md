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
<!-- AUTO-TABLE:upgrade-plan END -->

## Table 2 — Execution metadata (how to ship)

<!-- AUTO-TABLE:execution START -->
<!-- AUTO-TABLE:execution END -->

## Table 3 — Governance metadata (rollback / blockers / observability)

<!-- AUTO-TABLE:governance START -->
<!-- AUTO-TABLE:governance END -->

**Reading guide:**
- `rollback_complexity: dangerous` ⇒ PR body MUST contain a written rollback runbook.
- `migration_blockers` ⇒ every token MUST resolve to a merged PR / verified configuration / shipped upstream release BEFORE opening the family's PR.
- `observability_requirements` ⇒ every signal MUST be live and ingesting from DEV preprod (46.224.118.55) BEFORE the family's prod tag — CI green is not enough.

## Table 4 — Operational metadata (data migration / dual runtime / RTO / ownership / perf baseline)

<!-- AUTO-TABLE:operational START -->
<!-- AUTO-TABLE:operational END -->

**Reading guide:**
- `data_migration_required: yes` ⇒ rollback runbook MUST cover the data-side rollback.
- `supports_dual_runtime`: `full` ⇒ may use `dual-runtime` deployment stage; `partial` ⇒ split deployment; `none` ⇒ atomic swap mandatory, banner/maintenance window needed.
- `rollback_rto_minutes` ⇒ rollback runbook MUST be drillable inside this window. Drill on DEV preprod once during the soak period.
- `upgrade_owner_domain` ⇒ map to `repository-registry` ownership domains (ADR-058). Every domain MUST have a named human owner via CODEOWNERS / ownership.yaml — never `__unassigned__`.
- `requires_perf_baseline: yes` ⇒ PR body MUST contain before/after measurement on `/api/_perf` or equivalent baseline. No baseline = no merge.

## Table 5 — Control-plane metadata (machine-readable for orchestrators / CI / PR validators)

<!-- AUTO-TABLE:control-plane START -->
<!-- AUTO-TABLE:control-plane END -->

**Reading guide:**
- `rollback_runbook_required: true` ⇒ PR validators / CI / orchestrators consume this directly. Schema invariant: `rollback_complexity: dangerous` forces this to `true` — cannot be relaxed.
- `expected_user_impact` ⇒ release notes + customer comms + support triage MUST mention each impact token. `[none]` is explicit.
- `perf_baseline_metrics` ⇒ exactly which numbers to capture. Schema invariant: `requires_perf_baseline: true` (on production-approved families) forces this to be non-empty.
- `estimated_recovery_sequence` ⇒ ordered, drillable on DEV preprod during the soak window. Schema invariant: `dangerous` forces this to be non-empty. Each step is a kebab-case token greppable across PRs.

## Table 6 — State + canary metadata (state surface / abort thresholds / parallel windows)

<!-- AUTO-TABLE:state-canary START -->
<!-- AUTO-TABLE:state-canary END -->

**Reading guide:**
- `stateful_surface` ⇒ "where the state actually lives" — incident triage starts here.
- `rollback_validation_checks` ⇒ "rollback is not done until these pass" — drill on DEV preprod during soak.
- `canary_abort_conditions` ⇒ "what makes us pull the plug" — quantitative thresholds, not vibes.
- `runtime_state_coupling` ⇒ "what primitives we touch" — drives blast analysis at PR-review time.
- `safe_parallel_window_minutes` ⇒ "max minutes the dual-runtime can be live" — infinite dual-runtime is a lie; banner / canary coordination caps this. `0` = atomic swap (dual_runtime=none).

## Table 7 — Orchestration metadata (data loss / runtime entrypoints / on-call / canary duration / human approval)

<!-- AUTO-TABLE:orchestration START -->
<!-- AUTO-TABLE:orchestration END -->

**Reading guide:**
- `rollback_data_loss_risk`: `none` ⇒ rollback is loss-free; `replayable` ⇒ state re-emission required; `partial-loss` ⇒ user-visible state lost but data not destroyed; `irreversible` ⇒ data destruction (none in PR-9 scope).
- `runtime_entrypoints`: drives canary sequencing.
- `operational_owner`: kebab-case team slug ending in `-team`. Maps to PagerDuty schedule / Slack on-call channel.
- `estimated_canary_duration_minutes`: > 0 if `canary` in `deployment_sequence` (schema-enforced). Drives canary-watchdog timeout.
- `rollback_requires_human_approval`: `true` ⇒ automated orchestrators may DETECT abort conditions but a human INITIATES the recovery sequence.

## Table 8 — Lifecycle + planning metadata (drill audit / incompat / cost / SLO)

<!-- AUTO-TABLE:lifecycle-planning START -->
<!-- AUTO-TABLE:lifecycle-planning END -->

**Reading guide:**
- `rollback_tested_at` + `rollback_drill_commit` are NULL at PR-9a generation time. The actual upgrade PR (PR-9b..9g) MUST set them BEFORE the prod tag.
- `known_incompatible_families`: orchestrators MUST NOT schedule these in parallel.
- `upgrade_cost_estimate`: total engineer-days = sum across families — informs sprint capacity and review-board scheduling.
- `runtime_slo_impact`: the SLOs whose error budget is consumed during the upgrade window. Critical/high families MUST declare at least one (schema-enforced).

## Table 9 — Runtime DAG + canary auto-evaluation (DAG edges / preconditions / SLI queries / state version / blast scope)

<!-- AUTO-TABLE:runtime-dag START -->
<!-- AUTO-TABLE:runtime-dag END -->

**Reading guide:**
- `depends_on_runtime`: runtime DAG edges, orthogonal to `migration_blockers` (PR sequencing) and `known_incompatible_families` (parallel scheduling).
- `rollback_preconditions`: hard preconditions that MUST hold before rollback may begin. Schema-enforced: `dangerous` ⇒ at least one.
- `observability_sli_queries`: SLO ID → Prometheus/Loki query. Empty at PR-9a time is OK (fill at PR-9b..9g kickoff).
- `state_schema_version`: identifier of the persisted-state shape. `n/a` means stateless. Drift detection between rolled-back code and live state uses this.
- `rollback_blast_scope`: surfaces TOUCHED by rollback.

## Table 10 — Platform-engineering metadata (capabilities / failure domain / confidence / transition strategy / comms)

<!-- AUTO-TABLE:platform-engineering START -->
<!-- AUTO-TABLE:platform-engineering END -->

**Reading guide:**
- `runtime_capabilities`: orchestrators consult this list BEFORE scheduling — replaces heuristic inference from `deployment_sequence`.
- `failure_domain`: abstract incident-routing category. Multiple domains OK.
- `rollback_confidence_level`: ALL families start `theoretical` at PR-9a. Each PR-9b..9g MUST elevate to at least `drilled` before prod tag.
- `state_transition_strategy`: NOT inferable from `data_migration_required` alone — must be NAMED. Schema-enforced: `data_migration_required: true` ⇒ strategy ≠ `none`.
- `incident_comm_protocol`: schema-enforced — any non-`none` `expected_user_impact` ⇒ at least one comm protocol.

## Table 11 — Contract + orchestration metadata (compat contracts / freeze window / orchestrator policy / lineage / state compat window)

<!-- AUTO-TABLE:contract-orchestration START -->
<!-- AUTO-TABLE:contract-orchestration END -->

**Reading guide:**
- `compatibility_contracts`: versioned wire/state contracts. PR-9b..9g supersede these with `-v(N+1)`.
- `runtime_freeze_window`: stateful families (queues / auth / Nest / Remix / data) deploy overnight only.
- `orchestrator_policy.rollback_mode`: schema-enforced to `manual-only` when `rollback_requires_human_approval: true`.
- `dependency_lineage.supersedes`: empty at PR-9a (first iteration). PR-9b..9g will populate.
- `state_compatibility_window_minutes`: window during which old + new state shapes can both be read by the receiving code. `dual-write` ⇒ schema-enforced `> 0`.

## Table 12 — Budget + reconciliation + lock + grace + expiry

<!-- AUTO-TABLE:budget-reconciliation START -->
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
