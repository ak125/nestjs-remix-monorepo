# Change Protocol — AutoMecanik Architecture

**Version:** 1.0.0  
**Status:** CANON  
**Date:** 2026-04-14  
**Owner:** Software-Architect (d2e89803)  
**Approver:** CTO (7fa3c971)  
**Source:** [AUT-277](/AUT/issues/AUT-277) / [AUT-271](/AUT/issues/AUT-271)

---

## Purpose

This document defines the levels of governance required for architectural changes in the AutoMecanik monorepo. It is authoritative — every agent, engineer, and automated gate must respect these rules.

Any change that is not covered by a lower level **must** escalate to the next level. When in doubt: escalate, do not assume.

---

## Change Levels

### R0 — No-approval (autonomous)

**Scope:** Changes that carry zero architectural risk.

Examples:
- Fix a typo in a comment
- Update a log message
- Add a `console.log` for debugging (removed before merge)
- Update `package.json` version numbers (patch bumps, not deps)

**Gate required:** Lint + TypeCheck only.  
**Approver:** None.

---

### R1 — Manifest drift (advisory)

**Scope:** Changes that touch a module covered by a `stub` or `draft` manifest.

Triggered when:
- A file in `backend/src/modules/<module>/` is modified
- The module's manifest has `status: stub` or `status: draft`

**Gate:** `manifest-check` in ADVISORY mode — reports violations, does not block.  
**Action required:** Update the manifest to reflect the change (add to `http_routes`, `owned_tables`, etc.).  
**Approver:** None (self-serve), but violations must be documented in the PR.

**manifest_version_read:** Before any R1 or higher change, the agent/engineer MUST read the current manifest version:
```bash
cat .spec/modules/<module>/manifest.yaml
```
This prevents stale-manifest drift where the manifest describes a prior state of the module.

**manifest_drift_clean:** If the manifest is out of date (reality diverged from manifest), a manifest-only PR must be opened to sync the manifest before or alongside the feature PR.

---

### R2 — Certified module change (blocking)

**Scope:** Changes that touch a module with `status: certified` in its manifest.

Triggered when:
- A file in `backend/src/modules/<module>/` is modified
- The module's manifest has `status: certified`

**Gate:** `manifest-check` in BLOCKING mode — must pass before merge.  
**Approver:** PR author self-review is sufficient IF the gate is green.  
**If gate is red:** Gate-override requires CTO approval + Data-Ops (for DB-touching modules) or IA-SEO Master (for SEO-touching modules).

**Additional requirements:**
- All `invariants_ref` SQL gates must return 0 rows
- `change_surface.review_checklist` must be addressed in PR body

---

### R3 — Database migration (write)

**Scope:** Any migration that adds, modifies, or removes a table, column, index, or constraint.

**Gate:** `manifest-check` + migration checklist (`sql-migration-checklist.md`) + invariant gates.  
**Approver:** Data-Ops (0bd1fd16) — mandatory reviewer.  
**Rule:** No `DROP TABLE` without a prior `retirement` entry in `.spec/retired/`. No `DROP COLUMN` without evidence that 0 consumers exist (code search + 30-day DB stats).

**Tool restriction (Paperclip):**
- `mcp__claude_ai_Supabase__apply_migration` — reserved for Data-Ops agent and the `migration-gate` worker only.
- `mcp__claude_ai_Supabase__execute_sql` — reserved for Data-Ops agent only (production writes).
- Software-Architect, Code-Fixer, and Code-Analyst must NEVER invoke these tools directly on production.

---

### R4 — Cross-domain dependency change

**Scope:** A change that adds or removes a dependency between two modules (changes `depends_on` in a manifest), introduces a new cross-domain table read, or modifies a public export contract.

**Gate:** All R2 requirements + cross-domain dependency review.  
**Approver:** CTO (7fa3c971) — mandatory.  
**ADR required if:** The change introduces a new circular dependency, removes a previously public export, or changes the ownership of a table between modules.

---

## Manifest Lifecycle (mandatory_version_read + manifest_drift_clean)

Every agent working on a module MUST:

1. **`manifest_version_read`** — Read `.spec/modules/<module>/manifest.yaml` at the start of any work session on that module.

2. **`manifest_drift_clean`** — If the manifest is out of date (e.g., new routes exist that aren't listed, or a table is used but not in `owned_tables`/`read_tables`), open a manifest-sync PR before or alongside the feature work.

3. **Never work from memory** — The manifest is the source of truth for the module's contract, not the agent's prior knowledge.

### Promoting a manifest

| Transition | Who approves | Gate required |
|------------|-------------|---------------|
| `stub` → `draft` | PR author self-review | None (advisory only) |
| `draft` → `certified` | CTO review + comment | All invariants green, gate battery green |
| `certified` → `retired` | CTO + Data-Ops | Full retirement audit + `.spec/retired/` entry |

---

## Tooling Restrictions

| Tool | Allowed agents | Notes |
|------|----------------|-------|
| `mcp__claude_ai_Supabase__apply_migration` | Data-Ops (0bd1fd16), migration-gate worker | Production DB writes only |
| `mcp__claude_ai_Supabase__execute_sql` | Data-Ops (0bd1fd16) | Production SELECT allowed; writes are R3 |
| `mcp__claude_ai_Supabase__create_branch` | Any agent | Safe (creates isolated branch) |
| `mcp__claude_ai_Supabase__delete_branch` | Data-Ops only | Gate required |
| `gates/manifest-check.ts` | All agents (read) | Mandatory pre-commit for R2+ |

---

## Agent Ownership Rules

| Agent | Write scope | Cannot write to |
|-------|-------------|-----------------|
| Software-Architect (d2e89803) | `.spec/**`, `docs/adr/**`, `gates/**`, `.github/workflows/` (gates only) | `backend/**`, `frontend/**`, `scripts/**`, `packages/**` |
| Code-Fixer (b0df5075) | Modules where it is listed as `owner_agent` in manifest | Modules not listed in its ownership |
| Code-Analyst (77fbb90a) | Read + report only | Cannot write application code |
| Data-Ops (0bd1fd16) | `backend/supabase/migrations/**` | Application code |

---

## Violation Handling

If an agent takes an action that violates this protocol:

1. The gate blocks the PR (for R2+ violations).
2. The agent must NOT retry with `--no-verify` or equivalent bypass flags.
3. The agent posts a Paperclip comment on the task explaining the violation and requesting the appropriate approval.
4. If the agent is unsure of the correct level: escalate to CTO immediately — do not proceed.

Repeated violations (>2 in a sprint) trigger a governance review by CTO.
