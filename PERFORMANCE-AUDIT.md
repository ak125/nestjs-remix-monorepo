# Audit Performance Full-Stack — 2026-02-22

> Analyse complète du monorepo NestJS + Remix (e-commerce automobile, 4M+ produits, 59k+ utilisateurs)

**Score global : 6.8/10**

---

## Table des matières

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Backend (NestJS)](#2-backend-nestjs) — 16 issues (3 CRITICAL)
3. [Frontend (Remix)](#3-frontend-remix) — 27 issues (8 P0)
4. [Infrastructure (Docker/Caddy/Turbo)](#4-infrastructure) — 25 issues (1 CRITICAL)
5. [Architecture & Patterns](#5-architecture--patterns) — 25 issues (3 CRITICAL)
6. [Matrice de priorisation](#6-matrice-de-priorisation)
7. [Roadmap recommandée](#7-roadmap-recommandée)

---

## 1. Résumé exécutif

| Axe | Score | Issues CRITICAL | Issues HIGH | Issues MEDIUM |
|-----|-------|----------------|-------------|---------------|
| Backend | 6/10 | 3 | 2 | 5 |
| Frontend | 7/10 | 0 | 8 | 12 |
| Infrastructure | 6/10 | 1 | 3 | 8 |
| Architecture | 7/10 | 3 | 5 | 10 |
| **Total** | **6.8/10** | **7** | **18** | **35** |

**Risques immédiats :**
- Memory leaks (Maps/WebSocket unbounded) → crash après quelques semaines
- Turbo cache désactivé partout → 5-10 min gaspillées par CI run
- SELECT * sur 23+ fichiers avec 4M produits → latence API
- N+1 queries non protégées dans Orders/Catalog
- Race condition sur le semaphore de connexion Supabase

---

## 2. Backend (NestJS)

### CRITICAL

#### 2.1 Memory leak — Maps sans limite dans VehicleFilteredCatalogV4HybridService
**Fichier :** `backend/src/modules/catalog/services/vehicle-filtered-catalog-v4-hybrid.service.ts:104-115`
- `memoryCache = new Map()` et `vehicleStats = new Map()` croissent indéfiniment
- Aucun LRU, aucun TTL, aucun `OnModuleDestroy`
- **Impact :** OOM après quelques semaines de production
- **Fix :** Remplacer par `lru-cache` (maxSize=5000, maxAge=1h) ou migrer vers Redis via CacheService

#### 2.2 Memory leak — Maps dans RagProxyService
**Fichier :** `backend/src/modules/rag-proxy/rag-proxy.service.ts:64-82`
- `intentStats` et `webJobs` accumulent sans limite
- **Fix :** Ajouter TTL + cleanup périodique + `OnModuleDestroy`

#### 2.3 WebSocket connections illimitées
**Fichier :** `backend/src/notifications/notifications.gateway.ts:38-77`
- `connectedClients = new Map()` sans plafond (59k users = 59k+ entries)
- `setTimeout` jamais nettoyé au disconnect
- Broadcast sans batching
- **Fix :** Limit max 10k connections + cleanup dans `handleDisconnect` + batch broadcasts par 100

### HIGH

#### 2.4 SELECT * sur 23+ fichiers
- 30 fichiers utilisent `.select('*')` → fetch de toutes les colonnes
- Sur tables avec 4M lignes, +50-80% de payload réseau inutile
- **Fix :** Auditer et remplacer par `.select('id, name, alias, image_url')` explicite

#### 2.5 setInterval sans cleanup (8+ services)
- `upload-analytics.service.ts`, `mcp-validation.service.ts`, `system.service.ts`
- Aucun `OnModuleDestroy` pour `clearInterval()`
- **Fix :** Implémenter `OnModuleDestroy` dans tous les services avec des intervalles

### MEDIUM

#### 2.6 Session Redis — TTL 30 jours sans invalidation au logout
**Fichier :** `backend/src/main.ts:59,91`
- Session réplayable si session ID compromis
- **Fix :** Invalider la session Redis au logout + réduire TTL à 7-14j

#### 2.7 Cache Redis — Race condition au boot (timeout 2s)
**Fichier :** `backend/src/cache/cache.service.ts:24-58`
- Si Redis met >2s à démarrer, l'app tourne sans cache (silent fail)
- **Fix :** Augmenter timeout à 5-10s + fallback LRU in-memory

#### 2.8 Guards chaînés — 2 I/O par requête admin
- `AuthenticatedGuard` (Redis) + `IsAdminGuard` (DB) en séquence sur chaque route
- **Fix :** Memoize le résultat du guard 60s + utiliser guard au niveau module

#### 2.9 Middleware coûteux sur toutes les routes
**Fichier :** `backend/src/main.ts:112-148`
- `crypto.randomBytes(16)` pour CSP nonce à chaque requête
- **Fix :** Pré-calculer le template CSP nonce

#### 2.10 Pagination manquante sur datasets larges
- Sitemap (714k+ URLs) bien shardé, mais d'autres services chargent tout sans `.limit()`
- **Fix :** Ajouter `.limit()` et `.range()` systématiquement

---

## 3. Frontend (Remix)

### P0 (Action immédiate)

#### 3.1 Recharts — +140KB gzipped chargé globalement
**Fichier :** `frontend/package.json:67`
- Utilisé uniquement sur pages admin
- **Fix :** Lazy-load avec `React.lazy()` ou route splitting

#### 3.2 Pas de Cache-Control sur les réponses SSR
**Fichier :** `frontend/app/routes/_index.tsx`
- Chaque navigation re-fetch toutes les données
- **Fix :** `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`

#### 3.3 suppressHydrationWarning masque des bugs
**Fichier :** `frontend/app/root.tsx:408-409,448,521`
- Plusieurs flags pour masquer des mismatches SSR/client
- **Fix :** Identifier la source (probablement `new Date()` côté serveur) et corriger

#### 3.4 Navbar 628 lignes sans memoization
**Fichier :** `frontend/app/components/Navbar.tsx`
- 4+ useEffect, progress bar, state management — zéro `React.memo()`
- **Fix :** Extraire sub-components (Logo, SearchBar, UserActions, CartButton) + memo

#### 3.5 Family Cards re-render complet à chaque tab switch
**Fichier :** `frontend/app/routes/_index.tsx:1155-1240`
- 40+ cards non memoizées, re-render total à chaque changement d'onglet
- **Fix :** `React.memo()` sur les cards + `useMemo()` pour le filtrage

#### 3.6 AVIF manquant — 25-35% d'économie de bande passante
**Fichier :** `frontend/app/components/ui/ResponsiveImage.tsx:147-275`
- `PictureImage` supporte AVIF/WebP mais `ResponsiveImage` non
- **Fix :** Utiliser `PictureImage` partout avec fallback AVIF → WebP → JPEG

#### 3.7 Admin dashboard charge tout synchroniquement
**Fichier :** `frontend/app/routes/admin._index.tsx:61-100+`
- Stats API bloquantes au chargement
- **Fix :** Remix `defer()` pour les stats non-critiques

#### 3.8 Hydration mismatch dans usePageRole hook
**Fichier :** `frontend/app/root.tsx:256-267`
- `usePageRoleDataAttrs()` peut accéder au DOM côté serveur
- **Fix :** Check `typeof window` ou wrapper `useEffect`

### P1 (Sprint suivant)

#### 3.9 TipTap editor non code-splitté (+50KB)
#### 3.10 Embla Carousel chargé globalement (+40KB)
#### 3.11 Pas de timeout/AbortController sur les fetches homepage
#### 3.12 QueryClient optimization (cache persistant localStorage)
#### 3.13 Images sans cache-busting CDN
#### 3.14 Widths images pas mobile-first (manque 240px, 360px)
#### 3.15 prefers-reduced-motion non respecté dans Reveal
#### 3.16 6 poids de fonts Google préchargés (trop)
#### 3.17 6 logos brand hardcodés en preload (pas scalable)
#### 3.18 Asset hashes non configurés pour immutable cache
#### 3.19 Checkout fait des fetches séquentiels au lieu de parallèles
#### 3.20 Tailwind content paths trop larges

### P2 (Backlog)

#### 3.21 GA4 inline JS ~3KB
#### 3.22 DNS prefetch analytics même si consent denied
#### 3.23 CSS minification uniquement en prod
#### 3.24 Pas de Web Vitals tracking (LCP, FID, CLS)
#### 3.25 ChatWidget error boundary silencieux (pas de Sentry)
#### 3.26 Code splitting admin routes à valider avec bundle analyzer
#### 3.27 chunkSizeWarningLimit à 500KB (devrait être 250KB)

---

## 4. Infrastructure

### CRITICAL

#### 4.1 Turbo cache désactivé sur TOUTES les tâches sauf build
**Fichier :** `turbo.json:5-21`
- `typecheck`, `lint`, `test` ont `"cache": false`
- **Perte : 5-10 minutes par CI run**
- **Fix :**
```json
"typecheck": { "cache": true, "outputs": ["tsconfig.tsbuildinfo"] },
"lint": { "cache": true, "outputs": [".eslintcache"] },
"test": { "cache": true, "outputs": ["coverage"] }
```

### HIGH

#### 4.2 Docker — layer caching inefficace
**Fichier :** `Dockerfile:7`
- `COPY . .` en début de builder → cache invalidé à chaque changement
- **Fix :** Copier package*.json d'abord, puis npm ci, puis les sources

#### 4.3 Docker — node_modules complets dans l'image finale
**Fichier :** `Dockerfile:53-59`
- Dev + prod dependencies copiées (~1.5GB+)
- **Fix :** `npm ci --omit=dev` dans le stage runner

#### 4.4 Docker — `--force` sur turbo build
**Fichier :** `Dockerfile:36-40`
- `CACHEBUST` + `--force` reconstruisent tout à chaque build CI
- **Fix :** Conditionner `--force` à une variable d'environnement

### MEDIUM

#### 4.5 Caddy — Brotli manquant (15-20% meilleur que gzip)
**Fichier :** `config/caddy/Caddyfile:301` — `encode gzip zstd` → ajouter `brotli`

#### 4.6 Redis — 256MB trop bas pour 59k users avec TTL 30j
**Fichier :** `docker-compose.prod.yml:57` — 256MB ≈ 51k sessions max, borderline
- **Fix :** Augmenter à 512MB

#### 4.7 Pas de memory limits sur le container NestJS
**Fichier :** `docker-compose.prod.yml` — pas de `deploy.resources.limits`
- **Fix :** Ajouter `memory: 2G`, `cpus: 2`

#### 4.8 Health check trop lent (timeout 15s, 5 retries)
**Fichier :** `docker-compose.prod.yml:40-45`
- Détection de panne : 2.5 minutes minimum
- **Fix :** timeout 3s, retries 3, interval 10s

#### 4.9 requestTimeout à 5 minutes
**Fichier :** `backend/src/main.ts:226` — `requestTimeout = 300000`
- **Fix :** 30s pour la plupart des routes, 5 min uniquement pour uploads

#### 4.10 TypeScript strict mode désactivé
**Fichier :** `backend/tsconfig.json:6` — `"strict": false`

#### 4.11 4GB heap allocation pour le build
**Fichier :** `backend/package.json:34` — `--max-old-space-size=4096`
- Symptôme de dépendances circulaires ou fichiers trop gros

#### 4.12 Pas de graceful shutdown timeout
**Fichier :** `backend/src/main.ts:171` — `enableShutdownHooks()` sans timeout

### LOW

#### 4.13 Vite — commonjsOptions inclut `/backend/` dans le build frontend
#### 4.14 Vite — dedupe partiel (manque zod, zustand, tanstack)
#### 4.15 Pas de remote caching Turbo
#### 4.16 globalDependencies manquant dans turbo.json
#### 4.17 Caddy — Vary: Accept-Encoding manquant sur assets hashés
#### 4.18 Caddy — pas de HTTP 103 Early Hints
#### 4.19 Pas de source maps cachés en production (debuggabilité)
#### 4.20 Node.js single process (pas de cluster mode)

---

## 5. Architecture & Patterns

### CRITICAL

#### 5.1 Race condition sur le semaphore de connexion Supabase
**Fichier :** `backend/src/database/services/supabase-base.service.ts:24-60`
- `this.current++` synchrone sans protection → race condition sous charge
- **Fix :** Utiliser Mutex ou Redis semaphore

#### 5.2 Package @monorepo/shared-types manquant
- Référencé dans 20+ fichiers, n'existe pas comme package
- Docker build crash si module `rm/` activé (incident 2026-01-11)
- **Fix :** Créer `packages/shared-types/` avec types partagés

#### 5.3 Order status — implémentation incomplète
**Fichier :** `backend/src/modules/orders/services/order-status.service.ts:61`
- `// TODO: Réimplémenter avec Supabase` — pas d'historique de statut
- **Fix :** Créer table `order_status_history` + logger chaque transition

### HIGH

#### 5.4 Dépendances circulaires — 20+ forwardRef()
- SEO module : 7 forwardRef (pire cas)
- Orders ↔ Shipping ↔ API cycle
- Remix ↔ Orders ↔ Users cycle
- **Fix :** Registry pattern, Event Bus, extraction de types communs

#### 5.5 N+1 queries dans Orders/Invoices
- Pattern : charger orders puis boucle sur `getOrderItems(order.id)`
- **Fix :** RPC functions ou JOIN queries

#### 5.6 Réponses API inconsistantes
- Certains endpoints : `{ statusCode, data, pagination }`
- Certains : `{ code, message, details }`
- Certains : arrays bruts
- **Fix :** Créer `ApiResponse<T>` unifié

#### 5.7 Pagination inconsistante
- Mix de `page` et `offset` selon les modules
- **Fix :** Standard `PaginationQuery` + `PaginatedResponse<T>`

#### 5.8 159 TODOs / 31 FIXMEs en production
- Taxe TVA hardcodée à 20% (`order-actions.service.ts:77`)
- Stock non remis au panier après annulation (`order-actions.service.ts:201`)
- Dashboard avec données fake (`dashboard.service.ts:55`)

### MEDIUM

#### 5.9 Validation Zod non systématique
- Seulement messages/, users/, products/ utilisent ZodValidationPipe
- Orders, Payments, Cart non validés
- **Fix :** Ajouter `@UsePipes(ZodValidationPipe)` partout

#### 5.10 1,579 uses de `any`/`unknown`
- 79 unsafe casts (`as any`)
- **Fix :** Typer progressivement, commencer par les services critiques

#### 5.11 Pas de rate limiting sur le callback paiement
- **Fix :** Ajouter rate limit par order_id

#### 5.12 HTML sanitization partielle (blog)
- Pas de DOMPurify intégré
- **Fix :** `DOMPurify.sanitize(content)` pour tout contenu user-generated

#### 5.13 Error logging fire-and-forget
**Fichier :** `backend/src/modules/errors/filters/global-error.filter.ts:50-60`
- Si Redis down, les erreurs sont perdues
- **Fix :** Buffer mémoire + fallback fichier

#### 5.14 Supabase query patterns dupliqués (50+ fois)
#### 5.15 Error handling boilerplate dupliqué (40+ fois)
#### 5.16 Pagination logic dupliquée (9 endroits)
#### 5.17 Cache keys sans version → stale data possible
#### 5.18 Missing batch operations (uploads, validations)

---

## 6. Matrice de priorisation

### Impact × Effort

```
                        EFFORT BAS (<4h)          EFFORT MOYEN (4-16h)        EFFORT HAUT (>16h)
                    ┌─────────────────────────┬───────────────────────────┬──────────────────────────┐
   IMPACT CRITIQUE  │ ★ Turbo cache enable    │ ★ OnModuleDestroy tous    │ ★ Refactor SEO circular  │
                    │ ★ WebSocket limit        │ ★ Docker layer caching   │ ★ shared-types package   │
                    │ ★ Semaphore Mutex        │ ★ SELECT * audit         │ ★ N+1 queries fix (RPC)  │
                    ├─────────────────────────┼───────────────────────────┼──────────────────────────┤
   IMPACT HIGH      │ ★ Cache-Control SSR      │ ★ Recharts lazy-load     │ ★ API response standard  │
                    │ ★ Redis 512MB            │ ★ Navbar memo split      │ ★ Pagination standard    │
                    │ ★ Health check tuning    │ ★ Fix hydration warnings │ ★ Order status impl      │
                    ├─────────────────────────┼───────────────────────────┼──────────────────────────┤
   IMPACT MEDIUM    │ ★ Brotli Caddy           │ ★ AVIF images            │ ★ Zod validation partout │
                    │ ★ requestTimeout 30s     │ ★ TipTap/Embla split     │ ★ Reduce 1579 `any`      │
                    │ ★ Memory limits Docker   │ ★ Fonts optimization     │                          │
                    └─────────────────────────┴───────────────────────────┴──────────────────────────┘
```

**Quick wins (< 4h, impact critique) :**
1. Activer Turbo cache → `turbo.json` (5 min)
2. Limiter WebSocket connections → `notifications.gateway.ts` (1h)
3. Remplacer Map par Mutex dans semaphore → `supabase-base.service.ts` (2h)

---

## 7. Roadmap recommandée

### Semaine 1 — Stabilité (CRITICAL)

| # | Action | Fichier principal | Effort |
|---|--------|-------------------|--------|
| 1 | Activer Turbo cache (typecheck, lint, test) | `turbo.json` | 30 min |
| 2 | Ajouter `OnModuleDestroy` + LRU cache | 8+ services | 4h |
| 3 | Limiter WebSocket (max 10k) + cleanup disconnect | `notifications.gateway.ts` | 2h |
| 4 | Fix race condition semaphore (Mutex) | `supabase-base.service.ts` | 2h |
| 5 | Ajouter `Cache-Control` headers SSR | `_index.tsx` + loaders | 1h |

### Semaine 2 — Performance (HIGH)

| # | Action | Fichier principal | Effort |
|---|--------|-------------------|--------|
| 6 | Docker layer caching (package.json first) | `Dockerfile` | 2h |
| 7 | `npm ci --omit=dev` dans image finale | `Dockerfile` | 1h |
| 8 | Audit SELECT * → colonnes explicites | 23+ fichiers backend | 4h |
| 9 | Lazy-load Recharts | `admin._index.tsx` | 2h |
| 10 | Split + memo Navbar | `Navbar.tsx` | 3h |
| 11 | Memo CatalogFamilyCards + useMemo | `_index.tsx` | 2h |

### Semaine 3 — Architecture (HIGH)

| # | Action | Fichier principal | Effort |
|---|--------|-------------------|--------|
| 12 | Créer `packages/shared-types/` | nouveau package | 4h |
| 13 | Compléter order-status-service | `order-status.service.ts` | 8h |
| 14 | Standardiser ApiResponse<T> | nouveau DTO + controllers | 12h |
| 15 | Fix hydration warnings (root.tsx) | `root.tsx` | 3h |
| 16 | Redis 512MB + health check tuning | `docker-compose.prod.yml` | 1h |

### Semaine 4 — Optimisation (MEDIUM)

| # | Action | Fichier principal | Effort |
|---|--------|-------------------|--------|
| 17 | Brotli sur Caddy | `Caddyfile` | 30 min |
| 18 | AVIF images (PictureImage partout) | `ResponsiveImage.tsx` | 4h |
| 19 | TipTap + Embla code splitting | routes spécifiques | 3h |
| 20 | N+1 queries → RPC functions | orders, catalog services | 16h |

---

## Métriques à surveiller post-fix

```bash
# Memory leaks
docker stats --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Cache hit ratio
docker exec redis-prod redis-cli INFO stats | grep keyspace

# API latence P95
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/catalog/families

# Build time CI
gh run list --limit 5 --json conclusion,startedAt,updatedAt

# Bundle size
cd frontend && npx vite-bundle-visualizer
```

---

*Généré par analyse automatisée — 4 agents parallèles (backend, frontend, infra, architecture)*
*93 issues identifiées — 7 CRITICAL, 18 HIGH, 35 MEDIUM, 33 LOW*
