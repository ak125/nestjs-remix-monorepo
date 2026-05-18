# `audit/dependencies/` — Dependency Modernization Control Plane (PR-9a)

## Central rules (non-negotiable)

1. **No global latest upgrade.** One dependency family per PR. One rollback path. One CI proof. One runtime-risk analysis.
2. **No cross-family upgrade PR allowed.** Touching packages in two distinct families = split the PR.
3. **`requires_staging_soak: true` families** MUST observe `staging_soak_hours` on DEV preprod (46.224.118.55) before any prod tag.
4. **`production_approved: false` families** are benchmark / spike / experimental only — never reach prod regardless of CI green.
5. **`node_runtime_requirement`** must be verified against the production Dockerfile + CI matrix **before** the family's upgrade PR opens.
6. **`peer_dependency_cluster`** members upgrade **together** in the same PR — partial cluster upgrade is forbidden.
7. **`migration_blockers`** MUST all be resolved before the family's upgrade PR opens. A blocker is a hard precondition.
8. **`rollback_complexity: dangerous` families** REQUIRE a written rollback runbook in the PR description (not just `git revert`).
9. **`observability_requirements`** MUST be live on DEV preprod before the family's prod tag (CI green ≠ runtime healthy).
10. **`data_migration_required: true`** ⇒ rollback runbook MUST include data-migration rollback steps.
11. **`supports_dual_runtime`** drives `deployment_sequence` choice: `full` ⇒ may use `dual-runtime`; `partial` ⇒ split via `workers-first` / feature flag; `none` ⇒ atomic swap + banner.
12. **`rollback_rto_minutes`** is the operational RTO — rollback runbook MUST be drillable inside this window.
13. **`upgrade_owner_domain`** MUST map to `repository-registry` ownership domains (ADR-058) — every upgrade has a named human owner, never `__unassigned__`.
14. **`requires_perf_baseline: true`** ⇒ PR body MUST contain before/after perf measurement against a captured baseline. No baseline = no merge.
15. **`rollback_runbook_required: true`** is the explicit machine-readable boolean — schema-enforced: `dangerous` ⇒ runbook required.
16. **`expected_user_impact`** declares user-visible side-effects (forced-signout, banner-display, queue-delay…) — drives release notes + comms + support triage.
17. **`perf_baseline_metrics`** declares WHICH metrics matter — schema-enforced: `requires_perf_baseline: true` ⇒ at least one metric named.
18. **`estimated_recovery_sequence`** is the ordered rollback playbook — schema-enforced: `dangerous` ⇒ at least one recovery step.
19. **`stateful_surface`** declares WHERE runtime state lives. Drives incident triage and rollback drill scope.
20. **`rollback_validation_checks`** ⇒ rollback is not done until these pass. Schema-enforced: `dangerous` ⇒ at least one check.
21. **`canary_abort_conditions`** are quantitative — canary without measurable abort triggers = pure intuition. Schema-enforced: `canary` in `deployment_sequence` ⇒ at least one condition.
22. **`runtime_state_coupling`** declares which runtime primitives the family touches (redis / cookies / queue-ids / cache-keys / realtime-channels / cdn). Drives blast analysis.
23. **`safe_parallel_window_minutes`** caps `dual-runtime` exposure. Schema-enforced: `dual_runtime: none` ⇒ `0`; otherwise `> 0`.
24. **Peer clusters are frozen at generation time.** Overlay patterns (`@nestjs/*`) are EXPANDED by the generator into `peer_dependency_cluster_resolved` (explicit names, sorted). Wildcards never reach the artifact — future agents read the resolved list, never the patterns.
25. **`rollback_data_loss_risk`** decouples loss from complexity (`none` | `replayable` | `partial-loss` | `irreversible`). Schema-enforced: `irreversible` ⇒ `rollback_requires_human_approval: true`.
26. **`runtime_entrypoints`** declares WHERE the runtime lives (`api` / `workers` / `cron` / `ssr` / `edge` / `build-only`) — drives canary sequencing + deploy-tooling routing.
27. **`operational_owner`** is the on-call team that gets paged — distinct from organisational `upgrade_owner_domain`.
28. **`estimated_canary_duration_minutes`** is the canary observation window. Schema-enforced: `canary` in `deployment_sequence` ⇒ `> 0`. NOT the same as `safe_parallel_window_minutes`.
29. **`rollback_requires_human_approval: true`** blocks automated orchestrators from initiating rollback. Mandatory for `irreversible` data-loss; recommended for auth/queues/realtime.
30. **`rollback_tested_at` + `rollback_drill_commit`** are the drill audit trail — runbook drilled on DEV preprod, commit SHA recorded. `dangerous` rollbacks without a drill = unverified runbook = blocked at prod gate.
31. **`known_incompatible_families`** declares cross-family conflicts orchestrators MUST NOT schedule in parallel (distinct from `migration_blockers`, which is sequential).
32. **`artifact_immutability_hash`** is the replay-determinism witness — `sha256:` of input hashes (`deps.json` + overlay + lockfile). Identical inputs ⇒ identical hash.
33. **`upgrade_cost_estimate`** declares `estimated_engineer_days` + `estimated_review_load` for roadmap prioritization + sprint planning.
34. **`runtime_slo_impact`** declares which SLOs the upgrade touches. Schema-enforced: `critical`/`high` + `production_approved` ⇒ at least one SLO.
35. **`runtime_dependency_edges.depends_on_runtime`** declares the runtime DAG (orthogonal to migration_blockers + known_incompatible_families). Drives orchestration, deadlock detection, blast routing.
36. **`rollback_preconditions`** are conditions that MUST hold before rollback begins. Schema-enforced: `dangerous` ⇒ at least one.
37. **`observability_sli_queries`** is the SLO → query map enabling canary auto-evaluation by orchestrators.
38. **`state_schema_version`** identifies the persisted state shape (e.g. `bullmq-v4`, `session-v7`) for drift detection.
39. **`rollback_blast_scope`** declares which surfaces rollback TOUCHES (api / workers / sessions / cache / cdn / ssr / queue / realtime / none) for incident comms + post-mortem.
40. **`runtime_capabilities`** declares deployment capabilities (`supports-canary` / `supports-shadow` / `supports-dual-write` / `supports-feature-flag` / `none`) — replaces heuristic inference.
41. **`failure_domain`** declares the abstract incident-routing category — drives post-mortem + blast analytics.
42. **`rollback_confidence_level`** declares runbook maturity (`theoretical` → `simulated` → `drilled` → `production-proven`). All families start `theoretical` at PR-9a; PR-9b..9g elevate to `drilled` minimum before prod tag.
43. **`state_transition_strategy`** declares state migration approach (`dual-write` / `replay` / `lazy-migration` / `hard-cut` / `none`). Schema-enforced: `data_migration_required: true` ⇒ strategy ≠ `none`.
44. **`incident_comm_protocol`** declares user-comm channels. Schema-enforced: non-`[none]` user impact ⇒ at least one protocol.
45. **`compatibility_contracts`** declares versioned wire/state contracts (e.g. `session-cookie-v7`). Drives compatibility replay + drift validation.
46. **`runtime_freeze_window`** declares wall-clock windows where upgrade may NOT run (`{start, end}` HH:MM or `null`).
47. **`orchestrator_policy`** declares orchestrator behaviours: `rollback_mode` + `deploy_mode`. Schema-enforced: `rollback_requires_human_approval: true` ⇒ `rollback_mode: manual-only`.
48. **`dependency_lineage.supersedes`** declares prior contracts this family replaces — migration archaeology + replay lineage.
49. **`state_compatibility_window_minutes`** is the window during which old + new state shapes are mutually interpretable. Schema-enforced: `state_transition_strategy: dual-write` ⇒ `> 0`.
50. **`runtime_budget_constraints`** transforms perf baselines into quantitative budgets (max p99 / memory / cold-start / lcp regressions). Schema-enforced: `requires_perf_baseline: true` ⇒ at least one budget set (spike/benchmark families exempt).
51. **`state_reconciliation_strategy.duplicate_resolution`** declares conflict resolution. Schema-enforced: `dual-write` / `replay` ⇒ ≠ `n/a`.
52. **`orchestrator_lock_scope`** prevents concurrent migrations on the same scope — orchestrators MUST acquire all locks before deploy.
53. **`rollback_observability_grace_period_minutes`** silences alerts during the residual-error window post-rollback.
54. **`runtime_contract_expiry`** sets an ISO date by which current contracts MUST be superseded — prevents dual-write zombies. Stateful families SHOULD set one.

This directory is **audit-only**. It declares no behaviour, mutates no
runtime, and adds no CI gate. It enumerates every dependency in the
monorepo, groups them into upgrade families, and locks the PR-9b → PR-9g
sequence.

## DRAFT values requiring validation at PR-9b..9g kickoff

Several overlay fields are **aspirational** at PR-9a generation time and MUST be
validated by domain owners before the downstream PRs (PR-9b..9g) consume them
as authoritative. Listed here for transparency — no value is silently
fabricated.

| Field | Status at PR-9a | What to validate before consumption |
|---|---|---|
| `operational_owner` (`*-team` slugs) | aspirational naming convention | CODEOWNERS / ownership.yaml MUST formalize each `*-team` group (auth-team, queues-team, backend-runtime-team, data-team, frontend-runtime-team, observability-team, platform-validation-team, platform-tooling-team) before PR-9b..9g routing. Until then, treat as DRAFT. |
| `observability_sli_queries.*` (PromQL expressions) | placeholder queries | Metric names (e.g. `http_request_duration_seconds_bucket`, `bullmq_job_duration_seconds_bucket`) MUST be verified against the actual Prometheus + Loki configuration before any canary watchdog wires them in. Treat current values as illustrative templates. |
| `state_schema_version` (e.g. `session-v7`, `bullmq-v4`, `supabase-v2`) | PR-9a-introduced convention | These versioning labels are introduced by PR-9a — families adopt them at upgrade time. Drift detection consumers MUST tolerate the absence of these labels in code authored before PR-9a. |
| `runtime_contract_expiry` (e.g. `2026-12-31`, `2027-06-30`) | proposed deadlines | Dates are PR-9a proposals — the family's `operational_owner` confirms or revises the expiry at PR-9b..9g kickoff. |
| `upgrade_cost_estimate.estimated_engineer_days` (total 53 days) | low-confidence estimate | PR-9a-time guesstimate; refine during PR-9b..9g kickoff against actual scope. |
| `runtime_budget_constraints.max_*_pct` (e.g. Nest p99 ≤ 10%) | proposed budgets | Canary thresholds are PR-9a defaults — `operational_owner` may relax or tighten at PR-9b..9g kickoff against historical baselines. |

Convention: any consumer of `audit/dependencies/dependency-modernization-inventory.json`
that gates on a DRAFT field MUST cross-check the table above and refuse to gate
silently if the value is still marked aspirational.

## Layers

| Layer | File | Editor |
|---|---|---|
| L1 raw | `audit/registry/deps.json` | generated by `scripts/registry/build-deps-registry.js` |
| L1' resolved | `package-lock.json` | npm |
| L2 overlay | `family-overlay.yaml` | **human** — assign family / blast_radius / target_major / PR + 56 governance fields |
| L3 projection | `dependency-modernization-inventory.json` | **generated**, never hand-edit |
| L4 curation | `dependency-upgrade-matrix.md` (tables generated between AUTO-TABLE fences), `pr-9-modernization-roadmap.md` | human prose + codegen |

## Regenerate

```bash
# Pure static. No network. No install. Idempotent.
tsx scripts/audit/build-dependency-modernization-inventory.ts

# Determinism check (regenerate + diff)
tsx scripts/audit/build-dependency-modernization-inventory.ts --check

# Render the 12 markdown tables from the inventory JSON (zero MD/YAML drift)
tsx scripts/audit/render-dependency-modernization-matrix.ts

# Check matrix is in sync with inventory
tsx scripts/audit/render-dependency-modernization-matrix.ts --check

# Unit tests (Zod refines + generator helpers)
tsx --test scripts/audit/__tests__/dependency-modernization.schema.test.ts
tsx --test scripts/audit/__tests__/build-dependency-modernization-inventory.test.ts
```

## Non-objectives (PR-9a)

- Does NOT modify `package.json` / lockfile / Docker / CI / runtime
- Does NOT call npm registry HTTP — `target_major` is a curated human field
- Does NOT enforce a CI freshness gate (the generator can be re-run on demand)
- Does NOT upgrade anything — every upgrade ships in PR-9b..9g
