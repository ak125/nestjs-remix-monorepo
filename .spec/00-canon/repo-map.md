# Repo Map - AutoMecanik Monorepo

> **Source de verite** - Structure reelle du code au 2026-06-20
> **Version**: 2.1.0 | **Status**: CANON

---

## Vue d'ensemble

```
/opt/automecanik/app/
├── backend/          # NestJS API (modules : voir REPO_MAP genere)
├── frontend/         # Remix SSR (Remix flat-routes)
├── packages/         # 12 packages partages
├── .spec/            # Documentation technique
├── scripts/          # Scripts utilitaires
└── docs/             # Documentation publique
```

**Note**: Le corpus RAG est dans `automecanik-rag/knowledge/` (352 docs — diagnostics, gammes, FAQ, guides, fiches véhicules, SEO).

---

## Backend - NestJS API

**Chemin**: `backend/src/modules/`
**Inventaire vivant** : voir [`.claude/knowledge/REPO_MAP.md`](../../.claude/knowledge/REPO_MAP.md) (genere depuis `audit/registry/canonical.json`, ADR-058 — jamais a la main). Ce canon n'epingle PAS le compte de modules (derive FS garantie).

### Modules par domaine

| Domaine | Modules |
|---------|---------|
| **Core** | `config`, `health`, `system`, `errors` |
| **Auth** | `auth`, `users`, `staff` |
| **Catalog** | `products`, `catalog`, `vehicles`, `gamme-rest`, `substitution`, `vehicle-context` |
| **Commerce** | `cart`, `orders`, `payments`, `invoices`, `promo`, `commercial`, `pricing` |
| **Logistics** | `shipping`, `suppliers`, `supplier-truth`, `customers` |
| **Content** | `blog`, `blog-metadata`, `ai-content`, `marketing`, `merchant-center` |
| **SEO** | `seo`, `seo-logs`, `seo-monitoring`, `seo-projection`, `seo-shadow-observatory`, `seo-control-plane`, `trend-signals` |
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

### Inventaire complet

Liste exhaustive et a jour des modules : [`.claude/knowledge/REPO_MAP.md`](../../.claude/knowledge/REPO_MAP.md) (projection generee du registry, ADR-058). La table par domaine ci-dessus est une **classification curee** (intention metier), pas un inventaire mecanique — ne pas la traiter comme source du compte.

---

## Frontend - Remix SSR

**Chemin**: `frontend/app/`
**Routes**: Remix flat-routes — ce canon n'epingle PAS de compte (comptage de fichiers = proxy trompeur, et churn permanent avec la migration React Router). Inventaire vivant : carte generee `.claude/knowledge/REPO_MAP.md`.

### Structure

```
frontend/app/
├── routes/           # Remix flat-routes
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
| Shared packages | 12 |
| Docker configs | 10 |
| Produits DB | 4M+ |
| Utilisateurs | 59k+ |
| Categories | 9k+ |

> **Comptes modules / routes retires de ce canon** (ADR-048 follow-up 2026-06-20) : derivables du filesystem, ils derivaient en permanence et dupliquaient le registry (ADR-058). Inventaire vivant = `.claude/knowledge/REPO_MAP.md`. Le detecteur de drift ne suit plus que les metriques structurelles stables (Shared packages, Docker configs).

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

_Derniere mise a jour: 2026-06-20_
_Status: CANON - Source de verite_
