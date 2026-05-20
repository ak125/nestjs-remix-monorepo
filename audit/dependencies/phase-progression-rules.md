# Phase progression rules — PR-9a → PR-12

> **Meta-rule (non-negotiable):** No phase may expand its perimeter without
> evidence produced by the previous phase. Each phase's exit criteria
> become the next phase's preconditions. PR-9b is the smoke test of the
> entire control plane — PR-10/11/12 do not exist as scoped work until
> PR-9b proves the overlay fields are not decorative.

## Phase ladder

| Phase | Surface | What it proves | Exit criteria |
|---|---|---|---|
| **PR-9a** | declarative — schema + overlay + inventory + matrix + roadmap | the model is internally consistent | 30 schema invariants pass + `--check` returns deterministic hash + 39 unit tests green |
| **PR-9b** | **first operational proof** (tooling-typescript-eslint family) | a declared upgrade is actually executable inside the encoded constraints | see PR-9b exit criteria below |
| **PR-10** | static freshness — overlay ↔ infra correspondence | declared aspirational fields match real infrastructure | static-parse only, see PR-10 constraints below |
| **PR-11** | cross-family coherence — dry-run simulation | the scheduling/window/lock combinations actually compose | dry-run timeline output reviewable by operational_owner |
| **PR-12** | **observation runtime, no automated rollback initiation** | canary watchdogs detect abort conditions and notify | see PR-12 absolute prohibition below |

## PR-9b — Operational proof (must produce evidence before PR-10 opens)

PR-9b is not a tooling upgrade. PR-9b is **the first real-world test of every overlay field** by exercising the simplest possible family
(`tooling-typescript-eslint`: `rollback_complexity: trivial`,
`runtime_criticality: low`, `production_approved: true`, build-time only).

**Exit criteria (all 4 mandatory before merge):**

1. **Rollback runbook drilled ≤ 30 minutes on PREPROD container** (`49.12.233.2:3200`, image `:preprod`, READ_ONLY=true ; see [`.claude/rules/deployment.md`](../../.claude/rules/deployment.md) for canonical topology). The `rollback_rto_minutes: 30` in the overlay is not aspirational — it is a measured wall-clock time recorded in the PR body. Drill = execute every step of `estimated_recovery_sequence` against the deployed canary state.
2. **`Node20Required` migration blocker verified BEFORE opening the PR.** Verified = grep `engines.node` in `package.json` + Dockerfile + `.github/workflows/ci.yml` Node matrix returns `>=20` consistently. NOT verified mid-PR via CI failure.
3. **`target_major: "locked-at-execution"` resolved explicitly in the PR body.** PR-9b's first task is to lock the concrete version (e.g. `TS 5.6 / ESLint 9 flat config`) with an upstream-release link. This converts the placeholder into a concrete contract for downstream consumption.
4. **`rollback_tested_at` + `rollback_drill_commit` set to non-null in `family-overlay.yaml` BEFORE the prod tag.** Overlay overlay-edit + generator re-run + `--check` succeeds + matrix renderer re-run + `--check` succeeds.

**If any of these 4 fails:** PR-9b is rejected and the failure is documented as a PR-9a follow-up patch. The control plane is corrected before PR-9b reopens. No semantic adjustment "to make it pass" — the contract holds, the upgrade adapts.

## PR-10 — Static freshness (must remain 100% static-parse)

PR-10 closes the semantic-drift class identified in `README.md` § "DRAFT
values requiring validation": `operational_owner` slugs not in CODEOWNERS,
`observability_sli_queries` keys absent from Prometheus rules,
`runtime_contract_expiry` dates already in the past.

**Hard prohibition (architectural):**

```
FORBIDDEN in PR-10:
  - fetch()
  - HTTP requests to Prometheus
  - GitHub API calls
  - npm registry calls
  - any runtime service dependency
```

PR-10 introducing its first `fetch()` is an architectural regression. The
control plane is a deterministic audit projection — it must not become a
service with failure modes.

**Allowed (static-parse only):**

```
ALLOWED in PR-10:
  - parse local files
  - parse CODEOWNERS local
  - parse prometheus rules local (YAML files in the repo)
  - compare dates (against generation time)
  - verify ownership (kebab slug exists in CODEOWNERS)
  - verify DRAFT-tagged fields are non-aspirational at consumption time
```

**Exit criteria:**
- New script `scripts/audit/check-overlay-freshness.ts` with `--check` mode (mirror of inventory generator pattern)
- Phase 1: warn-only — surface drift without blocking
- Phase 2 (post evidence): BLOCKING — wired into the existing `dependency-modernization-fresh.yml` workflow

## PR-11 — Cross-family simulation (dry-run only)

PR-11 catches the inconsistencies the schema cannot see — incompatible
timing/window/lock combinations when two families propose overlapping
deploys.

**Hard constraints:**

```
PR-11 surface:
  input: inventory + overlay
  output: markdown timeline + violations report
  no deploy
  no mutation
  no runtime call
```

**Output format (one section per simulated family):**

```markdown
## Simulation: pr-9d (queues-bullmq)

Timeline:
  T+0min   acquire locks: [queues, workers]
  T+5min   workers-first deploy starts (canary 10%)
  T+45min  canary observation (queue-latency p99 baseline)
  T+60min  api-second deploy starts (atomic swap)
  T+120min full-rollout
  T+180min release locks

Violations:
  ✘ runtime_freeze_window 22:00-06:00 conflicts with simulated start at 14:30
  ⚠ overlaps with pr-9f scheduled in same week — locks conflict at T+60min
```

**Exit criteria:**
- Simulator output reviewed by `operational_owner` team of each family BEFORE PR-11 merges
- Cross-family overlap matrix published (which pairs cannot run in same week)
- Catches at least one real conflict not caught by schema invariants

## PR-12 — Runtime observation (detect + notify only, NO automated rollback)

PR-12 wires canary watchdogs to read `canary_abort_conditions` from the
inventory and observe them via the metrics declared in
`observability_sli_queries`.

**Behaviour matrix:**

| Trigger | PR-12 action |
|---|---|
| `canary_abort_conditions` token fires | notify on-call channel of `operational_owner` |
| Alert acknowledged within `estimated_canary_duration_minutes` | continue observation |
| Alert unacknowledged past canary window | escalate to incident channel + annotate incident |
| `rollback_requires_human_approval: true` | human INITIATES the recovery sequence, NOT the orchestrator |
| `rollback_requires_human_approval: false` AND `rollback_confidence_level: production-proven` AND `rollback_data_loss_risk: none` | automated rollback initiation MAY be authorized in a future PR-13, NOT in PR-12 |

**Absolute prohibition (BLOCKS PR-12 merge if violated):**

```
rollback_requires_human_approval=true
  ⇒ no automated rollback initiation, ever, regardless of canary signal
```

PR-12 introducing automated rollback initiation for any family with
`rollback_requires_human_approval: true` is an immediate revert.

**Phase-in order (lowest risk first):**
- Phase 1 (PR-12.1): wire watchdogs for `validation-zod` and
  `tooling-typescript-eslint` only — both `low`/`moderate` complexity,
  both have at least 3 production-proven canary cycles
- Phase 2 (PR-12.2): expand to `queues-bullmq` and `data-supabase` only
  after the families have `rollback_confidence_level: production-proven`
- Phase 3 (PR-12.3): never expand to `auth-session-passport` automated
  detection without prior PR-13 authorization

## Verdict

PR-9b is the smoke test of the system. PR-10/11/12 do not exist as
scoped work until PR-9b produces the four pieces of evidence listed
above. Each subsequent phase's authorization to begin scoping work is
gated on the prior phase shipping its exit criteria as merged evidence
in the inventory.

**The control plane is built; the proof is owed.** PR-9b is where it
gets paid.
