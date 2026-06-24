# PR-9f.0 — Express 5 Compatibility Audit (audit-only, BLOCKS PR-9f)

> **Verdict** : **`BLOCKING-FOR-PR9F: [@remix-run/express-peer-dep-strict-express-4]`**
>
> Audit produced per [PR-9 roadmap](./pr-9-modernization-roadmap.md) § PR-9f.0. Audit-only PR. Touches no runtime code. Output is this document.
>
> **Methodology** : enumerate every Express 4 contract used in the monorepo, check Express 5 status (per [Express 5.0 migration guide](https://expressjs.com/en/guide/migrating-5.html)), and produce a `PASS` or `BLOCKING-FOR-PR9F: <list>` verdict.

## TL;DR

| Surface | Status | Action required for PR-9f |
|---|---|---|
| App handler code (`@Req()`/`@Res()`, route handlers) | ✅ PASS | 0 deprecated Express 4 patterns found in 85 decorator sites |
| Custom NestJS middleware (5 files) | ✅ PASS | All use `NestMiddleware` interface — Express-version-agnostic |
| `main.ts` `app.use(...)` chain (10 calls) | ✅ PASS | All middleware (session, compression, helmet, cors, body-parser inline, passport) Express 5-compatible after upstream bumps |
| `body-parser` standalone package | ⚠️ MIGRATE | Still works in Express 5 via standalone package; cleaner to use core `express.json()`/`express.urlencoded()` (non-blocking) |
| Trust proxy + Cloudflare | ✅ PASS | `expressApp.set('trust proxy', 1)` retained in Express 5 |
| **`@remix-run/express@2.17.4`** | ❌ **BLOCKING** | Peer dep `express: ^4.20.0` strict. **No Remix v2 release supports Express 5.** Resolution requires Remix v3 (out of PR-9f scope) or custom adapter. |
| `connect-redis@5.2.0` | ⚠️ KNOWN — handled by PR-9e | Must bump 5→9 (redis@5+ client). Already in PR-9e (auth) scope per roadmap. |

## 1. Deprecated Express 4 API patterns (scan results)

Greps run on `backend/src/**/*.ts` (exclusion: `node_modules`, `dist`, `tests/fixtures`):

| Pattern | Express 5 status | Occurrences | Notes |
|---|---|---|---|
| `req.param(name)` | **REMOVED** — use `req.params`/`req.body`/`req.query` | **0** | ✅ |
| `app.del(` / `router.del(` | **REMOVED** — use `.delete(` | **0** | ✅ |
| `res.sendfile(` (lowercase) | **REMOVED** — use `res.sendFile(` (camelCase) | **0** | ✅ |
| `res.json(status, body)` (numeric first arg) | **REMOVED** — use `res.status(s).json(b)` | **0** | ✅ |
| `res.send(status, body)` (numeric first arg) | **REMOVED** — use `res.status(s).send(b)` | **0** | ✅ |
| `res.jsonp(status, body)` (numeric first arg) | **REMOVED** — use `res.status(s).jsonp(b)` | **0** | ✅ |
| `res.redirect(url, status)` (status as 2nd arg) | **SIGNATURE REVERSED** — now `(status, url)` | **0** | ✅ |
| `req.acceptsCharset(` (singular) | **REMOVED** — use `req.acceptsCharsets(` | **0** | ✅ |
| `req.acceptsEncoding(` (singular) | **REMOVED** — use `req.acceptsEncodings(` | **0** | ✅ |
| `req.acceptsLanguage(` (singular) | **REMOVED** — use `req.acceptsLanguages(` | **0** | ✅ |
| `req.host` (returns host without port in v4) | **CHANGED** — returns full host with port in v5; use `req.hostname` | **0** | ✅ |
| `Router.prototype.error(` | **REMOVED** | **0** | ✅ |
| `app.param(regexpFn)` (regex matcher first arg) | **REMOVED** — only named-param signature kept | **0** | ✅ |

**Subtotal** : 0 hits across 13 deprecated patterns scanned. **No application-level code rewrites required.**

## 2. Custom NestJS middleware (5 files)

| File | Signature | Express 5 compat | Notes |
|---|---|---|---|
| `backend/src/auth/cart-merge.middleware.ts` | `async use(req: Request, res: Response, next: NextFunction)` | ✅ PASS | Standard `NestMiddleware` — interface unchanged, types from `@types/express` v4 must be re-resolved to v5 at upgrade time (peer-dep transitive) |
| `backend/src/modules/vehicle-context/vehicle-context.middleware.ts` | `async use(req: Request, _res: Response, next: NextFunction): Promise<void>` | ✅ PASS | Same |
| `backend/src/modules/analytics/landing-attribution.middleware.ts` | `use(req: Request, _res: Response, next: NextFunction): void` | ✅ PASS | Same |
| `backend/src/modules/bot-guard/bot-guard.middleware.ts` | `async use(req: Request, res: Response, next: NextFunction)` | ✅ PASS | Uses `req.headers`, `res.status(...).json(...)` — standard idioms |
| `backend/src/modules/mcp-validation/middleware/request-id.middleware.ts` | `use(req: Request, res: Response, next: NextFunction)` | ✅ PASS | Augments Express `Request` interface via module declaration merging — works in v5 |

**Conclusion** : All 5 custom middleware use the version-agnostic `NestMiddleware` interface. The only side effect of the Express 4→5 upgrade is the **`@types/express` v4→v5 peer transition**, which is handled transparently by `npm install` once `@nestjs/platform-express` is bumped to v11.

## 3. `main.ts` `app.use(...)` chain (10 calls, lines 150-260)

| Line | Middleware | Express 5 compat | Notes |
|---|---|---|---|
| 150 | `app.use(session({...}))` | ✅ PASS (after bump) | `express-session@1.17.3` → bump to `>=1.18` for Express 5. Latest = 1.19.0 |
| 172 | `app.use((req,res,next) => landingAttribution.use(req,res,next))` | ✅ PASS | Generic adapter |
| 185 | `app.use(compression({...}))` | ✅ PASS | `compression` package supports Express 5 |
| 215 | `app.use((req,res,next) => jsonParser(req,res,next))` (conditional) | ⚠️ MIGRATE-OPTIONAL | Currently uses `body-parser` standalone — works in v5, but cleaner to use core `express.json()`. Non-blocking. |
| 219 | `app.use((req,res,next) => urlencodedParser(req,res,next))` (conditional) | ⚠️ MIGRATE-OPTIONAL | Same — could use core `express.urlencoded()` |
| 224 | `app.use(passport.initialize())` | ✅ PASS | `passport@0.7.0` supports Express 5 |
| 225 | `app.use(passport.session())` | ✅ PASS | Same |
| 233 | `app.use((_req,res,next) => res.locals.cspNonce = ...)` | ✅ PASS | Standard pattern |
| 242 | `app.use((req,res,next) => helmet({...})(req,res,next))` | ✅ PASS | `helmet@8.1.0` supports Express 5 |
| 253 | `app.use(cors({...}))` | ✅ PASS | `cors@2.8.5` supports Express 5 |

**Trust proxy** : `expressApp.set('trust proxy', 1)` (line 230) — API unchanged in Express 5. ✅ PASS.

**`x-powered-by` disable** : `expressApp.disable('x-powered-by')` (line 261) — API unchanged. ✅ PASS.

## 4. Direct `express` package imports

20+ files import `Request`, `Response`, `NextFunction` from `'express'`. Examples :
- `backend/src/auth/cart-merge.middleware.ts`
- `backend/src/auth/exception.filter.ts`
- `backend/src/modules/seo/interceptors/*.ts`
- `backend/src/modules/vehicles/*.controller.ts`
- `backend/src/modules/errors/filters/global-error.filter.ts`

All these imports are **type imports** — they resolve to whatever `@types/express` version is installed. When `@nestjs/platform-express` is bumped to v11, `@types/express` v5 will be pulled transitively. No source code changes required.

## 5. Upstream peer dependencies — Express 5 compat matrix

| Package | Current | Latest | Express 5 compat | Action for PR-9f |
|---|---|---|---|---|
| `@nestjs/platform-express` | `^10.4.20` | `11.1.23` | v11+ uses Express 5 | **BUMP** (the actual PR-9f bump) |
| `express-session` | `^1.17.3` | `1.19.0` | v1.18+ supports Express 5 | BUMP |
| `connect-redis` | `^5.2.0` | `9.0.0` | v9 requires `redis@>=5` (NOT `ioredis`) | **MIGRATE (PR-9e scope)** — switch to `redis@5+` client OR keep v5 with override (risky) |
| `passport` | `^0.7.0` | `0.7.0` | ✅ Express 5 compatible | No-op |
| `passport-local` | `^1.0.0` | `1.0.0` | ✅ | No-op |
| `passport-jwt` | `^4.0.1` | `4.0.1` | ✅ | No-op |
| `body-parser` | indirect (`backend/package.json`) | — | Works as standalone in v5; preferred = core `express.json()`/`express.urlencoded()` | Optional cleanup |
| `compression` | indirect | latest | ✅ | No-op |
| `cors` | indirect | latest | ✅ | No-op |
| `helmet` | `^8.1.0` | latest | ✅ Express 5 | No-op |
| **`@remix-run/express`** | **`^2.17.4`** | **`2.17.4`** | **❌ peer `express: ^4.20.0` STRICT** | **BLOCKING** — see § 6 |

## 6. The blocker — `@remix-run/express`

### Diagnosis

`@remix-run/express` is the Remix v2 SSR adapter for Express. Latest stable `2.17.4` declares :

```json
"peerDependencies": {
  "express": "^4.20.0",
  "typescript": "^5.1.0"
}
```

This is **strict semver** — no Remix v2 release (2.0 → 2.17.4) declares support for `express@^5`. The package internally constructs an Express-4-style request handler chain ; under Express 5, the changed handler signature semantics around async error propagation may diverge.

### Why this blocks PR-9f

PR-9f bumps `@nestjs/platform-express` 10→11, which forces `express` to v5. `npm install` will then refuse `@remix-run/express@^2.17.4` because its peer (`express: ^4.20.0`) is violated. Override-with-`--legacy-peer-deps` is **bricolage** — runtime behavior of @remix-run/express under Express 5 is not vendor-supported, and the changed `Router` behavior (auto-async-error catch, signature changes) may surface as silent SSR breakage.

### Resolution paths (decision required BEFORE PR-9f opens)

| Path | Effort | Risk | Owner decision required |
|---|---|---|---|
| **A. Wait for Remix v3** (announced support for Express 5) | Out of PR-9f scope; depends on Remix release timeline | Low (vendor-supported) | Strategic — defers PR-9f indefinitely |
| **B. Upgrade Remix v2 → v3** (separate major initiative) | LARGE — Remix v3 is a breaking release for frontend route conventions, loaders, actions | High (touches every route file) | Owner sign-off, separate roadmap |
| **C. Replace `@remix-run/express` with custom adapter** | MEDIUM — write a thin Express-handler wrapper around `@remix-run/server-runtime` | Medium (handler exists in Remix internals, but unmaintained as separate package) | Backend-runtime owner sign-off |
| **D. Stay on `@nestjs/platform-express@10` / Express 4 indefinitely** | Zero | Zero (status quo) | Defeats PR-9f purpose |

**Recommendation** : **Path C** is the only path that unblocks PR-9f without a Remix major upgrade or indefinite wait. It produces ~50-100 LoC custom adapter that handles `(req, res, next) → Remix handler` translation. Vendor-independent. Reversible (can swap back to `@remix-run/express` if Remix v2 ever supports Express 5).

### Out-of-scope for this audit

The decision between Paths A/B/C/D is **architectural and product-level**, owned by the backend-runtime team + frontend / Remix owner. This audit's role is to surface the blocker and quantify the resolution paths — not to choose.

## 7. Required follow-up before PR-9f opens

1. **Owner decision on `@remix-run/express` path** (A/B/C/D above) — gating item
2. **Complete PR-9e (auth)** — which handles `connect-redis` 5→9 + `express-session` minor bump
3. **Verify `@types/express` v5 type definitions** for `Request`/`Response`/`NextFunction` cover all 20+ import sites with no source changes (sanity check, expected pass)
4. **Optional cleanup PR** : migrate `body-parser` standalone → core `express.json()`/`express.urlencoded()` in `main.ts` (non-blocking, cosmetic)
5. **Re-run this audit** after Resolution Path is chosen and stage-1 prep PRs merge, to confirm verdict flips to `PASS`

## 8. Audit reproducibility

Greps run from monorepo root (worktree commit `e0e2b3618`, audit branch `chore/pr-9f.0-express5-compatibility-audit`) :

```bash
# Deprecated patterns scan
grep -rn "req\.param(" backend/src --include="*.ts"
grep -rnE "(app|router)\.del\(" backend/src --include="*.ts"
grep -rn "res\.sendfile(" backend/src --include="*.ts"
grep -rnE "res\.(json|send|jsonp)\([0-9]" backend/src --include="*.ts"
grep -rnE "res\.redirect\([^,]+,\s*[0-9]" backend/src --include="*.ts"
grep -rnE "req\.accepts(Charset|Encoding|Language)\b" backend/src --include="*.ts"
grep -rnE "req\.host\b" backend/src --include="*.ts"

# Middleware inventory
find backend/src -name "*.middleware.ts"

# main.ts app.use chain
grep -nE "app\.use\(" backend/src/main.ts

# Express import sites
grep -rnE "from ['\"]express['\"]" backend/src --include="*.ts"

# Peer dep checks
for pkg in @remix-run/express express-session connect-redis passport passport-local passport-jwt @nestjs/platform-express; do
  npm view "$pkg" version peerDependencies
done
```

All scans reproducible on any checkout of `e0e2b3618` or later.

## Verdict

**`BLOCKING-FOR-PR9F: [@remix-run/express-peer-dep-strict-express-4]`**

Single blocker. Application code (handlers, middleware, decorators) is **100% Express 5-compatible** — 0 deprecated patterns across 13 scans. The single structural blocker is the Remix SSR adapter package which strictly peer-requires Express 4. Resolution requires owner decision among Paths A/B/C/D (§ 6). After resolution + PR-9e completion, re-run this audit to confirm `PASS`.

---

*Audit produced 2026-05-24. Audit-only PR per PR-9 roadmap § PR-9f.0. No runtime code modified.*

---

## ERRATA — 2026-06-24 (re-evaluation after the React Router v7→v8 migration)

> The 2026-05-24 verdict above is **preserved for history**. This errata supersedes it. Two findings: the blocker is lifted, **and** the original "100% Express 5-compatible application code" claim was incomplete (its 13 scans did not check route-path syntax).

**Verdict update: `BLOCKING-FOR-PR9F` is LIFTED ⇒ `PASS` with required (non-blocking) Express-5 migrations for PR-9f.**

- **Blocker lifted.** `@remix-run/express@2.17.4` (the sole blocker, peer `express@^4.20.0`) is **gone**: the React Router v7→v8 migration retired Remix v2 (PR #1052 + follow-ups #1041/#1046/#1058/#1126). SSR now runs through `@react-router/express`, whose peer accepts `express ^4 || ^5`. The leftover nested `express@4` under `@react-router/serve` is a CLI not used at runtime, and `@nestjs/platform-express@10` bundles its own `express@4` until NestJS 11.
- **Correction to the original "0 deprecated patterns" claim.** The 13 scans checked handler/middleware/decorator patterns (`req.param()`, `res.json(status,…)`, etc.) but **not route-path syntax**. Express 5 ships path-to-regexp v8, which breaks the v0 wildcard/regex route forms still present:
  - `@All(':path*')` — `backend/src/remix/remix.controller.ts:60`
  - `:param(.*)` regex routes — `backend/src/modules/metadata/controllers/optimized-metadata.controller.ts:40/70/104`, `optimized-breadcrumb.controller.ts:40/117/152/194`, `backend/src/modules/seo/controllers/seo.controller.ts:52/115`
  - → migrate to named wildcards `{*path}` (which also matches the root path).
- **Query parser.** `main.ts` sets no explicit `query parser`; Express 5 flips the default `extended`→`simple` (nested/array query params change shape). PR-9f must prove no controller depends on it **or** set `expressApp.set('query parser', 'extended')`.

**Net:** PR-9f is **openable** (no upstream peer-dep wall) with these two migrations as mandatory in-scope work, not "no source change". Re-run a full scan during PR-9f.
