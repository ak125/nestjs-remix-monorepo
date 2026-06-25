# PR-9f Execution Spec — NestJS 11 / Express 5 (2026-06-25)

> **Statut** : spec d'exécution (audit-only doc, produit par PR-9f.0 refresh). Aucun code runtime ici.
> **Prérequis** : PR-9e ✅ mergé (#1139). Verdict audit = [`UNBLOCKED_WITH_EXECUTION_GATES`](./pr-9f.0-express-5-compatibility-audit.md).
> **Séquence** : PR-9e ✅ → **PR-9f.cache** (cache-manager v6/Keyv, sous Nest 10) → **PR-9f** (Nest 11/Express 5).
> Zod 4 reste **hors chemin** (`nestjs-zod@4.3.1` accepte zod 3‖4).

Tous les `file:line` ci-dessous sont vérifiés sur `origin/main` au 2026-06-25.

---

## Principe directeur : 3 PR, une-famille / un-rollback

Le moteur HTTP (Express 5) et le moteur cache (Keyv) sont **deux runtimes indépendants** → jamais
dans la même PR. `@nestjs/cache-manager@3` accepte Nest 9/10/11 (peer `@nestjs/core: ^9‖^10‖^11`,
`cache-manager: >=6`, `keyv: >=5`) → le bridge cache se fait **sous Nest 10** d'abord.

---

## PR-9f.cache — bridge cache-manager v6 / Keyv (sous Nest 10)

Branche `feat/pr9f-cache-bridge`.

### Cibles dépendances
`@nestjs/cache-manager ^3.1` ; `cache-manager ^6` (**PAS ^7** — évite le changement `null→undefined`
de v7) ; `keyv ^5` ; `cacheable ^2.4` (→ Keyv 5.6.x, fournit `KeyvCacheableMemory`) ; **retirer `@types/cache-manager`**.

### Deux sous-systèmes de cache — NE PAS confondre (trou bloquant identifié)
- **Cache ioredis maison** : `backend/src/cache/cache.service.ts` (`redisClient.setex`/`expire` = **SECONDES**).
  **Non concerné** par cache-manager.
- **cache-manager** in-memory : 9 `CacheModule.register` + 16 injections `CACHE_MANAGER` (= **ms**).
- Les deux **partagent l'enum `CacheTTL` / `CACHE_STRATEGIES`** (`backend/src/config/cache-ttl.config.ts`, **en secondes**).

**INTERDIT** : convertir l'enum en ms / inventer `ONE_HOUR_MS` → corromprait tous les `setex` ioredis
**×1000** (1h→1000h) = silent fallback. La conversion s→ms **existe déjà** :
`getTTLMs(strategy)=strategy.ttl*1000` (`cache-ttl.config.ts:406`) + `*1000` inline aux sites cache-manager.

### Travail
1. **`max`→`lruSize`** via factory **partagée unique** (étendre `config/`, pas de parallèle) :
   `boundedStore(ttlMs,maxEntries)=new Keyv({store:new KeyvCacheableMemory({ttl:ttlMs,lruSize:maxEntries})})`.
   Adapter les **9** `register(...)` (blog:65, seo:178, vehicles:75 `registerAsync`, navigation:24, metadata:34,
   invoices:19, dashboard:14, products:48, catalog:68).
2. **TTL ms aux register cache-manager UNIQUEMENT** : les `register({ttl:300/180/300})` **nus**
   (navigation:24, dashboard:14, catalog:68) passent des secondes → router via `getTTLMs()`/`*1000`.
   Auditer les 9 : nus → multiplier ; déjà-ms → laisser. **0 modification du chemin ioredis.**
3. **`reset()`→`clear()`** : `backend/src/modules/blog/services/blog-cache.service.ts:84`.
4. **Valeur absente au wrapper central** : `CacheService.get<T>()` (`cache.service.ts:111`) renvoie `T|null`
   → normaliser `?? undefined` à **ce point unique** (pas dispersé sur N services).
5. **Topologie cache** : cartographier sous Nest 10, préserver la topologie métier, 0 isolation/mutualisation accidentelle.

### Tests & gates
- Caractérisation TTL **sous l'ancien stack** (golden `getTTLMs=ttl*1000` + fake-timers) → bump → mêmes tests repassent.
- **Assert : `setex` ioredis reçoit toujours des secondes** (non-régression cross-subsystème).
- get/set/del/wrap/**clear**, expiration réelle, isolation, sérialisation, `lruSize`, boot+shutdown.
- Guard `grep -RIn 'cacheManager\.reset(' backend/src` = 0.
- **Épingler `cache-manager ^6` à la main** (PAS `bump-dependency-family --target latest` = `^7`).
- **Régénérer l'inventaire** : `npm run audit:pr-9-modernization-inventory` (gate BLOQUANT sur lockfile).
- CI **vérifiée `gh pr checks`** (requis verts, skips documentés). Merge.

---

## PR-9f — NestJS 11 / Express 5 (code atomique, worktree)

Branche `feat/pr9f-nestjs11`. **Une seule PR.**

### PRÉREQUIS — réconcilier l'overlay (déplacé ici depuis PR-9f.0 : cascade d'invariants Zod)
Avant le bump, aligner `audit/dependencies/family-overlay.yaml` `runtime-backend-nest` (l.504+) sur la réalité
(le repo déploie **atomique**, pas de canary — cf. `.claude/rules/deployment.md`). **Cascade d'invariants** à respecter
ensemble (sinon `Validate Specifications` rouge) :
- `deployment_sequence` : retirer `canary` → garder `full-rollout` seul ;
- `estimated_canary_duration_minutes: 60 → 0` (rule #28 : canary absent ⇒ doit être 0) ;
- `estimated_recovery_sequence` / `rollback_preconditions` / `canary_abort_conditions` : retirer les entrées `*canary*` ;
- `staging_soak_hours: 72 → 24` (soak piloté par preuve — PREPROD `READ_ONLY`) ;
- `node_runtime_requirement: ">=20" → ">=24"` (engines réel) ;
- `family.members` : inclure tout le set bumpé (cf. ci-dessous) — `bump-dependency-family.mjs` bumpe exactement `members` ;
- `rollback_tested_at` / `rollback_drill_commit` : remplir **après drill PREPROD**, avant tag PROD.
Puis `npm run audit:pr-9-modernization-inventory`.

### C0. Caractérisation routes sous Nest 10 (1er commit, AVANT bump)
Golden sur 0/1/plusieurs segments ; `%20`,`%25`,`%252F`,`%2F`,`+`, accents ; `%`,`%ZZ` invalides ;
**valeur exacte transmise aux services** ; **comportement actuel de breadcrumb `schema/`** (morte).
Après bump : mêmes valeurs/statuts, **0 changement de contrat d'URL**.

### C1. Encapsulation splat (remplace 8 décodes inline)
- **Util pur** `backend/src/common/utils/splat-path.util.ts` (`splatToPath(p)` join l'array, **ne décode JAMAIS**
  — v8 décode déjà) + barrel (précédent `url-builder.utils.ts`) + **spec co-localisée** (undefined→'/', simple, multi, espace décodé).
- **Décorateur** `@SplatPath('path'|'url')` (`createParamDecorator`, précédent `user.decorator.ts`) adossé à l'util.
  Lit `req.params[name]` (array sous v8) → string propre. Le **nom** du param (`path` vs `url`) est passé en argument.
- Remplacer `@Param(...)+decodeURIComponent` aux 8 sites (metadata:45/76/109, breadcrumb:124/158/200, seo:55/118).

### C2. Conversions routes (14, syntaxe v8)
- **Globaux → `{*path}`** : 9 décorateurs (remix:60 ; metadata:40/70/104 ; breadcrumb:117/152 + `schema/{*path}` 194
  **sans réordonner** → schema reste morte = comportement préservé ; seo `metadata/{*url}` 52, `redirect/{*url}` 115) ;
  3 middleware globaux app.module:292, bot-guard:20, mcp-validation:112.
- **Scopé → splat NOMMÉ** : vehicle-context:41/42 → `api/diagnostic/*path` + `api/v1/orientation/*path`
  (caractériser le bare-prefix d'abord ; `{*path}` seulement si la racine doit matcher). **Jamais universel** (sinon fire sur toutes les requêtes).

### C3. Query parser + override + bump
- `expressApp.set('query parser','extended')` à `main.ts:163` (à côté de `trust proxy`, via le `app as any` existant
  `main.ts:70` — **pas** le snippet `NestExpressApplication`).
- Retirer override `"path-to-regexp":"3.3.0"` (root `package.json`).
- **Bump via l'outil gouverné** `scripts/audit/bump-dependency-family.mjs --family runtime-backend-nest`
  (pas d'édition manuelle). Set : `@nestjs/*` 10→11 (+ `@nestjs/bull`→^11.0.4 [peer 10.2.3 = Nest 8/9/10 only],
  swagger→11, throttler→6, event-emitter→3). **Déjà OK** : jwt@11, bullmq@11, config, schedule, nestjs-zod@4.3.1,
  nestjs-pino. **RxJS déjà ^7.8.2** (`RxJS7Required` satisfait). **throttler** config déjà `throttlers:[{ttl:ms}]` (v6-shaped).
  **Retirer les 2 `swagger-ui-express`** (racine `^5` + backend `^4`, 0 importateur ; `@nestjs/swagger@11` tire `swagger-ui-dist`).

### C4. Guards ast-grep PERMANENTS (ratchets)
- `.ast-grep/rules/backend-no-legacy-route-wildcard.yml` (scope controllers+modules+main.ts ; précédent
  `backend-no-parseint-query-param.yml` ; ignore commentaires) — **warning→error même PR** (corpus=0 au merge).
  **Plusieurs patterns** : arg string de décorateur `:param(.*)`/`:path*` + `forRoutes('*')` + `{path:'*'}`.
- `.ast-grep/rules/backend-no-decode-in-splat-controllers.yml` **file-scoped aux 3 contrôleurs**
  (metadata/breadcrumb/seo) — **pas monorepo** (paybox HMAC / auth décodent légitimement).

### C5. Gate dépendances
`npm install` → `npm ls --all` / `npm explain @nestjs/common @nestjs/core express path-to-regexp @nestjs/bull bull swagger-ui-express` →
0 invalid peer ; `@nestjs/bull` 11.x + `bull` 4.x inchangé ; `npm explain swagger-ui-express` = aucun chemin runtime ;
0 Nest 10 résiduel runtime ; override 3.3.0 supprimé ; chaîne Nest/Express sur path-to-regexp 8.

### C6. Matrice runtime = e2e supertest in-process (`backend/tests`) + curl smoke PREPROD
Boot statique (guards ast-grep, 14/14 migrés) ; boot runtime (0 `TypeError`, 0 warning `LegacyRouteConverter`) ;
SSR (`/`, R1/R2/R8, `.html` legacy, 404, 410) ; **catch-all = garde runtime `remix.controller.ts:68-76`** (`startsWith`,
≠ path-to-regexp) ; splats 0/1/N + **single-decode** ; middleware scopé `api/diagnostic/*path` fire, préfixe frère NON ;
encodage `%25/%252F/%2F/+`/accents + `%`/`%ZZ` → 0 crash ; query parser tableaux/objets ; breadcrumb identique à Nest 10 ;
cache (rejouer batterie PR-9f.cache **sous Nest 11**, topologie préservée, `setex` ioredis = secondes) ;
Swagger (`createDocument`, `/api/docs` + `/api/docs-json` 200, schémas, nb paths ≈ baseline) ;
WebSocket (NotificationsGateway, MessagingGateway : connect/handshake/emit/shutdown) ;
Worker `:3001` (boot Nest 11, `/health` 200, queues+processors **Bull 4 / @nestjs/bull**, shutdown,
**aucune mutation fournisseur** — one-shot compilé + garde de refus testé, **jamais lancé**) ;
auth/session/Passport ; static MIME+compression ; sitemaps ; throttling IP Cloudflare ; shutdown ordonné ;
perf Nest 10↔11 (cold-start, RSS, p95, Swagger gen).

### C7. Ouvrir PR C
Régénérer l'inventaire (`npm run audit:pr-9-modernization-inventory`) ; CI **vérifiée `gh pr checks`** ;
corps PR = runbook rollback.

---

## Déploiement, soak, rollback

`merge main → PREPROD atomique → matrice C6 → soak piloté → GO owner nominatif → tag PROD v*`.
`deploy_mode: atomic ; supports_dual_runtime: none ; rollback_mode: manual-only`.
**Observabilité = INTERNE existante** (Sentry via `serverObservability` câblé dans `remix.controller.ts`,
`/health`, stack CWV/RUM, `rpc_*_alerts_v1`) — **pas de canary externe**.
**Rollback drillé** : préparer 1 revert PR (+ ratchets Express5→4 / RxJS) ; drill sur le container PREPROD
(49.12.233.2:3200) ; remplir `rollback_tested_at` AVANT le tag.
**Soak piloté par preuve** (pas 72 h mécanique) : min 24 h trafic synthétique couvrant C6 ; extension si signaux
(reconnexions Redis/BullMQ, instabilité mémoire, erreur intermittente). Sortie : 0 crash / 0 restart / 0 session perdue /
0 erreur path-to-regexp / 0 régression cache/WS. **Nuance** : le container PREPROD est `READ_ONLY` → les probes
write-path (login) se valident sur DEV (46.224.118.55:3000) + E2E Smoke CI.

## Rejeté (sur-ingénierie)
Constantes `*_MS` (schéma dupliqué de `CacheTTL`+`getTTLMs`) ; ast-grep no-decode monorepo-wide ;
canary / dual-runtime ; soak 72 h mécanique ; patch d'un 2ᵉ query-parser dans `main.server.ts`
(2ᵉ bootstrap `bootstrapNest()`, 0 consommateur → classer UNREACHABLE / supprimer).
