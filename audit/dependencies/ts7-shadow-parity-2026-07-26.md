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
cache, outside the project's versioned state**. **No dependency is added and the
lockfile does not change; `package.json` gains only the audit entry points**
(`audit:ts7-shadow*` scripts). So no determinism gate keyed on dependencies is
involved and `overrides.typescript` is not perturbed.

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
`.tsbuildinfo` across runs.

Be precise about `--affected`: it is appended **only on `pull_request` events**. Pushes
to `main` and `dev` run a **full** typecheck — see the `🔎 Type check` step of
[`ci.yml`](../../.github/workflows/ci.yml) (referenced by step name, not line number, which
will drift): it narrows on PRs deliberately and never on the pre-deploy gate. So `--affected` is not what
makes the aggregate misleading on the push path; Turbo parallelism, content caching and
the restored `.tsbuildinfo` are. The conclusion is unchanged either way.

The honest reading is per-project cold latency, dominated by `frontend` (24.0 s → 2.2 s)
and `backend` (19.8 s → 2.0 s).

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

### VERDICT: NO-GO for the simple removal (matrix run 2026-07-27)

The first half of the matrix has now been run on `backend`, removing **both** lines
together. Result: **NO-GO**, on the `resolution differs` clause of the decision rule.

**Emit — passes.** Identical counts (1387 each of `.js`, `.d.ts`, `.js.map`; no
`.d.ts.map`), and aggregate SHA-256 per class:

| class | before | after | |
|---|---|---|---|
| `.js` | `3be33871…` | `3be33871…` | **IDENTICAL** |
| `.js.map` | `17a0005b…` | `17a0005b…` | **IDENTICAL** |
| `.d.ts` | `3cd78d58…` | `0b127b7a…` | differs — 15 / 1387 files |

All 15 `.d.ts` diffs are confined to `import("…")` specifier text (0 files with a
differing line that does not contain `import(`), e.g. a shorter specifier resolving via
a barrel:

```
- import("../../gamme-rest/services/buying-guide-data.service").GammeBuyingGuideV1
+ import("../../gamme-rest/services").GammeBuyingGuideV1
```

**Resolution — fails.** `--traceResolution`, normalised and compared on outcomes only
(`Module name 'X' was successfully resolved to 'Y'`, probe-path noise discarded):

- `packages/registry`: **same outcomes** (228 = 228). Clean.
- `backend`: **outcomes differ** — 6720 → 6812 unique resolutions; **27 distinct
  specifiers resolve to a different target**, 2 disappear, 81 are new.
- Resolutions landing on **ESM declarations (`.d.mts`) go from 1 to 7** on a backend
  that emits CommonJS `require()`: `helmet`, `openai`, `@anthropic-ai/sdk`, `cookie-es`,
  `js-yaml`, …
- Flips in both directions: `engine.io-parser` moves `build/esm/*.d.ts` →
  `build/cjs/*.d.ts`; `gaxios` gains `build/esm/*` alongside its `build/cjs/*`.

**Why `.js` identity was never sufficient evidence.** Types are erased at emit, so the
emitted JavaScript is byte-identical *even though the type-checking basis moved under
it*. The runtime shipped today is unaffected; what changed is which declaration files
27+81 specifiers are checked against — including six new CJS→ESM declaration surfaces.
That is not "inert", so it fails the bar this removal was allowed under.

**Consequence.** Deleting the line trades a loud, correct TS7 error for a silent
resolution change. The right fix is an explicit, supported `moduleResolution` — i.e.
the real `nodenext` migration — not omission. The shortcut does not exist. The 4–7 day
figure is a **planning estimate, not a measured duration** — no pilot has been run, so
it must not be cited as an observed number.

Remaining matrix items (`tsc-alias`, `node dist/main` boot, Jest DI, the 29 dynamic
`import()` sites, Docker + PREPROD smoke) were **not run**: the decision rule already
fires NO-GO on resolution difference, and `.js` identity means they could not overturn it.

#### Validation matrix (as specified)

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

## Decision — PARKED (owner, 2026-07-27)

**TS7 is parked. No action is open.** Recommendation accepted on the reasoning that the
blocker is external (Finding 3), the measured gain is a cold sequential benchmark rather
than a CI saving, and TS7 appears in none of the five canonical priorities.

Operationally, and until the reopening trigger below fires:

- **Do not** modify `packages/typescript-config/node-cjs-legacy.json`.
- ~~**Do not** start the `nodenext` pilot on `packages/seo-url-contract`.~~ Lifted for
  this one project by the owner on 2026-10-15 — see *Owner GO 2026-10-15* below.
- **Do not** add TS7 to the repository (no dependency, no lockfile entry).
- Keep **only** the observation harness (`npm run audit:ts7-shadow`).

### Reopening trigger — state it exactly

> A **stable** `typescript-eslint` release whose peer range **explicitly includes
> `typescript@7.x`**, permitting a full upgrade of the TypeScript/ESLint cluster.

**A range that merely opens to TypeScript 6.x unblocks nothing.** Do not settle for
"the peer moved past `<6.1.0`" — that is the trap. Verified 2026-07-29:
`typescript-eslint@8.65.0` (latest stable) still declares
`typescript: ">=4.8.4 <6.1.0"`, and central rule #6 of the `peer_dependency_cluster`
forbids upgrading the cluster partially.

### Sequence at reopening — `nodenext` FIRST, cluster upgrade LAST

**The order matters and the intuitive one is wrong.** Upgrading the cluster first — i.e.
letting TS7 become the repo compiler before the migration — would immediately produce the
**8 `TS5108` errors** documented above. The repository could not stay green between steps.
So TS7 enters the lockfile only once its configuration blockers are already gone:

1. Verify a **stable** `typescript-eslint` explicitly supports `typescript@7.x` (see the
   trigger above — a 6.x-only opening does not qualify).
2. Re-run the harness to refresh the baseline.
3. **Keeping TS6 as the repo compiler**, migrate to `nodenext` **project by project**,
   smallest blast radius first (`seo-url-contract` 3 files → `domain-commerce` 6 → … →
   `backend` 1389; `packages/registry` is already clean at the resolution level).
   **Do not flip the shared `node-cjs-legacy.json`** — migrate each project on its own.
4. After **each** project: TS7 harness, resolution traces, emit, consumer tests.
5. Once every `BLOCKED_CONFIG` is eliminated, upgrade the **whole** TypeScript/ESLint
   cluster in a **single atomic PR** → `npm ci` → typed lint → full typecheck / build /
   tests → PREPROD.

What this buys: the `nodenext` migrations stay green under TS6; the harness proves
`BLOCKED_CONFIG` → `PARITY` incrementally; TS7 lands only after its blockers are cleared;
and central rule #6 (no partial cluster upgrade) is respected throughout.

The node10 debt stays on the books, unpaid: it does not justify diverting time now from
commerce-loop-v1, the runtime truths, Web Vitals, and the content pipeline.

Editing `packages/typescript-config/node-cjs-legacy.json` invalidates every turbo cache
entry (it is in `turbo.json` `globalDependencies`) and the CI `.tsbuildinfo` cache key —
one deliberate cold run, so it belongs in its own PR.

## Owner GO 2026-10-15 — `nodenext` pilot on `packages/seo-url-contract` only

The PARKED decision above stands. The owner lifted **one** of its lines, the pilot on
`packages/seo-url-contract`, and nothing else: `node-cjs-legacy.json` is untouched, TS7
is still not a repo dependency (no `package.json` or lockfile change), and no other
project is migrated.

The reopening trigger has **not** fired. Verified 2026-10-15: `typescript-eslint@8.71.2`
(latest stable) still declares `typescript: ">=4.8.4 <6.1.0"`. TypeScript 7.0 also ships
without a JS API (`typescript@7.0.2` exports `./lib/version.cjs` and `unstable/*` only),
so tools that import `typescript` cannot move to 7.x whatever their peer range says.

### Change

`packages/seo-url-contract/tsconfig.json` extends `base.json` instead of
`node-cjs-legacy.json` and sets `module` and `moduleResolution` to `NodeNext`. The file
is byte-identical to `packages/seo-types/tsconfig.json`. The package has no `"type"`
field, so its files stay **CommonJS** under `NodeNext`: the module format does not
change, only the resolution algorithm.

Effective delta (`tsc --showConfig`, TS 6.0.3): `ignoreDeprecations: "6.0"` removed;
`module` commonjs → nodenext; `moduleResolution` node10 → nodenext; `moduleDetection`
→ force; `resolvePackageJsonExports` / `resolvePackageJsonImports` → true (NodeNext
defaults). Nothing else.

### Evidence — TS 6.0.3, the repo compiler

| Check | Before | After |
|---|---|---|
| `tsc --noEmit` | exit 0, 0 diagnostics | exit 0, 0 diagnostics |
| `tsc` build | exit 0 | exit 0 |
| Emit (`.js`, `.d.ts` and their maps) | 12 files | the same 12, byte-identical (sha256) |
| Specifiers resolved (`--traceResolution`) | 1: `./url-rules` → `src/url-rules.ts` | identical |
| Bare specifiers | 0 | 0 |
| Program files (`--explainFiles`) | 48 (45 lib + 3 src) | the same 48 |
| Package tests (`tsx --test`) | 5/5 | 5/5 |

After the change, `--explainFiles` adds one line per source file — *"File is CommonJS
module because 'package.json' does not have field "type""* — which confirms the format.

Consumers: the backend Jest config maps `@repo/seo-url-contract` to `src/`, which is
unchanged; every other consumer goes through the unchanged `package.json` `exports` to
`dist/`, whose emit is byte-identical. The consumer delta is zero by construction.

### Evidence — TS 7.0.2, observation

Run before commit on this project alone, with the harness's own functions: the pinned
`ensureTs7` installer, the `runCompiler` arguments, `parseDiagnostics` and `classify`.
The TS6 exit code is checked as well, so a TS6 crash cannot pass as 0 diagnostics.

| Configuration | Classification | TS6 | TS7 |
|---|---|---|---|
| Before (`node-cjs-legacy.json`) | BLOCKED_CONFIG | exit 0, 0 diagnostics | `TS5108` |
| After (`NodeNext`) | PARITY | exit 0, 0 diagnostics | exit 0, 0 diagnostics |

### `ts7-shadow-parity.json` is not regenerated here

- It is already stale on `main`: its `inputHash` stopped matching when #1473 changed
  `backend/tsconfig.json`.
- A full run needs a checkout that passes the harness preflight, and a fresh `npm ci`
  worktree does not. The preflight requires a `node_modules` directory inside every
  workspace that declares dependencies; a hoisted install creates one only where versions
  conflict, so 7 of the 11 workspace projects have none (`services/remotion-renderer` is
  not a workspace and needs its own install). On the long-lived DEV checkout those 7
  directories exist and are empty. The check tests for the directory, not for resolvable
  dependencies.

Refreshing the artifact is a separate observation task. Until then, its
`packages/seo-url-contract` row (BLOCKED_CONFIG) describes the configuration before this
change, and the 4–7 day estimate above remains a planning figure: this pilot covers the
smallest project only.

## `nodenext` on `packages/domain-commerce` — second project of the sequence

Same scope rule as the pilot: one project. `node-cjs-legacy.json` is untouched, TS7 is
still not a repo dependency (no `package.json` or lockfile change), and the PARKED
decision above stands.

`packages/domain-commerce` belongs to D11 (order and order-line statuses), owned by
payments-team. The change is compile configuration only, the emitted `dist/` is
byte-identical, and the package's sources, tests and `package.json` do not change. It was
applied by a delivery script that only the owner runs: that run is the owner's GO for
this project.

### Change

`packages/domain-commerce/tsconfig.json` becomes byte-identical to
`packages/seo-url-contract/tsconfig.json`: it extends `base.json` and sets `module` and
`moduleResolution` to `NodeNext`. The package has no `"type"` field, so its files stay
**CommonJS**. The effective delta (`tsc --showConfig`, TS 6.0.3) is the pilot's:
`ignoreDeprecations: "6.0"` removed; `module` commonjs → nodenext; `moduleResolution`
node10 → nodenext; `moduleDetection` → force; `resolvePackageJsonExports` /
`resolvePackageJsonImports` → true. Nothing else.

### Evidence — TS 6.0.3, the repo compiler

| Check | Before | After |
|---|---|---|
| `tsc --noEmit` | exit 0, 0 diagnostics | exit 0, 0 diagnostics |
| `tsc` build | exit 0 | exit 0 |
| Emit (`.js`, `.d.ts` and their maps) | 16 files | the same 16, byte-identical (sha256) |
| Specifiers resolved (`--traceResolution`) | 3: `./order-status`, `./order-line-status`, `./order-events` → `src/*.ts` | identical |
| Bare specifiers | 0 | 0 |
| Program files (`--explainFiles`) | 49 (45 lib + 4 src) | the same 49 |
| Package tests (`tsx --test`) | 22/22 | 22/22 |

After the change, `--explainFiles` adds the *"File is CommonJS module"* line for each of
the 4 source files.

Consumers: the backend only (orders controller and services, the command-center KPI
service, one unit test). It resolves the package through its unchanged `package.json`
(`exports`, `main`, `types`) to `dist/`, and no `tsconfig` or Jest config maps it to
`src/`. The emit is
byte-identical, so the consumer delta is zero by construction.

### Evidence — TS 7.0.2, observation

Same method as the pilot: this project alone, the harness's own functions, TS6 exit code
checked. The delivery script commits only if the run before the change is
`BLOCKED_CONFIG` with `TS5108` and the run after is `PARITY` with TS6 and TS7 at exit 0
and 0 diagnostics.

| Configuration | Classification | TS6 | TS7 |
|---|---|---|---|
| Before (`node-cjs-legacy.json`) | BLOCKED_CONFIG | exit 0, 0 diagnostics | `TS5108` |
| After (`NodeNext`) | PARITY | exit 0, 0 diagnostics | exit 0, 0 diagnostics |

### Still `BLOCKED_CONFIG`

Six projects remain on `node-cjs-legacy.json`: `packages/design-tokens`,
`packages/cwv-taxonomy`, `packages/seo-role-contracts`, `packages/seo-roles`,
`packages/registry` and `backend`. `ts7-shadow-parity.json` is still not regenerated, for
the reasons given in the pilot section; its `packages/domain-commerce` row describes the
configuration before this change.

## `nodenext` on `packages/design-tokens` — third project of the sequence

Same scope rule as the pilot: one project. `node-cjs-legacy.json` is untouched, TS7 is
still not a repo dependency (no `package.json` or lockfile change), and the PARKED
decision above stands.

`packages/design-tokens` belongs to D8, owned by frontend-team. The emitted `dist/` is
byte-identical. The change was applied by a delivery script that only the owner runs:
that run is the owner's GO for this project.

### What differs from the first two projects

- The package is `"type": "module"`. Under `NodeNext` its sources are **ECMAScript
  modules**, so a relative specifier must carry its extension. With the configuration
  change alone, `src/index.ts` fails with `TS2835` on `'./tokens/generated'`.
- The build is tsup (an esbuild bundle, declarations through rollup-plugin-dts), not
  `tsc`. tsup 8.5.1 adds `baseUrl: "."` to the options of its declaration build
  (`node_modules/tsup/dist/rollup.js`: `baseUrl: compilerOptions.baseUrl || "."`), and
  TS 6.0.3 rejects it: *TS5101: Option 'baseUrl' is deprecated and will stop functioning
  in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this
  error.* Until now, the `ignoreDeprecations: "6.0"` of `node-cjs-legacy.json` silenced
  it, and nothing recorded that dependency.

### Change

Three files of the package:

- `tsconfig.json` (+3 −1) extends `base.json` instead of `node-cjs-legacy.json`, and sets
  `module` and `moduleResolution` to `NodeNext`. It is not a copy of
  `packages/seo-url-contract/tsconfig.json`, because that file also sets `composite`, an
  ES2020 `target` and `lib`, `isolatedModules` and more, which would change more than
  module resolution. The effective delta (`tsc --showConfig`, TS 6.0.3) is the pilot's:
  - `ignoreDeprecations: "6.0"` is removed;
  - `module` goes from commonjs to nodenext, and `moduleResolution` from node10 to
    nodenext;
  - `moduleDetection` becomes force;
  - `resolvePackageJsonExports` / `resolvePackageJsonImports` are no longer forced to
    false (the NodeNext default is true).

  Nothing else changes.
- `src/index.ts` (+1 −1): `export * from './tokens/generated.js';`. This file is written
  by hand; `scripts/build-tokens.mjs` generates only `src/tokens/generated.ts`. The new
  specifier also compiles under the old configuration (0 diagnostics).
- `tsup.config.ts` (+3 −1): `dts: { compilerOptions: { ignoreDeprecations: '6.0' } }`
  instead of `dts: true`. For this package, the exemption no longer covers `tsc` or the
  ESLint parser. It covers only the build that injects the option.

### The tsup exemption, checked both ways

- **Alive.** With the new `tsconfig.json` and `src/index.ts` but `dts: true`, the build
  fails with `TS5101` on `baseUrl`. The delivery script re-runs this check and the next.
- **Narrow.** With the exemption but the old specifier, the declaration build still fails
  with `TS2835`: it silences the deprecation, not resolution errors.
- **Exit.** tsup 9.0.0, published 2026-10-14, no longer sets `baseUrl` in that block.
  This was read in the published tarball, which was not installed. Moving to tsup 9 is a
  dependency change outside this scope. The change that does it must also remove the
  exemption, which would then be dead.
- **TS7.** `PARITY` below is measured on `tsc` only, as the harness does. With tsup 8.5.1,
  the package's declaration build still relies on `baseUrl`, which TS 7.0 stops honouring.
  This project's build is therefore not TS7-ready until tsup moves. No other workspace
  declares tsup.

### Evidence — TS 6.0.3, the repo compiler

| Check | Before | After |
|---|---|---|
| `tsc --noEmit` | exit 0, 0 diagnostics | exit 0, 0 diagnostics |
| Package build (`build-tokens.mjs`, then tsup) | exit 0 | exit 0 |
| `dist/` (`index.js`, `index.cjs`, `index.d.ts`, `index.d.cts`, both maps, `tokens.css`) | 7 files | the same 7, byte-identical (sha256) |
| Specifiers resolved (`--traceResolution`) | 1: `./tokens/generated` → `src/tokens/generated.ts` | 1: `./tokens/generated.js` → the same file |
| Bare specifiers | 0 | 0 |
| Program files (`--explainFiles`) | 65 (61 lib + 4 src) | the same 65 |
| Package tests (vitest) | 17/17 | 17/17 |
| `build:check`, `check:reserved-namespaces` | pass | pass |
| ESLint (`eslint src`, type-aware parser on `tsconfig.json`) | 0 problems | 0 problems |

After the change, `--explainFiles` adds the line *"File is ECMAScript module because
'package.json' has field "type" with value "module""* for each of the 4 source files.

The package tests read `src/tokens.json`, the scripts and the generated projections. They
do not compile `src/*.ts`, so they guard against regressions but say nothing about module
resolution.

Consumers: the frontend only, through `@fafa/design-tokens/css` (`dist/tokens.css`, copied
from `src/styles/tokens.css`) and `@fafa/design-tokens/tailwind-tokens`
(`src/tailwind-tokens.cjs`, which is not compiled). Nothing in the repo imports the
TypeScript entry point (`.`). `dist/` is byte-identical, so the consumer delta is zero by
construction.

### Evidence — TS 7.0.2, observation

Same method as the pilot: this project alone, the harness's own functions, TS6 exit code
checked. The delivery script commits only if the run before the change is
`BLOCKED_CONFIG` with `TS5108` and the run after is `PARITY` with TS6 and TS7 at exit 0
and 0 diagnostics.

| Configuration | Classification | TS6 | TS7 |
|---|---|---|---|
| Before (`node-cjs-legacy.json`) | BLOCKED_CONFIG | exit 0, 0 diagnostics | `TS5108` |
| After (`NodeNext`) | PARITY | exit 0, 0 diagnostics | exit 0, 0 diagnostics |

### Still `BLOCKED_CONFIG` after the third project

Five projects remain on `node-cjs-legacy.json`: `packages/cwv-taxonomy`,
`packages/seo-role-contracts`, `packages/seo-roles`, `packages/registry` and `backend`.
`ts7-shadow-parity.json` is still not regenerated, for the reasons given in the pilot
section; its `packages/design-tokens` row describes the configuration before this change.

## `nodenext` on `packages/cwv-taxonomy` — fourth project of the sequence

Same scope rule as the pilot: one project. `node-cjs-legacy.json` is untouched, TS7 is
still not a repo dependency (no `package.json` or lockfile change), and the PARKED
decision above stands.

`packages/cwv-taxonomy` belongs to D11, owned by seo-team. It is the runtime taxonomy of
the CWV beacon: surfaces, funnel steps, priority tiers, metrics, route groups, user-agent
classes and the beacon's zod schemas. The change is compile configuration only, the
emitted `dist/` is byte-identical, and the package's sources, tests and `package.json` do
not change. It was applied by a delivery script that only the owner runs: that run is the
owner's GO for this project.

### What differs from the first three projects

This is the first project of the sequence with a bare specifier: `src/schema.ts` imports
`zod` (4.4.3). The two algorithms reach the same file by different paths:

- **node10** (before) ignores `exports` and reads the `types` field of zod's
  `package.json`: `./index.d.cts`.
- **NodeNext** (after) resolves in CJS mode with the conditions `require`, `types`,
  `node`, enters `exports` `"."`, skips `@zod/source`, and matches `types`:
  `./index.d.cts`.

Both resolve to `node_modules/zod/index.d.cts`, with the same package ID. The delivery
script asserts that exact trace line after the change, as well as the full set of
resolution outcomes and program files before and after.

The package has no `"type"` field, so its files stay **CommonJS**. The canon file
`.spec/00-canon/seo-runtime/cwv-taxonomy.yaml` says the package is CommonJS only, and that
remains true.

### Change

`packages/cwv-taxonomy/tsconfig.json` becomes byte-identical to
`packages/seo-url-contract/tsconfig.json`: it extends `base.json` and sets `module` and
`moduleResolution` to `NodeNext`. The two files differed only in those lines before. The
effective delta (`tsc --showConfig`, TS 6.0.3) is the pilot's:

- `ignoreDeprecations: "6.0"` is removed;
- `module` goes from commonjs to nodenext, and `moduleResolution` from node10 to nodenext;
- `moduleDetection` becomes force;
- `resolvePackageJsonExports` / `resolvePackageJsonImports` are no longer forced to false
  (the NodeNext default is true).

Nothing else changes.

### Evidence — TS 6.0.3, the repo compiler

| Check | Before | After |
|---|---|---|
| `tsc --noEmit` | exit 0, 0 diagnostics | exit 0, 0 diagnostics |
| `tsc` build | exit 0 | exit 0 |
| Emit (`.js`, `.d.ts` and their maps) | 32 files | the same 32, byte-identical (sha256) |
| Relative specifiers (`--traceResolution`) | 7: `./surface`, `./funnel-step`, `./priority-tier`, `./metric`, `./route-group`, `./user-agent`, `./schema` → `src/*.ts` | identical |
| Bare specifiers | 1: `zod` → `node_modules/zod/index.d.cts` | identical |
| Resolution outcomes, all files (zod's declarations included) | 93, 0 unresolved | the same 93 |
| Program files (`--listFilesOnly`, `--explainFiles`) | 133 (45 lib + 8 src + 80 zod) | the same 133 |
| Package tests (`tsx --test`) | 68/68 | 68/68 |

After the change, `--explainFiles` adds the line *"File is CommonJS module because
'package.json' does not have field "type""* for each of the 8 source files.

Consumers, all through the unchanged `package.json` (`exports`, `main`, `types`) to
`dist/`:

- the backend: the CWV beacon and runtime-events controllers, the beacon service, the
  runtime-events schema, one Jest test. No Jest `moduleNameMapper` entry or `tsconfig`
  path maps the package to `src/`.
- the frontend: the web-vitals and runtime-errors client utilities, one vitest test. Vite
  lists the package in `optimizeDeps.include`, which pre-bundles `dist/` in DEV only.

The emit is byte-identical, so the consumer delta is zero by construction.

### Evidence — TS 7.0.2, observation

Same method as the pilot: this project alone, the harness's own functions, TS6 exit code
checked. The delivery script commits only if the run before the change is
`BLOCKED_CONFIG` with `TS5108` and the run after is `PARITY` with TS6 and TS7 at exit 0
and 0 diagnostics.

| Configuration | Classification | TS6 | TS7 |
|---|---|---|---|
| Before (`node-cjs-legacy.json`) | BLOCKED_CONFIG | exit 0, 0 diagnostics | `TS5108` |
| After (`NodeNext`) | PARITY | exit 0, 0 diagnostics | exit 0, 0 diagnostics |

### Still `BLOCKED_CONFIG` after the fourth project

Four projects remain on `node-cjs-legacy.json`: `packages/seo-role-contracts`,
`packages/seo-roles`, `packages/registry` and `backend`. `ts7-shadow-parity.json` is still
not regenerated, for the reasons given in the pilot section; its `packages/cwv-taxonomy`
row describes the configuration before this change.
