# Runtime Contract V1 — Coverage Report (PR-5)

> Generated 2026-05-14 during PR-5 implementation.
> Mirror of `audit-reports/generator-determinism-2026-05-14.md` (PR-W4 #513) evidence pattern.
> Read alongside `.spec/00-canon/repository-registry/runtime-topology.yaml`
> and `repository-contract-series-canon-20260514.md`.

## Summary

| Metric | Value |
|---|---|
| L1 entries (`audit/registry/runtime.json`) | **470** |
| V1 canon sample (`runtime-topology.yaml`) | **28** (≈ 6 % of L1) |
| Soft threshold (test §4.6) | < 600 |
| Schema sanity cap (Zod `.max()`) | 5000 |
| Cross-contract tests passing | 9/9 (20/20 test cases including positive/negative) |
| Determinism (test §4.7) | byte-identical across runs |

## L1 kind distribution (470 entries)

Verified 2026-05-14 via `jq -r '.entries | group_by(.kind) | …' audit/registry/runtime.json` :

| Kind | L1 count | V1 sample | Coverage |
|---|---|---|---|
| `remix-route`      | 240 | 10 | 4.2 % |
| `nestjs-controller`| 163 | 10 | 6.1 % |
| `nestjs-module`    |  61 |  8 | 13.1 % |
| `other`            |   5 |  0 | **0 % (V1 gap)** |
| `worker`           |   1 |  0 | **0 % (V1 gap)** |
| **Total**          | **470** | **28** | **6.0 %** |

V1 is intentionally a *representative sample*, not exhaustive. Exhaustivity is
a V2 concern, preconditioned by PR-5 stability + observation period
(mirror PR-3b §52-57 preconditions in
`repository-contract-series-canon-20260514.md`).

The 5 kinds defined in `RuntimeKindSchema` but not yet emitted by the L1 builder
(`nestjs-service`, `remix-loader`, `remix-action`, `cron`, `migration`) are
forward-compatible: the canon schema accepts them as soon as a future L1 PR
starts emitting them.

## V1 GAPS — Critical entrypoints missing ownership.yaml coverage

The following **6 entrypoints** are present in L1 but **excluded from canon V1**
because no ownership.yaml glob covers them. Per PR-5 plan §4 NO MODIFY scope,
ownership.yaml extension is out of scope for PR-5.

| L1 ID | Kind | Gap |
|---|---|---|
| `runtime:backend/src/main.ts`           | other  | no glob covers `backend/src/main.ts` |
| `runtime:backend/src/main.server.ts`    | other  | no glob covers `backend/src/main.server.ts` |
| `runtime:backend/src/workers/main.ts`   | worker | no glob covers `backend/src/workers/**` |
| `runtime:frontend/app/entry.client.tsx` | other  | no glob covers `frontend/app/entry.*` |
| `runtime:frontend/app/entry.server.tsx` | other  | (idem) |
| `runtime:frontend/app/root.tsx`         | other  | no glob covers `frontend/app/root.tsx` |

**Proposed remediation (separate PR before V2)** — add 3 narrow globs to
ownership.yaml :

```yaml
- glob: backend/src/main*.ts          # NestJS entrypoints (main.ts, main.server.ts)
  domain: D14
  owner: '@ak125'
  sourceConfidence: high

- glob: backend/src/workers/**        # BullMQ worker bootstrap + future processors
  domain: D10
  owner: '@ak125'
  sourceConfidence: high

- glob: frontend/app/{entry.*,root.tsx}  # Remix root entrypoints
  domain: D14
  owner: '@ak125/frontend-team'
  sourceConfidence: high
```

Once those land, a follow-up PR can extend `runtime-topology.yaml` with the 6
deferred entries — no schema change needed, just data.

## Cross-contract test summary (verified locally 2026-05-14)

| Test | Status | What it enforces |
|---|---|---|
| §4.1 schema integrity (11 sub-tests) | ✅ | Zod parse OK + 9 negative paths (extra fields, malformed semver/owner/id/path, UNKNOWN domain, duplicate id, id ≠ path) |
| §4.2 L1 cross-check | ✅ | Every contract `id` exists in `audit/registry/runtime.json` (subset) |
| §4.3 domains.yaml cross-check | ✅ | Every contract `domain` is declared in domains.yaml entries |
| §4.4a ownership glob match | ✅ | Every contract `path` matches an ownership.yaml glob (micromatch) |
| §4.4b ownership owner FK | ✅ | Every contract `owner` appears as `owner:` in ownership.yaml |
| §4.5a architecture layer FK | ✅ | Every contract `layer` matches a declared `architecture.yaml#layers[].id` |
| §4.5b layer-path coherence | ✅ | Every contract `layer` === `inferLayerFromPath(path, architectureLayers)` |
| §4.6 size warning | ✅ | `entries.length` < 600 (currently: 28) |
| §4.7 determinism | ✅ | Two consecutive `npm run runtime-contract:build` runs produce byte-identical schema.json |

Plus 17 table-driven tests for `inferLayerFromPath` helper itself (separate file).

**Grand total: 37 tests passing** (20 in `runtime-contract.test.ts` + 17 in
`infer-layer-from-path.test.ts`).

## Anti-parallel-truth checklist (canon §46 Loi B)

Verified post-implementation:

- ✅ `RuntimeKindSchema` — REUSED from `packages/registry/src/entries/runtime-entry.ts:21` (10 values, NOT a parallel inline enum).
- ✅ `StatusSchema` — REUSED from `packages/registry/src/shared/status.ts` (5 values, NOT a 3-value parallel enum).
- ✅ `DomainIdSchema` — REUSED from `packages/registry/src/shared/domain.ts` + `.refine()` to forbid UNKNOWN in canon (mirror db-contract.ts:20).
- ✅ `OwnerIdSchema` — NEW shared at `packages/registry/src/shared/owner.ts`. Db-contract.ts `OwnerSchema` refactored to alias from shared (was a private duplicate).
- ✅ `layer` — `z.string()` cross-validated against `architecture.yaml#layers[].id` (test §4.5a). NO parallel layer enum.
- ✅ `inferLayerFromPath(path, layers)` — reads `architecture.yaml#layers[].rootGlobs` (test §4.5b). NO hardcoded glob rules.

## Schema regex extension — Remix flat-routes special chars

Verified all 470 L1 paths via :

```bash
jq -r '.entries[].path' audit/registry/runtime.json | grep -oE '[^a-zA-Z0-9._/-]' | sort -u
# Output: + [ ] $
```

Path character class extended in `runtime-contract.ts`:
`/^[a-zA-Z0-9._\-/+\[\]$]+$/`

Covers Remix flat-routes conventions:
- `$` splat / dynamic param (`routes/$.tsx`, `routes/$action.tsx`)
- `+` pathless group (`routes/_public+/_layout.tsx`)
- `[`, `]` escaped/optional segments (`routes/[.well-known].tsx`)

Without this extension, ~5 % of L1 paths would have been rejected — including
the V1 sample entry `routes/$.tsx`.

## Files shipped in PR-5

| Path | LOC | Role |
|---|---|---|
| `packages/registry/src/shared/owner.ts` | 30 | NEW shared OwnerIdSchema |
| `packages/registry/src/canonical/lib/infer-layer-from-path.ts` | 55 | NEW helper |
| `packages/registry/src/canonical/runtime-contract.ts` | 125 | L3 Zod schema |
| `packages/registry/src/__tests__/infer-layer-from-path.test.ts` | 98 | 17 helper tests |
| `packages/registry/src/__tests__/runtime-contract.test.ts` | 240 | 20 contract tests |
| `packages/registry/src/bin/build-runtime-contract-artifacts.ts` | 140 | L3 generator |
| `.spec/00-canon/repository-registry/runtime-topology.yaml` | 295 | L2 canon YAML |
| `audit-reports/runtime-contract-v1-coverage-2026-05-14.md` | 130 | This file |
| `.github/workflows/audit.yml` (+1 step) | +10 | CI hookup |
| `.spec/00-canon/repository-registry/architecture.yaml` (doctrine fix) | +2 −2 | Comment alignment |
| `.gitignore` (+1 line) | +1 | runtime-topology.schema.json gitignored |
| `packages/registry/package.json` (+1 script, +1 dep) | +3 | build:runtime-contract, micromatch |
| `package.json` (+1 script) | +1 | runtime-contract:build delegation |
| `packages/registry/src/canonical/db-contract.ts` (refactor) | +2 −3 | OwnerSchema → alias of shared OwnerIdSchema |
| `packages/registry/src/index.ts` (+1 export) | +1 | OwnerIdSchema exported |

## V2 roadmap (post PR-5 stability)

Preconditions (mirror PR-3b §52-57 in canon):
1. PR-5 merged + ≥ 3 green `audit.yml` runs on main with `runtime-contract:build` step.
2. No flaky test on `runtime-contract.test.ts`.
3. ≥ 1 contributor PR has touched `runtime-topology.yaml` correctly (proves doctrine readability).
4. Explicit V2 cadrage + new ADR if scope changes.

V2 candidate enrichments :
- Cover the 6 V1 gaps (worker + 5 other) after ownership.yaml extension.
- Extend the V1 sample from 28 → ~100 entries (still well under 600 soft threshold).
- Once `nestjs-service`, `remix-loader`, `remix-action`, `cron`, `migration`
  kinds start being emitted by L1, include representatives in canon.

## Refs

- PR-5 plan : `/home/deploy/.claude/plans/oui-pr-5-est-la-bubbly-origami.md`
- Canon series : `repository-contract-series-canon-20260514.md`
- PR-2 #507 (architecture contract V1)
- PR-3a #511 (db contract V1)
- PR-W3 #512 (registry tests CI step)
- PR-W4 #513 (generator determinism evidence)
- ADR-058 (Repository Contract System)
