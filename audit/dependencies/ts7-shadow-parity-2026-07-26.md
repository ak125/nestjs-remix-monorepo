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

TS7 is installed into `node_modules/.cache/ts7-shadow/<version>/` — a **gitignored
cache, outside the project's versioned state**. Nothing is added to `package.json` or
`package-lock.json`, so no determinism gate is involved and `overrides.typescript`
is not perturbed.

## Results

**PARITY 4 · BLOCKED_CONFIG 8 · DIVERGENT 0.**

Stated precisely: **0 source-level diagnostics on both compilers, and 8 config-level
`TS5108` diagnostics under TS7.** These two counts are reported separately in the
artifact (`ts6SourceDiagnostics`, `ts7SourceDiagnostics`, `ts7ConfigDiagnostics`) and
must not be collapsed into a single "zero diagnostics" claim.

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

**Do not read the 45 s aggregate saving as a CI or dev saving.** `turbo typecheck`
runs these in parallel with content caching, and `ci.yml` additionally restores
`.tsbuildinfo` across runs and narrows to `--affected` on PRs. The honest reading is
per-project cold latency, dominated by `frontend` (24.0 s → 2.2 s) and `backend`
(19.8 s → 2.0 s).

## Finding 1 — removing the node10 line is a compatibility fix, not a migration

`packages/typescript-config/node-cjs-legacy.json` is inherited by all 8 blocked
projects and is the sole cause:

```json
{ "extends": "./base.json",
  "compilerOptions": { "module": "CommonJS", "moduleResolution": "Node", "ignoreDeprecations": "6.0" } }
```

`moduleResolution: "Node"` is node10, removed in TS7 and already deprecated in TS6 —
`ignoreDeprecations: "6.0"` exists only to silence that. **This debt is owed regardless
of TS7.**

Measured: **omitting `moduleResolution` — keeping `module: "CommonJS"` — makes all 8
blocked projects type-check clean under TS7 (0 source diagnostics), and is a no-op
under TS6 (0 source diagnostics).** Verified against probe configs for all 8, including
`packages/registry` (js-yaml/jose/micromatch) and `backend` (1389 files, 74 external
specifiers). `services/remotion-renderer` corroborates independently: `module: commonjs`
with no explicit `moduleResolution`, already PARITY.

**This is explicitly not a modernisation.** With `module: "CommonJS"`, omitting
`moduleResolution` most likely just re-derives a Node10-compatible resolution
implicitly under TS6. It removes the TS7 error; it does not move the repo to
`nodenext`, which remains the recommended target for a modern Node application. It is
acceptable only as a **minimal compatibility fix, and only if proven inert.** Note also
that once the option is implicit, TS6 and TS7 each derive their own default — the
measurement above shows both land on a working resolution for these 12 projects, it
does **not** prove the two derived resolutions are identical. `--traceResolution` is
the instrument that settles that.

### Not cleared — required before any GO

Comparing backend emit under both configs: identical file count (4161), but some
`.d.ts` differ in the module specifiers TS writes inside inferred type positions —
it picks a shorter specifier resolving to the same module, e.g.

```
- import("../../gamme-rest/services/buying-guide-data.service").GammeBuyingGuideV1
+ import("../../gamme-rest/services").GammeBuyingGuideV1
```

**Whether any `.js` differs was not measured.** Until the matrix below is run, this is
a lead, not a green light.

#### Validation matrix

Both lines (`moduleResolution` **and** `ignoreDeprecations`) must be removed together.

| Comparison | Purpose |
|---|---|
| TS6 + current config ↔ TS6 without the two lines | prove today's shipped build does not change |
| TS6 without the lines ↔ TS7 without the lines | measure the future TS7 migration |

Evidence to collect for each:

- count **and SHA-256** of `.js`, `.d.ts`, `.js.map`, `.d.ts.map`
- normalised `--traceResolution` output for `backend` and `packages/registry`
- full build including `tsc-alias`
- `node dist/main` boot + `/health`
- backend Jest suite, specifically the Nest DI tests
  (scar: `reference_backend_ts_jest_isolatedmodules_breaks_di_tests`)
- the 29 dynamic `import()` sites
- Docker build + PREPROD smoke

#### Decision rule

- **GO** (separate PR removing the two lines): TS6 before/after byte-identical for `.js`, tests and boot green.
- Differences confined to `.d.ts` **between TS6 and TS7**: blocks future TS7 adoption, not necessarily the TS6 cleanup.
- **NO-GO** for the simple removal: any `.js` difference between TS6 before/after, any resolution difference, or any DI failure.

## Finding 2 — `npx` shorthand misparses; the explicit form is fine

```
npx -y typescript@7.0.2 tsc --noEmit -p <p>
→ error TS5042: Option 'project' cannot be mixed with source files on a command line.
```

npx resolves the package's single bin and leaves the `tsc` token as a positional source
file. `--version` still prints `7.0.2`, so the shorthand looks healthy — that is what
makes it worth recording.

**The correct form works, including real type-checks** (verified on both a blocked and
a passing project):

```
npx --package=typescript@7.0.2 -- tsc --noEmit -p <p>
```

So the pinned cache install is used for **isolation and to avoid re-downloading the
compiler on every run** — not because npx is incapable of executing it.

## Finding 3 — `typescript` itself still cannot move

`typescript-eslint@8.65.0` (latest) declares peer `typescript: ">=4.8.4 <6.1.0"`.
`typescript` is a member of the `tooling-typescript-eslint` `peer_dependency_cluster`,
where central rule #6 forbids partial cluster upgrades. TS7 can only be out-of-band
tooling here until that peer range opens — independent of the node10 block.

## Finding 4 — the `tooling-typescript-go` overlay premise is stale

The family declares `members: ["@typescript/native-preview"]`,
`target_major: "tsc-go-preview"`, `migration_blockers: [NotProductionReady]`. As of
2026-07-26 TS7 has shipped stable as `typescript@7.0.2`, while
`@typescript/native-preview` is frozen at `7.0.0-dev.20260707.2`.

This does **not** contest `production_approved: false` — Finding 3 is independent and
still binding. Recording only; `family-overlay.yaml` is a humans-only L2 surface.

## Two guards worth knowing

**Preflight.** Run from a checkout whose workspace-nested `node_modules` are absent and
both compilers report the *same* phantom `TS2307`s, so the comparison reads PARITY while
the numbers describe a tree nobody ships. The harness refuses to publish in that state.
The first run of this harness hit exactly that on `frontend` (14 phantom
`@playwright/test` errors) and was discarded.

**TS6059 / TS6307 participate in the comparison.** They were briefly suppressed as
"status noise". They are not: TS6059 is *file not under `rootDir`* and TS6307 is *file
not listed in a composite project's file list* — both describe the project file graph,
and both are exactly what a resolution-mode change can flip. Suppressing them could
turn a real difference into a false PARITY. Neither occurs in this repo today (verified
across all 12 projects on both compilers), so including them costs nothing.

## Next actions (owner-gated)

1. Run the validation matrix above in a **separate PR**. This one stays observational.
2. If the decision rule says GO, remove both lines there — it unblocks 8 projects and
   pays a TS6 deprecation.
3. Re-run `npm run audit:ts7-shadow`; expect the 8 to move `BLOCKED_CONFIG` → `PARITY`.
4. Leave TS7 out-of-band until `typescript-eslint` opens its peer range.

Editing `packages/typescript-config/node-cjs-legacy.json` invalidates every turbo cache
entry (it is in `turbo.json` `globalDependencies`) and the CI `.tsbuildinfo` cache key —
one deliberate cold run, so it belongs in its own PR.
