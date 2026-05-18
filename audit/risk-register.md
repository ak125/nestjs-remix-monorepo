# Risk register — monorepo deep-audit (Phase 0.9 / PR-0b)

> Derived from `audit/*.json` (PR-0a) + `audit/db-usage-map.json` (PR-0b). Generated semi-manually; **not** checked by `audit:inventory:check` — review must keep it in sync with the JSON. Re-derive the numbers after each `npm run audit:inventory`.
>
> "Test coverage %" below is a **proxy**: `*.spec.ts` / `*.test.tsx` files ÷ total files in the domain. No coverage instrumentation was run — treat it as "is this area exercised at all", not as line coverage.

## Snapshot (this checkout)

2112 source files · 1116 runtime entrypoints · 53/61 NestJS modules reachable from `app.module.ts`/`worker.module.ts` · **339 dead-code candidates** (high 23 / med 222 / low 94) · 15 cycles · 41 duplicate exports · 82 `no-deep-module-access` violations · DB: 60 candidate-orphan tables (all `low` confidence — 888 dynamic `.from()` callsites), 141 candidate-orphan RPCs (`medium`), 26 trigger functions.

## Per-domain risk

| Domain | Runtime surface | Dead-code candidates (h/m/l) | Cycles | deep-access viol. | Test proxy | Sensitive points | Risk |
|---|---|---|---|---|---|---|---|
| **payments** | Paybox + SystemPay callbacks, HMAC `timingSafeEqual` | 6 (0/5/1) | 0 | 1 | ~4% (1/28) | HMAC keys, callback signature gate, `normalizeOrderId`, throttler `payment_callback` | **HIGH** — critical path, almost no tests. Touch with extreme care; never delete a payments file without `validate-before-delete.sh` + manual trace. |
| **auth** | Passport local + admin JWT, Redis sessions, guards | 5 (0/4/1) | 1 (`auth↔users`) | 0 | ~6% (2/32) | session middleware, `cart-merge.middleware`, `exception.filter` (candidate — verify it's not an `APP_FILTER`), the `auth↔users` cycle | **HIGH** — auth + a cycle + thin tests. Break the cycle (PR-5) before any restructure. |
| **orders** | order lifecycle, ties to payments + stock | 5 (0/5/0) | 0 | 2 | 0% (0/22) | order-id normalisation, payment status transitions | **HIGH** — money-adjacent, zero tests. |
| **admin** | dashboard, stock, gammes-seo, enrichers | 8 (1/7/0) | 3 (`admin-gammes-seo↔gamme-detail-enricher`, `stock-management↔stock-movement`, `↔stock-report`) | **32** (the worst) | ~3% (3/117) | `IsAdminGuard`, stock movements, the 3 cycles | **HIGH** — biggest boundary mess (32 deep-access), 3 cycles, large surface, thin tests. PR-5 (cycles) + PR-6 (barrels) priority. |
| **products** | catalogue, cross-selling, V-Level | 1 (1/0/0) | 2 (`cross-selling↔cross-selling-seo`, `↔cross-selling-source`) | 0 | 0% (0/27) | `pieces_*` TEXT/`_i` INTEGER columns, V-Level classification | **MED** — public-facing, cycles, no tests; but small candidate count. |
| **cart** | panier flow, frontend `panier.*` routes | 0 | 0 | 2 | 0% (0/18) | session-tied cart, cart-merge on login | **MED** |
| **catalog** / **vehicles** / **gamme-rest** | vehicle lookup, RM listing, gamme pages | 1+5+1 | 0 | 5+5 | 0% | `__rm_*` tables, vehicle compatibility RPC, V-Level | **MED** — public SEO surface; deep-access violations to clean (PR-6). |
| **seo** (+ seo-logs, seo-monitoring, seo-shadow-observatory) | SEO chain V9, sitemaps V10, R2 gate, `@repo/seo-roles`, `@repo/seo-role-contracts` | 9+2 (0/8/3) | 0 | 4 | ~21% (36/171 — best in the repo) | legacy V4 (`dynamic-seo-v4-ultimate`, `seo-v4-switch-engine`) — **owned by the seo-v9 cascade (PR-2c/PR-10), not this chantier** | **MED** — well-tested, but the legacy-V4 candidates must be left to seo-v9; `packages/seo-role*` are in the never-auto-delete zone. |
| **rag-proxy** | RAG ingestion/webhook/redis-job | 2 (0/2/0) | **3** (`rag-proxy↔rag-ingestion↔rag-redis-job`, `rag-proxy↔rag-webhook-completion`, `rag-cleanup↔rag-gamme-detection↔rag-knowledge`) | 2 | 0% (0/44) | RAG L3 guard, ingestion pipeline | **MED** — densest cycle cluster; extract shared types (PR-5). |
| **blog** | advice / constructeur services | 0 (—) | 2 (`advice↔advice-enrichment`, `constructeur↔constructeur-search`) | **23** (2nd worst) | ~3% (1/31) | — | **MED** — 23 deep-access violations + 2 cycles. PR-5 + PR-6. |
| **support** | legal pages | 2 (0/1/1) | 2 (`legal↔legal-page`, `↔legal-version`) | 0 | 0% (0/24) | — | **LOW-MED** |
| **users** | account, customers | 8 (0/3/5) | (`auth↔users`) | 0 | 0% (0/27) | password hashing (bcrypt+MD5 legacy) | **MED** — part of the `auth↔users` cycle. |
| **config** | Zod page contracts, R*-keyword-plan constants, gateways, `marketing-matrix.module` (unreachable) | 22 (2/13/7) | 1 (config-types cluster with workers/admin) | 0 | ~6% (6/98) | many `page-contract-r*.schema.ts` / `r*-keyword-plan.constants.ts` may be superseded by `@repo/seo-role-contracts` — **verify before deleting** | **MED** — big candidate bucket; needs careful triage against the seo-roles packages. |
| **common** / **database** / **backend-core** | decorators, pipes, base services, `app.service` | 6+5+8 (0/3/3 + 4/4/0 + 5/3/0) | 0 | 0 | 0% | `app.service.ts` (candidate — is it injected anywhere?), base Supabase service | **MED** — `database` has 4 high-confidence candidates; `backend-core` 5 high. Easy wins but verify DI. |
| **upload** / **agentic-engine** / **knowledge-graph** / **mcp-validation** / **substitution** / **blog-metadata** | feature modules **NOT reachable** from `app.module.ts`/`worker.module.ts` | 7+5+5+17+5+2 (mostly `low`) | 0 | 0 | 0% | their `*.module.ts` is in `nestjs_unreachable_modules` — either a dead subtree or loaded by a mechanism the scanner doesn't follow | **MED** — **investigate reachability first** (PR-3): if the module is genuinely never imported, the whole subtree is dead; if it's lazy/dynamic, the candidates are false positives. `mcp-validation` (17 candidates, 16 `low`) is the largest. |
| **workers** | BullMQ processors (7), cron | 0 (in never-auto-delete zone) | (config-types cluster) | 0 | 0% (0/11) | `READ_ONLY` gate at processor, cron jobs | **MED** — protected from deletion; the config-types cycle touches it. |
| **frontend-routes** | 240 Remix route files | 0 (all in never-auto-delete zone) | (`root↔useRootData`) | n/a | 0% (0/240) | Remix loaders/actions, SSR | **MED** — protected; the only frontend cycle is `root.tsx ↔ hooks/useRootData.ts`. |
| **frontend-shared** | components / hooks / utils / services | **187** (7/148/32) | 0 | n/a | 0% (0/610) | 29 of the 41 duplicate exports live here | **MED — high volume, low individual risk.** The bulk of the cleanup. PR-4: each via `validate-before-delete.sh` + grep; delete co-located tests; collapse the 29 dup exports. |
| **scripts** | build/audit/CI scripts | (9 dup exports in `scripts/ui-audit/*`) | 0 | 0 | — | — | **LOW** — `scripts/ui-audit/*` is a candidate cluster + 9 dup exports; check no CI/husky reference (PR-2). |

## Test coverage (proxy) — the gaps that matter

Almost everything money- or auth-adjacent has **near-zero test files**: `payments` ~4%, `auth` ~6%, `orders` 0%, `users` 0%, `cart` 0%, `products` 0%, `admin` ~3%. `seo` is the outlier at ~21%. **Implication for the cleanup:** the deletion-condition #7 ("build + tests OK") is weak protection in these domains — lean harder on `validate-before-delete.sh`, manual call-tracing, and small reviewable batches there. Adding tests is **out of scope** for this chantier but the register flags it.

## Database surface

- **60 candidate-orphan tables — all `confidence: low`.** Reason: 888 `.from(<non-literal>)` callsites in `backend/src` mean a literal-only scan under-counts table usage; plus RLS-only / dashboard / external-cron / RPC-internal access is invisible. **Do not act on these as "dead" from this map** — they're a "needs manual check" list. Examples: `__qa_audit_*`, `__lighthouse_*`, `__error_logs`, `__abandoned_cart_emails`, `__seo_cwv_daily_2026_*` (these last look like monthly partitions — likely written by a cron).
- **141 candidate-orphan RPCs — `confidence: medium`.** Defined in a migration, never `.rpc()`-called from backend, not a trigger function. Only 3 dynamic `.rpc()` callsites, so the literal scan is ~complete — but an RPC can still be called by another RPC body, the dashboard, or raw PostgREST. This is a sizeable surface (`__gov_m*`, `build_*`, `auth_*`, …) and aligns with the known RPC-cleanup history (ADR-017, the −44-RPC cleanup). **→ dedicated DB/RPC audit + a vault ADR + RPC Gate — never a code-cleanup PR in this monorepo.**
- 26 trigger functions correctly excluded from orphan candidates.

## How risk maps to the cleanup sequence

- **PR-2 (hors runtime):** `scripts/ui-audit/*`, `*.disabled`/`*.bak`, old Python agents — LOW risk, do first.
- **PR-3 (backend NestJS-aware):** make knip see DI, then triage `config` (vs `@repo/seo-role-contracts`), `database`/`backend-core`/`common` high-confidence candidates, and **decide the fate of the 6 unreachable module subtrees** (`upload`, `agentic-engine`, `knowledge-graph`, `mcp-validation`, `substitution`, `blog-metadata`). HIGH-risk domains (`payments`, `auth`, `orders`) — only the candidates that pass a manual trace, tiny batches.
- **PR-4 (frontend Remix-aware):** the 187 `frontend-shared` candidates + 29 dup exports — high volume, low individual risk, batched.
- **PR-5 (cycles):** `root↔useRootData` → config-types cluster → `rag-proxy`×3 → `admin`×3 / `blog`×2 / `products`×2 / `support`×2 / `auth↔users`.
- **PR-6 (boundaries):** the 82 `no-deep-module-access` violations — `admin` (32) and `blog` (23) are 67% of them; add barrels.
- **DB (separate, vault-governed):** the 141 candidate-orphan RPCs → RPC-cleanup ADR. The 60 candidate-orphan tables → manual review only, no action from this map.
