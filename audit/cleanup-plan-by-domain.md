# Cleanup plan by domain — Phase 2 driver (PR-0b)

> The concrete PR sequence derived from `audit/*.json` + `audit/db-usage-map.json` + `audit/risk-register.md`. Generated semi-manually; **not** checked by `audit:inventory:check` — keep it in sync with the JSON after each `npm run audit:inventory`.
>
> **Every deletion goes through the conditions #0–#8** (`audit/README.md`): never-auto-delete zone → zero static import → zero dynamic import → zero runtime use → zero string ref → zero CI/script use → zero DB/cron/worker use → build+tests OK → human review. The `validate-before-delete.sh` script re-checks #0–#6 mechanically before each `git rm`. **No bulk auto-delete.** HIGH-risk domains (`payments`, `auth`, `orders`, `admin`) — tiny batches, manual call-tracing, lean less on the test gate (near-zero test coverage there).

## Order of operations

`PR-2` (hors runtime — small) → `PR-3` (backend NestJS-aware) → `PR-4` (frontend Remix-aware — the bulk) → `PR-5(/5a/5b)` (cycles) → `PR-6` (boundaries). The DB surface (141 candidate-orphan RPCs, 60 candidate-orphan tables) is **not** a code PR — it goes to a dedicated DB/RPC audit + a vault ADR + the RPC Gate.

Each PR ends with `npm run audit:inventory` + `npm run audit:baseline:refresh` committed in the same PR (the ratchet).

---

## PR-2 — Cleanup non ambigu hors runtime  *(small, do first)*

knip does **not** flag `scripts/ui-audit/*` as unused (it's reachable via `knip.json`'s `scripts/**` entries), so the plan's original "scripts/ui-audit" target doesn't apply. What's left:

- `__regression__/seo-role-canon-guard.regression.ts.disabled` — explicit `.disabled` file; confirm nothing references it, then `git rm`.
- `.claude/settings.local.json.bak` — already gitignored (`.claude/*.bak`); not tracked → nothing to do unless it got committed somewhere.
- Old Python agents `ai-agents-python/agents/*.py` — the whole `ai-agents-python/` tree is **gitignored** (`.gitignore` line ~101), so it's not in the repo; nothing to delete. (If a stray `.py` is tracked, check for a runner/cron first.)
- Anything else surfacing as `confidence: high` under `scripts/` in a future `dead-code-candidates.json` (currently **0**).

→ PR-2 is essentially empty today. Skip it or fold the one `.disabled` file into PR-3.

## PR-3 — Backend NestJS-aware

**Step A — make knip see NestJS DI.** Add a NestJS-aware `knip.json` config (plugin if available for knip 6.11, otherwise add `backend/src/**/*.module.ts` + `*.controller.ts` as entries / a targeted ignore) so `unused_files` lists only real backend dead code. Re-run `npm run audit:inventory` → `dead-code-candidates.json` shrinks.

**Step B — decide the fate of the 6 unreachable module subtrees** (`runtime-entrypoints.json#nestjs_unreachable_modules`): `upload` (7 cand.), `agentic-engine` (5), `knowledge-graph` (5), `mcp-validation` (17 — 16 `low`), `substitution` (5), `blog-metadata` (2). For each: is the `*.module.ts` imported *anywhere*? If genuinely never imported → the whole subtree is dead → remove the module + its tree via conditions #0–#8. If lazy/dynamic/conditionally-registered → the candidates are false positives → add the module to a documented allowlist and move on. **Investigate before deleting.**

**Step C — high-confidence backend candidates** (16; all pass `validate-before-delete.sh` SAFE per PR-0a snapshot — re-verify):
`backend/src/database/services/{invoices,payment}.service.ts`, `database/types/database.types.ts`, `database/utils/supabase-type-helpers.ts`, `modules/admin/events/keyword-plan.events.ts`, `modules/catalog/interfaces/catalog-gamme.interface.ts`, `modules/config/interfaces/config.interfaces.ts`, `modules/products/types/product.types.ts`, `notifications/notifications-center.{controller,module}.ts`, `search/global-search.{controller,module}.ts`, `types/order.types.ts`, `config/r0-page-contract.constants.ts`, `modules/invoices.module.ts`, `modules/shipping/shipping-new.module.ts`.
⚠️ `notifications-center.*` and `global-search.*` and `invoices.module.ts` / `shipping-new.module.ts` are module/controller files for **unreachable modules** — confirm they're not lazy-loaded before removing (overlaps Step B).

**Step D — `config/` triage vs `@repo/seo-role-contracts`** (22 candidates). The `page-contract-r*.schema.ts`, `r2-*.utils.ts`, `r2-content-contract.*`, `r2-keyword-plan.constants.ts`, `brand-role-map.schema.ts`, `duplicate-gate.schema.ts`, `surface-metrics.schema.ts` files **may have been superseded by `packages/seo-role-contracts/`** — for each, check whether the contracts package now owns the equivalent. Delete only the truly-superseded ones; keep + document the rest. `swagger.config.ts`, `config.validator.ts`, `environment.validator.ts` — verify they're not wired before removing.

**Step E — `database`/`backend-core`/`common` easy wins** — `app.service.ts` (is it in any `@Module({providers})`? — if not, dead), the unused decorators/pipes/types. Small, but verify DI each time.

⚠️ **HIGH-risk domains** (`payments`, `auth`, `orders`, `admin` — see risk register): only candidates that pass a manual call-trace, batches of ≤5, no reliance on the test gate. The `auth/exception.filter.ts` candidate — confirm it's not registered as `APP_FILTER` before touching.

End of PR-3: regen inventory + baseline refresh + commit. May split into PR-3a (Step A + knip config) / PR-3b (Steps B–E).

## PR-4 — Frontend Remix-aware  *(the bulk — 187 candidates + 29 dup exports)*

**Step A** — confirm `frontend/app/routes/**` is fully recognised as entry (already in `knip.json`; verify the depcruise `no-orphans` scope ignores it) — no route file ever surfaces as orphan.

**Step B** — delete confirmed-orphan `frontend/app/{components,hooks,utils,services}/*`: 132 components, 22 frontend-services (`*.api.ts`/`*.server.ts`), 17 hooks, 14 other, 2 services. Each via `validate-before-delete.sh` + a manual grep (basename, dynamic import, Remix `useLoaderData`-style indirection). **Delete co-located `*.test.tsx` too.** Batches of ~30-40 → PR-4a / PR-4b / PR-4c.

**Step C** — collapse the 29 `frontend-shared` duplicate exports (`export X` + `export default X` → single named export; update `import X, { X }` → `import { X }`). The 1 `auth`, 1 `common`, 1 `config` backend dup exports can go here or in PR-3. The 9 `scripts/ui-audit/*` dup exports — fix in whichever PR touches those files (or a standalone).

End of PR-4: regen inventory + baseline refresh + commit (then the "ratchet complet" follow-up commit tightening `unused_files/exports/types` thresholds to 0 if not done after PR-3).

## PR-5 — Cycles (15)  *(see `audit/cycle-map.json`)*

Order (priority = ease + blast radius):
1. `frontend/app/root.tsx ↔ hooks/useRootData.ts` — simplest.
2. **config-types cluster** — `config/role-ids.ts` / `config/content-section-policy.ts` ↔ `workers/types/content-refresh.types.ts` ↔ `modules/admin/services/brief-gates.service.ts` → extract a shared types file.
3. **rag-proxy ×3** — `rag-proxy↔rag-ingestion↔rag-redis-job`, `rag-proxy↔rag-webhook-completion`, `rag-cleanup↔rag-gamme-detection↔rag-knowledge` → extract `rag-proxy/types/` shared types.
4. The rest (invert one dependency each): `admin-gammes-seo↔gamme-detail-enricher`, `stock-management↔stock-movement`, `stock-management↔stock-report`, `blog: advice↔advice-enrichment`, `blog: constructeur↔constructeur-search`, `support: legal↔legal-page`, `support: legal↔legal-version`, `products: cross-selling↔cross-selling-seo`, `products: cross-selling↔cross-selling-source`, `auth↔users`.
5. When `npx madge --circular` = 0 → promote `dependency-cruiser` `no-circular` `warn → error`.

Split: **PR-5a** (1–3: frontend + config-types + rag-proxy) / **PR-5b** (4: module-internal cycles + promotion).

## PR-6 — Boundaries (82 `no-deep-module-access` violations)  *(see `audit/module-boundaries.json`)*

Concentration: `admin` 32, `blog` 23, `gamme-rest` 5, `vehicles` 5, `seo` 4, `cart`/`orders`/`rag-proxy` 2 each, others 1. → route cross-module imports through `index.ts` barrels; add a barrel where missing (public surface only). Start with `admin` + `blog` (67% of the violations).
Preconditions: PR-3 (knip backend stable) + PR-4 (Remix routes protected) done; `runtime-entrypoints.json#never_auto_delete_globs` + entrypoints feed the `allowedOrphans` allowlist in `.dependency-cruiser.cjs`.
Then promote `no-deep-module-access` `warn → error`; promote `no-orphans` `warn → error` (scoped `backend/src` + `frontend/app`, with the documented `allowedOrphans`).

## DB surface — NOT a code-cleanup PR

`audit/db-usage-map.json`: **141 candidate-orphan RPCs** (`medium`) + **60 candidate-orphan tables** (all `low` — 888 dynamic `.from()` callsites make any "dead table" claim unjustifiable from this map). Aligns with the known RPC-cleanup history (ADR-017, the −44-RPC cleanup).
→ **Open a dedicated DB/RPC audit task** that: (1) cross-checks the 141 RPCs against RPC bodies, the dashboard, and PostgREST usage; (2) for confirmed-dead ones, drafts a vault ADR + a `DROP FUNCTION` migration that goes through the **RPC Gate**. The 60 candidate-orphan tables → manual review only; **no action from this map**. None of this happens in the Phase-2 code PRs.

## SEO legacy V4 — out of scope here

`dynamic-seo-v4-ultimate.service.ts`, `seo-v4-switch-engine.service.ts` (`@deprecated PR-2c`), `seo-v4.types.ts`, `seo-v4-monitoring.service.ts`, `/api/seo-dynamic-v4/*` — owned by the **seo-v9 cascade (PR-2c stateless adapter → PR-10 cleanup)**, run on parallel sessions. This chantier does not touch them; the baseline ratchet absorbs their removal when seo-v9 ships it. `packages/seo-roles/**` and `packages/seo-role-contracts/**` are in the never-auto-delete zone.
