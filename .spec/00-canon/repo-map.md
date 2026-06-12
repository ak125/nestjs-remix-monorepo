# Repo Map - AutoMecanik Monorepo

> **Source de verite** - Structure reelle du code au 2026-05-25
> **Version**: 2.0.2 | **Status**: CANON

---

## Vue d'ensemble

```
/opt/automecanik/app/
├── backend/          # NestJS API (54 modules)
├── frontend/         # Remix SSR (235 fichiers routes top-level)
├── packages/         # 12 packages partages
├── .spec/            # Documentation technique
├── scripts/          # Scripts utilitaires
└── docs/             # Documentation publique
```

**Note**: Le corpus RAG est dans `automecanik-rag/knowledge/` (352 docs — diagnostics, gammes, FAQ, guides, fiches véhicules, SEO).

---

## Backend - NestJS API

**Chemin**: `backend/src/modules/`
**Total**: 54 modules

### Modules par domaine

| Domaine | Modules |
|---------|---------|
| **Core** | `config`, `health`, `system`, `errors` |
| **Auth** | `auth`, `users`, `staff` |
| **Catalog** | `products`, `catalog`, `vehicles`, `gamme-rest`, `substitution`, `vehicle-context` |
| **Commerce** | `cart`, `orders`, `payments`, `invoices`, `promo`, `commercial`, `pricing` |
| **Logistics** | `shipping`, `suppliers`, `customers` |
| **Content** | `blog`, `blog-metadata`, `ai-content`, `marketing`, `merchant-center` |
| **SEO** | `seo`, `seo-logs`, `seo-monitoring`, `seo-shadow-observatory`, `seo-control-plane`, `trend-signals` |
| **Support** | `messages`, `support` |
| **Analytics** | `analytics`, `dashboard`, `observability` |
| **Search/RAG** | `search`, `knowledge-graph`, `rag-proxy`, `rag-knowledge-bootstrap` |
| **AI/Diagnostic** | `agentic-engine`, `diagnostic-engine`, `mcp-validation` |
| **Security** | `bot-guard` |
| **Media** | `upload`, `metadata` |
| **Navigation** | `navigation`, `layout` |
| **Admin** | `admin` |
| **Ops** | `maintenance` |
| **Legacy/DEV** | `rm` (DEV uniquement — cf. CLAUDE.md backend.md) |

### Liste complete

```
admin                       agentic-engine              ai-content
analytics                   auth                        blog
blog-metadata               bot-guard                   cart
catalog                     commercial                  config
customers                   dashboard                   diagnostic-engine
errors                      gamme-rest                  health
invoices                    knowledge-graph             layout
maintenance                 marketing                   mcp-validation
merchant-center             messages                    metadata
navigation                  observability               orders
payments                    pricing                     products
promo                       rag-knowledge-bootstrap     rag-proxy
rm                          search                      seo
seo-control-plane           seo-logs                    seo-monitoring
seo-shadow-observatory      shipping                    staff
substitution                suppliers                   support
system                      trend-signals               upload
users                       vehicle-context             vehicles
```

---

## Frontend - Remix SSR

**Chemin**: `frontend/app/`
**Routes**: 235 fichiers top-level (.ts/.tsx, hors sous-dossiers)

### Structure

```
frontend/app/
├── routes/           # 235 fichiers top-level (flat routes)
├── components/       # Composants React
│   ├── ui/          # shadcn/ui components
│   └── ...          # Composants metier
├── services/         # Services API
├── stores/           # Zustand stores
├── hooks/            # React hooks
├── utils/            # Utilitaires
└── styles/           # CSS/Tailwind
```

### Routes principales

| Pattern | Description |
|---------|-------------|
| `_index.tsx` | Homepage |
| `admin.*` | Dashboard admin |
| `panier.*` | Pages panier |
| `pieces.*` | Catalogue produits |
| `api.*` | API routes Remix |

---

## Packages partages

**Chemin**: `packages/`
**Total**: 12 packages

| Package | Description |
|---------|-------------|
| `@repo/database-types` | Types Supabase generes |
| `@fafa/design-tokens` | Design system tokens |
| `@fafa/typescript-config` | tsconfig partage |
| `@fafa/eslint-config` | ESLint rules partagees |
| `@fafa/eslint-plugin-fafa-ports` | ESLint plugin guards d'imports cross-domaine |
| `@repo/seo-role-contracts` | Contrats Zod R0-R8 (ADR-038/039) |
| `@repo/seo-roles` | Canon RoleId R0-R8 + normalisation |
| `@repo/seo-types` | Types partages SEO |
| `@repo/seo-url-contract` | SoT CJS regles URL R-SEO-09 (front + back) |
| `@repo/cwv-taxonomy` | Canon taxonomie CWV (ADR-063) |
| `@repo/domain-commerce` | Types partages domaine commerce (cart/orders/pricing) |
| `@repo/registry` | Schemas Zod Repository Control Plane (ADR-058 V1) |

---

## Configuration

### Fichiers racine

| Fichier | Role |
|---------|------|
| `package.json` | Dependencies monorepo |
| `turbo.json` | Pipeline Turbo |
| `Dockerfile` | Build production |
| `docker-compose.prod.yml` | Stack production |
| `CLAUDE.md` | Instructions Claude Code |

### Docker Compose disponibles

- `docker-compose.prod.yml` - Production (image production)
- `docker-compose.preprod.yml` - Preprod DEV (image preprod)
- `docker-compose.dev.yml` - Developpement local
- `docker-compose.ci-deploy.yml` - Deploiement CI
- `docker-compose.caddy.yml` - Reverse proxy Caddy
- `docker-compose.redis.yml` - Cache Redis (sessions)
- `docker-compose.meilisearch.yml` - Search engine
- `docker-compose.vector.yml` - Vector DB
- `docker-compose.worker.yml` - Workers async
- `docker-compose.imgproxy.yml` - Image proxy

---

## Statistiques

| Metrique | Valeur |
|----------|--------|
| Backend modules | 54 |
| Frontend routes | 235 |
| Shared packages | 12 |
| Docker configs | 10 |
| Produits DB | 4M+ |
| Utilisateurs | 59k+ |
| Categories | 9k+ |

---

## Chemins critiques

```
backend/src/main.ts              # Bootstrap NestJS
backend/src/app.module.ts        # Root module
frontend/app/root.tsx            # Remix root
frontend/app/routes/_index.tsx   # Homepage
packages/seo-roles/src/          # Canon RoleId R0-R8
```

---

## RAG Corpus (externe)

**Chemin**: `/opt/automecanik/rag/knowledge/`
**Total**: 15 documents

Voir `.spec/bmad/output/rag_diagnosis.md` pour details.

---

_Derniere mise a jour: 2026-05-25_
_Status: CANON - Source de verite_
