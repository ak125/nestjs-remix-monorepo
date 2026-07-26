# TS6 → TS7 shadow parity — measured 2026-07-26

Observation only. TypeScript 7 is **not** a repo dependency and must not become one
under this analysis. Sanctioned by `audit/dependencies/family-overlay.yaml` family
`tooling-typescript-go` (`upgrade_strategy: benchmark-only`,
`runtime_capabilities: [supports-shadow]`, `production_approved: false`).

Harness: [`scripts/audit/ts7-shadow-parity.ts`](../../scripts/audit/ts7-shadow-parity.ts)
· machine-readable results: [`ts7-shadow-parity.json`](ts7-shadow-parity.json)
· supersedes the single-project spot-check in
[`audit/karpathy-loop-pilot-buildspeed-2026-07-02.verdict.json`](../karpathy-loop-pilot-buildspeed-2026-07-02.verdict.json).

Compared: `typescript@6.0.3` (repo pin) vs `typescript@7.0.2` (npm `latest`).
Cold both sides, buildinfo redirected to scratch, sequential, median of 3 after
discarding one warm-up run. 12 tsconfig projects.

## Results

**PARITY 4 · BLOCKED_CONFIG 8 · DIVERGENT 0.** All 12 projects emit **0 diagnostics
under both compilers** — there is no diagnostic divergence anywhere in the repo today.

| Project | Verdict | TS6 | TS7 | |
|---|---|---:|---:|---|
| `frontend` | PARITY | 24011 ms | 2217 ms | **10.8×** |
| `backend` | BLOCKED_CONFIG | 19776 ms | 1975 ms | 10.0× |
| `services/remotion-renderer` | PARITY | 1806 ms | 387 ms | 4.7× |
| `packages/database-types` | PARITY | 966 ms | 239 ms | 4.0× |
| `packages/registry` | BLOCKED_CONFIG | 845 ms | 121 ms | 7.0× |
| `packages/seo-roles` | BLOCKED_CONFIG | 713 ms | 60 ms | 11.9× |
| `packages/seo-types` | PARITY | 547 ms | 101 ms | 5.4× |
| `packages/seo-role-contracts` | BLOCKED_CONFIG | 386 ms | 57 ms | 6.8× |
| `packages/cwv-taxonomy` | BLOCKED_CONFIG | 360 ms | 63 ms | 5.7× |
| `packages/domain-commerce` | BLOCKED_CONFIG | 217 ms | 47 ms | 4.6× |
| `packages/seo-url-contract` | BLOCKED_CONFIG | 215 ms | 50 ms | 4.3× |
| `packages/design-tokens` | BLOCKED_CONFIG | 189 ms | 51 ms | 3.7× |
| **sequential total** | | **50.0 s** | **5.4 s** | **9.3×** |

`BLOCKED_CONFIG` is always the same single cause:

```
error TS5108: Option 'moduleResolution=node10' has been removed.
```

The timings for blocked projects are still valid — TS7 type-checks the code and
reports the config error alongside it — but no parity claim is made for them.

**Do not read the 45 s aggregate saving as a CI or dev saving.** `turbo typecheck`
runs these in parallel with content caching, and `ci.yml` additionally restores
`.tsbuildinfo` across runs and narrows to `--affected` on PRs. The honest reading is
per-project cold latency, where the two that dominate are `frontend` (24.0 s → 2.2 s)
and `backend` (19.8 s → 2.0 s).

## Finding 1 — the node10 block is 2 deleted lines, not a nodenext migration

`packages/typescript-config/node-cjs-legacy.json` is inherited by all 8 blocked
projects and is the sole cause:

```json
{ "extends": "./base.json",
  "compilerOptions": { "module": "CommonJS", "moduleResolution": "Node", "ignoreDeprecations": "6.0" } }
```

`moduleResolution: "Node"` is node10, removed in TS7 and already deprecated in TS6 —
`ignoreDeprecations: "6.0"` exists only to silence that. **This debt is owed
regardless of TS7.**

The expected fix was a migration to `node16`/`nodenext`, estimated at 4–7 engineer-days:
`module: "commonjs"` + `moduleResolution: "node16"` is illegal (TS5110, `module` must
be node16/nodenext), `nodenext` on the backend changes the emit of 29 dynamic
`import()` sites, and `bundler` would drop the `node` condition of every exports map
while still emitting `require()`.

Measured instead: **simply omitting `moduleResolution` — keeping `module: "CommonJS"` —
makes all 8 blocked projects type-check clean under TS7 (0 diagnostics), and is a
no-op under TS6 (0 diagnostics).** Verified against probe configs for all 8,
including `packages/registry` (js-yaml/jose/micromatch, the highest-risk consumer)
and `backend` (1389 files, 74 external specifiers). `services/remotion-renderer`
independently corroborates this: it sets `module: commonjs` with no explicit
`moduleResolution` and is already PARITY.

### Not yet cleared — declaration emit changes

The backend *emits* (`tsc --build && tsc-alias`). Comparing emit under both configs:
file count is identical (4161), but some `.d.ts` files differ in the module
specifiers TS writes inside inferred type positions — it picks a shorter specifier
that resolves to the same module, e.g.

```
- import("../../gamme-rest/services/buying-guide-data.service").GammeBuyingGuideV1
+ import("../../gamme-rest/services").GammeBuyingGuideV1
```

**Whether any `.js` file differs was not measured.** Until it is, this is a lead, not
a green light. Required evidence before adopting: differing-file counts split by
extension, `npm run build` + `tsc-alias`, `node dist/main` boot, and the jest suite —
the repo carries a recorded scar on transform changes breaking NestJS DI
(`reference_backend_ts_jest_isolatedmodules_breaks_di_tests`).

Note also that removing the line makes TS6 and TS7 *derive* the default
independently. The measurement above shows both land on a working resolution for
these 12 projects; it does not prove the two defaults are identical.

## Finding 2 — `npx` silently breaks this benchmark

```
npx -y typescript@7.0.2 tsc --noEmit -p backend/tsconfig.json
→ error TS5042: Option 'project' cannot be mixed with source files on a command line.
```

npx forwards the `tsc` token as a positional argument, so tsc sees a phantom source
file. `npx … tsc --version` still prints `7.0.2`, which makes this easy to mistake for
a config problem. The harness therefore installs the pinned version into a scratch
prefix **outside the repo** and invokes the binary by absolute path — which also keeps
`package.json` / `package-lock.json` untouched, so no determinism gate is involved.

## Finding 3 — `typescript` itself still cannot move

`typescript-eslint@8.65.0` (latest) declares peer `typescript: ">=4.8.4 <6.1.0"`.
`typescript` is a member of the `tooling-typescript-eslint` `peer_dependency_cluster`,
where central rule #6 forbids partial cluster upgrades. So TS7 can only ever be
out-of-band tooling here until that peer range opens — independent of the node10 block.

## Finding 4 — the `tooling-typescript-go` overlay premise is stale

The family declares `members: ["@typescript/native-preview"]`,
`target_major: "tsc-go-preview"`, `migration_blockers: [NotProductionReady]`. As of
2026-07-26 TS7 has shipped stable as `typescript@7.0.2`, while
`@typescript/native-preview` is frozen at `7.0.0-dev.20260707.2`. The stated premise
no longer matches reality.

This does **not** contest `production_approved: false` — Finding 3 is an independent
and still-binding blocker. Recording only; `family-overlay.yaml` is a humans-only L2
surface and updating it is an owner decision.

## Why the harness has a preflight

Run from a checkout whose workspace-nested `node_modules` are absent and both
compilers report the *same* phantom `TS2307`s, so the comparison still reads PARITY
while the numbers describe a tree nobody ships. The harness now refuses to publish
in that state rather than degrading silently. First measured run of this harness hit
exactly that on `frontend` (14 phantom `@playwright/test` errors) and had to be discarded.

## Next actions (owner-gated)

1. Complete the emit evidence for Finding 1 (`.js` diff by extension, build, boot, jest).
   If `.js` is unchanged, the node10 removal becomes a small scoped PR that
   unblocks 8 projects and pays a TS6 deprecation — worth doing on its own merits.
2. Re-run `npm run audit:ts7-shadow` after that change; expect the 8 to move
   `BLOCKED_CONFIG` → `PARITY`.
3. Leave TS7 out-of-band until `typescript-eslint` opens its peer range.

Editing `packages/typescript-config/node-cjs-legacy.json` invalidates every turbo
cache entry (it is in `turbo.json` `globalDependencies`) and the CI `.tsbuildinfo`
cache key — one deliberate cold run, so it belongs in its own PR.
