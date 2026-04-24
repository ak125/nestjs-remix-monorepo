# Phase 0 — Cleanup Gate Baseline

Generated: 2026-04-24 — branch `feat/claude-knowledge-base`

Deterministic tools ran on the full monorepo with all rules at `severity: warning`
(Phase 0 is non-blocking by design). This file is the baseline we promote to
`error` severity after each Phase 1 cleanup pass.

## Raw outputs (same directory)

- `phase0-knip.txt` — unused files / exports / deps
- `phase0-madge.txt` — circular dependencies
- `phase0-depcruise.txt` — architectural dependency violations
- `phase0-astgrep.txt` — rule-pattern violations from `.ast-grep/rules/`

## Summary

### knip (unused code + deps)

| Category                | Count |
|-------------------------|-------|
| Unused files            | 362   |
| Unused dependencies     | 4     |
| Unused devDependencies  | 4     |
| Unlisted dependencies   | 10    |
| Unlisted binaries       | 4     |
| Unused exports          | 219   |
| Unused exported types   | 338   |
| Duplicate exports       | 41    |

**Interpretation.** 362 files with no detected consumer is the largest lever.
Some may be false positives (route files loaded by Remix's flat-router, dynamic
imports, CLI scripts not listed as entry points). A sampling pass before bulk
delete is non-negotiable.

### madge (circular dependencies)

- **Backend**: 16 cycles across `config/role-ids.ts`, `workers/types/`,
  `modules/admin/services/brief-gates`, `modules/rag-proxy/*`, `modules/products`,
  `modules/blog`, `modules/support`, `auth ↔ users`.
- **Frontend**: 1 cycle `root.tsx → hooks/useRootData.ts`.

**Interpretation.** All cycles are local (within a module or between
directly-coupled modules), none cross the backend/frontend boundary. The
`rag-proxy/*` cluster (3 cycles) is the densest; refactoring it would most
likely require breaking out a shared-types file.

### dependency-cruiser (architectural violations)

- 148 warnings on 2101 modules, 8425 dependencies
- 0 errors (Phase 0 severity = `warn` across the board)
- 1 flagged phantom dep: `file-type` imported by
  `backend/src/modules/upload/services/file-validation.service.ts` but not in
  `package.json` — promote to error after a quick `npm i -D file-type`.
- Cross-module service imports (`no-deep-module-access`) flagged but left as
  warning — typical NestJS setup where shared services get imported across
  module boundaries.

### ast-grep (pattern rules from `.ast-grep/rules/`)

14 warnings across the 2 initial rules:

1. `payments-no-raw-equality` — 1 hit in
   `backend/src/modules/payments/controllers/paybox-monitoring.controller.ts:159`
   (`config.hmacKey === 'CONFIGURED'`). Not a real HMAC comparison — it's a
   status probe. Either whitelist this file, or tighten the rule's AST pattern
   to match only `crypto`-involved comparisons.
2. `backend-no-console-log` — 13 hits, all in dev utility scripts
   (`validate-phase0.ts` etc). Legit in validation CLIs; rule needs a
   `pathNot: scripts|validators` filter.

**Pending rule** : a guard against raw supplier-prefixed columns (the ones
suffixed `_i` should always be used instead) is **not yet wired**. The literal
column prefix in the DB clashes with a project naming constraint; decide on
the matcher before enabling.

## Gate posture after Phase 0

| Tool                   | Phase 0 posture            | Run via                   |
|------------------------|----------------------------|---------------------------|
| ast-grep               | pre-commit, soft-fail      | `npm run audit:ast`       |
| knip                   | on-demand / CI             | `npm run audit:knip`      |
| madge                  | on-demand / CI             | `npm run audit:madge`     |
| dependency-cruiser     | on-demand / CI             | `npm run audit:depcruise` |
| Full audit             | on-demand                  | `npm run audit:all`       |

**Rationale.** knip / madge / depcruise scan the full monorepo and take
several seconds to ~1 min each — running them on every commit punishes fast
iteration. ast-grep is Rust-fast and narrow, so it stays in the pre-commit
hook as the "symbolic rule" guard.

## Promotion path (after Phase 1 cleanup)

1. Delete or justify each of the 362 unused files (knip review).
2. Break the 17 cycles (extract shared types, invert one dependency).
3. Add `file-type` to `package.json`, then promote `no-non-package-json` to
   `error` in `.dependency-cruiser.cjs`.
4. Tighten ast-grep `payments-no-raw-equality` (match `crypto.*` contexts only),
   then promote to `error`.
5. Add a CI job running `npm run audit:all` on every PR with
   `--no-exit-code` replaced by strict mode.

## Non-objectives of Phase 0

- Not deleting any code. Only collecting evidence.
- Not refactoring cycles. Only identifying them.
- Not failing commits. Only surfacing signals.
- Not making Phase 1 decisions. Human-in-the-loop for every deletion.

---

_Run `npm run audit:all` to regenerate this data end-to-end._
