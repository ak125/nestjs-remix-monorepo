# ADR-003 — Grandfathering advisory→blocking flip

**Status:** proposed  
**Date:** 2026-04-14  
**Author:** Software-Architect (d2e89803)  
**Approver (required):** CTO (7fa3c971)  
**Source:** [AUT-283](/AUT/issues/AUT-283) / [AUT-271](/AUT/issues/AUT-271)  
**Depends on:** ADR-001 (module manifest schema), [AUT-276](/AUT/issues/AUT-276)

---

## Context

Phase 1 of the architectural hardening plan (AUT-271) ends with the first batch of modules reaching `status: certified` in their manifest. At that point, the `manifest-check` gate — currently running in ADVISORY mode (exit 0 always) — must flip to **BLOCKING** for certified modules.

PRs that are already open at the moment of the flip will fail their CI if they touch certified modules and haven't already satisfied the gate battery. Without a grandfathering protocol, the flip will cause cascading failures, block the team, and risk being reverted entirely.

This ADR defines the controlled transition: a 72-hour freeze window, a label-based grace period for in-flight PRs, a drain strategy, and a rollback plan.

---

## Decision

### 1. Freeze window — 72h before the flip

- The CTO announces the flip date (`T-day`) at least **72 hours in advance** via a Paperclip comment on [AUT-276](/AUT/issues/AUT-276) and a message in `#eng` channel.
- During the 72h window, no new module may be promoted to `certified`. The set of certified modules at `T-72h` is the **baseline set** for the flip.
- A GitHub Actions workflow (`pre-gate-baseline-label.yml`, see below) runs at `T-72h` and automatically labels all currently open PRs that touch certified modules with `pre-gate-baseline`.

### 2. Label `pre-gate-baseline` — grace period

PRs labeled `pre-gate-baseline` receive the following treatment:

| Window | Gate behavior |
|--------|---------------|
| `T` to `T+72h` | Gate remains ADVISORY — CI reports but does not block merge |
| After `T+72h` | Gate is BLOCKING — PR must pass before merge or be closed |

The label is applied automatically by the workflow and **must not be applied manually** except by Software-Architect or CTO.

The label expires semantically at `T+72h`. The enforcement workflow removes it and switches the gate to blocking for that PR.

### 3. Drain strategy

At `T-day`, the following responsibilities apply:

| Actor | Responsibility |
|-------|----------------|
| **PR author** | Primary responsibility: rebase on `main`, fix manifest violations before `T+72h` |
| **Code-Analyst (77fbb90a)** | Nightly sweep: identify all open `pre-gate-baseline` PRs; comment on each with remaining time |
| **Code-Fixer (b0df5075)** | If a PR is assigned to Code-Fixer and touches a certified module, it must be rebased and gate-compliant within 48h |
| **CTO** | The only agent authorized to grant a `gate-override` extension beyond `T+72h`. Requires 2-agent approval (CTO + Data-Ops for DB-touching modules) |
| **Software-Architect** | Does NOT apply `gate-override` unilaterally. Escalates via [AUT-271](/AUT/issues/AUT-271) comment |

**Close vs rebase decision tree:**

```
PR has pre-gate-baseline label?
├── YES → is it stale (no commits in 7d)?
│   ├── YES → close with comment "stale at gate flip, please reopen when gate-compliant"
│   └── NO → author must rebase by T+72h
└── NO → gate is already blocking, PR must comply
```

### 4. Rollback plan

If **>10% of non-stale open PRs** are blocked by the gate at `T+24h` and unable to drain:

1. Software-Architect posts a Paperclip comment on [AUT-276](/AUT/issues/AUT-276) declaring rollback intent.
2. CTO approves (explicit comment required — no silent auto-rollback).
3. The gate is reverted to ADVISORY for all modules by setting `GATE_MODE=advisory` in the workflow environment variable.
4. A post-mortem issue is opened (child of AUT-271) within 48h.
5. The flip is retried at `S+1` (next sprint start) with lessons applied.

**Rollback is NOT automatic.** A human CTO approval is required at step 2.

---

## Schema change to `.spec/modules/_schema.yaml`

No schema change required. The `status: certified` field already triggers blocking behavior in `gates/manifest-check.ts`.

The gate reads `status` at runtime — promoting a module to `certified` is the activation mechanism.

---

## Implementation

### Files produced by this ADR

| File | Description |
|------|-------------|
| `.github/workflows/pre-gate-baseline-label.yml` | Workflow that labels open PRs and manages grace period |
| `docs/runbooks/gate-flip-day.md` | Step-by-step runbook for the operator executing the flip |
| `docs/adr/0003-grandfathering-gate-flip.md` | This ADR |

### What this ADR does NOT decide

- Which modules are first to reach `certified` — that is decided by the CTO during review of individual `draft` manifests.
- The exact `T-day` date — CTO decides based on sprint progress.
- The `prevent-regression` gate ([AUT-276](/AUT/issues/AUT-276)) — that gate has its own ADR. This ADR covers the flip of `manifest-check` only.

---

## Consequences

**Positive:**
- Teams have 72h advance notice — no surprise failures.
- The `pre-gate-baseline` label makes the grace period explicit and auditable.
- Rollback is defined and bounded — prevents the flip from being permanently reverted.

**Negative:**
- Adds operational complexity during the flip week.
- Requires Code-Analyst to actively monitor PRs during `[T, T+72h]`.

**Neutral:**
- This ADR becomes irrelevant once all modules have reached `certified` status — at that point the gate is permanently blocking.

---

## Approval

| Approver | Status | Date |
|----------|--------|------|
| CTO (7fa3c971) | **pending** | — |
| Software-Architect (d2e89803) | proposed | 2026-04-14 |
