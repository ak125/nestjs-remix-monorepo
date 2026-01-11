# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a production-ready NestJS + Remix monorepo for an automotive parts e-commerce platform. The backend (NestJS) serves both the API and the frontend (Remix) on the same port (3000) in development and production.

**Key Stats:**
- 4M+ products, 59k+ users, 9k+ categories
- Production deployment with Docker + Caddy reverse proxy
- Database: Supabase (PostgreSQL) - pas de Prisma

## Source of Truth (00-canon)

Les fichiers canoniques définissent la vérité du projet. Toujours consulter ces fichiers en priorité.

| Fichier | Contenu |
|---------|---------|
| `.spec/00-canon/repo-map.md` | Structure monorepo (40 modules, 158 routes, 9 packages) |
| `.spec/00-canon/architecture.md` | Architecture technique NestJS/Remix/Supabase/Redis |
| `.spec/00-canon/rules.md` | 7 règles non-négociables du projet |

**RAG Knowledge:** Le corpus RAG est dans `/opt/automecanik/rag/knowledge/` (14 docs validés avec truth_level L1/L2).

## Common Commands

### Development
```bash
# Start full stack (backend + frontend on port 3000)
npm run dev

# Start backend only
cd backend && npm run dev

# Start frontend only
cd frontend && npm run dev

# Start with Redis (required for sessions)
docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine
npm run dev
```

### Building
```bash
# Build all packages (uses Turbo)
npm run build

# Build backend only
cd backend && npm run build

# Build frontend only
cd frontend && npm run build

# Clean build artifacts
cd backend && npm run prebuild  # removes dist/ and tsconfig.tsbuildinfo
```

### Testing (curl)
```bash
# Test API endpoints avec curl
curl http://localhost:3000/health
curl http://localhost:3000/api/catalog/families
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"xxx"}'

# Test avec jq pour formater JSON
curl -s http://localhost:3000/api/catalog/families | jq '.data[:3]'

# Test endpoint avec cookie session
curl -b cookies.txt -c cookies.txt http://localhost:3000/api/user/profile
```

### Linting & Type Checking
```bash
# Lint all packages
npm run lint

# Type check all packages
npm run typecheck

# Fix linting issues
cd backend && npm run lint -- --fix
cd frontend && npm run lint -- --fix
```

### Production
```bash
# Start production server (requires build)
npm run start

# Docker production
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f app
```

### GitHub CLI (gh)
```bash
# Créer une PR
gh pr create --title "feat: description" --body "Description détaillée"

# Lister les PRs
gh pr list

# Voir une PR
gh pr view 18

# Merger une PR
gh pr merge 18 --merge

# Créer une issue
gh issue create --title "Bug: description" --body "Détails"

# Voir le status des checks
gh pr checks
```

## Architecture Overview

### Monorepo Structure
- **backend/** - NestJS API (TypeScript, PostgreSQL via Supabase)
- **frontend/** - Remix SSR application (React 18, Vite)
- **packages/** - Shared libraries
  - `@repo/database-types` - Supabase-generated types
  - `@monorepo/shared-types` - Shared TypeScript types and Zod schemas
  - `@fafa/ui` - React component library (Radix UI + Tailwind)
  - `@fafa/design-tokens` - Design system tokens
  - `@fafa/typescript-config` - Shared tsconfig
  - `@fafa/eslint-config` - Shared ESLint rules

### Backend Architecture (NestJS)

**Key Pattern: Module-based Dependency Injection**
```typescript
// Each feature is a module with controllers, services, and data services
PaymentsModule
├── PaymentsController (HTTP handlers)
├── PaymentService (business logic)
└── PaymentDataService (Supabase queries)
```

**Three-Tier Pattern:**
1. Controllers - HTTP/validation layer (Zod schemas)
2. Services - Business logic orchestration
3. Data Services - Direct Supabase queries

**Database Access (Supabase uniquement, PAS de Prisma):**
- Supabase SDK directement : `supabase.from('table').select().eq()`
- RPC functions pour requêtes complexes : `supabase.rpc('function_name', params)`
- Base service : `SupabaseBaseService` avec patterns réutilisables
- Migrations SQL dans `backend/supabase/migrations/`

**Session Management:**
- Redis + express-session (30-day TTL)
- Passport.js for authentication (local strategy)
- Admin auth uses JWT tokens (24-hour expiry)
- Cookie name: `connect.sid` (HttpOnly, SameSite: lax)

**Important Modules:**
- `CryptoModule` - Global module for password hashing (bcrypt + legacy MD5 support)
- `DatabaseModule` - Exports all data services
- `PaymentsModule` - Dual payment gateway (Paybox + SystemPay)
- `SeoModule` - V4 Ultimate SEO with 180% more variables
- `CacheModule` - Redis + NestJS Cache Manager

### Frontend Architecture (Remix)

**SSR with Remix:**
- Server-side rendering for SEO and performance
- Route-based code splitting (flat routes pattern)
- Loaders for server-side data fetching
- Actions for form submissions

**State Management:**
- Server state: React Query (TanStack)
- Client state: Zustand stores
- Form state: Conform.js + Zod validation

**API Communication:**
- Services in `frontend/app/services/api/`
- Native fetch with error handling
- Base URL: `http://localhost:3000` (same port as backend)

**Key Routes Pattern:**
```
app/routes/
├── _index.tsx                    # Homepage
├── admin.*/                      # Admin dashboard routes
├── panier.*/                     # Cart pages
├── pieces.*.tsx                  # Product catalog routes
└── api.*.ts                      # API routes (handled by Remix)
```

### UI Components Convention

**IMPORTANT: Use shadcn/ui + Tailwind CSS**
- Always use `shadcn/ui` components from `~/components/ui/` (not raw HTML or custom components)
- Style with Tailwind CSS utility classes only
- Icons: Use `lucide-react` (already installed)
- Do NOT import `React` unless using class components or specific React APIs (hooks don't need it)

**Component imports:**
```typescript
// ✅ Correct - use shadcn/ui
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';

// ❌ Wrong - don't import React for functional components
import React from 'react';  // Not needed with modern JSX transform
```

**Styling:**
```typescript
// ✅ Correct - Tailwind classes
<div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200">

// ❌ Wrong - inline styles or CSS modules
<div style={{ display: 'flex' }}>
```

### Payment Integration (Critical)

**Two Gateways:**
1. **Paybox (Production)** - Vérifone
   - HMAC-SHA512 signature
   - Config: `PAYBOX_SITE`, `PAYBOX_RANG`, `PAYBOX_IDENTIFIANT`, `PAYBOX_HMAC_KEY`
   - Response format: `Mt:10050;Ref:ORD123;Auto:XXXXX;Erreur:00000;Signature:...`

2. **SystemPay (Test)** - BNP Paribas Cyberplus
   - HMAC-SHA256 or SHA1 signature
   - Config: `SYSTEMPAY_SITE_ID`, `SYSTEMPAY_CERTIFICATE_PROD/TEST`
   - Vads_* parameters (alphabetically sorted for signature)

**Payment Flow:**
1. Order created → Payment initiated
2. User redirected to gateway
3. Gateway callback to `/api/payments/paybox/callback`
4. Signature verified → Order status updated
5. User redirected to success/error page

**Security:**
- HMAC signature verification on all callbacks
- CSP headers allow payment domains
- Error code validation before confirmation

### SEO Architecture (Advanced)

**DynamicSeoV4UltimateService:**
- 180% more variables than original
- Dynamic meta descriptions, Open Graph, Twitter cards
- Structured data (Schema.org JSON-LD)
- Breadcrumbs with internal linking

**Sitemap System (V2 Scalable):**
- 3-level hierarchy: Index → Sub-indices → Final sitemaps
- 50k URL limit per file (Google requirement)
- Sharding strategies: alphabetic, numeric, temporal
- GZIP compression for large sitemaps
- Supports 1M+ URLs with intelligent caching

**Key SEO Tables:**
- `__seo_*` prefix for dynamic content
- `__blog_*` for blog/guides/advice content
- RPC functions for efficient querying

### Testing Strategy

**API Testing (curl):**
- Tester les endpoints directement avec curl
- Utiliser jq pour parser les réponses JSON
- Scripts de test dans `backend/scripts/` si nécessaire

**Tests manuels recommandés:**
```bash
# Health check
curl http://localhost:3000/health

# API catalog
curl -s http://localhost:3000/api/catalog/families | jq '.data | length'

# Vérifier SEO
curl -s "http://localhost:3000/pieces/freinage" | grep -o '<title>[^<]*</title>'
```

## Development Workflow

### Starting Development
1. Ensure Redis is running: `docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine`
2. Start dev: `npm run dev` (runs backend + frontend concurrently)
3. Backend starts on port 3000, serves Remix frontend
4. Access: `http://localhost:3000`

### Making Changes

**Backend:**
- Edit files in `backend/src/`
- TypeScript compiler watches and rebuilds (`dev:compile`)
- Nodemon restarts server on dist changes (`dev:watch`)
- Tester avec curl après modifications

**Frontend:**
- Edit files in `frontend/app/`
- Vite provides HMR (instant updates)
- Remix handles routing, loaders, actions
- Components in `frontend/app/components/`

**Shared Types:**
- Edit `packages/shared-types/src/`
- Used by both backend and frontend
- Rebuild: `cd packages/shared-types && npm run build`

### Git Workflow & Déploiement

**⚠️ RÈGLE ABSOLUE : Push sur `main` = VALIDATION MANUELLE OBLIGATOIRE**

1. **Ne JAMAIS push sur `main`** sans approbation explicite de l'utilisateur
2. `main` = production automatique (déploiement immédiat)
3. Workflow :
   - Travailler sur branche feature ou directement
   - Tester localement avec curl
   - **DEMANDER VALIDATION** avant tout push sur main
   - Attendre confirmation explicite ("ok push", "go", "valide")
   - Seulement après : `git push origin main`

### Commits par Session (CRITIQUE)

> ⚠️ **RÈGLE ABSOLUE** : Ne committer QUE les fichiers de la session en cours !

**Avant chaque commit, vérifier :**
```bash
# 1. Lister les fichiers modifiés
git status

# 2. Vérifier ce qui sera poussé
git diff --name-only origin/main

# 3. Exclure les modules non testés
git reset HEAD backend/src/modules/<module-non-testé>/
```

**Modules en Développement (INTERDIT en prod) :**

| Module | Status | Raison |
|--------|--------|--------|
| `backend/src/modules/rm/` | ⚠️ DEV | Import @monorepo/shared-types non résolu en Docker |

### Séparation Documentation / Production

**Règle : Documentation sur `develop` uniquement**

| Branche | Contenu |
|---------|---------|
| `main` (prod) | Code uniquement - pas de `.spec/`, docs minimales |
| `develop` | Code + documentation complète (`.spec/`, guides, README détaillés) |

**Fichiers à garder sur develop seulement :**
- `.spec/` - Spécifications et documentation technique
- Guides détaillés et tutoriels
- Rapports et analyses

**Objectif :** Garder `main` léger et propre pour la production

### Environment Variables

**Backend (.env):**
```env
PORT=3000
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=redis://localhost:6379
PAYBOX_SITE=...
PAYBOX_HMAC_KEY=...
SYSTEMPAY_SITE_ID=...
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

## Critical Patterns to Follow

### Database Queries
```typescript
// Use Supabase SDK directly
const { data, error } = await this.supabase
  .from('__products')
  .select('*')
  .eq('id', productId)
  .single();

// For complex queries, use RPC
const { data } = await this.supabase.rpc('get_bestsellers', {
  limit: 10,
  category_id: 5
});
```

### Authentication Guards
```typescript
// Protect admin routes
@UseGuards(IsAdminGuard)
@Get('admin/stats')
async getAdminStats() { ... }

// Check user session
@UseGuards(AuthGuard('local'))
@Post('login')
async login(@Req() req) { ... }
```

### Form Validation (Zod)
```typescript
// Backend controller
import { z } from 'zod';

const createOrderSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number() }))
});

@Post('orders')
async createOrder(@Body() body: z.infer<typeof createOrderSchema>) { ... }
```

### Remix Loaders
```typescript
// Server-side data fetching
export async function loader({ request, params }: LoaderFunctionArgs) {
  const productId = params.productId;
  const product = await fetch(`${API_URL}/api/products/${productId}`);
  return json({ product });
}

// Meta tags for SEO
export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data.product.name },
  { name: "description", content: data.product.description }
];
```

## Common Pitfalls

1. **Redis Required:** Backend won't start without Redis for sessions. Run Redis before `npm run dev`.

2. **Port 3000 Shared:** Backend serves frontend on the same port. Don't try to run frontend separately on different port.

3. **Payment Signatures:** Always verify HMAC signatures on payment callbacks. Use correct algorithm (SHA512 for Paybox, SHA256 for SystemPay).

4. **Supabase RLS:** Some tables have Row Level Security. Use service role key in backend, anon key in frontend.

5. **TypeScript Compilation:** Backend uses `tsc --build` with watch mode. Wait for compilation before testing changes.

6. **Turbo Cache:** If builds seem stale, clear Turbo cache: `npm run clean-turbo-cache`.

7. **Memory Limits:** Backend build uses `--max-old-space-size=4096`. Increase if build fails with OOM.

## Incidents et Post-Mortems

### 2026-01-11 : Crash Production (Module rm/)

**Cause :** Push du module `rm/` qui importe `@monorepo/shared-types` non lié dans Docker.

**Symptôme :**
```
Error: Cannot find module '@monorepo/shared-types'
Require stack:
- /app/backend/dist/modules/rm/services/rm-listing.service.js
```

**Impact :** Site down ~15 minutes (Cloudflare 521)

**Résolution :**
```bash
git reset --hard 9b4d7ddd
git push --force origin main
# Empty commit pour déclencher rebuild
git commit --allow-empty -m "chore: trigger rebuild"
git push origin main
```

**Leçon :** Toujours vérifier que les imports sont résolus dans le build Docker avant push.

## Key Files to Reference

- `backend/src/main.ts` - NestJS bootstrap, middleware setup
- `backend/src/app.module.ts` - Root module with all imports
- `frontend/app/root.tsx` - Remix root with providers
- `frontend/app/routes/_index.tsx` - Homepage
- `turbo.json` - Monorepo build pipeline
- `docker-compose.prod.yml` - Production deployment
- `README.md` - Full documentation and metrics

## Production Deployment

**Docker Build:**
```bash
docker build -t automecanik-app .
docker-compose -f docker-compose.prod.yml up -d
```

**Environment:**
- `NODE_ENV=production`
- Port 3001 internally, exposed via Caddy reverse proxy
- Redis for sessions on internal network
- Supabase for database (production URL)

**Monitoring:**
- Logs: `docker-compose logs -f app`
- Health check: `http://localhost:3000/health`
- Admin stats: `http://localhost:3000/admin/stats`

## CI/CD Automatique (GitHub Actions)

**⚠️ IMPORTANT : Déploiement automatique activé !**

Le projet utilise **GitHub Actions avec self-hosted runner** pour déployer automatiquement sur le serveur de production.

### Workflow de déploiement

**Fichier:** `.github/workflows/ci.yml`

**Déclenchement:**
```bash
git push origin main  # Déclenche automatiquement le déploiement
```

**Pipeline (5-10 minutes):**
1. **Lint** - Vérification ESLint (`npm run lint`)
2. **TypeCheck** - Vérification TypeScript (`npm run typecheck`)
3. **Build** - Construction image Docker (`massdoc/nestjs-remix-monorepo:production`)
4. **Deploy** - Déploiement sur serveur self-hosted

**Condition de déploiement:**
- Branche: `main` uniquement
- Event: `push` (pas sur PR)
- Runner: `self-hosted, Linux, X64`

### Commandes de déploiement automatique

Le runner exécute automatiquement :
```bash
# Pull de l'image Docker buildée
docker pull massdoc/nestjs-remix-monorepo:production

# Synchronisation docker-compose depuis Git
cp docker-compose.prod.yml /home/deploy/app/
cp docker-compose.caddy.yml /home/deploy/app/

# Création réseau externe
docker network create automecanik-prod

# Arrêt des anciens conteneurs
docker stop nestjs-remix-caddy nestjs-remix-monorepo-prod
docker rm nestjs-remix-caddy nestjs-remix-monorepo-prod

# Démarrage avec nouvelle config
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d

# Vérification variables d'environnement
docker exec nestjs-remix-monorepo-prod env | grep -E "UNIFIED|RPC"
```

### Workflow manuel (si besoin)

Si le déploiement automatique échoue ou pour tests locaux :
```bash
# Build et push manuel de l'image
docker build -t massdoc/nestjs-remix-monorepo:production .
docker push massdoc/nestjs-remix-monorepo:production

# Déploiement sur serveur (SSH)
ssh deploy@server
cd /home/deploy/app
docker pull massdoc/nestjs-remix-monorepo:production
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d
```

### Monitoring du déploiement

**Via GitHub Actions:**
- Aller sur `https://github.com/ak125/nestjs-remix-monorepo/actions`
- Voir le workflow "🚀 Deploy" en cours
- Statut: ✅ Réussi / ❌ Échoué

**Sur le serveur:**
```bash
# Logs en temps réel
docker compose -f docker-compose.prod.yml logs -f

# Vérifier que les conteneurs tournent
docker ps | grep nestjs-remix

# Tester le health check
curl http://localhost:3000/health
```

### Secrets GitHub (déjà configurés)

**Secrets nécessaires:**
- `DOCKERHUB_USERNAME` - Login Docker Hub
- `DOCKERHUB_TOKEN` - Token Docker Hub
- `DATABASE_URL` - URL Supabase production
- `TURBO_TOKEN` - Cache Turbo (optionnel)
- `TURBO_TEAM` - Team Turbo (optionnel)

### Rollback en cas de problème

Si le déploiement échoue :
```bash
# Revenir à la version précédente
git revert HEAD
git push origin main  # Redéclenche le déploiement avec l'ancien code

# OU restaurer manuellement une image précédente
docker pull massdoc/nestjs-remix-monorepo:production@sha256:xxxxx
docker compose up -d
```

**Note:** Le workflow conserve les anciennes images Docker. Vérifier avec `docker images` sur le serveur.
