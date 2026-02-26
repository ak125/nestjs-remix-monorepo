---
title: "Index Complet des API Endpoints"
status: stable
version: 1.0.0
---

# 🔌 Index Complet des API Endpoints

> **Référence exhaustive des 187+ endpoints** - Tous les modules backend documentés

**Version:** 1.0.0
**Dernière mise à jour:** 2025-11-18
**Modules couverts:** 37/37 (100%)

---

## 📋 Table des matières

- [Vue d'ensemble](#-vue-densemble)
- [Auth & Admin](#-auth--admin-45-endpoints)
- [E-commerce Core](#-e-commerce-core-109-endpoints)
- [CMS & Content](#-cms--content-35-endpoints)
- [Analytics & Monitoring](#-analytics--monitoring-24-endpoints)
- [Recherche par fonctionnalité](#-recherche-par-fonctionnalit%C3%A9)
- [Conventions API](#-conventions-api)

---

## 🎯 Vue d'ensemble

### Statistiques

| Catégorie | Modules | Endpoints | Specs |
|-----------|---------|-----------|-------|
| **Auth & Admin** | 2 | 45 | [auth](./features/auth-module.md), [admin](./features/admin-module.md) |
| **E-commerce Core** | 6 | 109 | [catalog](./features/catalog-module.md), [products](./features/products.md), [cart](./features/cart.md), [payments](./features/payments.md), [orders](./features/orders.md), [customers](./features/customers.md) |
| **CMS & Content** | 3 | 35+ | [blog](./features/blog-module.md), [blog-metadata](./features/blog-metadata-module.md), [ai-content](./features/ai-content-module.md) |
| **Analytics & Monitoring** | 2 | 24+ | [analytics](./features/analytics-module.md), [dashboard](./features/dashboard-module.md) |
| **Total** | **37** | **187+** | - |

### Codes HTTP Communs

| Code | Signification | Usage |
|------|---------------|-------|
| `200 OK` | Succès | GET, PUT, DELETE |
| `201 Created` | Création réussie | POST |
| `204 No Content` | Suppression réussie | DELETE |
| `400 Bad Request` | Validation échouée | Params/Body invalides |
| `401 Unauthorized` | Non authentifié | Session expirée, JWT invalide |
| `403 Forbidden` | Non autorisé | RBAC level insuffisant |
| `404 Not Found` | Ressource inexistante | ID invalide |
| `422 Unprocessable Entity` | Logique métier échouée | Stock insuffisant, promo invalide |
| `429 Too Many Requests` | Rate limit dépassé | Login attempts (5/15min) |
| `500 Internal Server Error` | Erreur serveur | À investiguer |

---

## 🔐 Auth & Admin (45 endpoints)

### Auth Module (6 endpoints)

| Method | Endpoint | Description | Guards | Response |
|--------|----------|-------------|--------|----------|
| `POST` | `/authenticate` | Login user (customers + staff) | - | `{ user, token, session }` |
| `POST` | `/register-and-login` | Register + auto-login | - | `{ user, token }` |
| `POST` | `/logout` | Logout user | Authenticated | `204 No Content` |
| `GET` | `/profile` | Get user profile | Authenticated | `{ id, email, level, ... }` |
| `PUT` | `/profile` | Update profile (name, email) | Authenticated | `{ ...updatedUser }` |
| `PUT` | `/profile/password` | Change password | Authenticated | `204 No Content` |

**Spec:** [auth-module.md](./features/auth-module.md)

**Exemples:**

```bash
# Login
curl -X POST https://api.example.com/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure123"
  }'

# Get profile
curl https://api.example.com/profile \
  -H "Authorization: Bearer <jwt_token>"

# Change password
curl -X PUT https://api.example.com/profile/password \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{
    "currentPassword": "old123",
    "newPassword": "new456"
  }'
```

---

### Admin Module (39 endpoints)

#### Stock Management (13 endpoints)

| Method | Endpoint | Description | RBAC | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/admin/stock/dashboard` | Stock overview (all gammes) | 7+ | `{ total, available, reserved, alerts[] }` |
| `GET` | `/api/admin/stock/:pg_id` | Stock detail for gamme | 7+ | `{ pg_id, stock_total, stock_disponible, reservations[] }` |
| `PUT` | `/api/admin/stock/:pg_id` | Update stock quantity | 7+ | `{ pg_id, stock_total, stock_disponible }` |
| `POST` | `/api/admin/stock/reserve` | Reserve stock | 7+ | `{ reservation_id, pg_id, quantity, expires_at }` |
| `POST` | `/api/admin/stock/release` | Release reservation | 7+ | `204 No Content` |
| `GET` | `/api/admin/stock/reservations` | List all reservations | 7+ | `{ reservations[] }` |
| `DELETE` | `/api/admin/stock/reservations/:id` | Delete reservation | 7+ | `204 No Content` |
| `GET` | `/api/admin/stock/movements` | Stock movement history | 7+ | `{ movements[] }` |
| `POST` | `/api/admin/stock/movements` | Record manual movement | 7+ | `{ movement_id, type, quantity, reason }` |
| `GET` | `/api/admin/stock/alerts` | Low stock alerts | 7+ | `{ alerts[] }` |
| `PUT` | `/api/admin/stock/alerts/:pg_id/threshold` | Update alert threshold | 7+ | `{ pg_id, threshold }` |
| `POST` | `/api/admin/stock/import` | Bulk import stock | 9+ | `{ imported: 120, errors: [] }` |
| `GET` | `/api/admin/stock/export` | Export stock CSV | 7+ | `text/csv` |

#### User Management (7 endpoints)

| Method | Endpoint | Description | RBAC | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/admin/users` | List all users (paginated) | 7+ | `{ users[], total, page }` |
| `GET` | `/api/admin/users/:id` | User detail | 7+ | `{ id, email, level, ... }` |
| `PUT` | `/api/admin/users/:id` | Update user info | 7+ | `{ ...updatedUser }` |
| `PUT` | `/api/admin/users/:id/level` | Change RBAC level | 9+ | `{ id, level }` |
| `PUT` | `/api/admin/users/:id/status` | Activate/deactivate | 7+ | `{ id, actif }` |
| `GET` | `/api/admin/users/stats` | Users statistics | 7+ | `{ total, active, by_level{} }` |
| `DELETE` | `/api/admin/users/:id` | Delete user (GDPR) | 9+ | `204 No Content` |

#### Products Admin (9 endpoints)

| Method | Endpoint | Description | RBAC | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/admin/products` | Search products (admin) | 7+ | `{ products[], filters }` |
| `GET` | `/api/admin/products/:pg_id` | Product detail (admin) | 7+ | `{ pg_id, ...full_data }` |
| `PUT` | `/api/admin/products/:pg_id` | Update product | 7+ | `{ ...updatedProduct }` |
| `PUT` | `/api/admin/products/:pg_id/prices` | Update prices | 7+ | `{ pg_id, prices{} }` |
| `PUT` | `/api/admin/products/:pg_id/seo` | Update SEO metadata | 7+ | `{ pg_id, seo{} }` |
| `POST` | `/api/admin/products/bulk-update` | Bulk update | 9+ | `{ updated: 50, errors: [] }` |
| `GET` | `/api/admin/products/statistics` | Products stats | 7+ | `{ total, by_famille{}, by_brand{} }` |
| `POST` | `/api/admin/products/import` | Import products CSV | 9+ | `{ imported: 200, errors: [] }` |
| `GET` | `/api/admin/products/export` | Export products CSV | 7+ | `text/csv` |

#### Reporting (5 endpoints)

| Method | Endpoint | Description | RBAC | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/admin/reporting/analytics` | Analytics dashboard | 7+ | `{ orders{}, revenue{}, products{} }` |
| `GET` | `/api/admin/reporting/sales` | Sales report (date range) | 7+ | `{ sales[], total }` |
| `GET` | `/api/admin/reporting/inventory` | Inventory report | 7+ | `{ stock{}, movements{} }` |
| `POST` | `/api/admin/reporting/schedule` | Schedule automated report | 9+ | `{ schedule_id, frequency }` |
| `GET` | `/api/admin/reporting/export/:type` | Export report (PDF/CSV) | 7+ | `application/pdf` or `text/csv` |

#### Configuration & SEO (5 endpoints)

| Method | Endpoint | Description | RBAC | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/admin/config` | Get all config | 9+ | `{ config{} }` |
| `PUT` | `/api/admin/config/:key` | Update config value | 9+ | `{ key, value }` |
| `GET` | `/api/admin/seo/switches` | SEO switches (all gammes) | 7+ | `{ switches[] }` |
| `PUT` | `/api/admin/seo/switches/:pg_id` | Update SEO switches | 7+ | `{ pg_id, switches{} }` |
| `POST` | `/api/admin/cache/clear` | Clear cache (all or specific) | 9+ | `{ cleared: ["products", "catalog"] }` |

**Spec:** [admin-module.md](./features/admin-module.md)

---

## 🛒 E-commerce Core (109 endpoints)

### Catalog Module (31 endpoints)

#### Hierarchy & Navigation (8 endpoints)

| Method | Endpoint | Description | Cache | Response |
|--------|----------|-------------|-------|----------|
| `GET` | `/api/catalog/hierarchy` | Full hierarchy (Famille→Gamme→Produit) | 5min | `{ familles[], gammes[], products[] }` |
| `GET` | `/api/catalog/famille` | List 19 familles | 5min | `{ familles[] }` |
| `GET` | `/api/catalog/famille/:id_famille` | Famille detail + gammes | 5min | `{ id_famille, gammes[], colors[], ... }` |
| `GET` | `/api/catalog/famille/:id_famille/gammes` | Gammes in famille | 5min | `{ gammes[] }` |
| `GET` | `/api/catalog/gamme/:pg_id` | Gamme detail + products | Hot | `{ pg_id, products[], seo{}, ... }` |
| `GET` | `/api/catalog/gamme/:pg_id/products` | Products in gamme | Hot | `{ products[] }` |
| `GET` | `/api/catalog/gamme/:pg_id/related` | Related gammes | 5min | `{ related[] }` |
| `GET` | `/api/catalog/navigation` | Breadcrumb navigation | 5min | `{ breadcrumbs[] }` |

#### Brands & Manufacturers (7 endpoints)

| Method | Endpoint | Description | Cache | Response |
|--------|----------|-------------|-------|----------|
| `GET` | `/api/catalog/brands` | List all brands (constructeurs) | 10min | `{ brands[] }` |
| `GET` | `/api/catalog/brands/:id_constructeur` | Brand detail | 10min | `{ id_constructeur, name, logo, gammes[] }` |
| `GET` | `/api/catalog/brands/:id_constructeur/gammes` | Gammes by brand | 5min | `{ gammes[] }` |
| `GET` | `/api/catalog/brands/popular` | Popular brands | 10min | `{ brands[] }` |
| `GET` | `/api/catalog/equipementiers` | List équipementiers (OEM) | 1h | `{ equipementiers[] }` |
| `GET` | `/api/catalog/equipementiers/:id` | Équipementier detail | 1h | `{ id, name, products[] }` |
| `GET` | `/api/catalog/brands-hierarchy` | Brands tree structure | 10min | `{ tree{} }` |

#### Vehicles & Compatibility (10 endpoints)

| Method | Endpoint | Description | Cache | Response |
|--------|----------|-------------|-------|----------|
| `GET` | `/api/catalog/vehicles` | List all vehicles | 10min | `{ vehicles[] }` |
| `GET` | `/api/catalog/vehicles/search` | Search vehicles (autocomplete) | - | `{ results[] }` |
| `GET` | `/api/catalog/vehicles/:id_type_auto` | Vehicle detail | 10min | `{ id_type_auto, marque, modele, ... }` |
| `GET` | `/api/catalog/vehicles/:id_type_auto/compatible-products` | Compatible products | 5min | `{ products[] }` |
| `GET` | `/api/catalog/vehicles/:id_type_auto/compatible-gammes` | Compatible gammes | 5min | `{ gammes[] }` |
| `POST` | `/api/catalog/vehicles/filter-products` | Filter products by vehicle | - | `{ products[], filters{} }` |
| `GET` | `/api/catalog/compatibility/:pg_id/:id_type_auto` | Check compatibility | 5min | `{ compatible: true/false }` |
| `GET` | `/api/catalog/vehicles/popular` | Popular vehicles | 1h | `{ vehicles[] }` |
| `GET` | `/api/catalog/vehicles/by-brand/:brand` | Vehicles by brand | 10min | `{ vehicles[] }` |
| `GET` | `/api/catalog/vehicles/years` | Available years | 1h | `{ years[] }` |

#### Search & Filters (6 endpoints)

| Method | Endpoint | Description | Engine | Response |
|--------|----------|-------------|--------|----------|
| `GET` | `/api/catalog/search` | Full-text search | Meilisearch | `{ results[], facets{} }` |
| `POST` | `/api/catalog/search/advanced` | Advanced filters | Meilisearch | `{ results[], filters{} }` |
| `GET` | `/api/catalog/search/suggestions` | Autocomplete | Meilisearch | `{ suggestions[] }` |
| `GET` | `/api/catalog/filters/available` | Available filters | 5min | `{ brands[], years[], families[] }` |
| `POST` | `/api/catalog/filters/apply` | Apply multiple filters | - | `{ filtered_results[] }` |
| `GET` | `/api/catalog/search/popular` | Popular searches | 1h | `{ searches[] }` |

**Spec:** [catalog-module.md](./features/catalog-module.md)

---

### Products Module (26 endpoints)

#### Product Listing & Detail (8 endpoints)

| Method | Endpoint | Description | Cache | Response |
|--------|----------|-------------|-------|----------|
| `GET` | `/api/products` | List products (paginated) | 5min | `{ products[], total, page }` |
| `GET` | `/api/products/:pg_id` | Product detail | 10min | `{ pg_id, ...full_data }` |
| `GET` | `/api/products/:pg_id/full` | Product with relations | 10min | `{ product{}, related[], cross_sell[] }` |
| `GET` | `/api/products/by-ids` | Multiple products by IDs | 5min | `{ products[] }` |
| `GET` | `/api/products/featured` | Featured products | 10min | `{ products[] }` |
| `GET` | `/api/products/new` | New arrivals | 5min | `{ products[] }` |
| `GET` | `/api/products/bestsellers` | Best sellers | 10min | `{ products[] }` |
| `GET` | `/api/products/on-sale` | Discounted products | 5min | `{ products[] }` |

#### Search & Filters (6 endpoints)

| Method | Endpoint | Description | Performance | Response |
|--------|----------|-------------|-------------|----------|
| `GET` | `/api/products/search` | Text search | p95 <300ms | `{ results[], total }` |
| `POST` | `/api/products/search/advanced` | Multi-criteria search | p95 <500ms | `{ results[], filters{} }` |
| `GET` | `/api/products/by-vehicle/:id_type_auto` | Filter by vehicle | 5min cache | `{ products[] }` |
| `POST` | `/api/products/filter` | Apply filters | - | `{ filtered[], facets{} }` |
| `GET` | `/api/products/autocomplete` | Search suggestions | - | `{ suggestions[] }` |
| `GET` | `/api/products/filters` | Available filters | 5min | `{ brands[], prices{}, families[] }` |

#### Prices & Stock (5 endpoints)

| Method | Endpoint | Description | Real-time | Response |
|--------|----------|-------------|-----------|----------|
| `GET` | `/api/products/:pg_id/price` | Current price | Yes | `{ price, discount, final_price }` |
| `GET` | `/api/products/:pg_id/stock` | Stock availability | Yes | `{ disponible, total, reserved }` |
| `POST` | `/api/products/prices` | Bulk prices (multiple IDs) | Yes | `{ prices[] }` |
| `POST` | `/api/products/stock` | Bulk stock (multiple IDs) | Yes | `{ stock[] }` |
| `GET` | `/api/products/:pg_id/availability` | Delivery estimate | - | `{ available, delivery_days }` |

#### Relations & Recommendations (7 endpoints)

| Method | Endpoint | Description | Algorithm | Response |
|--------|----------|-------------|-----------|----------|
| `GET` | `/api/products/:pg_id/related` | Related products | Cross-sell | `{ products[] }` |
| `GET` | `/api/products/:pg_id/alternatives` | Alternative products | Same gamme | `{ products[] }` |
| `GET` | `/api/products/:pg_id/frequently-bought-together` | Often bought together | Order history | `{ products[] }` |
| `GET` | `/api/products/:pg_id/compatibility` | Compatible vehicles | `__cross_gamme_car_new` | `{ vehicles[] }` |
| `GET` | `/api/products/:pg_id/reviews` | Product reviews | - | `{ reviews[], rating }` |
| `POST` | `/api/products/:pg_id/reviews` | Add review | Authenticated | `{ review_id }` |
| `GET` | `/api/products/recommendations` | Personalized recommendations | User history | `{ products[] }` |

**Spec:** [products.md](./features/products.md)

---

### Cart Module (18 endpoints)

#### Cart Management (7 endpoints)

| Method | Endpoint | Description | Session | Response |
|--------|----------|-------------|---------|----------|
| `GET` | `/api/cart` | Get cart | Required | `{ items[], subtotal, shipping, total }` |
| `POST` | `/api/cart/items` | Add item to cart | Required | `{ cart{}, added_item{} }` |
| `PUT` | `/api/cart/items/:id` | Update item quantity | Required | `{ cart{}, updated_item{} }` |
| `DELETE` | `/api/cart/items/:id` | Remove item | Required | `{ cart{} }` |
| `POST` | `/api/cart/clear` | Clear entire cart | Required | `204 No Content` |
| `POST` | `/api/cart/merge` | Merge guest → user cart | After login | `{ cart{} }` |
| `GET` | `/api/cart/count` | Items count | Required | `{ count: 5 }` |

#### Cart Operations (5 endpoints)

| Method | Endpoint | Description | Validation | Response |
|--------|----------|-------------|------------|----------|
| `POST` | `/api/cart/validate` | Validate cart contents | Stock check | `{ valid: true/false, errors[] }` |
| `POST` | `/api/cart/recalculate` | Recalculate totals | Prices + shipping | `{ cart{} }` |
| `PUT` | `/api/cart/notes` | Update order notes | - | `{ notes }` |
| `POST` | `/api/cart/save-for-later/:item_id` | Save item for later | - | `{ saved_items[] }` |
| `POST` | `/api/cart/restore/:item_id` | Restore saved item | Stock check | `{ cart{} }` |

#### Shipping & Promo (6 endpoints)

| Method | Endpoint | Description | Logic | Response |
|--------|----------|-------------|-------|----------|
| `GET` | `/api/cart/shipping/methods` | Available shipping methods | Weight + destination | `{ methods[] }` |
| `POST` | `/api/cart/shipping/calculate` | Calculate shipping cost | Cart weight | `{ cost, method, days }` |
| `PUT` | `/api/cart/shipping/select` | Select shipping method | - | `{ cart{}, shipping{} }` |
| `POST` | `/api/cart/promo/apply` | Apply promo code | Validation | `{ cart{}, discount{} }` |
| `DELETE` | `/api/cart/promo/remove` | Remove promo code | - | `{ cart{} }` |
| `GET` | `/api/cart/promo/available` | Available promos for user | User segments | `{ promos[] }` |

**Spec:** [cart.md](./features/cart.md)

---

### Payments Module (11 endpoints)

#### Payment Initialization (4 endpoints)

| Method | Endpoint | Description | Security | Response |
|--------|----------|-------------|----------|----------|
| `POST` | `/api/payments/init` | Initialize payment | HMAC SHA512 | `{ payment_id, paybox_url, hmac }` |
| `POST` | `/api/payments/prepare` | Prepare payment data | Session | `{ amount, cart_id, customer{} }` |
| `GET` | `/api/payments/:id/status` | Payment status | Auth | `{ status, amount, date }` |
| `POST` | `/api/payments/:id/cancel` | Cancel payment | Auth | `204 No Content` |

#### Paybox Integration (4 endpoints)

| Method | Endpoint | Description | Validation | Response |
|--------|----------|-------------|------------|----------|
| `POST` | `/api/payments/paybox/callback` | Paybox IPN callback | HMAC | `200 OK` |
| `GET` | `/api/payments/paybox/success` | Success redirect | Session | `{ order_id, payment{} }` |
| `GET` | `/api/payments/paybox/error` | Error redirect | Session | `{ error, payment{} }` |
| `GET` | `/api/payments/paybox/cancel` | Cancel redirect | Session | `{ cancelled: true }` |

#### Payment Management (3 endpoints)

| Method | Endpoint | Description | RBAC | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/payments` | List user payments | Auth | `{ payments[] }` |
| `GET` | `/api/payments/admin` | List all payments | 7+ | `{ payments[], total }` |
| `POST` | `/api/payments/:id/refund` | Refund payment | 9+ | `{ refund_id, amount }` |

**Spec:** [payments.md](./features/payments.md)

**Exemples:**

```bash
# Initialize payment
curl -X POST https://api.example.com/api/payments/init \
  -H "Authorization: Bearer <token>" \
  -d '{
    "cart_id": "abc123",
    "amount": 15900,
    "currency": "EUR"
  }'

# Check payment status
curl https://api.example.com/api/payments/pay123/status \
  -H "Authorization: Bearer <token>"
```

---

### Orders Module (17 endpoints)

#### Order Creation & Detail (6 endpoints)

| Method | Endpoint | Description | Workflow | Response |
|--------|----------|-------------|----------|----------|
| `POST` | `/api/orders` | Create order from cart | Cart → Order | `{ order_id, status, total }` |
| `GET` | `/api/orders/:id` | Order detail | Auth | `{ id, items[], status, total }` |
| `GET` | `/api/orders` | List user orders | Auth | `{ orders[], total }` |
| `GET` | `/api/orders/:id/full` | Order with relations | Auth | `{ order{}, items[], payments[] }` |
| `PUT` | `/api/orders/:id/cancel` | Cancel order | Auth + conditions | `{ order{} }` |
| `GET` | `/api/orders/:id/tracking` | Shipment tracking | Auth | `{ tracking_number, status, carrier }` |

#### Order Status & Workflow (5 endpoints)

| Method | Endpoint | Description | RBAC | States |
|--------|----------|-------------|------|--------|
| `PUT` | `/api/orders/:id/status` | Update order status | 7+ | `pending → processing → shipped → delivered` |
| `POST` | `/api/orders/:id/ship` | Mark as shipped | 7+ | `{ tracking_number, carrier }` |
| `POST` | `/api/orders/:id/deliver` | Mark as delivered | 7+ | `{ delivered_at }` |
| `POST` | `/api/orders/:id/complete` | Complete order | 7+ | `{ completed_at }` |
| `GET` | `/api/orders/workflow` | Workflow definition | Public | `{ states[], transitions[] }` |

#### Order Documents (3 endpoints)

| Method | Endpoint | Description | Format | Response |
|--------|----------|-------------|--------|----------|
| `GET` | `/api/orders/:id/invoice` | Generate invoice PDF | PDF | `application/pdf` |
| `GET` | `/api/orders/:id/receipt` | Payment receipt | PDF | `application/pdf` |
| `GET` | `/api/orders/:id/packing-slip` | Packing slip | PDF | `application/pdf` |

#### Admin & Reports (3 endpoints)

| Method | Endpoint | Description | RBAC | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/orders/admin` | List all orders (paginated) | 7+ | `{ orders[], total, filters{} }` |
| `GET` | `/api/orders/admin/stats` | Orders statistics | 7+ | `{ total, by_status{}, revenue{} }` |
| `POST` | `/api/orders/admin/export` | Export orders CSV | 7+ | `text/csv` |

**Spec:** [orders.md](./features/orders.md)

---

### Customers Module (17 endpoints)

#### Profile Management (5 endpoints)

| Method | Endpoint | Description | Auth | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/customers/profile` | Get customer profile | Required | `{ id, email, nom, prenom, ... }` |
| `PUT` | `/api/customers/profile` | Update profile | Required | `{ ...updatedProfile }` |
| `PUT` | `/api/customers/profile/email` | Change email | Required | `{ email }` |
| `PUT` | `/api/customers/profile/password` | Change password | Required | `204 No Content` |
| `DELETE` | `/api/customers/profile` | Delete account (GDPR) | Required | `204 No Content` |

#### Addresses (4 endpoints)

| Method | Endpoint | Description | Auth | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/customers/addresses` | List addresses | Required | `{ addresses[] }` |
| `POST` | `/api/customers/addresses` | Add address | Required | `{ address_id, ...address }` |
| `PUT` | `/api/customers/addresses/:id` | Update address | Required | `{ ...updatedAddress }` |
| `DELETE` | `/api/customers/addresses/:id` | Delete address | Required | `204 No Content` |

#### Orders History (3 endpoints)

| Method | Endpoint | Description | Auth | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/customers/orders` | Orders history | Required | `{ orders[], total }` |
| `GET` | `/api/customers/orders/:id` | Order detail | Required | `{ order{}, items[] }` |
| `GET` | `/api/customers/orders/stats` | Orders statistics | Required | `{ total_orders, total_spent }` |

#### Wishlist & Favorites (3 endpoints)

| Method | Endpoint | Description | Auth | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/customers/favorites` | List favorites | Required | `{ products[] }` |
| `POST` | `/api/customers/favorites/:pg_id` | Add to favorites | Required | `{ favorite_id }` |
| `DELETE` | `/api/customers/favorites/:pg_id` | Remove from favorites | Required | `204 No Content` |

#### GDPR Compliance (2 endpoints)

| Method | Endpoint | Description | Auth | Format |
|--------|----------|-------------|------|--------|
| `GET` | `/api/customers/gdpr/export` | Export personal data | Required | `application/json` (ZIP) |
| `POST` | `/api/customers/gdpr/delete-request` | Request account deletion | Required | `{ request_id, status }` |

**Spec:** [customers.md](./features/customers.md)

---

## 📝 CMS & Content (35+ endpoints)

### Blog Module (20+ endpoints)

#### Blog Homepage & Lists (6 endpoints)

| Method | Endpoint | Description | Cache | Response |
|--------|----------|-------------|-------|----------|
| `GET` | `/api/blog/homepage` | Homepage content | Hot 5000s | `{ featured[], recent[], popular[] }` |
| `GET` | `/api/blog/articles` | List articles (paginated) | Warm 1000s | `{ articles[], total, page }` |
| `GET` | `/api/blog/recent` | Recent articles | Warm 1000s | `{ articles[] }` |
| `GET` | `/api/blog/popular` | Popular articles | Hot 5000s | `{ articles[] }` |
| `GET` | `/api/blog/by-category/:category` | Articles by category | Warm 1000s | `{ articles[] }` |
| `GET` | `/api/blog/featured` | Featured articles | Hot 5000s | `{ articles[] }` |

#### Article Detail & Sections (7 endpoints)

| Method | Endpoint | Description | Cache | Response |
|--------|----------|-------------|-------|----------|
| `GET` | `/api/blog/article/:slug` | Article detail | Warm 1000s | `{ article{}, sections[], related[] }` |
| `GET` | `/api/blog/article/:slug/sections` | Article sections (H2/H3) | Warm 1000s | `{ h2[], h3[] }` |
| `GET` | `/api/blog/article/:slug/related` | Related articles | Warm 1000s | `{ articles[] }` |
| `GET` | `/api/blog/article/:slug/vehicles` | Compatible vehicles | 5min | `{ vehicles[] }` |
| `GET` | `/api/blog/article/:slug/seo` | SEO metadata | 1h | `{ title, description, keywords }` |
| `GET` | `/api/blog/article/:id/views` | View count | Real-time | `{ views: 12345 }` |
| `POST` | `/api/blog/article/:id/view` | Increment view count | - | `204 No Content` |

#### Search & Navigation (4 endpoints)

| Method | Endpoint | Description | Engine | Response |
|--------|----------|-------------|--------|----------|
| `GET` | `/api/blog/search` | Search articles | Meilisearch | `{ results[], total }` |
| `GET` | `/api/blog/autocomplete` | Search suggestions | Meilisearch | `{ suggestions[] }` |
| `GET` | `/api/blog/categories` | List categories | Hot 5000s | `{ categories[] }` |
| `GET` | `/api/blog/tags` | List tags | Warm 1000s | `{ tags[] }` |

#### Admin & Management (3+ endpoints)

| Method | Endpoint | Description | RBAC | Response |
|--------|----------|-------------|------|----------|
| `POST` | `/api/blog/admin/articles` | Create article | 7+ | `{ article_id }` |
| `PUT` | `/api/blog/admin/articles/:id` | Update article | 7+ | `{ ...updatedArticle }` |
| `DELETE` | `/api/blog/admin/articles/:id` | Delete article | 9+ | `204 No Content` |

**Spec:** [blog-module.md](./features/blog-module.md)

---

### Blog Metadata Module (5 endpoints)

| Method | Endpoint | Description | Cache | Response |
|--------|----------|-------------|-------|----------|
| `GET` | `/api/blog/metadata/:alias` | Get metadata by alias | 1h | `{ title, description, keywords, h1, breadcrumbs }` |
| `GET` | `/api/blog/metadata` | Get all metadata | 1h | `{ metadata[] }` |
| `GET` | `/api/blog/metadata/aliases` | List all aliases | 1h | `{ aliases[] }` |
| `DELETE` | `/api/blog/metadata/cache/:alias` | Clear cache for alias | Admin | `204 No Content` |
| `DELETE` | `/api/blog/metadata/cache` | Clear all metadata cache | Admin | `204 No Content` |

**Spec:** [blog-metadata-module.md](./features/blog-metadata-module.md)

**Exemples:**

```bash
# Get metadata for homepage
curl https://api.example.com/api/blog/metadata/home

# Get metadata for specific conseil
curl https://api.example.com/api/blog/metadata/conseil-entretien-batterie

# Clear cache (admin)
curl -X DELETE https://api.example.com/api/blog/metadata/cache/home \
  -H "Authorization: Bearer <admin_token>"
```

---

### AI Content Module (10 endpoints)

#### Content Generation (5 endpoints)

| Method | Endpoint | Description | Providers | Response |
|--------|----------|-------------|-----------|----------|
| `POST` | `/api/ai/generate` | Generate generic content | Multi | `{ content, provider, tokens }` |
| `POST` | `/api/ai/generate/product` | Product description | Multi | `{ description, seo{} }` |
| `POST` | `/api/ai/generate/seo` | SEO optimization | Multi | `{ title, description, keywords }` |
| `POST` | `/api/ai/generate/article` | Blog article draft | Multi | `{ title, content, sections[] }` |
| `POST` | `/api/ai/generate/summary` | Text summarization | Multi | `{ summary }` |

#### Provider Management (3 endpoints)

| Method | Endpoint | Description | RBAC | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/ai/providers` | List available providers | Public | `{ providers[] }` |
| `GET` | `/api/ai/providers/:provider/health` | Provider health check | Public | `{ status, latency, quota }` |
| `POST` | `/api/ai/providers/:provider/test` | Test provider | 7+ | `{ success, response }` |

#### Configuration & Monitoring (2 endpoints)

| Method | Endpoint | Description | RBAC | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/ai/config` | Get AI configuration | 7+ | `{ providers[], models[], limits{} }` |
| `PUT` | `/api/ai/config` | Update configuration | 9+ | `{ ...updatedConfig }` |

**Spec:** [ai-content-module.md](./features/ai-content-module.md)

---

## 📊 Analytics & Monitoring (24+ endpoints)

### Analytics Module (15+ endpoints)

#### Tracking & Events (7 endpoints)

| Method | Endpoint | Description | Providers | Response |
|--------|----------|-------------|-----------|----------|
| `GET` | `/track.js` | Tracking script (legacy PHP compat) | All | `application/javascript` |
| `GET` | `/track.min.js` | Minified tracking script | All | `application/javascript` |
| `POST` | `/track` | Track single event | All | `204 No Content` |
| `POST` | `/track.php` | Legacy PHP endpoint | All | `204 No Content` |
| `POST` | `/v7.track.php` | Legacy v7 endpoint | All | `204 No Content` |
| `POST` | `/api/analytics/events` | Track event (modern API) | All | `{ event_id }` |
| `POST` | `/api/analytics/events/batch` | Batch track events | All | `{ processed: 50 }` |

#### Metrics & Reports (5 endpoints)

| Method | Endpoint | Description | RBAC | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/analytics/metrics` | Get metrics | 7+ | `{ pageviews, users, sessions }` |
| `GET` | `/api/analytics/metrics/:metric` | Specific metric | 7+ | `{ value, trend }` |
| `GET` | `/api/analytics/report/daily` | Daily report | 7+ | `{ date, metrics{} }` |
| `GET` | `/api/analytics/report/weekly` | Weekly report | 7+ | `{ week, metrics{} }` |
| `GET` | `/api/analytics/report/monthly` | Monthly report | 7+ | `{ month, metrics{} }` |

#### Admin & Configuration (3+ endpoints)

| Method | Endpoint | Description | RBAC | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/analytics/config` | Get config | 7+ | `{ providers[], enabled{} }` |
| `PUT` | `/api/analytics/config` | Update config | 9+ | `{ ...updatedConfig }` |
| `GET` | `/api/analytics/health` | Health check | Public | `{ providers[], status{} }` |

**Spec:** [analytics-module.md](./features/analytics-module.md)

---

### Dashboard Module (9 endpoints)

#### KPIs & Overview (4 endpoints)

| Method | Endpoint | Description | RBAC | Refresh |
|--------|----------|-------------|------|---------|
| `GET` | `/api/dashboard/overview` | Dashboard overview | 7+ | 5min |
| `GET` | `/api/dashboard/kpis` | Key performance indicators | 7+ | 5min |
| `GET` | `/api/dashboard/summary` | Summary statistics | 7+ | 5min |
| `GET` | `/api/dashboard/health` | System health | 7+ | Real-time |

#### Orders & Revenue (3 endpoints)

| Method | Endpoint | Description | RBAC | Period |
|--------|----------|-------------|------|--------|
| `GET` | `/api/dashboard/orders/stats` | Orders statistics | 7+ | Date range |
| `GET` | `/api/dashboard/revenue` | Revenue tracking | 7+ | Date range |
| `GET` | `/api/dashboard/revenue/forecast` | Revenue forecast | 9+ | Next 30 days |

#### Products & Inventory (2 endpoints)

| Method | Endpoint | Description | RBAC | Response |
|--------|----------|-------------|------|----------|
| `GET` | `/api/dashboard/products/top` | Top selling products | 7+ | `{ products[], sales{} }` |
| `GET` | `/api/dashboard/inventory/alerts` | Inventory alerts | 7+ | `{ low_stock[], out_of_stock[] }` |

**Spec:** [dashboard-module.md](./features/dashboard-module.md)

---

## 🔍 Recherche par Fonctionnalité

### 🔐 Authentication

| Fonctionnalité | Endpoint | Module |
|----------------|----------|--------|
| Login | `POST /authenticate` | Auth |
| Register | `POST /register-and-login` | Auth |
| Logout | `POST /logout` | Auth |
| Get profile | `GET /profile` | Auth |
| Update profile | `PUT /profile` | Auth |
| Change password | `PUT /profile/password` | Auth |

### 🛒 Shopping Experience

| Fonctionnalité | Endpoint | Module |
|----------------|----------|--------|
| Search products | `GET /api/products/search` | Products |
| Product detail | `GET /api/products/:pg_id` | Products |
| Check stock | `GET /api/products/:pg_id/stock` | Products |
| Add to cart | `POST /api/cart/items` | Cart |
| View cart | `GET /api/cart` | Cart |
| Apply promo | `POST /api/cart/promo/apply` | Cart |
| Checkout | `POST /api/payments/init` | Payments |
| Create order | `POST /api/orders` | Orders |

### 📊 Admin Operations

| Fonctionnalité | Endpoint | Module |
|----------------|----------|--------|
| Stock dashboard | `GET /api/admin/stock/dashboard` | Admin |
| Update stock | `PUT /api/admin/stock/:pg_id` | Admin |
| User management | `GET /api/admin/users` | Admin |
| Orders admin | `GET /api/orders/admin` | Orders |
| Analytics | `GET /api/dashboard/overview` | Dashboard |
| Export reports | `GET /api/admin/reporting/export/:type` | Admin |

### 📝 Content Management

| Fonctionnalité | Endpoint | Module |
|----------------|----------|--------|
| Blog homepage | `GET /api/blog/homepage` | Blog |
| Article detail | `GET /api/blog/article/:slug` | Blog |
| Search articles | `GET /api/blog/search` | Blog |
| SEO metadata | `GET /api/blog/metadata/:alias` | Blog Metadata |
| Generate content | `POST /api/ai/generate/product` | AI Content |

### 📦 Order Management

| Fonctionnalité | Endpoint | Module |
|----------------|----------|--------|
| Order history | `GET /api/customers/orders` | Customers |
| Order detail | `GET /api/orders/:id` | Orders |
| Track shipment | `GET /api/orders/:id/tracking` | Orders |
| Download invoice | `GET /api/orders/:id/invoice` | Orders |
| Cancel order | `PUT /api/orders/:id/cancel` | Orders |
| Return order | `POST /api/orders/:id/return` | Orders |

### 👤 Customer Account

| Fonctionnalité | Endpoint | Module |
|----------------|----------|--------|
| Profile | `GET /api/customers/profile` | Customers |
| Addresses | `GET /api/customers/addresses` | Customers |
| Order history | `GET /api/customers/orders` | Customers |
| RGPD export | `GET /api/customers/gdpr/export` | Customers |
| Delete account | `POST /api/customers/gdpr/delete-request` | Customers |

### 📈 Analytics & Monitoring

| Fonctionnalité | Endpoint | Module |
|----------------|----------|--------|
| Track event | `POST /api/analytics/events` | Analytics |
| Get metrics | `GET /api/analytics/metrics` | Analytics |
| Dashboard KPIs | `GET /api/dashboard/kpis` | Dashboard |
| Orders stats | `GET /api/dashboard/orders/stats` | Dashboard |
| Revenue report | `GET /api/dashboard/revenue` | Dashboard |

---

## 📋 Index par Méthode HTTP

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
- `/api/products/:pg_id` - Product detail
- `/api/products/:pg_id/compatibility` - Vehicle compatibility
- `/api/products/:pg_id/alternatives` - Alternatives

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

### POST Endpoints (40+)

**Authentication:**
- `/authenticate` - Login
- `/register-and-login` - Register & login

**Products & Search:**
- `/api/products/search/advanced` - Advanced search
- `/api/products/filter` - Filter products
- `/api/products/prices` - Batch pricing
- `/api/products/check-compatibility` - Check compatibility

**Cart:**
- `/api/cart/items` - Add item
- `/api/cart/promo/apply` - Apply promo
- `/api/cart/merge` - Merge carts
- `/api/cart/validate` - Validate cart

**Payments & Orders:**
- `/api/payments/init` - Initialize payment
- `/api/payments/paybox/callback` - Paybox callback
- `/api/orders` - Create order

**Admin Operations:**
- `/api/admin/stock/reserve` - Reserve stock
- `/api/admin/reporting/schedule` - Schedule report

**AI & Analytics:**
- `/api/ai/generate` - Generate content
- `/api/ai/generate/product` - Product description
- `/api/analytics/events` - Track event
- `/api/analytics/events/batch` - Batch track

### PUT Endpoints (20+)

**Profile & Account:**
- `/profile` - Update profile
- `/profile/password` - Change password
- `/api/customers/profile` - Update customer profile
- `/api/customers/addresses/:id` - Update address

**Cart:**
- `/api/cart/items/:id` - Update quantity
- `/api/cart/shipping/select` - Select shipping

**Admin:**
- `/api/admin/stock/:pg_id` - Update stock
- `/api/admin/users/:id` - Update user
- `/api/admin/users/:id/level` - Update RBAC level
- `/api/admin/products/:pg_id` - Update product
- `/api/orders/:id/status` - Update order status

### DELETE Endpoints (15+)

**Cart:**
- `/api/cart/items/:id` - Remove item
- `/api/cart/promo/remove` - Remove promo

**Admin:**
- `/api/admin/stock/reservations/:id` - Delete reservation
- `/api/admin/users/:id` - Delete user

**Cache Management:**
- `/api/blog/metadata/cache/:alias` - Clear metadata cache
- `/api/blog/metadata/cache` - Clear all metadata cache

**RGPD:**
- `/api/customers/profile` - Delete account
- `/api/customers/addresses/:id` - Delete address

---

## 🔍 Recherche Rapide par Cas d'Usage

**Je veux afficher les produits d'une famille:**
```
GET /api/catalog/famille/:id_famille/gammes
→ GET /api/catalog/gamme/:pg_id/products
```

**Je veux chercher un produit par texte:**
```
GET /api/products/search?q=filtre+à+huile&limit=20
```

**Je veux filtrer par véhicule:**
```
POST /api/products/filter
Body: { "vehicle_id": 12345 }
```

**Je veux ajouter au panier:**
```
POST /api/cart/items
Body: { "pg_id": "PG123", "quantity": 2 }
```

**Je veux appliquer un code promo:**
```
POST /api/cart/promo/apply
Body: { "code": "PROMO10" }
```

**Je veux payer:**
```
POST /api/payments/init
Body: { "cart_id": "xxx", "amount": 15900, "currency": "EUR" }
```

**Je veux créer la commande:**
```
POST /api/orders
Body: { "payment_id": "pay123" }
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
GET /api/customers/gdpr/export
→ Retourne JSON (ZIP)
```

---

## 🎨 Conventions API

### Format des Réponses

#### Success Response

```json
{
  "data": { ...data },
  "meta": {
    "timestamp": "2025-11-18T10:30:00Z",
    "version": "1.0.0"
  }
}
```

#### Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  },
  "meta": {
    "timestamp": "2025-11-18T10:30:00Z"
  }
}
```

#### Paginated Response

```json
{
  "data": [ ...items ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

### Headers Standards

#### Request Headers

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
Accept: application/json
X-Request-ID: <uuid>
```

#### Response Headers

```
Content-Type: application/json
X-Request-ID: <uuid>
X-Cache-Hit: true/false
X-Response-Time: 123ms
```

---

### Query Parameters Conventions

| Paramètre | Type | Description | Exemple |
|-----------|------|-------------|---------|
| `page` | integer | Page number (1-indexed) | `?page=2` |
| `limit` | integer | Items per page | `?limit=20` |
| `sort` | string | Sort field | `?sort=created_at` |
| `order` | enum | Sort direction (asc/desc) | `?order=desc` |
| `filter` | object | Filters | `?filter[status]=active` |
| `search` | string | Search query | `?search=batterie` |
| `include` | string | Relations to include | `?include=products,reviews` |

---

### Rate Limiting

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| **Public** | 100 req/min | Per IP |
| **Authenticated** | 300 req/min | Per user |
| **Admin** | 1000 req/min | Per user |
| **Search** | 60 req/min | Per IP |
| **Auth (login)** | 5 attempts | Per 15min |

**Headers:**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1700385600
```

---

### Cache Headers

```
Cache-Control: public, max-age=300
ETag: "abc123def456"
Last-Modified: Mon, 18 Nov 2025 10:00:00 GMT
```

**Cache Strategies:**

- **Hot**: TTL 5000s (blog populaire, catalog hiérarchie)
- **Warm**: TTL 1000s (articles récents, produits actifs)
- **Cold**: TTL 600s (listes générales, métadonnées)
- **No cache**: Stock temps réel, paiements, sessions

---

## 📚 Exemples d'Utilisation

### Flow E-commerce Complet

```bash
# 1. Rechercher un produit
curl "https://api.example.com/api/products/search?q=batterie%20voiture"

# 2. Obtenir le détail du produit
curl "https://api.example.com/api/products/PG12345"

# 3. Vérifier le stock
curl "https://api.example.com/api/products/PG12345/stock"

# 4. Ajouter au panier
curl -X POST "https://api.example.com/api/cart/items" \
  -H "Authorization: Bearer <token>" \
  -d '{"pg_id": "PG12345", "quantity": 2}'

# 5. Appliquer un code promo
curl -X POST "https://api.example.com/api/cart/promo/apply" \
  -H "Authorization: Bearer <token>" \
  -d '{"code": "WELCOME10"}'

# 6. Initialiser le paiement
curl -X POST "https://api.example.com/api/payments/init" \
  -H "Authorization: Bearer <token>" \
  -d '{"cart_id": "cart123", "amount": 15900}'

# 7. Créer la commande (après succès paiement)
curl -X POST "https://api.example.com/api/orders" \
  -H "Authorization: Bearer <token>" \
  -d '{"payment_id": "pay123"}'

# 8. Obtenir la facture PDF
curl "https://api.example.com/api/orders/order123/invoice" \
  -H "Authorization: Bearer <token>" \
  -o facture.pdf
```

---

### Flow Admin

```bash
# 1. Dashboard overview
curl "https://api.example.com/api/dashboard/overview" \
  -H "Authorization: Bearer <admin_token>"

# 2. Stock dashboard
curl "https://api.example.com/api/admin/stock/dashboard" \
  -H "Authorization: Bearer <admin_token>"

# 3. Update stock
curl -X PUT "https://api.example.com/api/admin/stock/PG12345" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"stock_total": 50, "stock_disponible": 45}'

# 4. Orders statistics
curl "https://api.example.com/api/dashboard/orders/stats?from=2025-01-01&to=2025-12-31" \
  -H "Authorization: Bearer <admin_token>"

# 5. Export orders CSV
curl "https://api.example.com/api/orders/admin/export" \
  -H "Authorization: Bearer <admin_token>" \
  -o orders.csv
```

---

## 🚀 Performance Tips

### Optimiser les Requêtes

1. **Utiliser les paramètres `include`** pour éviter les N+1 queries:
   ```bash
   GET /api/products/PG123?include=prices,stock,related
   ```

2. **Paginer les listes** pour limiter le payload:
   ```bash
   GET /api/products?page=1&limit=20
   ```

3. **Utiliser les endpoints bulk** pour les opérations multiples:
   ```bash
   POST /api/products/prices
   Body: {"pg_ids": ["PG1", "PG2", "PG3"]}
   ```

4. **Activer la compression** avec `Accept-Encoding: gzip`:
   ```bash
   curl -H "Accept-Encoding: gzip" https://api.example.com/api/products
   ```

5. **Utiliser les ETags** pour le cache client:
   ```bash
   curl -H "If-None-Match: abc123def456" https://api.example.com/api/catalog/hierarchy
   ```

---

## 📖 Ressources

### Documentation Liée

- **Main README**: [README.md](./README.md) - Navigation principale
- **Coverage Report**: [CRITICAL-MODULES-REPORT.md](./features/CRITICAL-MODULES-REPORT.md) - Rapport de couverture
- **Architecture Diagrams**: [ARCHITECTURE-DIAGRAMS.md](./ARCHITECTURE-DIAGRAMS.md) - Diagrammes Mermaid (à créer)
- **Quick Start**: [QUICK-START-DEV.md](./QUICK-START-DEV.md) - Guide onboarding (à créer)

### Specs Complètes par Module

Chaque endpoint est documenté en détail dans sa spec module respective :

- [auth-module.md](./features/auth-module.md)
- [admin-module.md](./features/admin-module.md)
- [catalog-module.md](./features/catalog-module.md)
- [products.md](./features/products.md)
- [cart.md](./features/cart.md)
- [payments.md](./features/payments.md)
- [orders.md](./features/orders.md)
- [customers.md](./features/customers.md)
- [blog-module.md](./features/blog-module.md)
- [blog-metadata-module.md](./features/blog-metadata-module.md)
- [ai-content-module.md](./features/ai-content-module.md)
- [analytics-module.md](./features/analytics-module.md)
- [dashboard-module.md](./features/dashboard-module.md)

---

**Made with ❤️ by Backend Team**  
**API Reference v1.0.0 - 2025-11-18**
