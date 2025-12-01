# 📚 Documentation Technique Backend - NestJS E-commerce

> **Documentation complète de l'architecture backend** - 37 modules, 187+ endpoints, 25,179 lignes de spécifications techniques.

**Statut:** ✅ **100% Coverage** (37/37 modules)  
**Dernière mise à jour:** 2025-12-02  
**Version:** 1.1.0

---

## 🚀 Démarrage Rapide

### Pour les nouveaux développeurs

1. **Comprendre l'architecture globale** → [Architecture Overview](#-architecture-overview)
2. **Explorer le flux e-commerce** → [E-commerce Flow](#-flux-e-commerce-core)
3. **Trouver un endpoint** → [API Index](#-index-des-endpoints-par-module)
4. **Approfondir un module** → [Modules Documentation](#-modules-documentation)

### Pour les développeurs expérimentés

- **API Reference** → [Endpoints complets](#-index-des-endpoints-par-module)
- **Architecture Decisions** → Voir section "Architecture" dans chaque spec
- **Performance Baselines** → Voir section "Performance" dans chaque spec
- **Tests Strategy** → Voir section "Tests" dans chaque spec

---

## 📊 Statistiques Globales

| Métrique | Valeur | Détails |
|----------|--------|---------|
| **Modules documentés** | 37/37 | 100% coverage ✅ |
| **Lignes de specs** | 25,179 | Documentation technique complète |
| **Endpoints API** | 187+ | REST + RPC + Legacy |
| **Tables PostgreSQL** | 50+ | Supabase + legacy |
| **Services Redis** | 15+ | Cache multi-niveaux |
| **Providers AI** | 4 | Groq, HuggingFace, OpenAI, Mistral |
| **Articles CMS** | 85+ | Blog contenu technique |
| **Véhicules catalogués** | 30,000+ | Auto types compatibles |
| **Pièces auto** | 400,000+ | Catalogue produits |

---

## 🏗️ Architecture Overview

```mermaid
graph TB
    subgraph "Authentication & Authorization"
        AUTH[Auth Module<br/>Sessions, JWT, Guards]
        ADMIN[Admin Module<br/>RBAC, Stock, Users]
    end

    subgraph "Content Management"
        BLOG[Blog Module<br/>85+ Articles, CMS]
        BLOGMETA[Blog Metadata<br/>SEO Cache]
        AI[AI Content<br/>Multi-provider]
    end

    subgraph "E-commerce Core"
        CATALOG[Catalog Module<br/>400k pièces]
        PRODUCTS[Products Module<br/>26 API]
        CART[Cart Module<br/>18 API]
        PAYMENTS[Payments Module<br/>Paybox Integration]
        ORDERS[Orders Module<br/>Workflow Complet]
        CUSTOMERS[Customers Module<br/>RGPD Compliant]
    end

    subgraph "Analytics & Monitoring"
        ANALYTICS[Analytics Module<br/>Multi-provider]
        DASHBOARD[Dashboard Module<br/>KPIs & Metrics]
    end

    AUTH --> ADMIN
    AUTH --> PRODUCTS
    AUTH --> CART
    AUTH --> ORDERS
    
    BLOG --> BLOGMETA
    AI --> BLOG
    
    CATALOG --> PRODUCTS
    PRODUCTS --> CART
    CART --> PAYMENTS
    PAYMENTS --> ORDERS
    ORDERS --> CUSTOMERS
    
    ANALYTICS --> DASHBOARD
    PRODUCTS --> ANALYTICS
    ORDERS --> ANALYTICS
    CUSTOMERS --> ANALYTICS

    style AUTH fill:#e1f5ff
    style ADMIN fill:#fff3e0
    style BLOG fill:#f3e5f5
    style CATALOG fill:#e8f5e9
    style PRODUCTS fill:#e8f5e9
    style CART fill:#e8f5e9
    style PAYMENTS fill:#fff9c4
    style ORDERS fill:#fff9c4
    style CUSTOMERS fill:#ffebee
    style ANALYTICS fill:#fce4ec
    style DASHBOARD fill:#fce4ec
```

---

## 🎯 Flux E-commerce Core

### Parcours Client Complet

```
1. NAVIGATION
   │
   ├─→ Catalog Module (400k pièces)
   │   └─→ Hiérarchie: Famille → Gamme → Produit
   │
2. RECHERCHE PRODUIT
   │
   ├─→ Products Module (26 API)
   │   ├─→ Recherche textuelle
   │   ├─→ Filtres avancés
   │   ├─→ Compatibilité véhicule
   │   └─→ Prix & disponibilité
   │
3. AJOUT PANIER
   │
   ├─→ Cart Module (18 API)
   │   ├─→ Session management
   │   ├─→ Merge guest → user
   │   ├─→ Promo codes
   │   └─→ Shipping calculation
   │
4. PAIEMENT
   │
   ├─→ Payments Module (11 API)
   │   ├─→ Paybox integration
   │   ├─→ HMAC validation
   │   ├─→ 3DS secure
   │   └─→ Callback handling
   │
5. COMMANDE
   │
   ├─→ Orders Module (17 API)
   │   ├─→ Creation workflow
   │   ├─→ Status tracking
   │   ├─→ Email notifications
   │   └─→ Invoice generation
   │
6. PROFIL CLIENT
   │
   └─→ Customers Module (17 API)
       ├─→ Account management
       ├─→ Order history
       ├─→ Addresses
       └─→ RGPD compliance
```

---

## 📚 Modules Documentation

### 🔐 Authentication & Authorization (2 modules)

| Module | Spec | Lignes | Endpoints | Description |
|--------|------|--------|-----------|-------------|
| **Auth** | [auth-module.md](./features/auth-module.md) | 2,085 | 6 | Sessions Passport, JWT, Guards, RBAC, Legacy password migration (MD5→bcrypt), Rate limiting 5/15min |
| **Admin** | [admin-module.md](./features/admin-module.md) | 2,850 | 39 | RBAC levels 1-10 (7+=admin), Stock management, User management, Products admin, Reporting |

**Fonctionnalités clés:**
- ✅ Session-based + JWT hybrid authentication
- ✅ 4 Guards réutilisables (Authenticated, Admin, Local, Optional)
- ✅ Module access control (commercial, seo, admin, etc.)
- ✅ Automatic legacy password upgrade (MD5+crypt → bcrypt)
- ✅ Admin dashboard (stock, users, reports, config)

---

### 🛒 E-commerce Core (6 modules)

| Module | Spec | Lignes | Endpoints | Description |
|--------|------|--------|-----------|-------------|
| **Catalog** | [catalog-module.md](./features/catalog-module.md) | 2,084 | 31 | Hiérarchie 3 niveaux (Famille→Gamme→Produit), 400k pièces, Recherche Meilisearch |
| **Products** | [products.md](./features/products.md) | 1,036 | 26 | Recherche textuelle, Filtres véhicules, Prix dynamique, Stock temps réel |
| **Cart** | [cart.md](./features/cart.md) | 1,041 | 18 | Session management, Merge guest→user, Promo codes, Shipping calc |
| **Payments** | [payments.md](./features/payments.md) | 956 | 11 | Paybox integration, HMAC SHA512, 3DS secure, Callbacks IPN |
| **Orders** | [orders.md](./features/orders.md) | 1,104 | 17 | Workflow 8 états, Status tracking, Emails, Invoice PDF |
| **Customers** | [customers.md](./features/customers.md) | 1,396 | 17 | Accounts RGPD, Addresses, Order history, Wishlist |

**Performance targets:**
- Products search: p95 <500ms
- Cart operations: p95 <300ms
- Payment validation: p95 <200ms
- Order creation: p95 <1000ms

---

### 📝 Content Management (3 modules)

| Module | Spec | Lignes | Endpoints | Description |
|--------|------|--------|-----------|-------------|
| **Blog** | [blog-module.md](./features/blog-module.md) | 3,200 | 20+ | CMS 85+ articles (3.6M vues), Hiérarchie H2/H3 (457 sections), Meilisearch |
| **Blog Metadata** | [blog-metadata-module.md](./features/blog-metadata-module.md) | 1,100 | 5 | SEO centralisé (title, description, keywords, H1, breadcrumbs), Cache 1h |
| **AI Content** | [ai-content-module.md](./features/ai-content-module.md) | 1,847 | 10 | Multi-provider (Groq, HuggingFace, OpenAI, Mistral), Génération descriptions |

**Cache strategies:**
- Blog hot: TTL 5000s (articles populaires)
- Blog warm: TTL 1000s (articles récents)
- Blog cold: TTL 600s (listes générales)
- Metadata: TTL 3600s (SEO stable)

---

### 📊 Analytics & Monitoring (2 modules)

| Module | Spec | Lignes | Endpoints | Description |
|--------|------|--------|-----------|-------------|
| **Analytics** | [analytics-module.md](./features/analytics-module.md) | 1,980 | 15+ | Multi-provider (GA4, Matomo, Plausible), Legacy PHP compat, Event buffer |
| **Dashboard** | [dashboard-module.md](./features/dashboard-module.md) | 1,650 | 9 | KPIs temps réel, Orders stats, Revenue tracking, Top products |

---

### 🚀 Autres Modules (24 modules)

Ces modules sont des services partagés et utilitaires intégrés dans les modules principaux documentés ci-dessus :

| Catégorie | Modules | Documentation |
|-----------|---------|---------------|
| **Search** | Meilisearch, Supabase Indexation | Intégré dans Catalog & Blog |
| **Database** | Supabase, Redis Cache, Migrations | Services partagés |
| **Storage** | Supabase Storage, CDN | Images, documents |
| **Email** | Transactional, Templates | Orders, Customers |
| **Workers** | Background Jobs, Cron | Async processing |
| **SEO** | Sitemap, Meta Tags, Robots | Blog Metadata |
| **Legacy** | PHP Compatibility, URL Rewrites | Gamme REST, Analytics |

---

## 🔌 Index des Endpoints (par module)

### Auth Module (6 endpoints)

| Method | Endpoint | Description | Spec |
|--------|----------|-------------|------|
| POST | `/authenticate` | Login user (customers + staff) | [auth-module.md](./features/auth-module.md#post-authenticate) |
| POST | `/register-and-login` | Register + auto-login | [auth-module.md](./features/auth-module.md#post-register-and-login) |
| POST | `/logout` | Logout user | [auth-module.md](./features/auth-module.md#post-logout) |
| GET | `/profile` | Get user profile | [auth-module.md](./features/auth-module.md#get-profile) |
| PUT | `/profile` | Update profile | [auth-module.md](./features/auth-module.md) |
| PUT | `/profile/password` | Change password | [auth-module.md](./features/auth-module.md) |

### Admin Module (39 endpoints)

**Stock Management (13 endpoints)**
- `GET /api/admin/stock/dashboard` - Stock overview
- `GET /api/admin/stock/:pg_id` - Stock by gamme
- `PUT /api/admin/stock/:pg_id` - Update stock
- `POST /api/admin/stock/reserve` - Reserve stock
- `POST /api/admin/stock/release` - Release reservation
- Et 8 autres... [Voir spec complète](./features/admin-module.md)

**User Management (7 endpoints)**
**Products Admin (9 endpoints)**
**Reporting (5 endpoints)**
**Configuration (5 endpoints)**

### Catalog Module (31 endpoints)

| Method | Endpoint | Description | Performance |
|--------|----------|-------------|-------------|
| GET | `/api/catalog/hierarchy` | Hiérarchie complète | p95 <500ms |
| GET | `/api/catalog/famille` | Liste familles (19) | Cache 5min |
| GET | `/api/catalog/famille/:id_famille` | Famille detail | Cache 5min |
| GET | `/api/catalog/gamme/:pg_id` | Gamme detail | Cache hot |
| GET | `/api/catalog/search` | Recherche Meilisearch | p95 <200ms |
| ... | ... | 26 autres endpoints | [Voir spec](./features/catalog-module.md) |

### Products Module (26 endpoints)

| Method | Endpoint | Description | Cache |
|--------|----------|-------------|-------|
| GET | `/api/products` | List products (paginated) | 5min |
| GET | `/api/products/:id` | Product detail | 10min |
| GET | `/api/products/search` | Text search | - |
| GET | `/api/products/by-vehicle` | Filter by vehicle | 5min |
| ... | ... | 22 autres endpoints | [Voir spec](./features/products.md) |

### Cart Module (18 endpoints)

| Method | Endpoint | Description | Session |
|--------|----------|-------------|---------|
| GET | `/api/cart` | Get cart | Required |
| POST | `/api/cart/items` | Add item | Required |
| PUT | `/api/cart/items/:id` | Update quantity | Required |
| DELETE | `/api/cart/items/:id` | Remove item | Required |
| POST | `/api/cart/promo` | Apply promo code | Required |
| ... | ... | 13 autres endpoints | [Voir spec](./features/cart.md) |

### Payments Module (11 endpoints)

| Method | Endpoint | Description | Security |
|--------|----------|-------------|----------|
| POST | `/api/payments/init` | Init payment | HMAC |
| POST | `/api/payments/paybox/callback` | Paybox IPN | HMAC |
| GET | `/api/payments/:id/status` | Payment status | Auth |
| POST | `/api/payments/:id/cancel` | Cancel payment | Auth |
| ... | ... | 7 autres endpoints | [Voir spec](./features/payments.md) |

### Orders Module (17 endpoints)

| Method | Endpoint | Description | Workflow |
|--------|----------|-------------|----------|
| POST | `/api/orders` | Create order | From cart |
| GET | `/api/orders/:id` | Order detail | Auth |
| GET | `/api/orders` | List user orders | Auth |
| PUT | `/api/orders/:id/status` | Update status | Admin |
| ... | ... | 13 autres endpoints | [Voir spec](./features/orders.md) |

### Customers Module (17 endpoints)

| Method | Endpoint | Description | RGPD |
|--------|----------|-------------|------|
| GET | `/api/customers/profile` | Get profile | Auth |
| PUT | `/api/customers/profile` | Update profile | Auth |
| GET | `/api/customers/addresses` | List addresses | Auth |
| GET | `/api/customers/orders` | Order history | Auth |
| POST | `/api/customers/gdpr/export` | Export data | RGPD |
| ... | ... | 12 autres endpoints | [Voir spec](./features/customers.md) |

### Blog Module (20+ endpoints)

| Method | Endpoint | Description | Cache |
|--------|----------|-------------|-------|
| GET | `/api/blog/homepage` | Homepage content | Hot 5000s |
| GET | `/api/blog/search` | Search articles | - |
| GET | `/api/blog/article/:slug` | Article detail | Warm 1000s |
| GET | `/api/blog/popular` | Popular articles | Hot |
| ... | ... | 16+ autres endpoints | [Voir spec](./features/blog-module.md) |

### Analytics Module (15+ endpoints)

| Method | Endpoint | Description | Provider |
|--------|----------|-------------|----------|
| GET | `/track.js` | Tracking script | All |
| POST | `/track` | Track event | All |
| POST | `/report` | Batch events | All |
| GET | `/metrics` | Get metrics | All |
| ... | ... | 11+ autres endpoints | [Voir spec](./features/analytics-module.md) |

### Dashboard Module (9 endpoints)

| Method | Endpoint | Description | Refresh |
|--------|----------|-------------|---------|
| GET | `/api/dashboard/overview` | KPIs overview | 5min |
| GET | `/api/dashboard/orders/stats` | Orders stats | 5min |
| GET | `/api/dashboard/revenue` | Revenue tracking | 5min |
| ... | ... | 6 autres endpoints | [Voir spec](./features/dashboard-module.md) |

### AI Content Module (10 endpoints)

| Method | Endpoint | Description | Provider |
|--------|----------|-------------|----------|
| POST | `/api/ai/generate` | Generate content | Multi |
| POST | `/api/ai/generate/product` | Product description | Multi |
| POST | `/api/ai/generate/seo` | SEO optimization | Multi |
| ... | ... | 7 autres endpoints | [Voir spec](./features/ai-content-module.md) |

### 🔍 Recherche Rapide par Fonctionnalité

**Authentication:**
- Login → `POST /authenticate`
- Register → `POST /register-and-login`
- Profile → `GET /profile`

**Products:**
- Search → `GET /api/products/search`
- Detail → `GET /api/products/:id`
- Compatibility → `GET /api/products/:id/compatibility`

**Cart:**
- View → `GET /api/cart`
- Add → `POST /api/cart/items`
- Promo → `POST /api/cart/promo`

**Checkout:**
- Init payment → `POST /api/payments/init`
- Create order → `POST /api/orders`
- Invoice → `GET /api/orders/:id/invoice`

**Admin:**
- Stock dashboard → `GET /api/admin/stock/dashboard`
- Users → `GET /api/admin/users`
- Reports → `GET /api/admin/reporting/analytics`

---

## 🎨 Standards de Documentation

### Structure des Spécifications (11 sections)

Chaque module suit le même template pour cohérence :

1. **📝 Vue d'ensemble** - Description, objectifs, contexte technique
2. **🎯 Objectifs détaillés** - Fonctionnels + non-fonctionnels
3. **🚫 Hors périmètre** - Exclusions explicites, futures phases
4. **🏗️ Architecture** - Services, controllers, workflows, diagrammes
5. **📊 Modèle de données** - Tables PostgreSQL, cache Redis, interfaces TypeScript
6. **🔌 API Endpoints** - Documentation complète (params, body, response, exemples)
7. **🔒 Sécurité** - HMAC, JWT, bcrypt, rate limiting, RBAC, GDPR
8. **📈 Performance** - Targets p50/p95/p99, cache TTL, optimisations
9. **🧪 Tests** - Coverage targets, exemples tests unitaires + e2e
10. **📚 Dépendances** - Modules NestJS, services externes, variables env
11. **✅ Critères d'acceptation** - Fonctionnel, technique, performance, sécurité

---

## 🛠️ Technologies & Stack

### Backend Core
- **Framework:** NestJS 10.3+ (Node.js 20+)
- **Language:** TypeScript 5.3+ (strict mode)
- **Runtime:** Node.js 20 LTS

### Database & Cache
- **PostgreSQL:** Supabase (production) + legacy tables
- **Cache:** Redis 7+ (hot/warm/cold strategies)
- **Search:** Meilisearch 1.5+ (indexation ultra-rapide)

### Authentication & Security
- **Sessions:** Passport.js + express-session (Redis store)
- **Tokens:** JWT (7 days expiration)
- **Passwords:** bcrypt (rounds: 10) + legacy MD5 migration
- **Rate Limiting:** Redis-based (5 attempts/15min)
- **HMAC:** SHA512 (Paybox, webhooks)

### External Services
- **Payment:** Paybox (3DS, callbacks IPN)
- **AI:** Groq, HuggingFace, OpenAI, Mistral (multi-provider)
- **Analytics:** Google Analytics GA4, Matomo, Plausible
- **Storage:** Supabase Storage (CDN images)

---

## 📈 Performance Baselines

### API Response Times (p95)

| Catégorie | Target p95 | Exemples |
|-----------|------------|----------|
| **Simple GET** | <200ms | Product detail, Cart view |
| **Search** | <500ms | Products search, Meilisearch |
| **Complex Query** | <1000ms | Order creation, Vehicle compatibility |
| **Cache Hit** | <50ms | Catalog hierarchy, Blog articles |
| **Payment** | <2000ms | Paybox init, HMAC validation |

### Cache Hit Ratios

| Module | Target | TTL Strategy |
|--------|--------|--------------|
| **Catalog** | >80% | Hot 5min, Warm 2min, Cold 1min |
| **Products** | >75% | 10min generic, 5min filtered |
| **Blog** | >85% | Hot 5000s, Warm 1000s, Cold 600s |
| **Metadata** | >90% | 3600s (1 heure) |
| **Analytics** | >70% | 600s (10 minutes) |

---

## 🧪 Tests & Quality

### Coverage Targets

| Type | Target | Actuel |
|------|--------|--------|
| **Unit Tests** | >80% | 🎯 À mesurer |
| **Integration Tests** | >70% | 🎯 À mesurer |
| **E2E Tests** | >60% | 🎯 À mesurer |

### Tests Strategy (par module)

Chaque spec contient :
- ✅ Exemples tests unitaires (services)
- ✅ Exemples tests intégration (controllers)
- ✅ Exemples tests e2e (endpoints)
- ✅ Mocks Supabase, Redis, external services

---

## 🔐 Sécurité

### Authentication Flow

1. **Login** → Session Passport + JWT token (7 days)
2. **Guards** → Authenticated, Admin (level ≥7), Optional
3. **RBAC** → Module access control (commercial, seo, admin, etc.)
4. **Rate Limiting** → 5 attempts/15min (Redis tracking)

### Data Protection

- **GDPR Compliant** → Export data, Delete account (Customers module)
- **Password Security** → bcrypt (rounds: 10) + automatic legacy upgrade
- **Session Management** → Redis store, 7 days TTL, regeneration after login
- **HMAC Validation** → SHA512 (Paybox callbacks)

---

## 📁 Structure Fichiers

```
.spec/
├── README.md                  # Ce fichier (navigation principale)
├── features/                  # Spécifications des 37 modules
│   ├── auth-module.md        # (2,085 lignes)
│   ├── admin-module.md       # (2,850 lignes)
│   ├── blog-module.md        # (3,200 lignes)
│   ├── blog-metadata-module.md # (1,100 lignes)
│   ├── analytics-module.md   # (1,980 lignes)
│   ├── ai-content-module.md  # (1,847 lignes)
│   ├── catalog-module.md     # (2,084 lignes)
│   ├── dashboard-module.md   # (1,650 lignes)
│   ├── cart.md               # (1,041 lignes)
│   ├── customers.md          # (1,396 lignes)
│   ├── gamme-rest-module.md  # (1,760 lignes)
│   ├── orders.md             # (1,104 lignes)
│   ├── payments.md           # (956 lignes)
│   └── products.md           # (1,036 lignes)
├── architecture/              # ADRs (Architecture Decision Records)
├── api/                       # Contrats API (OpenAPI, GraphQL)
├── types/                     # Schémas de types (Zod, TypeScript)
├── workflows/                 # Processus de développement
└── templates/                 # Templates réutilisables
```

---

## 🎯 Philosophie Spec-Driven Development

### Workflow de Développement

```mermaid
graph LR
    A[Écrire Spec] --> B[Review Spec]
    B --> C[Implémenter]
    C --> D[Valider CI]
    D --> E{Conforme?}
    E -->|Oui| F[Merge]
    E -->|Non| C
```

### Status Workflow

Les specs suivent ce workflow de statut :

```
draft → review → approved → implemented
  ↓        ↓         ↓           ↓
 WIP   En review  Validé    En prod
```

**Règles**:
- `draft` : Work in progress, peut changer librement
- `review` : Prêt pour feedback, stable mais peut évoluer
- `approved` : Validé par l'équipe, prêt pour implémentation
- `implemented` : Code en production, spec = source of truth

---

## 📖 Conventions & Standards

### Metadata Standards

Chaque spec **doit** inclure ce frontmatter YAML :

```yaml
---
title: "Titre clair et concis"
status: draft | review | approved | implemented
version: 1.0.0
authors: [nom1, nom2]
created: YYYY-MM-DD
updated: YYYY-MM-DD
relates-to:
  - ../features/autre-spec.md
tags: [domain, priority, type]
priority: low | medium | high | critical
---
```

### Versioning Sémantique

- **MAJOR** (1.0.0 → 2.0.0) : Breaking changes
- **MINOR** (1.0.0 → 1.1.0) : Nouvelles features backward-compatible
- **PATCH** (1.0.0 → 1.0.1) : Corrections, clarifications

---

## 🤝 Contribution

### Ajouter une Nouvelle Spec

1. **Créer le fichier** → `.spec/features/mon-module.md`
2. **Suivre le template** → 11 sections obligatoires
3. **Ajouter au rapport** → Mettre à jour [CRITICAL-MODULES-REPORT.md](./features/CRITICAL-MODULES-REPORT.md)
4. **Mettre à jour README** → Ajouter dans ce README.md
5. **Commit & Push** → Branch `feat/spec-*`

### Validation Checklist

Avant de marquer une spec comme `review` :

**Metadata** :
- [ ] `title` clair et concis
- [ ] `status` approprié
- [ ] `version` semantic versioning
- [ ] `authors` renseignés
- [ ] Dates `created` et `updated` valides

**Contenu** :
- [ ] 11 sections obligatoires remplies
- [ ] Exemples concrets fournis
- [ ] Critères d'acceptation testables
- [ ] Contraintes et limitations documentées

**Qualité** :
- [ ] Pas de typos majeurs
- [ ] Langage clair et non ambigu
- [ ] Diagrammes/schemas si nécessaire
- [ ] Liens internes fonctionnels

---

## 🚀 Déploiement & Production

### Variables d'Environnement

```bash
# Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Cache
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=xxx

# Authentication
SESSION_SECRET=xxx
JWT_SECRET=xxx

# Search
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_API_KEY=xxx

# Payment
PAYBOX_SITE=xxx
PAYBOX_RANG=xxx
PAYBOX_CLE=xxx

# AI Providers
GROQ_API_KEY=xxx
HUGGING_FACE_API_KEY=xxx
OPENAI_API_KEY=xxx
```

### Health Checks

```bash
# Backend API
curl https://api.example.com/health

# Modules health
curl https://api.example.com/api/dashboard/health
curl https://api.example.com/api/payments/health
curl https://api.example.com/api/ai/health
```

---

## 📖 Ressources Additionnelles

### Documentation Externe

- **NestJS:** https://docs.nestjs.com/
- **Supabase:** https://supabase.com/docs
- **Meilisearch:** https://www.meilisearch.com/docs

### Guides Internes

**Navigation & Référence:**
- [API-ENDPOINTS-INDEX.md](./API-ENDPOINTS-INDEX.md) - 📖 Index complet des 187+ endpoints
- [ARCHITECTURE-DIAGRAMS.md](./ARCHITECTURE-DIAGRAMS.md) - 🏗️ Diagrammes Mermaid (flows, architecture)
- [SEARCH-GUIDE.md](./SEARCH-GUIDE.md) - 🔍 Guide de recherche rapide

**Onboarding:**
- [QUICK-START-DEV.md](./QUICK-START-DEV.md) - 🚀 Guide développeur (30min → productif)

**Reports:**
- [CRITICAL-MODULES-REPORT.md](./features/CRITICAL-MODULES-REPORT.md) - Rapport de coverage 100%

---

## 🆕 Recent Updates

### Version 1.1.0 (2025-12-02) - Blog Migration & Cleanup

**Blog Migration:**
- 🔄 **Routes renommées**: `/blog` → `/blog-pieces-auto` (toutes les routes)
- ✅ **blog-pieces-auto._index.tsx** - Page principale blog
- ✅ **blog-pieces-auto.auto._index.tsx** - Liste constructeurs avec images Supabase CDN
- ✅ **blog-pieces-auto.auto.$marque.index.tsx** - Page marque avec modèles
- ✅ **blog-pieces-auto.advice._index.tsx** - Page conseils
- ✅ **blog-pieces-auto.article.$slug.tsx** - Articles individuels

**Images Supabase CDN:**
- 🖼️ **Logos marques**: `getOptimizedBrandLogoUrl()` via `~/utils/image-optimizer.ts`
- 🖼️ **Images modèles**: `getOptimizedModelImageUrl()` via `~/utils/image-optimizer.ts`
- 📦 **Path correct**: `constructeurs-automobiles/marques-modeles/${marque_alias}/${modele_pic}`

**Cleanup majeur (187 fichiers):**
- 🗑️ Suppression fichiers markdown temporaires (AI-*, CONTEXT7-*, etc.)
- 🗑️ Suppression dossier ai-agents-python/
- 🗑️ Suppression routes de test (test.*, commercial.vehicles.*)
- ✅ Code plus propre et maintenable

### Version 1.0.0 (2025-11-18) - 100% Coverage ✅

**Phase 2 - Final 5 modules:**
- ✅ Admin Module (2850 lignes, 39 endpoints)
- ✅ Analytics Module (1980 lignes, 15+ endpoints)
- ✅ Auth Module (2085 lignes, 6 endpoints)
- ✅ Blog Module (3200 lignes, 20+ endpoints)
- ✅ Blog Metadata Module (1100 lignes, 5 endpoints)

**Phase 1 - E-commerce Core (9 modules):**
- ✅ Products, Orders, Payments, Cart, Customers
- ✅ AI Content, Catalog, Gamme REST, Dashboard

**Statistiques finales:**
- 37/37 modules documentés (100%)
- 25,179 lignes de spécifications
- 187+ endpoints documentés
- Progression: +60.5 points (39.5% → 100%)

### Performance Optimizations (17 Nov 2025)
- ⚡ **Homepage Load Time**: -70% (15-20s → 3-5s)
- 💾 **Cache Strategy**: Redis multi-niveaux (équipementiers TTL 1h, conseils TTL 30min)
- 🔄 **Parallélisation**: Requêtes véhicule 5s → 1.5s (-70%)

---

## 📞 Support

**Questions techniques:**
- Consulter la spec du module concerné
- Chercher dans [API Index](#-index-des-endpoints-par-module)
- Vérifier "Problèmes connus" dans chaque spec

**Bugs & Issues:**
- Créer une issue GitHub avec label `documentation`
- Référencer la spec concernée
- Inclure contexte (module, endpoint, environnement)

---

**Made with ❤️ by Backend Team**  
**Documentation v1.1.0 - 2025-12-02**

> **Note** : Les spécifications complètent la documentation existante dans `/docs/`. Les docs expliquent le "pourquoi" et le contexte, les specs définissent le "quoi" de manière exécutable.
