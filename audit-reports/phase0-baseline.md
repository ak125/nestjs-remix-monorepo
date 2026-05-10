# Phase 0 — Cleanup Gate Baseline

Generated: 2026-04-24 — branch `feat/claude-knowledge-base`
Updated: 2026-04-24 — tier-1 refinements applied.

Deterministic tools ran on the full monorepo with all rules at `severity: warning`
(Phase 0 is non-blocking by design). This file is the baseline we promote to
`error` severity after each Phase 1 cleanup pass.

## Tier-1 refinements applied

- `backend-no-console-log` rule: added `ignores` for validation/CLI/test files.
  Eliminated 13 false positives (console.log in validate-*.ts tooling).
- `payments-no-raw-equality` rule: added `not has kind: string | template_string`
  constraint. Eliminated 2 false positives on config-value equality checks.
- `knip.json`: added entry patterns for workers, scripts, Remix routes config.
  Dropped unused types count from 338 to 310.
- `refresh-knowledge.py`: now strips JS/TS comments + filters providers by
  NestJS-class suffix (Service / Controller / Module / Guard / …). Cleaned
  ~117 lines of noise across 20 module .md files.

## Raw outputs (same directory)

- `phase0-knip.txt` — unused files / exports / deps
- `phase0-madge.txt` — circular dependencies
- `phase0-depcruise.txt` — architectural dependency violations
- `phase0-astgrep.txt` — rule-pattern violations from `.ast-grep/rules/`

## Summary

### knip (unused code + deps)

| Category                | Count (initial) | Count (tier-1) |
|-------------------------|-----------------|----------------|
| Unused files            | 362             | 362            |
| Unused dependencies     | 4               | 4              |
| Unused devDependencies  | 4               | 4              |
| Unlisted dependencies   | 10              | 9              |
| Unlisted binaries       | 4               | 3              |
| Unused exports          | 219             | 218            |
| Unused exported types   | 338             | **310** (-28)  |
| Duplicate exports       | 41              | 41             |

**Interpretation.** 362 files with no detected consumer is the largest lever,
unchanged after tier-1 because knip does not track NestJS decorator-based DI
registration. Classes annotated with `@Injectable`, `@Controller`, `@Module`
are loaded via metadata reflection, not imports — knip sees them as unused.
Fixing this would require a knip NestJS plugin config or explicit per-file
entries; out of Phase 0 scope.

A sampling pass before any bulk delete remains non-negotiable — expect that
a significant fraction of the 362 are NestJS-DI false positives.

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

**After tier-1 refinement: 0 warnings, 0 errors.** Both initial false-positive
clusters have been resolved by tightening the rules, so the baseline is clean.

Previously (before tier-1): 14 warnings :
1. `payments-no-raw-equality` — 1 false positive (`config.hmacKey === 'CONFIGURED'`,
   status probe not HMAC compare). Fixed by adding `not has kind: string`.
2. `backend-no-console-log` — 13 hits all in dev utility CLIs (`validate-phase0.ts`).
   Fixed by adding `ignores: backend/src/**/validate-*.ts` + cli/scripts/test patterns.

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
