# PR-9f.0 — Express 5 Compatibility Audit (audit-only, BLOCKS PR-9f)

> **Verdict (REFRESH 2026-06-25)** : **`UNBLOCKED_WITH_EXECUTION_GATES`** — voir [§ REFRESH](#refresh-2026-06-25--verdict-flips-to-unblocked_with_execution_gates).
> _(Verdict original 2026-05-24 `BLOCKING-FOR-PR9F: [@remix-run/express-peer-dep-strict-express-4]` — **SUPERSEDED**, conservé ci-dessous comme trace d'audit.)_
>
> Audit produced per [PR-9 roadmap](./pr-9-modernization-roadmap.md) § PR-9f.0. Audit-only PR. Touches no runtime code. Output is this document.
>
> **Methodology** : enumerate every Express 4 contract used in the monorepo, check Express 5 status (per [Express 5.0 migration guide](https://expressjs.com/en/guide/migrating-5.html)), and produce a `PASS` or `BLOCKING-FOR-PR9F: <list>` verdict.

## REFRESH 2026-06-25 — verdict flips to `UNBLOCKED_WITH_EXECUTION_GATES`

> Tout le corps **sous le § TL;DR (2026-05-24) est SUPERSEDED** — conservé comme trace d'audit.
> Son blocker unique est résolu et son scan §1 était incomplet (la **syntaxe de routes** n'avait pas été scannée).

### 1. Blocker résolu par RR8

L'unique blocker `@remix-run/express@2.17.4` (peer strict `express@^4.20.0`) a **disparu** :
[`backend/src/remix/remix.controller.ts`](../../backend/src/remix/remix.controller.ts) importe désormais
`createRequestHandler` depuis **`@react-router/express@8.0.1`** (React Router 8, live en PROD — état
**définitif**, pas un intermédiaire RR7). `@react-router/express@8` tourne déjà sur `express@5.x` ; seul
`@nestjs/platform-express@10` épingle encore `express@4.22.1`. PR-9e (auth/connect-redis 5→9, #1139) est mergée.
→ **plus aucun blocker structurel.**

### 2. Correction du §1 — la syntaxe de routes n'avait pas été scannée (path-to-regexp v8)

Le §1 original (« 0 deprecated patterns ») scannait `req.param()`, `res.json(status,…)`, etc. mais **pas les
chaînes de route**. path-to-regexp v8 (Express 5) retire `:param(.*)` et `:path*`. Inventaire **exhaustif = 14 patterns**
(critère : 14 recensés → 14 migrés → 0 laissé obsolète) :

| # | Type | Site | Actuel → v8 |
|---|---|---|---|
| 1 | décorateur | `remix.controller.ts:60` | `@All(':path*')` → `@All('{*path}')` |
| 2-4 | décorateur | `optimized-metadata.controller.ts:40/70/104` | `@Get/@Put/@Delete(':path(.*)')` → `{*path}` |
| 5-6 | décorateur | `optimized-breadcrumb.controller.ts:117/152` | `@Get/@Post(':path(.*)')` → `{*path}` |
| 7 | décorateur | `optimized-breadcrumb.controller.ts:194` | `@Get('schema/:path(.*)')` → `@Get('schema/{*path}')` |
| 8-9 | décorateur | `seo.controller.ts:52/115` | `metadata/:url(.*)` / `redirect/:url(.*)` → `metadata/{*url}` / `redirect/{*url}` |
| 10 | middleware | `app.module.ts:292` | `.forRoutes('*')` → `.forRoutes('{*path}')` |
| 11 | middleware | `bot-guard.module.ts:20` | `{ path: '*' }` → `{ path: '{*path}' }` |
| 12 | middleware | `mcp-validation.module.ts:112` | `{ path: '*' }` → `{ path: '{*path}' }` (module non relié au graphe — **migré** quand même) |
| 13-14 | middleware **scopé** | `vehicle-context.module.ts:41/42` | `api/diagnostic/*` / `api/v1/orientation/*` → splat **nommé** `*path` (PAS universel — sinon fire sur toutes les requêtes) |

### 3. Autres points Express 5 non signalés à l'origine

- **Splat = `string[] | undefined`** (pré-décodé) sous v8 → les 8 `decodeURIComponent(path/url)`
  (metadata 45/76/109, breadcrumb 124/158/200, seo 55/118) doivent **abandonner le décodage manuel** (sinon double-décodage).
- **Override `path-to-regexp: 3.3.0`** (root `package.json`) à **retirer** (down-pinnerait le router v8 d'Express 5).
- **Query parser** : Express 5 défaut `simple` ≠ Express 4 `extended` → `expressApp.set('query parser','extended')`
  (précautionnaire ; backend en query plat — **0 usage imbriqué vérifié**).
- **Prérequis cache (PR séparée)** : NestJS 11 force `@nestjs/cache-manager@3` → `cache-manager@6` + Keyv.
  **2 sous-systèmes cache partagent l'enum `CacheTTL` (secondes)** — convertir l'enum corromprait le cache
  ioredis ×1000. Isolé en **PR-9f.cache sous Nest 10** ; `getTTLMs()` existant réutilisé.
- **`@nestjs/bull@10.2.3`** peer Nest 8/9/10 seulement → bump **obligatoire `→^11.0.4`** (garde `bull@4.x`, n'empiète pas PR-9d).
- **`req.query`** : 0 mutation backend (vérifié) → compatible getter Express 5.
- **RxJS** déjà `^7.8.2` → `RxJS7Required` satisfait. **`@nestjs/swagger`** 7→11 (tire `swagger-ui-dist` ; les 2 décls directes `swagger-ui-express` ont 0 importateur → retirer). **`@nestjs/throttler`** config déjà `throttlers:[{ttl:ms}]` (v6-shaped).

### 4. Route morte pré-existante découverte (comportement préservé)

`@Get('schema/:path(.*)')` (breadcrumb:194) est **déjà inatteignable** sous Nest 10 : le générique
`@Get(':path(.*)')` (l.117) capture `schema/…` en premier. La migration **préserve ce comportement** (pas de
réordonnancement) → « 0 changement de contrat d'URL externe » reste vrai. Route morte signalée à l'owner pour décision séparée.

### 5. Nouveau verdict

**`UNBLOCKED_WITH_EXECUTION_GATES`** — aucun blocker structurel ; la migration 14-patterns + le bridge cache
sont **dans le périmètre de PR-9f / PR-9f.cache** (pas des blockers). Gates restants = exécution
(cf. `pr-9f-nestjs11-execution-spec-2026-06-25.md`) : peer-tree dépendances propre, matrice runtime,
soak piloté par preuve, **GO owner nominatif** pour le tag PROD. Préconditions cascade : PR-9e ✅ ;
Zod 4 hors-chemin (`nestjs-zod@4.3.1` accepte zod 3||4).

---

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
