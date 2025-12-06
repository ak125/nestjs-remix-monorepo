# 🔌 API Endpoints Index - Backend NestJS E-commerce

> **Index complet des 187+ endpoints** - Recherche rapide par module, méthode, fonctionnalité

**Dernière mise à jour:** 2025-11-18  
**Version:** 1.0.0

---

## 📋 Table des Matières

- [Authentication & Authorization](#authentication--authorization)
- [E-commerce Core](#e-commerce-core)
- [Content Management](#content-management)
- [Analytics & Monitoring](#analytics--monitoring)
- [Index par Méthode HTTP](#index-par-méthode-http)
- [Index par Fonctionnalité](#index-par-fonctionnalité)

---

## Authentication & Authorization

### Auth Module (6 endpoints)

| Method | Endpoint | Description | Auth | Performance |
|--------|----------|-------------|------|-------------|
| POST | `/authenticate` | Login user (customers + staff) | Public | p95 <500ms |
| POST | `/register-and-login` | Register + auto-login | Public | p95 <800ms |
| POST | `/logout` | Logout user | Required | p95 <200ms |
| GET | `/profile` | Get user profile | Required | p95 <300ms |
| PUT | `/profile` | Update profile | Required | p95 <400ms |
| PUT | `/profile/password` | Change password | Required | p95 <600ms |

**Spec:** [auth-module.md](./features/auth-module.md)

**Fonctionnalités:**
- Session-based authentication (Passport.js)
- JWT tokens (7 days expiration)
- Legacy password migration (MD5→bcrypt)
- Rate limiting: 5 attempts/15min
- Cart merge on login

---

### Admin Module (39 endpoints)

#### Stock Management (13 endpoints)

| Method | Endpoint | Description | Auth | Cache |
|--------|----------|-------------|------|-------|
| GET | `/api/admin/stock/dashboard` | Stock overview (totals, alerts, movements) | Admin ≥7 | 60s |
| GET | `/api/admin/stock/:pg_id` | Stock detail by gamme | Admin ≥7 | 300s |
| PUT | `/api/admin/stock/:pg_id` | Update stock quantity | Admin ≥7 | Clear cache |
| POST | `/api/admin/stock/reserve` | Reserve stock (order pending) | Admin ≥7 | - |
| POST | `/api/admin/stock/release` | Release reservation | Admin ≥7 | - |
| DELETE | `/api/admin/stock/reserve/:id` | Cancel reservation | Admin ≥7 | - |
| GET | `/api/admin/stock/movements` | Stock history (pagination) | Admin ≥7 | - |
| GET | `/api/admin/stock/movements/:pg_id` | Movements by gamme | Admin ≥7 | - |
| POST | `/api/admin/stock/movements` | Log manual movement | Admin ≥7 | - |
| GET | `/api/admin/stock/alerts` | Low stock alerts | Admin ≥7 | 120s |
| PUT | `/api/admin/stock/alerts/:pg_id` | Update alert threshold | Admin ≥7 | Clear cache |
| GET | `/api/admin/stock/reservations` | Active reservations list | Admin ≥7 | - |
| GET | `/api/admin/stock/export` | Export stock CSV | Admin ≥7 | - |

**Performance:**
- Dashboard: p50 <200ms, p95 <500ms
- Update operations: p95 <300ms
- Export: Async job, 10k lines ~5s

#### User Management (7 endpoints)

| Method | Endpoint | Description | Auth | Performance |
|--------|----------|-------------|------|-------------|
| GET | `/api/admin/users/stats` | Users statistics (total, active, new) | Admin ≥7 | p95 <400ms |
| GET | `/api/admin/users` | List users (pagination, filters) | Admin ≥7 | p95 <600ms |
| GET | `/api/admin/users/:id` | User details (orders, addresses) | Admin ≥7 | p95 <500ms |
| PUT | `/api/admin/users/:id` | Update user info | Admin ≥7 | p95 <400ms |
| PUT | `/api/admin/users/:id/level` | Update RBAC level | Admin ≥10 | p95 <300ms |
| PUT | `/api/admin/users/:id/activate` | Activate/deactivate user | Admin ≥7 | p95 <300ms |
| DELETE | `/api/admin/users/:id` | Soft delete user (RGPD) | Admin ≥10 | p95 <500ms |

#### Products Admin (9 endpoints)

| Method | Endpoint | Description | Auth | Performance |
|--------|----------|-------------|------|-------------|
| GET | `/api/admin/products/search` | Search products (advanced filters) | Admin ≥7 | p95 <800ms |
| GET | `/api/admin/products/:id` | Product detail (full admin view) | Admin ≥7 | p95 <400ms |
| PUT | `/api/admin/products/:id` | Update product | Admin ≥7 | p95 <600ms |
| POST | `/api/admin/products/:id/images` | Upload product images | Admin ≥7 | p95 <2000ms |
| DELETE | `/api/admin/products/:id/images/:image_id` | Delete product image | Admin ≥7 | p95 <500ms |
| GET | `/api/admin/products/statistics` | Products statistics | Admin ≥7 | Cache 600s |
| POST | `/api/admin/products/import` | Bulk import CSV | Admin ≥8 | Async job |
| GET | `/api/admin/products/export` | Export products CSV | Admin ≥7 | Async job |
| PUT | `/api/admin/products/batch` | Batch update (prices, stock) | Admin ≥8 | Async job |

#### Reporting (5 endpoints)

| Method | Endpoint | Description | Auth | Cache |
|--------|----------|-------------|------|-------|
| GET | `/api/admin/reporting/analytics` | Analytics dashboard (KPIs) | Admin ≥7 | 300s |
| GET | `/api/admin/reporting/sales` | Sales reports (date range) | Admin ≥7 | 600s |
| GET | `/api/admin/reporting/products` | Products performance | Admin ≥7 | 600s |
| POST | `/api/admin/reporting/generate` | Generate custom report | Admin ≥7 | Async |
| GET | `/api/admin/reporting/scheduled` | List scheduled reports | Admin ≥7 | - |

#### Configuration (5 endpoints)

| Method | Endpoint | Description | Auth | Cache |
|--------|----------|-------------|------|-------|
| GET | `/api/admin/config` | Get all config | Admin ≥8 | 600s |
| GET | `/api/admin/config/:key` | Get config by key | Admin ≥8 | 600s |
| PUT | `/api/admin/config/:key` | Update config value | Admin ≥8 | Clear |
| POST | `/api/admin/config` | Create new config | Admin ≥8 | Clear |
| DELETE | `/api/admin/config/:key` | Delete config | Admin ≥10 | Clear |

**Spec:** [admin-module.md](./features/admin-module.md)

---

## E-commerce Core

### Catalog Module (31 endpoints)

#### Hierarchy & Navigation (8 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/api/catalog/hierarchy` | Full hierarchy (19 families, 400k products) | 300s | p95 <500ms |
| GET | `/api/catalog/famille` | List families (19 total) | 300s | p95 <200ms |
| GET | `/api/catalog/famille/:id_famille` | Family detail | 300s | p95 <300ms |
| GET | `/api/catalog/famille/:id_famille/gammes` | Gammes of family | 300s | p95 <400ms |
| GET | `/api/catalog/gamme` | List all gammes (paginated) | 120s | p95 <600ms |
| GET | `/api/catalog/gamme/:pg_id` | Gamme detail | Hot 300s | p95 <400ms |
| GET | `/api/catalog/gamme/:pg_id/products` | Products of gamme | Warm 120s | p95 <800ms |
| GET | `/api/catalog/breadcrumbs/:pg_id` | Breadcrumbs navigation | 300s | p95 <100ms |

#### Search & Filters (7 endpoints)

| Method | Endpoint | Description | Performance |
|--------|----------|-------------|-------------|
| GET | `/api/catalog/search` | Meilisearch ultra-fast | p95 <200ms |
| POST | `/api/catalog/search/advanced` | Advanced filters | p95 <400ms |
| GET | `/api/catalog/filters/available` | Available filters | p95 <300ms |
| GET | `/api/catalog/autocomplete` | Search suggestions | p95 <150ms |
| GET | `/api/catalog/popular` | Popular gammes | Cache 600s |
| GET | `/api/catalog/recent` | Recently viewed | Session |
| GET | `/api/catalog/recommendations/:pg_id` | Related gammes | Cache 300s |

#### Vehicle Compatibility (8 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/api/catalog/vehicles` | List vehicles (30k+) | 600s | p95 <500ms |
| GET | `/api/catalog/vehicles/marques` | List brands | 600s | p95 <200ms |
| GET | `/api/catalog/vehicles/modeles/:marque` | Models by brand | 600s | p95 <300ms |
| GET | `/api/catalog/vehicles/types/:modele` | Types by model | 600s | p95 <300ms |
| POST | `/api/catalog/vehicles/search` | Search vehicle by criteria | - | p95 <600ms |
| GET | `/api/catalog/gamme/:pg_id/vehicles` | Compatible vehicles | 300s | p95 <500ms |
| POST | `/api/catalog/vehicles/compatibility` | Batch check compatibility | - | p95 <800ms |
| GET | `/api/catalog/vehicles/:id/gammes` | Gammes for vehicle | 300s | p95 <600ms |

#### Statistics & Analytics (4 endpoints)

| Method | Endpoint | Description | Cache | Auth |
|--------|----------|-------------|-------|------|
| GET | `/api/catalog/stats/overview` | Catalog statistics | 600s | Admin |
| GET | `/api/catalog/stats/gamme/:pg_id` | Gamme statistics | 300s | Admin |
| POST | `/api/catalog/analytics/track` | Track catalog events | - | Public |
| GET | `/api/catalog/analytics/popular` | Popular searches | 300s | Admin |

#### Cache Management (4 endpoints)

| Method | Endpoint | Description | Auth | Performance |
|--------|----------|-------------|------|-------------|
| DELETE | `/api/catalog/cache` | Clear all catalog cache | Admin ≥8 | <100ms |
| DELETE | `/api/catalog/cache/famille/:id` | Clear family cache | Admin ≥8 | <100ms |
| DELETE | `/api/catalog/cache/gamme/:pg_id` | Clear gamme cache | Admin ≥8 | <100ms |
| GET | `/api/catalog/cache/stats` | Cache hit/miss stats | Admin ≥7 | <100ms |

**Spec:** [catalog-module.md](./features/catalog-module.md)

**Cache Strategy:**
- **Hot** (TTL 300s): Popular gammes, frequently accessed
- **Warm** (TTL 120s): Recent gammes, filtered lists
- **Cold** (TTL 60s): Full lists, statistics

---

### Products Module (26 endpoints)

#### Products CRUD (8 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/api/products` | List products (paginated, 50/page) | 300s | p95 <600ms |
| GET | `/api/products/:id` | Product detail | 600s | p95 <400ms |
| POST | `/api/products/search` | Text search (Meilisearch) | - | p95 <300ms |
| GET | `/api/products/by-gamme/:pg_id` | Products by gamme | 300s | p95 <500ms |
| GET | `/api/products/by-famille/:id_famille` | Products by family | 300s | p95 <800ms |
| GET | `/api/products/featured` | Featured products | 600s | p95 <400ms |
| GET | `/api/products/new` | New arrivals | 300s | p95 <400ms |
| GET | `/api/products/bestsellers` | Best sellers | 600s | p95 <400ms |

#### Vehicle Compatibility (5 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/api/products/:id/compatibility` | Compatible vehicles list | 600s | p95 <500ms |
| POST | `/api/products/by-vehicle` | Filter by vehicle criteria | - | p95 <800ms |
| GET | `/api/products/:id/fitment` | Fitment details | 600s | p95 <400ms |
| POST | `/api/products/check-compatibility` | Batch check compatibility | - | p95 <1000ms |
| GET | `/api/products/vehicle/:vehicle_id` | All products for vehicle | 300s | p95 <1000ms |

#### Pricing & Stock (4 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/api/products/:id/price` | Current price (with promos) | 180s | p95 <200ms |
| GET | `/api/products/:id/stock` | Real-time stock | 60s | p95 <300ms |
| POST | `/api/products/prices` | Batch pricing (up to 100 IDs) | - | p95 <500ms |
| POST | `/api/products/stock` | Batch stock check | - | p95 <500ms |

#### Images & Media (3 endpoints)

| Method | Endpoint | Description | CDN | Performance |
|--------|----------|-------------|-----|-------------|
| GET | `/api/products/:id/images` | Product images URLs | Supabase | p95 <200ms |
| GET | `/api/products/:id/images/:image_id` | Single image detail | Supabase | p95 <150ms |
| GET | `/api/products/:id/videos` | Product videos (if any) | Supabase | p95 <200ms |

#### Alternatives & Cross-sell (4 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/api/products/:id/alternatives` | Alternative products | 600s | p95 <500ms |
| GET | `/api/products/:id/cross-sell` | Cross-sell suggestions | 600s | p95 <500ms |
| GET | `/api/products/:id/up-sell` | Up-sell suggestions | 600s | p95 <500ms |
| GET | `/api/products/:id/frequently-bought` | Frequently bought together | 600s | p95 <500ms |

#### Reviews & Ratings (2 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/api/products/:id/reviews` | Product reviews | 300s | p95 <400ms |
| POST | `/api/products/:id/reviews` | Submit review | - | p95 <600ms |

**Spec:** [products.md](./features/products.md)

**Performance optimizations:**
- Meilisearch indexation: <200ms search
- Redis multi-level cache: hot/warm/cold
- CDN images: Supabase Storage
- Batch operations: Max 100 IDs

---

### Cart Module (18 endpoints)

#### Cart Management (10 endpoints)

| Method | Endpoint | Description | Session | Performance |
|--------|----------|-------------|---------|-------------|
| GET | `/api/cart` | Get cart (items, totals, promos) | Required | p95 <300ms |
| POST | `/api/cart/items` | Add item to cart | Required | p95 <400ms |
| PUT | `/api/cart/items/:id` | Update item quantity | Required | p95 <300ms |
| DELETE | `/api/cart/items/:id` | Remove item | Required | p95 <200ms |
| POST | `/api/cart/items/bulk` | Add multiple items | Required | p95 <800ms |
| DELETE | `/api/cart/clear` | Empty cart | Required | p95 <200ms |
| POST | `/api/cart/merge` | Merge guest → user cart | Auto on login | p95 <600ms |
| GET | `/api/cart/count` | Items count | Required | p95 <100ms |
| GET | `/api/cart/summary` | Cart summary (totals only) | Required | p95 <150ms |
| POST | `/api/cart/validate` | Validate cart (stock check) | Required | p95 <500ms |

#### Promo Codes (4 endpoints)

| Method | Endpoint | Description | Session | Performance |
|--------|----------|-------------|---------|-------------|
| POST | `/api/cart/promo` | Apply promo code | Required | p95 <400ms |
| DELETE | `/api/cart/promo` | Remove promo code | Required | p95 <200ms |
| GET | `/api/cart/promo/available` | List available promos for user | Required | p95 <300ms |
| POST | `/api/cart/promo/validate` | Validate promo code | Required | p95 <300ms |

#### Shipping (4 endpoints)

| Method | Endpoint | Description | Session | Performance |
|--------|----------|-------------|---------|-------------|
| GET | `/api/cart/shipping` | Calculate shipping cost | Required | p95 <500ms |
| GET | `/api/cart/shipping/methods` | Available shipping methods | Required | p95 <200ms |
| POST | `/api/cart/shipping/estimate` | Estimate by address | Required | p95 <600ms |
| POST | `/api/cart/shipping/select` | Select shipping method | Required | p95 <300ms |

**Spec:** [cart.md](./features/cart.md)

**Features:**
- Session-based cart (Redis TTL 7 days)
- Automatic merge guest → user on login
- Real-time stock validation
- Promo codes with stacking rules
- Multi-carrier shipping calculation

---

### Payments Module (11 endpoints)

#### Payment Flow (7 endpoints)

| Method | Endpoint | Description | Security | Performance |
|--------|----------|-------------|----------|-------------|
| POST | `/api/payments/init` | Initialize payment (Paybox) | HMAC SHA512 | p95 <800ms |
| POST | `/api/payments/paybox/callback` | Paybox IPN callback | HMAC validation | p95 <500ms |
| GET | `/api/payments/:id/status` | Payment status | Auth | p95 <200ms |
| POST | `/api/payments/:id/cancel` | Cancel payment | Auth | p95 <400ms |
| POST | `/api/payments/:id/refund` | Refund payment | Admin ≥7 | p95 <1000ms |
| GET | `/api/payments/:id/receipt` | Payment receipt PDF | Auth | p95 <800ms |
| POST | `/api/payments/:id/retry` | Retry failed payment | Auth | p95 <800ms |

#### Security & Validation (4 endpoints)

| Method | Endpoint | Description | Performance |
|--------|----------|-------------|-------------|
| POST | `/api/payments/validate-hmac` | Validate HMAC signature | p95 <100ms |
| GET | `/api/payments/config` | Paybox config (public keys) | p95 <100ms |
| POST | `/api/payments/3ds/verify` | Verify 3DS authentication | p95 <500ms |
| POST | `/api/payments/fraud-check` | Fraud detection check | p95 <300ms |

**Spec:** [payments.md](./features/payments.md)

**Security:**
- HMAC SHA512 signature validation
- 3D Secure support
- PCI-DSS compliant (Paybox handles card data)
- Fraud detection integration
- IP geolocation check

**Supported:**
- Credit cards (Visa, Mastercard, Amex)
- Paybox callbacks (IPN)
- Multi-currency (EUR, USD, GBP)
- Partial refunds

---

### Orders Module (17 endpoints)

#### Order Management (9 endpoints)

| Method | Endpoint | Description | Auth | Performance |
|--------|----------|-------------|------|-------------|
| POST | `/api/orders` | Create order (from cart) | Required | p95 <1200ms |
| GET | `/api/orders/:id` | Order detail | Auth/Owner | p95 <500ms |
| GET | `/api/orders` | List user orders (paginated) | Required | p95 <600ms |
| PUT | `/api/orders/:id/status` | Update order status | Admin ≥7 | p95 <400ms |
| POST | `/api/orders/:id/cancel` | Cancel order (user) | Auth/Owner | p95 <600ms |
| PUT | `/api/orders/:id/shipping` | Update shipping info | Admin ≥7 | p95 <400ms |
| GET | `/api/orders/:id/tracking` | Shipping tracking info | Auth/Owner | p95 <300ms |
| POST | `/api/orders/:id/return` | Initiate return | Auth/Owner | p95 <800ms |
| GET | `/api/orders/:id/history` | Order status history | Auth/Owner | p95 <300ms |

#### Invoices & Documents (4 endpoints)

| Method | Endpoint | Description | Auth | Performance |
|--------|----------|-------------|------|-------------|
| GET | `/api/orders/:id/invoice` | Generate invoice PDF | Auth/Owner | p95 <1000ms |
| GET | `/api/orders/:id/receipt` | Payment receipt | Auth/Owner | p95 <800ms |
| GET | `/api/orders/:id/shipping-label` | Shipping label PDF | Admin ≥7 | p95 <1000ms |
| GET | `/api/orders/:id/packing-slip` | Packing slip PDF | Admin ≥7 | p95 <800ms |

#### Admin Operations (4 endpoints)

| Method | Endpoint | Description | Auth | Performance |
|--------|----------|-------------|------|-------------|
| GET | `/api/orders/admin/list` | All orders (admin view) | Admin ≥7 | p95 <1000ms |
| GET | `/api/orders/admin/statistics` | Orders statistics | Admin ≥7 | Cache 300s |
| POST | `/api/orders/admin/export` | Export orders CSV | Admin ≥7 | Async job |
| PUT | `/api/orders/admin/batch-update` | Batch update status | Admin ≥8 | Async job |

**Spec:** [orders.md](./features/orders.md)

**Workflow (8 états):**
1. `pending` - Order created, payment pending
2. `paid` - Payment confirmed
3. `processing` - Order being prepared
4. `shipped` - Order shipped
5. `delivered` - Order delivered
6. `cancelled` - Order cancelled
7. `returned` - Order returned
8. `refunded` - Order refunded

**Emails transactionnels:**
- Order confirmation
- Payment confirmation
- Shipping notification
- Delivery confirmation
- Cancellation notice
- Return confirmation

---

### Customers Module (17 endpoints)

#### Account Management (6 endpoints)

| Method | Endpoint | Description | Auth | Performance |
|--------|----------|-------------|------|-------------|
| GET | `/api/customers/profile` | Get customer profile | Required | p95 <300ms |
| PUT | `/api/customers/profile` | Update profile | Required | p95 <400ms |
| PUT | `/api/customers/profile/password` | Change password | Required | p95 <600ms |
| PUT | `/api/customers/profile/email` | Change email | Required | p95 <500ms |
| DELETE | `/api/customers/profile` | Delete account (RGPD) | Required | p95 <1000ms |
| POST | `/api/customers/profile/avatar` | Upload avatar | Required | p95 <2000ms |

#### Addresses (5 endpoints)

| Method | Endpoint | Description | Auth | Performance |
|--------|----------|-------------|------|-------------|
| GET | `/api/customers/addresses` | List addresses | Required | p95 <300ms |
| POST | `/api/customers/addresses` | Add address | Required | p95 <400ms |
| PUT | `/api/customers/addresses/:id` | Update address | Required | p95 <400ms |
| DELETE | `/api/customers/addresses/:id` | Delete address | Required | p95 <300ms |
| PUT | `/api/customers/addresses/:id/default` | Set default address | Required | p95 <300ms |

#### Order History (3 endpoints)

| Method | Endpoint | Description | Auth | Performance |
|--------|----------|-------------|------|-------------|
| GET | `/api/customers/orders` | Order history (paginated) | Required | p95 <600ms |
| GET | `/api/customers/orders/:id` | Order detail | Required | p95 <500ms |
| POST | `/api/customers/orders/:id/reorder` | Reorder (copy to cart) | Required | p95 <800ms |

#### RGPD Compliance (3 endpoints)

| Method | Endpoint | Description | Auth | Performance |
|--------|----------|-------------|------|-------------|
| POST | `/api/customers/gdpr/export` | Export personal data (JSON) | Required | p95 <2000ms |
| DELETE | `/api/customers/gdpr/delete` | Delete account & data | Required | p95 <3000ms |
| GET | `/api/customers/gdpr/consent` | Get consent status | Required | p95 <200ms |

**Spec:** [customers.md](./features/customers.md)

**RGPD Features:**
- Right to access (data export)
- Right to erasure (delete account)
- Right to rectification (update data)
- Consent management
- Data portability (JSON export)
- Anonymization (soft delete + anonymize)

---

## Content Management

### Blog Module (20+ endpoints)

#### Content Discovery (8 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/api/blog/homepage` | Homepage content (featured articles) | Hot 5000s | p95 <300ms |
| GET | `/api/blog/search` | Search articles (Meilisearch) | - | p95 <200ms |
| GET | `/api/blog/article/:slug` | Article detail (full content) | Warm 1000s | p95 <400ms |
| GET | `/api/blog/article/by-gamme/:pg_alias` | Article by gamme (legacy URL) | Warm 1000s | p95 <500ms |
| GET | `/api/blog/popular` | Popular articles (views) | Hot 5000s | p95 <300ms |
| GET | `/api/blog/recent` | Recent articles | Warm 1000s | p95 <300ms |
| GET | `/api/blog/category/:category` | Articles by category | Cold 600s | p95 <500ms |
| GET | `/api/blog/tag/:tag` | Articles by tag | Cold 600s | p95 <500ms |

#### Hierarchical Content (H2/H3) (4 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/api/blog/article/:slug/sections` | Article sections (H2 hierarchy) | Warm 1000s | p95 <300ms |
| GET | `/api/blog/article/:slug/section/:h2_id` | H2 section detail with H3 | Warm 1000s | p95 <350ms |
| GET | `/api/blog/article/:slug/toc` | Table of contents (H2+H3) | Warm 1000s | p95 <200ms |
| GET | `/api/blog/article/:slug/hierarchy` | Full hierarchy (H2→H3) | Warm 1000s | p95 <250ms |

#### Cross Recommendations (3 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/api/blog/article/:slug/related` | Related articles (cross table) | Warm 1000s | p95 <400ms |
| GET | `/api/blog/article/:slug/vehicles` | Compatible vehicles | Warm 1000s | p95 <500ms |
| GET | `/api/blog/gamme/:pg_id/articles` | Articles for gamme | Cold 600s | p95 <600ms |

#### SEO & Switches (3 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/api/blog/seo-switches/:pg_id` | SEO switches for gamme | Cold 600s | p95 <300ms |
| GET | `/api/blog/conseil/:pg_id` | Replacement advice (gamme) | Cold 600s | p95 <400ms |
| GET | `/api/blog/sitemap` | Blog sitemap XML | Hot 5000s | p95 <500ms |

#### Admin & Stats (4 endpoints)

| Method | Endpoint | Description | Auth | Cache |
|--------|----------|-------------|------|-------|
| GET | `/api/blog/dashboard` | Blog statistics (articles, views) | Admin ≥7 | Warm 1000s |
| GET | `/api/blog/article/:slug/stats` | Article statistics | Admin ≥7 | Cold 600s |
| PUT | `/api/blog/article/:slug` | Update article | Admin ≥7 | Clear cache |
| POST | `/api/blog/reindex` | Reindex Meilisearch | Admin ≥8 | Async job |

**Spec:** [blog-module.md](./features/blog-module.md)

**Content:**
- 85+ articles conseils techniques
- 3.6M+ cumulative views
- 457+ sections H2/H3 hiérarchisées
- Compatible avec 30,000+ véhicules
- SEO switches dynamiques per gamme

**Cache Strategy (3 niveaux):**
- **Hot** (TTL 5000s): Homepage, popular articles
- **Warm** (TTL 1000s): Article detail, sections, related
- **Cold** (TTL 600s): Lists, categories, stats

---

### Blog Metadata Module (5 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/api/blog/metadata/:alias` | SEO metadata (title, desc, keywords, H1, breadcrumbs) | 3600s | p95 <50ms (hit) / <200ms (miss) |
| GET | `/api/blog/metadata` | All metadata (admin) | - | Admin ≥7 |
| GET | `/api/blog/metadata/aliases` | List all aliases | 3600s | Admin ≥7 |
| DELETE | `/api/blog/metadata/cache/:alias` | Clear cache for alias | - | Admin ≥7 |
| DELETE | `/api/blog/metadata/cache` | Clear all metadata cache | - | Admin ≥8 |

**Spec:** [blog-metadata-module.md](./features/blog-metadata-module.md)

**Features:**
- Centralized SEO metadata (1 table: `__blog_meta_tags_ariane`)
- Redis cache 1h TTL (3600s)
- Intelligent fallback (default metadata if alias not found)
- Relfollow normalization: `"1"/"0"` → `"index, follow"/"noindex, nofollow"`
- Breadcrumbs ariane for navigation

**Fields:**
- `title`: Page title (max 70 chars)
- `description`: Meta description (max 160 chars)
- `keywords`: Meta keywords (comma-separated)
- `h1`: Main H1 heading
- `ariane`: Breadcrumbs JSON (array of {label, url})
- `content`: Optional full content
- `relfollow`: SEO directive ("index, follow" or "noindex, nofollow")

---

### AI Content Module (10 endpoints)

#### Content Generation (5 endpoints)

| Method | Endpoint | Description | Provider | Performance |
|--------|----------|-------------|----------|-------------|
| POST | `/api/ai/generate` | Generate generic content | Multi | p95 <3000ms |
| POST | `/api/ai/generate/product` | Product description | Multi | p95 <4000ms |
| POST | `/api/ai/generate/seo` | SEO optimization | Multi | p95 <3500ms |
| POST | `/api/ai/generate/blog` | Blog article | Multi | p95 <5000ms |
| POST | `/api/ai/generate/meta` | Meta tags (title, desc) | Multi | p95 <2000ms |

#### Provider Management (5 endpoints)

| Method | Endpoint | Description | Auth | Performance |
|--------|----------|-------------|------|-------------|
| GET | `/api/ai/providers` | List providers (Groq, HuggingFace, OpenAI, Mistral) | - | p95 <100ms |
| GET | `/api/ai/providers/:name` | Provider details & config | Admin ≥7 | p95 <100ms |
| POST | `/api/ai/providers/:name/test` | Test provider availability | Admin ≥7 | p95 <2000ms |
| PUT | `/api/ai/providers/:name/config` | Update provider config | Admin ≥8 | p95 <300ms |
| GET | `/api/ai/health` | Health check all providers | Admin ≥7 | p95 <3000ms |

**Spec:** [ai-content-module.md](./features/ai-content-module.md)

**Providers (4 supported):**
1. **Groq** - Ultra-fast inference (primary)
2. **HuggingFace** - Open models (fallback #1)
3. **OpenAI** - GPT models (fallback #2)
4. **Mistral** - European models (fallback #3)

**Features:**
- Multi-provider fallback cascade
- Streaming responses (SSE)
- Cost optimization (cheapest first)
- Rate limiting per provider
- Automatic retry with exponential backoff
- Token usage tracking

**Performance:**
- Groq: p95 <2000ms (ultra-fast)
- HuggingFace: p95 <4000ms (standard)
- OpenAI: p95 <3000ms (fast)
- Mistral: p95 <3500ms (standard)

---

## Analytics & Monitoring

### Analytics Module (15+ endpoints)

#### Tracking Scripts (3 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/track.js` | Tracking script (minified) | 600s | p95 <100ms |
| GET | `/track.min.js` | Ultra-minified tracking | 600s | p95 <100ms |
| GET | `/v7.track.php` | Legacy PHP compat | 600s | p95 <150ms |

#### Event Tracking (4 endpoints)

| Method | Endpoint | Description | Buffer | Performance |
|--------|----------|-------------|--------|-------------|
| POST | `/track` | Track single event | 1000 max | p95 <50ms |
| POST | `/track/batch` | Batch track events (max 100) | 1000 max | p95 <200ms |
| GET | `/track/pixel` | Tracking pixel (1x1 gif) | - | p95 <50ms |
| POST | `/report` | Report buffered events | Flush | p95 <500ms |

#### Analytics Data (5 endpoints)

| Method | Endpoint | Description | Cache | Auth |
|--------|----------|-------------|-------|------|
| GET | `/api/analytics/metrics` | Get metrics (date range) | 600s | Admin ≥7 |
| GET | `/api/analytics/events` | List tracked events | - | Admin ≥7 |
| GET | `/api/analytics/sessions` | Session statistics | 600s | Admin ≥7 |
| GET | `/api/analytics/conversions` | Conversion tracking | 600s | Admin ≥7 |
| GET | `/api/analytics/funnels` | Funnel analysis | 600s | Admin ≥7 |

#### Configuration (3 endpoints)

| Method | Endpoint | Description | Auth | Cache |
|--------|----------|-------------|------|-------|
| GET | `/api/analytics/config` | Analytics config | Public | 600s |
| PUT | `/api/analytics/config` | Update config | Admin ≥8 | Clear |
| POST | `/api/analytics/cache/clear` | Clear analytics cache | Admin ≥8 | - |

**Spec:** [analytics-module.md](./features/analytics-module.md)

**Providers (4 supported):**
1. **Google Analytics GA4** - Universal analytics
2. **Matomo** - Self-hosted analytics (GDPR compliant)
3. **Plausible** - Privacy-first analytics
4. **Custom** - Internal tracking

**Features:**
- Multi-provider simultaneous tracking
- Event buffer (1000 max, slice to 500 on overflow)
- Script generation (minification, async/defer)
- Legacy PHP endpoints compatibility
- GDPR compliant (IP anonymization, cookie consent)
- SameSite=strict cookies

**Performance:**
- Buffer operations: p95 <50ms
- Script delivery: p95 <100ms (cache hit)
- Event reporting: p95 <500ms (batch)

---

### Dashboard Module (9 endpoints)

#### KPIs Overview (3 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/api/dashboard/overview` | Global KPIs (orders, revenue, users) | 300s | p95 <800ms |
| GET | `/api/dashboard/today` | Today's stats | 60s | p95 <600ms |
| GET | `/api/dashboard/realtime` | Real-time metrics | - | p95 <400ms |

#### Orders & Revenue (3 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/api/dashboard/orders/stats` | Orders statistics (date range) | 300s | p95 <700ms |
| GET | `/api/dashboard/revenue` | Revenue tracking (daily, monthly) | 300s | p95 <600ms |
| GET | `/api/dashboard/revenue/forecast` | Revenue forecast | 600s | p95 <1000ms |

#### Products & Customers (3 endpoints)

| Method | Endpoint | Description | Cache | Performance |
|--------|----------|-------------|-------|-------------|
| GET | `/api/dashboard/products/top` | Top products (sales, views) | 600s | p95 <700ms |
| GET | `/api/dashboard/products/low-stock` | Low stock alerts | 300s | p95 <500ms |
| GET | `/api/dashboard/customers/stats` | Customers statistics | 600s | p95 <600ms |

**Spec:** [dashboard-module.md](./features/dashboard-module.md)

**KPIs tracked:**
- Orders (total, today, pending, completed)
- Revenue (today, month, year, forecast)
- Customers (total, new, active, churn)
- Products (views, sales, stock alerts)
- Conversion rate (cart → order)
- Average order value (AOV)
- Customer lifetime value (CLV)

**Cache Strategy:**
- Real-time: No cache (WebSocket updates)
- Today: TTL 60s (frequent refresh)
- Overview: TTL 300s (5 minutes)
- Forecast: TTL 600s (10 minutes)

---

## Index par Méthode HTTP

### GET Endpoints (130+)

**Authentication & Profile:**
- `/profile` - User profile
- `/api/customers/profile` - Customer profile
- `/api/customers/addresses` - Addresses list
- `/api/customers/orders` - Order history

**Catalog & Products:**
- `/api/catalog/hierarchy` - Full hierarchy
- `/api/catalog/famille` - Families list
- `/api/catalog/gamme/:pg_id` - Gamme detail
- `/api/products` - Products list
- `/api/products/:id` - Product detail
- `/api/products/:id/compatibility` - Vehicle compatibility
- `/api/products/:id/alternatives` - Alternatives

**Cart & Orders:**
- `/api/cart` - Get cart
- `/api/orders` - User orders
- `/api/orders/:id` - Order detail
- `/api/orders/:id/invoice` - Invoice PDF
- `/api/orders/:id/tracking` - Tracking info

**Blog & Content:**
- `/api/blog/homepage` - Homepage content
- `/api/blog/article/:slug` - Article detail
- `/api/blog/popular` - Popular articles
- `/api/blog/metadata/:alias` - SEO metadata

**Admin & Dashboard:**
- `/api/admin/stock/dashboard` - Stock dashboard
- `/api/admin/users` - Users list
- `/api/dashboard/overview` - KPIs overview
- `/api/dashboard/orders/stats` - Orders stats

**Analytics:**
- `/track.js` - Tracking script
- `/api/analytics/metrics` - Analytics metrics
- `/api/analytics/config` - Analytics config

---

### POST Endpoints (40+)

**Authentication:**
- `/authenticate` - Login
- `/register-and-login` - Register & login

**Products & Search:**
- `/api/products/search` - Search products
- `/api/products/by-vehicle` - Filter by vehicle
- `/api/products/prices` - Batch pricing
- `/api/products/check-compatibility` - Check compatibility

**Cart:**
- `/api/cart/items` - Add item
- `/api/cart/promo` - Apply promo
- `/api/cart/merge` - Merge carts
- `/api/cart/validate` - Validate cart

**Payments & Orders:**
- `/api/payments/init` - Initialize payment
- `/api/payments/paybox/callback` - Paybox callback
- `/api/orders` - Create order
- `/api/orders/:id/cancel` - Cancel order

**Admin Operations:**
- `/api/admin/stock/reserve` - Reserve stock
- `/api/admin/reporting/generate` - Generate report

**AI & Analytics:**
- `/api/ai/generate` - Generate content
- `/api/ai/generate/product` - Product description
- `/track` - Track event
- `/track/batch` - Batch track

**RGPD:**
- `/api/customers/gdpr/export` - Export data

---

### PUT Endpoints (20+)

**Profile & Account:**
- `/profile` - Update profile
- `/profile/password` - Change password
- `/api/customers/profile` - Update customer profile
- `/api/customers/addresses/:id` - Update address

**Cart:**
- `/api/cart/items/:id` - Update quantity

**Admin:**
- `/api/admin/stock/:pg_id` - Update stock
- `/api/admin/users/:id` - Update user
- `/api/admin/users/:id/level` - Update RBAC level
- `/api/admin/products/:id` - Update product
- `/api/orders/:id/status` - Update order status

---

### DELETE Endpoints (15+)

**Cart:**
- `/api/cart/items/:id` - Remove item
- `/api/cart/clear` - Empty cart
- `/api/cart/promo` - Remove promo

**Admin:**
- `/api/admin/stock/reserve/:id` - Cancel reservation
- `/api/admin/users/:id` - Delete user

**Cache Management:**
- `/api/catalog/cache` - Clear catalog cache
- `/api/blog/metadata/cache/:alias` - Clear metadata cache
- `/api/analytics/cache/clear` - Clear analytics cache

**RGPD:**
- `/api/customers/gdpr/delete` - Delete account
- `/api/customers/profile` - Delete account

---

## Index par Fonctionnalité

### 🔐 Authentication & Security
- Login: `POST /authenticate`
- Register: `POST /register-and-login`
- Logout: `POST /logout`
- Profile: `GET /profile`, `PUT /profile`
- Password: `PUT /profile/password`
- RBAC: Guards (Authenticated, Admin, Optional)

### 🛒 Shopping Experience
- Browse: `GET /api/catalog/hierarchy`
- Search: `POST /api/products/search`
- Vehicle filter: `POST /api/products/by-vehicle`
- Product detail: `GET /api/products/:id`
- Add to cart: `POST /api/cart/items`
- Apply promo: `POST /api/cart/promo`
- Checkout: `POST /api/payments/init`
- Place order: `POST /api/orders`

### 📦 Order Management
- Order history: `GET /api/customers/orders`
- Order detail: `GET /api/orders/:id`
- Track shipment: `GET /api/orders/:id/tracking`
- Download invoice: `GET /api/orders/:id/invoice`
- Cancel order: `POST /api/orders/:id/cancel`
- Return order: `POST /api/orders/:id/return`

### 👤 Customer Account
- Profile: `GET /api/customers/profile`
- Addresses: `GET /api/customers/addresses`
- Order history: `GET /api/customers/orders`
- RGPD export: `POST /api/customers/gdpr/export`
- Delete account: `DELETE /api/customers/gdpr/delete`

### 📝 Content & SEO
- Blog articles: `GET /api/blog/homepage`
- Article detail: `GET /api/blog/article/:slug`
- SEO metadata: `GET /api/blog/metadata/:alias`
- Generate content: `POST /api/ai/generate`
- Optimize SEO: `POST /api/ai/generate/seo`

### 📊 Admin & Reporting
- Dashboard: `GET /api/dashboard/overview`
- Stock management: `GET /api/admin/stock/dashboard`
- User management: `GET /api/admin/users`
- Orders admin: `GET /api/orders/admin/list`
- Reports: `GET /api/admin/reporting/analytics`
- Export data: `POST /api/admin/products/export`

### 📈 Analytics & Tracking
- Track event: `POST /track`
- Analytics metrics: `GET /api/analytics/metrics`
- Conversion tracking: `GET /api/analytics/conversions`
- Funnel analysis: `GET /api/analytics/funnels`

---

## 🔍 Recherche Rapide

### Par Cas d'Usage

**Je veux afficher les produits d'une famille:**
```
GET /api/catalog/famille/:id_famille/gammes
→ GET /api/catalog/gamme/:pg_id/products
```

**Je veux chercher un produit par texte:**
```
POST /api/products/search
Body: { "query": "filtre à huile", "limit": 20 }
```

**Je veux filtrer par véhicule:**
```
POST /api/products/by-vehicle
Body: { "marque": "BMW", "modele": "Serie 3", "annee": 2015 }
```

**Je veux ajouter au panier:**
```
POST /api/cart/items
Body: { "product_id": 123, "quantity": 2 }
```

**Je veux appliquer un code promo:**
```
POST /api/cart/promo
Body: { "code": "PROMO10" }
```

**Je veux payer:**
```
POST /api/payments/init
Body: { "cart_id": "xxx", "amount": 49.99, "currency": "EUR" }
```

**Je veux créer la commande:**
```
POST /api/orders
Body: { "cart_id": "xxx", "payment_id": "yyy", "shipping_address_id": 1 }
```

**Je veux voir mes commandes:**
```
GET /api/customers/orders?page=1&limit=10
```

**Je veux télécharger la facture:**
```
GET /api/orders/:id/invoice
→ Retourne PDF
```

**Je veux exporter mes données RGPD:**
```
POST /api/customers/gdpr/export
→ Retourne JSON avec toutes les données
```

---

## 📚 Documentation Complète

Pour plus de détails sur chaque endpoint :

- **Auth Module:** [auth-module.md](./features/auth-module.md)
- **Admin Module:** [admin-module.md](./features/admin-module.md)
- **Catalog Module:** [catalog-module.md](./features/catalog-module.md)
- **Products Module:** [products.md](./features/products.md)
- **Cart Module:** [cart.md](./features/cart.md)
- **Payments Module:** [payments.md](./features/payments.md)
- **Orders Module:** [orders.md](./features/orders.md)
- **Customers Module:** [customers.md](./features/customers.md)
- **Blog Module:** [blog-module.md](./features/blog-module.md)
- **Blog Metadata Module:** [blog-metadata-module.md](./features/blog-metadata-module.md)
- **AI Content Module:** [ai-content-module.md](./features/ai-content-module.md)
- **Analytics Module:** [analytics-module.md](./features/analytics-module.md)
- **Dashboard Module:** [dashboard-module.md](./features/dashboard-module.md)

**Navigation principale:** [README.md](./README.md)

---

**Made with ❤️ by Backend Team**  
**API Index v1.0.0 - 2025-11-18**
