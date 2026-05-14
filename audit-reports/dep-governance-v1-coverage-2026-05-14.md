# Dependency Governance Contract V1 — Coverage Report (PR-D)

> Generated 2026-05-14 during PR-D implementation.
> Mirror of `runtime-contract-v1-coverage-2026-05-14.md` (PR-5 #519) evidence pattern.

## Summary

| Metric | Value |
|---|---|
| L1 entries (`audit/registry/deps.json`) | **232** total (226 npm + 6 workspace) |
| V1 canon sample (`dep-governance.yaml`) | **26 npm deps** (≈ 11.5 % of npm L1) |
| Soft threshold (test §4.6) | < 500 |
| Schema sanity cap (Zod `.max()`) | 2000 |
| Cross-contract tests passing | 7/7 (19/19 test cases) |
| Determinism (test §4.7) | byte-identical across runs |
| Families covered | 11 of 14 (3 RESERVED V1) |

## L1 source distribution (232 entries, verified 2026-05-14)

```
npm      : 226 (97.4 %)
workspace:   6 ( 2.6 %)
github   :   0
git      :   0
```

PR-D V1 scope = **npm only** (workspace deps are covered by architecture.yaml boundaries).

## Family classification (V1 sample — 26 entries / 14 families)

| Family | Count V1 | Domain | Status |
|---|---|---|---|
| `auth`              | 3 | D11 | ✅ covered |
| `backend-platform`  | 3 | D14 | ✅ covered |
| `build-tooling`     | 2 | D13 | ✅ covered |
| `db`                | 1 | D1  | ✅ covered |
| `dev-tooling`       | 3 | D13 | ✅ covered |
| `frontend-ui`       | 3 | D8  | ✅ covered |
| `observability`     | 3 | D10 | ✅ covered |
| `rag`               | 2 | D6  | ✅ covered |
| `seo`               | 1 | D3  | ✅ covered |
| `testing`           | 3 | D13 | ✅ covered |
| `validation`        | 1 | D14 | ✅ covered |
| `vehicle`           | 0 | D4  | 🔒 RESERVED V1 (TecDoc-equivs not yet extracted) |
| `payments`          | 0 | D11 | 🔒 RESERVED V1 (paybox/systempay HTTP-only) |
| `other`             | 0 | —   | 🔒 RESERVED V1 (escape hatch only, no permanent residents) |

Test §4.5 RESERVED_V1 array enforces this — adding a `vehicle` or `payments` dep V1.5 requires updating both YAML + RESERVED_V1 simultaneously.

## V1 selection methodology

Heuristic regex-based dispatch from package name → family + domain:

```
^bcrypt|^passport|^jose|^jsonwebtoken         → auth / D11
^@nestjs/|^express|^reflect-metadata|^rxjs    → backend-platform / D14
^@supabase|^postgres|^pg|^drizzle             → db / D1
^zod|^ajv|^joi                                → validation / D14
^@anthropic-ai/|^openai|^@qdrant              → rag / D6
^@sentry|^pino|^opentelemetry                 → observability / D10
^react|^@remix-run|^@radix-ui|^tailwindcss    → frontend-ui / D8
^typescript|^prettier|^eslint|^husky|^@types/ → dev-tooling / D13
^vite|^turbo|^tsx|^esbuild                    → build-tooling / D13
^vitest|^@testing-library|^playwright         → testing / D13
^meilisearch                                  → seo / D3
```

Where multiple deps match per family, the script picks up to 3 (alphabetically). Owner = `@ak125` universal default for V1.

## Cross-contract test summary (19 cases passing)

| Test | Status | What it enforces |
|---|---|---|
| §4.1 schema integrity (12 sub-tests) | ✅ | Zod parse OK + 10 negative paths (extra fields rejected, malformed id/name/owner/family rejected, UNKNOWN domain rejected, id-name mismatch rejected, duplicate id/name rejected) |
| §4.2 cross-contract L1 | ✅ | Every contract `id` exists in `audit/registry/deps.json` |
| §4.3 cross-contract domains.yaml | ✅ | Every `domain` is declared in domains.yaml |
| §4.4 cross-contract ownership.yaml | ✅ | Every `owner` appears as `owner:` in ownership.yaml entries |
| §4.5 family enum coverage | ✅ | Every non-reserved FamilyIdSchema value used by ≥ 1 dep |
| §4.6 size warning | ✅ | `dependencies.length=26` < 500 soft threshold |
| §4.7 determinism | ✅ | Two consecutive `npm run dep-governance:build` produce byte-identical schema.json |

## Anti-parallel-truth checklist (canon §46 Loi B)

- ✅ `FamilyIdSchema` — NEW shared at `packages/registry/src/shared/family.ts` (the ONLY new shared schema in PR-D)
- ✅ `DomainIdSchema` REUSED from `shared/domain.ts` + `.refine()` to forbid UNKNOWN in canon
- ✅ `OwnerIdSchema` REUSED from `shared/owner.ts` (created in PR-5 #519)
- ✅ L1 `DepEntrySchema` shape consulted to align id format (`npm:<name>@<version>`)
- ✅ Inline regex for DepIdSchema accepts SemVer-range chars (verified all 226 npm L1 ids fit)
- ✅ 7 L1 fields explicitly omitted: source, version, workspaces, declaredIn, status, sourceConfidence, per-entry schemaVersion (extraction concerns, not invariants)

## Scope discipline (PR-D V1 explicitly OUT)

- License enforcement → `license-policy.yaml` + license-checker tool (V2 candidate)
- Version range hygiene (^ vs exact) → `version-policy.yaml` or renovate (V2 candidate)
- CVE / vulnerability scanning → `audit-ci` / `npm audit` output (existing tools, not in canon)
- Workspace deps (@fafa/*, @repo/*) → architecture.yaml boundaries (already covered)
- Phantom-dep prevention (transitive imports declared) → dependency-cruiser rule (V2)
- Cross-family forbidden imports (e.g., backend-platform must not import frontend-ui) → V2 cross-contract with architecture.yaml + ownership.yaml

## Files shipped in PR-D

| Path | LOC | Role |
|---|---|---|
| `packages/registry/src/shared/family.ts` | 47 | NEW shared FamilyIdSchema |
| `packages/registry/src/canonical/dep-governance-contract.ts` | 110 | L3 Zod schema |
| `packages/registry/src/__tests__/dep-governance-contract.test.ts` | 320 | 19 test cases |
| `packages/registry/src/bin/build-dep-governance-artifacts.ts` | 110 | L3 generator |
| `.spec/00-canon/repository-registry/dep-governance.yaml` | 230 | L2 canon YAML |
| `audit-reports/dep-governance-v1-coverage-2026-05-14.md` | 130 | This file |
| `.github/workflows/audit.yml` (+1 step) | +11 | CI hookup |
| `.gitignore` (+1 line) | +1 | dep-governance.schema.json gitignored |
| `packages/registry/package.json` (+1 script) | +1 | build:dep-governance |
| `package.json` (+1 script) | +1 | dep-governance:build delegation |
| `packages/registry/src/index.ts` (+1 export) | +1 | FamilyIdSchema exported |

## V2 roadmap

Preconditions (mirror PR-3b §52-57 / PR-5b in canon):
1. PR-D merged + ≥ 3 green `audit.yml` runs on main with `dep-governance:build` step.
2. No flaky test on `dep-governance-contract.test.ts`.
3. ≥ 1 contributor PR has touched `dep-governance.yaml` correctly.
4. Explicit V2 cadrage + new ADR if scope changes.

V2 candidate enrichments:
- Add `vehicle` and `payments` deps if/when SDKs are introduced.
- Extend V1 sample from 26 → ~80 entries (still well under 500 soft threshold).
- Per-team owners (replace universal `@ak125` with `@ak125/auth-team`, `@ak125/seo-team`, etc.).
- Cross-family forbidden imports (V2 cross-contract).
- License field (V2 contract or separate license-policy.yaml).

## Refs

- PR-D plan : `/home/deploy/.claude/plans/dependency-governance-contract-v1-2026-05-14.md`
- Canon series : `repository-contract-series-canon-20260514.md`
- PR-2 #507 (architecture V1) + PR-3a #511 (db V1) + PR-5 #519 (runtime V1)
- PR-W3 #512 (registry tests warn-only) + PR-W4 #513 (generator determinism evidence)
- ADR-058 (Repository Contract System)
