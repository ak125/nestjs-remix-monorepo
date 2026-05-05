# `__regression__/` — Canon enforcement guard fixtures

Test fixtures verifying that lint enforcement rules (ast-grep + ESLint) catch
the patterns they're designed to catch. NOT executed by Jest, NOT scanned by
ast-grep at rest — opt-in only.

## SEO role canon guard

| File | Purpose |
|------|---------|
| `seo-role-canon-guard.regression.ts.disabled` | Validates ast-grep + ESLint union coverage for `seo-no-bare-role-literal` rule |

### Current state

- ast-grep rule `.ast-grep/rules/seo-no-bare-role-literal.yml` — **`severity: warning`** (PR-3a phase 3a, observe mode)
- ESLint `no-restricted-syntax` Literal selector (frontend/.eslintrc.cjs + backend/.eslintrc.js) — **`warn`**

### How to verify the rules trigger

```bash
# Step 1 — Rename fixture to active extension
mv __regression__/seo-role-canon-guard.regression.ts.disabled \
   __regression__/seo-role-canon-guard.regression.ts

# Step 2 — Run ast-grep with project config (should report 4 warnings)
# IMPORTANT : passe `--config sgconfig.yml` (sinon ast-grep ne charge pas
# le `files:` glob `__regression__/**/*.ts` et zéro hit). Scan le repo
# entier — ast-grep filtrera via le rule's files: glob.
npx ast-grep scan --config sgconfig.yml \
  --rule .ast-grep/rules/seo-no-bare-role-literal.yml \
  | grep "__regression__"
# Expected : 4 lines matching R3, R6, R9, R3_GUIDE bare literals

# Step 3 — Run ESLint (should report 8 warnings on suffixed legacy forms)
cd backend && npx eslint ../__regression__/seo-role-canon-guard.regression.ts

# Step 4 — Restore fixture to disabled state
mv __regression__/seo-role-canon-guard.regression.ts \
   __regression__/seo-role-canon-guard.regression.ts.disabled
```

### Promotion path : warning → error (PR-3b)

PR-3a (PR #309) ships **warning** mode. Promotion to **error** in PR-3b
requires :

1. **≥7 days observation** post PR-3a merge — no new warnings introduced
   on `main` branch via standard PRs
2. **0 baseline warnings** — verified by `npx ast-grep scan` returning
   no hits (PR-3a-cleanup #310 brought baseline 18 → 0)
3. **Code-owners SEO validate** the `ignores:` list in the YAML — no
   ignore entry was added without a corresponding canon-defining rationale
   (audit trail in commit messages)
4. **Promotion commit** : edit `severity: warning` → `severity: error` in
   the YAML + change ESLint `'warn'` → `'error'` in both eslintrc files

After promotion, attempting to introduce a bare `'R3'` / `'R6'` / `'R9'` /
`'R3_GUIDE'` literal in any non-ignored file will fail CI.

## Why fixtures don't run

- Jest ignores them (`testRegex: '.*\.test\.ts$'` is anchored, `.disabled`
  suffix doesn't match)
- ast-grep config scans `__regression__/**/*.ts` (not `.ts.disabled`) —
  fixture is invisible at rest
- ESLint is invoked per-project root (backend/ or frontend/) ; root-level
  `__regression__/` is outside both scopes by default

This intentional invisibility lets the fixtures live in the repo as living
documentation without polluting CI.
