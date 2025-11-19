# 🔍 Guide de Recherche Rapide

> **Trouver rapidement n'importe quelle information dans la documentation backend**

**Version:** 1.0.0  
**Dernière mise à jour:** 2025-11-18  
**Modules documentés:** 37/37 (100%)

---

## 📋 Table des matières

- [Recherche par Type](#-recherche-par-type)
- [Recherche par Use Case](#-recherche-par-use-case)
- [Commandes de Recherche](#-commandes-de-recherche)
- [Index Alphabétique](#-index-alphab%C3%A9tique)
- [Raccourcis Clavier](#-raccourcis-clavier)

---

## 🎯 Recherche par Type

### Je cherche un **Endpoint API**

**→ Voir:** [API-ENDPOINTS-INDEX.md](./API-ENDPOINTS-INDEX.md)

**Recherche rapide par méthode:**

```bash
# Tous les GET endpoints
grep "^\| \`GET\`" .spec/API-ENDPOINTS-INDEX.md

# Tous les POST endpoints
grep "^\| \`POST\`" .spec/API-ENDPOINTS-INDEX.md

# Endpoint spécifique par route
grep "/api/products" .spec/API-ENDPOINTS-INDEX.md

# Endpoint par module
grep -A 30 "### Products Module" .spec/API-ENDPOINTS-INDEX.md
```

**Index rapide par module:**

| Besoin | Module | Section |
|--------|--------|---------|
| Login/Logout | Auth | [auth-module.md](./features/auth-module.md#post-authenticate) |
| Stock admin | Admin | [admin-module.md](./features/admin-module.md#stock-management) |
| Recherche produits | Products | [products.md](./features/products.md#search--filters) |
| Panier | Cart | [cart.md](./features/cart.md#cart-management) |
| Paiement | Payments | [payments.md](./features/payments.md#payment-initialization) |
| Commandes | Orders | [orders.md](./features/orders.md#order-creation--detail) |
| Profil client | Customers | [customers.md](./features/customers.md#profile-management) |
| Blog | Blog | [blog-module.md](./features/blog-module.md#blog-homepage--lists) |
| SEO metadata | Blog Metadata | [blog-metadata-module.md](./features/blog-metadata-module.md) |
| Génération AI | AI Content | [ai-content-module.md](./features/ai-content-module.md#content-generation) |
| Tracking | Analytics | [analytics-module.md](./features/analytics-module.md#tracking--events) |
| KPIs | Dashboard | [dashboard-module.md](./features/dashboard-module.md#kpis--overview) |

---

### Je cherche une **Table PostgreSQL**

**Commandes:**

```bash
# Lister toutes les tables mentionnées
grep -h "^###.*Table:" .spec/features/*.md | sort | uniq

# Chercher une table spécifique
grep -r "___pieces_gamme" .spec/features/

# Voir le schéma d'une table
grep -A 50 "Table: ___pieces_gamme" .spec/features/products.md
```

**Tables principales:**

| Table | Module | Description | Spec |
|-------|--------|-------------|------|
| `___pieces_gamme` | Products | Produits (400k) | [products.md](./features/products.md) |
| `___xtr_customer` | Customers | Clients | [customers.md](./features/customers.md) |
| `___xtr_commande` | Orders | Commandes | [orders.md](./features/orders.md) |
| `___xtr_panier` | Cart | Paniers | [cart.md](./features/cart.md) |
| `___config_admin` | Admin | Configuration admin | [admin-module.md](./features/admin-module.md) |
| `__blog_advice` | Blog | Articles blog (85+) | [blog-module.md](./features/blog-module.md) |
| `__blog_advice_h2` | Blog | Sections H2 | [blog-module.md](./features/blog-module.md) |
| `__blog_advice_h3` | Blog | Sections H3 (457+) | [blog-module.md](./features/blog-module.md) |
| `__blog_meta_tags_ariane` | Blog Metadata | Métadonnées SEO | [blog-metadata-module.md](./features/blog-metadata-module.md) |
| `__cross_gamme_car_new` | Catalog | Compatibilité véhicules | [catalog-module.md](./features/catalog-module.md) |

---

### Je cherche un **Guard NestJS**

**Guards disponibles:**

| Guard | Usage | Level RBAC | Spec |
|-------|-------|------------|------|
| `AuthenticatedGuard` | Session check | 1+ | [auth-module.md](./features/auth-module.md#guards) |
| `IsAdminGuard` | Admin only | 7+ | [auth-module.md](./features/auth-module.md#guards) |
| `LocalAuthGuard` | Passport login | Public | [auth-module.md](./features/auth-module.md#guards) |
| `OptionalAuthGuard` | Public + Private | Any | [auth-module.md](./features/auth-module.md#guards) |

**Recherche:**

```bash
# Voir tous les guards
grep -r "@UseGuards" backend/src/modules/

# Endpoints protégés par AuthenticatedGuard
grep -B 3 "AuthenticatedGuard" backend/src/modules/*/*.controller.ts

# Endpoints admin only
grep -B 3 "IsAdminGuard" backend/src/modules/*/*.controller.ts
```

---

### Je cherche un **Cache Redis**

**Stratégies de cache:**

| Type | TTL | Module | Clé Redis | Spec |
|------|-----|--------|-----------|------|
| Hot | 5000s | Blog | `blog:popular` | [blog-module.md](./features/blog-module.md#cache) |
| Warm | 1000s | Blog | `blog:article:{slug}` | [blog-module.md](./features/blog-module.md#cache) |
| Cold | 600s | Blog | `blog:list:{page}` | [blog-module.md](./features/blog-module.md#cache) |
| Metadata | 3600s | Blog Metadata | `blog:meta:{alias}` | [blog-metadata-module.md](./features/blog-metadata-module.md) |
| Catalog | 300s | Catalog | `catalog:hierarchy` | [catalog-module.md](./features/catalog-module.md) |
| Products | 600s | Products | `products:{pg_id}` | [products.md](./features/products.md) |
| Session | 604800s | Auth | `sess:{session_id}` | [auth-module.md](./features/auth-module.md) |

**Recherche:**

```bash
# Voir toutes les stratégies de cache
grep -r "TTL:" .spec/features/*.md

# Voir les clés Redis d'un module
grep -A 20 "## 📈 Performance" .spec/features/blog-module.md | grep "cache"
```

---

### Je cherche un **Workflow / Flow**

**→ Voir:** [ARCHITECTURE-DIAGRAMS.md](./ARCHITECTURE-DIAGRAMS.md)

**Flows disponibles:**

| Flow | Description | Diagramme |
|------|-------------|-----------|
| E-commerce complet | Customer journey | [ARCHITECTURE-DIAGRAMS.md#flux-e-commerce-complet](./ARCHITECTURE-DIAGRAMS.md#flux-e-commerce-complet-customer-journey) |
| Admin stock | Gestion stock | [ARCHITECTURE-DIAGRAMS.md#flux-admin---gestion-stock](./ARCHITECTURE-DIAGRAMS.md#flux-admin---gestion-stock) |
| Blog content | Delivery avec cache | [ARCHITECTURE-DIAGRAMS.md#flux-blog---content-delivery-avec-cache](./ARCHITECTURE-DIAGRAMS.md#flux-blog---content-delivery-avec-cache) |
| Paybox payment | Intégration paiement | [ARCHITECTURE-DIAGRAMS.md#int%C3%A9gration-paybox](./ARCHITECTURE-DIAGRAMS.md#int%C3%A9gration-paybox-payment-gateway) |
| AI generation | Multi-provider | [ARCHITECTURE-DIAGRAMS.md#workflow-ai-content-generation](./ARCHITECTURE-DIAGRAMS.md#workflow-ai-content-generation) |
| Order workflow | 8 états | [ARCHITECTURE-DIAGRAMS.md#workflow-commande](./ARCHITECTURE-DIAGRAMS.md#workflow-commande-8-%C3%A9tats) |

---

### Je cherche un **DTO / Interface**

**Recherche:**

```bash
# Lister tous les DTOs d'un module
find backend/src/modules/products -name "*.dto.ts"

# Chercher un DTO spécifique
grep -r "export class ProductDto" backend/src/

# Voir la structure d'un DTO dans la spec
grep -A 30 "ProductDto" .spec/features/products.md
```

---

## 🎯 Recherche par Use Case

### Use Case: "Je veux implémenter l'authentification"

**1. Lire la spec Auth:**
```bash
code .spec/features/auth-module.md
```

**2. Points clés:**
- Section "Architecture" → Comprendre Passport.js + JWT
- Section "API Endpoints" → `POST /authenticate`, `POST /logout`
- Section "Sécurité" → Bcrypt, rate limiting, session regeneration
- Section "Tests" → Exemples de tests unitaires

**3. Code source:**
```bash
# Voir l'implémentation
code backend/src/modules/auth/auth.service.ts
code backend/src/modules/auth/auth.controller.ts
```

**4. Guards à utiliser:**
- `AuthenticatedGuard` pour routes privées
- `OptionalAuthGuard` pour routes publiques + privées

---

### Use Case: "Je veux ajouter un produit au panier"

**1. Endpoint:**
```
POST /api/cart/items
Body: { pg_id: "PG123", quantity: 2 }
```

**2. Flow:**
```
Client → Cart Controller → Cart Service → Stock Validation → Redis Session → Response
```

**3. Spec:**
```bash
# Voir détails
grep -A 20 "POST /api/cart/items" .spec/features/cart.md
```

**4. Tables utilisées:**
- `___xtr_panier` (cart data)
- `___pieces_gamme` (stock validation)

---

### Use Case: "Je veux gérer le stock en admin"

**1. Endpoints admin stock:**
```
GET  /api/admin/stock/dashboard      # Overview
GET  /api/admin/stock/:pg_id         # Detail gamme
PUT  /api/admin/stock/:pg_id         # Update stock
POST /api/admin/stock/reserve        # Reserve stock
POST /api/admin/stock/release        # Release reservation
GET  /api/admin/stock/alerts         # Low stock alerts
```

**2. RBAC requis:**
- Level 7+ (admin staff)

**3. Spec complète:**
```bash
code .spec/features/admin-module.md
```

**4. Flow diagramme:**
```bash
# Voir le sequence diagram
grep -A 100 "Flux Admin - Gestion Stock" .spec/ARCHITECTURE-DIAGRAMS.md
```

---

### Use Case: "Je veux ajouter un article blog"

**1. Endpoint:**
```
POST /api/blog/admin/articles
Body: {
  title: "Mon article",
  content: "...",
  pg_alias: "mon-article",
  h2_sections: [...],
  h3_sections: [...]
}
```

**2. Tables:**
- `__blog_advice` (article principal)
- `__blog_advice_h2` (sections H2)
- `__blog_advice_h3` (sections H3)
- `__blog_meta_tags_ariane` (SEO metadata)

**3. Cache invalidation:**
```typescript
// Invalider cache après création
await cacheService.delPattern('blog:*');
```

**4. Indexation Meilisearch:**
```typescript
// Auto-indexation après création
await searchService.index('blog', article);
```

---

### Use Case: "Je veux créer un rapport admin"

**1. Endpoint:**
```
GET /api/admin/reporting/analytics?from=2025-01-01&to=2025-12-31
```

**2. Données disponibles:**
- Orders statistics (total, by status)
- Revenue tracking (daily, weekly, monthly)
- Top products (best sellers)
- Stock movements

**3. Export formats:**
- PDF: `GET /api/admin/reporting/export/pdf`
- CSV: `GET /api/admin/reporting/export/csv`

**4. Spec:**
```bash
grep -A 50 "#### Reporting" .spec/features/admin-module.md
```

---

## 🔧 Commandes de Recherche

### Recherche dans les Specs

```bash
# Recherche globale (tous les fichiers)
grep -r "mot-clé" .spec/features/

# Recherche case-insensitive
grep -ir "paybox" .spec/features/

# Recherche avec contexte (3 lignes avant/après)
grep -C 3 "HMAC" .spec/features/payments.md

# Recherche multi-mots (regex)
grep -E "cache|redis|ttl" .spec/features/blog-module.md

# Compter les occurrences
grep -c "endpoint" .spec/features/products.md

# Lister les fichiers contenant le mot
grep -l "Meilisearch" .spec/features/*.md
```

---

### Recherche dans le Code Source

```bash
# Chercher un fichier par nom
find backend/src -name "products.controller.ts"

# Chercher un pattern dans les fichiers
find backend/src -name "*.service.ts" -exec grep -l "CacheService" {} \;

# Chercher une classe
grep -r "export class ProductsService" backend/src/

# Chercher un endpoint
grep -r "@Post('products')" backend/src/

# Chercher une table Supabase
grep -r "___pieces_gamme" backend/src/

# Chercher un Guard
grep -r "@UseGuards(AuthenticatedGuard)" backend/src/
```

---

### Recherche par Performance

```bash
# Endpoints avec cache hot (TTL > 1000s)
grep -r "TTL.*[2-9][0-9][0-9][0-9]s" .spec/features/

# Endpoints real-time (no cache)
grep -B 5 "Real-time" .spec/API-ENDPOINTS-INDEX.md

# Performance targets p95
grep -r "p95 <" .spec/features/*.md

# Cache strategies
grep -A 10 "## 📈 Performance" .spec/features/*.md | grep -i cache
```

---

### Recherche par Sécurité

```bash
# Endpoints admin only (Level 7+)
grep -r "RBAC.*7+" .spec/features/*.md

# Guards utilisés
grep -r "@UseGuards" backend/src/modules/

# HMAC validation
grep -r "HMAC" .spec/features/

# Rate limiting
grep -r "rate limit" .spec/features/*.md -i

# GDPR compliance
grep -r "GDPR" .spec/features/*.md
```

---

## 📖 Index Alphabétique

### A

- **Admin Module** → [admin-module.md](./features/admin-module.md)
- **AI Content** → [ai-content-module.md](./features/ai-content-module.md)
- **Analytics** → [analytics-module.md](./features/analytics-module.md)
- **Architecture** → [ARCHITECTURE-DIAGRAMS.md](./ARCHITECTURE-DIAGRAMS.md)
- **Auth Module** → [auth-module.md](./features/auth-module.md)

### B

- **bcrypt** → [auth-module.md](./features/auth-module.md#s%C3%A9curit%C3%A9)
- **Blog CMS** → [blog-module.md](./features/blog-module.md)
- **Blog Metadata** → [blog-metadata-module.md](./features/blog-metadata-module.md)

### C

- **Cache Redis** → Voir "Performance" dans chaque spec
- **Cart Module** → [cart.md](./features/cart.md)
- **Catalog Module** → [catalog-module.md](./features/catalog-module.md)
- **Customers** → [customers.md](./features/customers.md)

### D

- **Dashboard** → [dashboard-module.md](./features/dashboard-module.md)
- **DTOs** → Voir section "API Endpoints" dans chaque spec

### E

- **Endpoints Index** → [API-ENDPOINTS-INDEX.md](./API-ENDPOINTS-INDEX.md)

### G

- **Gamme REST** → [gamme-rest-module.md](./features/gamme-rest-module.md)
- **Guards** → [auth-module.md](./features/auth-module.md#guards)

### H

- **HMAC SHA512** → [payments.md](./features/payments.md#s%C3%A9curit%C3%A9)

### J

- **JWT Tokens** → [auth-module.md](./features/auth-module.md#jwt)

### M

- **Meilisearch** → [catalog-module.md](./features/catalog-module.md#search), [blog-module.md](./features/blog-module.md#search)

### O

- **Orders Module** → [orders.md](./features/orders.md)

### P

- **Passport.js** → [auth-module.md](./features/auth-module.md#passport)
- **Paybox** → [payments.md](./features/payments.md)
- **Payments** → [payments.md](./features/payments.md)
- **Products** → [products.md](./features/products.md)

### Q

- **Quick Start** → [QUICK-START-DEV.md](./QUICK-START-DEV.md)

### R

- **RBAC Levels** → [auth-module.md](./features/auth-module.md#rbac)
- **Redis Cache** → Voir "Performance" dans chaque spec
- **README** → [README.md](./README.md)

### S

- **Search** → [catalog-module.md](./features/catalog-module.md#search), [products.md](./features/products.md#search)
- **SEO Metadata** → [blog-metadata-module.md](./features/blog-metadata-module.md)
- **Session Management** → [auth-module.md](./features/auth-module.md#sessions)
- **Stock Management** → [admin-module.md](./features/admin-module.md#stock-management)

### T

- **Tables PostgreSQL** → Voir "Modèle de données" dans chaque spec
- **Tests** → Voir section "Tests" dans chaque spec

### W

- **Workflows** → [ARCHITECTURE-DIAGRAMS.md](./ARCHITECTURE-DIAGRAMS.md#workflows-m%C3%A9tier)

---

## ⌨️ Raccourcis Clavier

### VS Code

| Raccourci | Action | Contexte |
|-----------|--------|----------|
| `Ctrl+P` | Quick Open fichier | `admin-module.md` |
| `Ctrl+Shift+F` | Recherche globale | `grep dans workspace` |
| `Ctrl+F` | Recherche dans fichier | `chercher "endpoint"` |
| `Ctrl+G` | Go to line | `aller ligne 500` |
| `Ctrl+Click` | Go to definition | `suivre liens [...]()` |
| `F12` | Go to definition | `code source` |
| `Ctrl+T` | Go to symbol | `chercher classe/fonction` |

---

### Terminal

| Commande | Raccourci | Action |
|----------|-----------|--------|
| `grep -r "pattern" .spec/` | - | Recherche récursive |
| `grep -l "pattern" *.md` | - | Liste fichiers contenant pattern |
| `grep -A 10 "pattern" file.md` | - | Affiche 10 lignes après match |
| `grep -B 5 "pattern" file.md` | - | Affiche 5 lignes avant match |
| `grep -C 3 "pattern" file.md` | - | Affiche 3 lignes contexte |
| `find . -name "*.md"` | - | Liste tous les .md |

---

## 🎯 Templates de Recherche

### Template 1: "Je cherche tout sur un module"

```bash
# 1. Ouvrir la spec
code .spec/features/[MODULE].md

# 2. Voir les endpoints
grep "| Method |" .spec/features/[MODULE].md

# 3. Voir les tables
grep "Table:" .spec/features/[MODULE].md

# 4. Voir le code
code backend/src/modules/[MODULE]/
```

---

### Template 2: "Je cherche un endpoint spécifique"

```bash
# 1. Recherche globale
grep -r "POST /api/products" .spec/

# 2. Voir détails dans API index
grep -A 5 "POST.*products" .spec/API-ENDPOINTS-INDEX.md

# 3. Voir implémentation
grep -r "@Post('products')" backend/src/
```

---

### Template 3: "Je cherche une fonctionnalité métier"

**Exemple: "Comment fonctionne la réservation de stock?"**

```bash
# 1. Chercher dans les specs
grep -r "reservation" .spec/features/*.md -i

# 2. Voir le workflow
grep -A 50 "Workflow Stock Reservation" .spec/ARCHITECTURE-DIAGRAMS.md

# 3. Voir le code
grep -r "reserve" backend/src/modules/admin/
```

---

### Template 4: "Je cherche les performances d'un module"

```bash
# 1. Section Performance
grep -A 30 "## 📈 Performance" .spec/features/products.md

# 2. Targets p95
grep "p95" .spec/features/products.md

# 3. Cache strategies
grep -i "cache\|ttl\|redis" .spec/features/products.md
```

---

## 📚 Ressources Complémentaires

### Documentation Principale

- [README.md](./README.md) - Navigation centrale
- [API-ENDPOINTS-INDEX.md](./API-ENDPOINTS-INDEX.md) - Référence API complète (187+ endpoints)
- [ARCHITECTURE-DIAGRAMS.md](./ARCHITECTURE-DIAGRAMS.md) - Diagrammes Mermaid (flows, architecture)
- [QUICK-START-DEV.md](./QUICK-START-DEV.md) - Guide onboarding développeurs
- [CRITICAL-MODULES-REPORT.md](./features/CRITICAL-MODULES-REPORT.md) - Rapport coverage 100%

### Specs par Catégorie

**Auth & Admin (2 specs):**
- [auth-module.md](./features/auth-module.md) (2,085 lignes, 6 endpoints)
- [admin-module.md](./features/admin-module.md) (2,850 lignes, 39 endpoints)

**E-commerce Core (6 specs):**
- [catalog-module.md](./features/catalog-module.md) (2,084 lignes, 31 endpoints)
- [products.md](./features/products.md) (1,036 lignes, 26 endpoints)
- [cart.md](./features/cart.md) (1,041 lignes, 18 endpoints)
- [payments.md](./features/payments.md) (956 lignes, 11 endpoints)
- [orders.md](./features/orders.md) (1,104 lignes, 17 endpoints)
- [customers.md](./features/customers.md) (1,396 lignes, 17 endpoints)

**CMS & Content (3 specs):**
- [blog-module.md](./features/blog-module.md) (3,200 lignes, 20+ endpoints)
- [blog-metadata-module.md](./features/blog-metadata-module.md) (1,100 lignes, 5 endpoints)
- [ai-content-module.md](./features/ai-content-module.md) (1,847 lignes, 10 endpoints)

**Analytics & Monitoring (2 specs):**
- [analytics-module.md](./features/analytics-module.md) (1,980 lignes, 15+ endpoints)
- [dashboard-module.md](./features/dashboard-module.md) (1,650 lignes, 9 endpoints)

---

## 💡 Astuces Pro

### 1. Recherche Multi-Critères

```bash
# Endpoints GET avec cache et RBAC 7+
grep -E "(GET|cache|Level 7)" .spec/API-ENDPOINTS-INDEX.md | grep -A 2 "GET"
```

### 2. Statistiques Rapides

```bash
# Compter endpoints par module
for file in .spec/features/*.md; do
  echo "$file: $(grep -c "| Method |" $file) endpoints"
done | sort -t: -k2 -rn

# Total lignes de specs
wc -l .spec/features/*.md | tail -1
```

### 3. Recherche Contextuelle

```bash
# Voir tous les endpoints d'un controller
grep -A 100 "class ProductsController" backend/src/modules/products/products.controller.ts
```

### 4. Recherche par Pattern

```bash
# Tous les services qui utilisent Redis
find backend/src -name "*.service.ts" -exec grep -l "RedisService\|CacheService" {} \;

# Tous les DTOs
find backend/src -name "*.dto.ts"
```

---

**Made with ❤️ by Backend Team**  
**Search Guide v1.0.0 - 2025-11-18**
