---
title: "Products Module - Core CRUD & Business Logic"
status: implemented
version: 2.0.0
authors: [Backend Team]
created: 2025-11-18
updated: 2025-11-18
relates-to:
  - ./product-catalog.md
  - ./stock-management.md
  - ../architecture/001-supabase-direct.md
tags: [products, crud, business-logic, pricing, filtering, cross-selling, consolidated, critical]
priority: critical
coverage:
  modules: [products]
  routes: [/api/products/*, /api/products/filters/*, /api/cross-selling/*]
  services: [ProductsService, ProductEnhancementService, ProductFilteringService, PricingService, CrossSellingService, StockService]
---

# Products Module - Core CRUD & Business Logic

## 📝 Overview

Module backend **consolidé** (Phase 2 & 3 achevées) gérant le CRUD des produits automobile, le pricing, les filtres avancés, le cross-selling et la gestion stock. Architecture modulaire Domain-Driven avec **6 services spécialisés** et **3 controllers** optimisés.

**Consolidation réalisée** :
- Services : 13 → 6 (-54%)
- Controllers : 8 → 3 (-63%)
- Code : 8,190 → 4,137 lignes (-49%)
- Duplication : 49% → 0%

**Tables gérées** :
- `pieces` (produits principaux, 400k+)
- `pieces_gamme` (catégories/gammes)
- `pieces_marque` (marques de pièces)
- Liens véhicules : `auto_marque`, `auto_modele`, `auto_type`

## 🎯 Goals

### Objectifs Principaux

1. **CRUD performant** : Création, lecture, modification, suppression produits (< 200ms)
2. **Filtrage avancé** : Multi-critères (gamme, marque, prix, stock, véhicule)
3. **Pricing flexible** : Calcul prix TTC/HT, remises, prix par référence
4. **Cross-selling intelligent** : Recommandations "souvent acheté ensemble"
5. **Stock temps réel** : Validation disponibilité, alertes réapprovisionnement
6. **Admin-friendly** : Interface commerciale pour gestion catalogue (level 3+)

### Objectifs Secondaires

- Enrichissement produits (images, descriptions, specs techniques)
- Debug endpoints pour diagnostics production
- Cache Redis intégré (TTL 5min endpoints fréquents)
- Validation Zod stricte sur tous les DTOs

## 🚫 Non-Goals

- **Search full-text** : Délégué à module `search` (Meilisearch)
- **Reviews/ratings** : Module `reviews` séparé
- **Inventory physical** : Module `stock-management` dédié
- **Suppliers** : Module `suppliers` séparé
- **Orders** : Module `orders` séparé

## 🏗️ Architecture

### Services Consolidés (6)

```typescript
ProductsModule
├── ProductsService                  // CRUD principal, queries DB
├── ProductEnhancementService        // Enrichissement (images, descriptions)
├── ProductFilteringService          // Filtres multi-critères
├── PricingService                   // Calcul prix, recherche référence
├── CrossSellingService              // Recommandations produits
└── StockService                     // Gestion stock, alertes réappro
```

### Controllers Consolidés (3)

```typescript
├── ProductsController           // /api/products/* - CRUD + admin
├── FilteringController          // /api/products/filters/* - Filtres listes
└── CrossSellingController       // /api/cross-selling/* - Recommandations
```

### DTOs Zod Validés

```typescript
CreateProductDto       // Création produit (name, sku, price, etc.)
UpdateProductDto       // Mise à jour partielle
SearchProductDto       // Recherche + pagination
UpdateStockDto         // Mise à jour stock
VehicleSearchDto       // Recherche par véhicule (brandId, modelId, typeId)
PopularProductsDto     // Produits populaires (limit)
```

## 📊 Data Model

### Table `pieces` (PostgreSQL - Supabase)

```sql
CREATE TABLE pieces (
  piece_id          SERIAL PRIMARY KEY,
  piece_name        VARCHAR(255) NOT NULL,         -- Nom produit
  piece_ref         VARCHAR(100),                  -- Référence constructeur
  piece_ref_brut    VARCHAR(100),                  -- Référence brute
  piece_des         TEXT,                          -- Description
  piece_price       DECIMAL(10,2),                 -- Prix HT
  piece_stock       INTEGER DEFAULT 0,             -- Stock disponible
  piece_gamme_id    INTEGER REFERENCES pieces_gamme(gamme_id),
  piece_pm_id       INTEGER REFERENCES pieces_marque(marque_id),
  piece_activ       BOOLEAN DEFAULT true,          -- Produit actif
  piece_display     BOOLEAN DEFAULT true,          -- Affichable frontend
  piece_has_img     BOOLEAN DEFAULT false,         -- A des images
  piece_has_oem     BOOLEAN DEFAULT false,         -- A des références OEM
  piece_year        INTEGER,                       -- Année introduction
  piece_top         BOOLEAN DEFAULT false,         -- Produit top ventes
  
  -- Indexes pour performances
  INDEX idx_pieces_gamme (piece_gamme_id),
  INDEX idx_pieces_marque (piece_pm_id),
  INDEX idx_pieces_ref (piece_ref),
  INDEX idx_pieces_activ (piece_activ),
  INDEX idx_pieces_name (piece_name)
);
```

### Table `pieces_gamme` (Catégories)

```sql
CREATE TABLE pieces_gamme (
  gamme_id          SERIAL PRIMARY KEY,
  gamme_name        VARCHAR(255) NOT NULL,
  gamme_description TEXT,
  gamme_parent_id   INTEGER REFERENCES pieces_gamme(gamme_id), -- Hiérarchie
  gamme_order       INTEGER DEFAULT 0
);
```

### Table `pieces_marque` (Marques pièces)

```sql
CREATE TABLE pieces_marque (
  marque_id         SERIAL PRIMARY KEY,
  marque_name       VARCHAR(255) NOT NULL,
  marque_logo       VARCHAR(500)                   -- URL logo
);
```

## 🔌 API Endpoints

### ProductsController (`/api/products`)

#### 1. GET `/api/products` - Liste produits

**Query Params:**
```typescript
{
  search?: string;        // Recherche nom/ref
  rangeId?: number;       // Filtre gamme
  brandId?: number;       // Filtre marque
  page?: number;          // Pagination (défaut: 1)
  limit?: number;         // Limite (défaut: 24, max: 100)
  sortBy?: string;        // Tri: name|price|stock (défaut: name)
  sortOrder?: 'asc'|'desc'; // Ordre tri
}
```

**Response:**
```json
{
  "data": [
    {
      "piece_id": 123,
      "piece_name": "Plaquettes de frein avant",
      "piece_ref": "FDB1234",
      "piece_price": 45.99,
      "piece_stock": 23,
      "piece_activ": true,
      "pieces_gamme": {
        "gamme_id": 7,
        "gamme_name": "Freinage"
      },
      "pieces_marque": {
        "marque_id": 12,
        "marque_name": "Bosch"
      }
    }
  ],
  "total": 1234,
  "page": 1,
  "limit": 24,
  "totalPages": 52
}
```

**Cache:** Redis 5 min  
**Performance:** < 150ms (p95)

---

#### 2. GET `/api/products/:id` - Détail produit

**Response:**
```json
{
  "piece_id": 123,
  "piece_name": "Plaquettes de frein avant",
  "piece_ref": "FDB1234",
  "piece_des": "Plaquettes haute performance...",
  "piece_price": 45.99,
  "piece_stock": 23,
  "piece_activ": true,
  "stock": {
    "available": 23,
    "reserved": 0,
    "total": 23,
    "status": "in_stock"
  },
  "pieces_gamme": { ... },
  "pieces_marque": { ... }
}
```

**Logique:**
1. Fetch produit par `piece_id`
2. Fetch stock via `StockService.getProductStock()`
3. Si erreur stock, retourner valeurs par défaut (available: 0, status: 'out_of_stock')

**Cache:** Redis 5 min  
**Performance:** < 100ms (p95)

---

#### 3. POST `/api/products` - Créer produit

**Body (Zod validated):**
```json
{
  "name": "Filtre à huile",
  "sku": "FIL-OIL-001",
  "description": "Filtre à huile premium",
  "price": 12.99,
  "stock_quantity": 100,
  "range_id": 15,
  "brand_id": 8,
  "is_active": true
}
```

**Response:**
```json
{
  "id": "456",
  "message": "Produit créé avec succès"
}
```

**Validation:**
- `name` : requis, 3-255 chars
- `sku` : requis, unique, 3-100 chars
- `price` : optionnel, > 0
- `stock_quantity` : optionnel, >= 0

**Erreurs:**
- 400 : Validation failed (Zod errors)
- 409 : SKU déjà existant
- 500 : Database error

---

#### 4. PUT `/api/products/:id` - Mettre à jour produit

**Body (Zod validated - partial):**
```json
{
  "name": "Filtre à huile premium",
  "price": 14.99,
  "stock_quantity": 80
}
```

**Response:**
```json
{
  "id": "456",
  "message": "Produit mis à jour avec succès"
}
```

---

#### 5. DELETE `/api/products/:id` - Supprimer produit

**Logique:** Soft delete (`piece_activ = false`)

**Response:**
```json
{
  "message": "Produit supprimé avec succès"
}
```

---

#### 6. PUT `/api/products/:id/stock` - Mettre à jour stock

**Body:**
```json
{
  "quantity": 50
}
```

**Response:**
```json
{
  "id": "456",
  "stock": 50,
  "message": "Stock mis à jour"
}
```

---

#### 7. GET `/api/products/search` - Recherche simple

**Query Params:**
```typescript
{
  query: string;          // Min 2 chars
  limit?: number;         // Défaut: 10, max: 50
}
```

**Response:**
```json
{
  "results": [
    {
      "piece_id": 789,
      "piece_name": "Plaquettes de frein arrière",
      "piece_ref": "FDB5678",
      "piece_price": 38.50,
      "piece_stock": 15
    }
  ]
}
```

**Logique:**
- Recherche `ILIKE` sur `piece_name`, `piece_ref`, `piece_des`
- Cache : 1 min
- Performance : < 100ms

---

#### 8. GET `/api/products/search/vehicle` - Recherche par véhicule

**Query Params:**
```typescript
{
  brandId: number;        // ID marque auto (auto_marque)
  modelId?: number;       // ID modèle (auto_modele)
  typeId?: number;        // ID type moteur (auto_type)
}
```

**Response:**
```json
{
  "results": [
    {
      "piece_id": 321,
      "piece_name": "Disque de frein avant",
      "compatible_vehicles": [
        { "brand": "Renault", "model": "Clio III", "type": "1.5 dCi" }
      ]
    }
  ]
}
```

**Logique:**
- Jointures sur tables de compatibilité véhicule-pièce
- Filtre par marque obligatoire, modèle/type optionnels

---

#### 9. GET `/api/products/gammes/:gammeId/products` - Produits par gamme

**Query Params:** Idem GET `/api/products`

**Response:** Idem GET `/api/products` mais filtré sur `piece_gamme_id`

**Cache:** 5 min  
**Performance:** < 150ms

---

#### 10. GET `/api/products/brands` - Liste marques

**Response:**
```json
{
  "brands": [
    { "marque_id": 1, "marque_name": "Bosch", "marque_logo": "https://..." },
    { "marque_id": 2, "marque_name": "Valeo", "marque_logo": "https://..." }
  ]
}
```

**Cache:** 10 min

---

#### 11. GET `/api/products/gammes` - Liste gammes

**Response:**
```json
{
  "gammes": [
    { "gamme_id": 7, "gamme_name": "Freinage", "gamme_description": "..." },
    { "gamme_id": 12, "gamme_name": "Filtration", "gamme_description": "..." }
  ]
}
```

**Cache:** 10 min

---

#### 12. GET `/api/products/brands/:brandId/models` - Modèles d'une marque

**Response:**
```json
{
  "models": [
    { "modele_id": 123, "modele_name": "Clio III" },
    { "modele_id": 124, "modele_name": "Megane II" }
  ]
}
```

**Cache:** 10 min

---

#### 13. GET `/api/products/models/:modelId/types` - Types d'un modèle

**Response:**
```json
{
  "types": [
    { "type_id": 19052, "type_name": "1.5 dCi", "type_annee": "2005-2012" },
    { "type_id": 55593, "type_name": "1.2 TCe", "type_annee": "2012-2019" }
  ]
}
```

**Cache:** 10 min

---

#### 14. GET `/api/products/search/:reference` - Recherche par référence

**Params:**
- `reference` : Référence constructeur (ex: "KTBWP8841")

**Response:**
```json
{
  "piece_id": 456,
  "piece_name": "Kit de distribution",
  "piece_ref": "KTBWP8841",
  "piece_price": 129.99,
  "price_ht": 108.32,
  "price_ttc": 129.99,
  "tva_rate": 20
}
```

**Cache:** 5 min

---

#### 15. GET `/api/products/popular` - Produits populaires

**Query Params:**
```typescript
{
  limit?: number;         // Défaut: 10
}
```

**Response:**
```json
{
  "products": [
    { "piece_id": 123, "piece_name": "Filtre à huile", "piece_top": true, ... }
  ]
}
```

**Logique:** Tri par `piece_top = true` puis `piece_stock DESC`

**Cache:** 5 min

---

#### 16. GET `/api/products/inventory/reorder-list` - Liste réapprovisionnement

**Response:**
```json
{
  "success": true,
  "count": 23,
  "items": [
    {
      "piece_id": 789,
      "piece_name": "Filtre à air",
      "piece_stock": 2,
      "reorder_threshold": 10,
      "recommended_quantity": 50
    }
  ]
}
```

**Logique:** `piece_stock < reorder_threshold`

**Cache:** 1 min

---

#### 17. GET `/api/products/inventory/report` - Rapport inventaire

**Response:**
```json
{
  "success": true,
  "report": {
    "total_products": 400000,
    "in_stock": 385000,
    "low_stock": 12000,
    "out_of_stock": 3000,
    "total_value_ht": 12500000.00,
    "total_value_ttc": 15000000.00
  }
}
```

**Cache:** 5 min  
**Performance:** < 500ms (aggregate queries)

---

#### 18. POST `/api/products/inventory/restock/:id` - Simuler réapprovisionnement

**Body:**
```json
{
  "quantity": 100
}
```

**Response:**
```json
{
  "success": true,
  "message": "Réapprovisionnement de 100 unités effectué",
  "productId": 789
}
```

**Logique:** Ajouter `quantity` au `piece_stock` existant

---

#### 19. GET `/api/products/admin/list` - Interface commerciale (Admin)

**Access:** Nécessite `level >= 3` (Commercial/Admin)

**Query Params:**
```typescript
{
  search?: string;
  page?: number;
  limit?: number;          // Défaut: 50
  sortBy?: string;
  sortOrder?: 'asc'|'desc';
  isActive?: boolean;      // Filtre actif/inactif
  lowStock?: boolean;      // Si true, filtre stock < 10
  gammeId?: number;
  brandId?: number;
  categoryId?: number;     // Alias pour gammeId
}
```

**Response:**
```json
{
  "products": [
    {
      "piece_id": 123,
      "piece_name": "Plaquettes de frein",
      "piece_ref": "FDB1234",
      "piece_price": 45.99,
      "piece_stock": 23,
      "piece_activ": true,
      "gamme_name": "Freinage",
      "marque_name": "Bosch"
    }
  ],
  "pagination": {
    "total": 1234,
    "page": 1,
    "limit": 50,
    "totalPages": 25
  }
}
```

**Cache:** 1 min  
**Performance:** < 200ms

---

#### 20. PUT `/api/products/:id/status` - Toggle activation produit

**Access:** Admin uniquement

**Body:**
```json
{
  "isActive": false
}
```

**Response:**
```json
{
  "id": "456",
  "piece_activ": false,
  "message": "Produit désactivé"
}
```

---

### FilteringController (`/api/products/filters`)

#### 21. GET `/api/products/filters/lists` - Listes pour dropdowns

**Query Params:**
```typescript
{
  gammeId?: number;       // Filtre dynamique marques par gamme
  brandId?: number;       // Filtre dynamique gammes par marque
}
```

**Response:**
```json
{
  "gammes": [
    { "gamme_id": 7, "gamme_name": "Freinage", "product_count": 12000 }
  ],
  "brands": [
    { "marque_id": 12, "marque_name": "Bosch", "product_count": 23000 }
  ]
}
```

**Logique filtrage dynamique:**
- Si SEULEMENT `gammeId` : retourner marques ayant produits dans cette gamme
- Si SEULEMENT `brandId` : retourner gammes ayant produits de cette marque
- Si les deux OU aucun : retourner listes complètes

**Cache:** 10 min  
**Performance:** < 100ms

---

### CrossSellingController (`/api/cross-selling`)

#### 22. GET `/api/cross-selling/recommendations/:productId` - Recommandations

**Query Params:**
```typescript
{
  limit?: number;         // Défaut: 6
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "piece_id": 789,
      "piece_name": "Disque de frein arrière",
      "piece_price": 55.00,
      "reason": "frequently_bought_together"
    }
  ]
}
```

**Logique:**
1. Produits même gamme
2. Produits achetés ensemble (historique commandes)
3. Produits prix similaire

**Cache:** 5 min

---

### Debug Endpoints (Production uniquement si ENV=development)

#### 23. GET `/api/products/debug/tables` - Vérifier contenu tables

**Response:** Samples de toutes les tables liées produits

---

#### 24. GET `/api/products/debug-real-data` - Analyser structure données

**Response:** Structure réelle + types colonnes

---

#### 25. GET `/api/products/debug-stock-distribution` - Distribution stocks

**Response:** Histogramme répartition stocks

---

#### 26. GET `/api/products/debug-piece-activ` - Diagnostic piece_activ

**Response:** Tests valeurs booléennes (0/1, true/false, '0'/'1')

---

## 🔒 Security

### Authentication

- **Endpoints publics** : GET (lecture seule)
- **Endpoints protégés** :
  - POST, PUT, DELETE : Nécessite JWT token + `role: admin` OU `level >= 3`
  - Admin endpoints (`/admin/*`) : `level >= 3`

### Validation

- **Tous les DTOs** validés avec Zod schemas
- **SQL Injection** : Protection via Supabase PostgREST (parameterized queries)
- **XSS** : Sanitization descriptions HTML (DOMPurify côté frontend)

### Rate Limiting

- **Endpoints publics** : 100 req/min/IP
- **Endpoints admin** : 500 req/min/user

---

## 📈 Performance

### Objectifs

| Endpoint | Target P95 | Cache TTL |
|----------|-----------|-----------|
| GET /products | < 150ms | 5 min |
| GET /products/:id | < 100ms | 5 min |
| POST /products | < 200ms | N/A |
| PUT /products/:id | < 200ms | N/A |
| DELETE /products/:id | < 100ms | N/A |
| GET /search | < 100ms | 1 min |
| GET /filters/lists | < 100ms | 10 min |
| GET /cross-selling/recommendations | < 150ms | 5 min |

### Optimisations

1. **Cache Redis** : `CacheInterceptor` NestJS sur endpoints GET fréquents
2. **Indexes DB** : Sur `piece_gamme_id`, `piece_pm_id`, `piece_ref`, `piece_name`
3. **Pagination obligatoire** : Limite 100 produits/page max
4. **Lazy loading** : Images chargées on-demand
5. **Select specific columns** : Éviter `SELECT *` sauf debug

---

## 🧪 Tests

### Coverage Targets

- **Unit tests** : ≥ 80% (services)
- **Integration tests** : ≥ 60% (controllers + DB)
- **E2E tests** : Flows critiques uniquement

### Tests Prioritaires

#### ProductsService

```typescript
describe('ProductsService', () => {
  it('should find all products with pagination', async () => {
    const result = await service.findAll({ page: 1, limit: 24 });
    expect(result.data).toHaveLength(24);
    expect(result.total).toBeGreaterThan(0);
  });

  it('should find product by id with stock info', async () => {
    const product = await service.findOne('123');
    expect(product.piece_id).toBe(123);
    expect(product.stock).toBeDefined();
  });

  it('should throw 404 if product not found', async () => {
    await expect(service.findOne('999999')).rejects.toThrow('Product not found');
  });

  it('should create product with valid DTO', async () => {
    const dto: CreateProductDto = {
      name: 'Test Product',
      sku: 'TEST-001',
      price: 19.99,
    };
    const result = await service.create(dto);
    expect(result.id).toBeDefined();
  });

  it('should reject duplicate SKU', async () => {
    const dto: CreateProductDto = {
      name: 'Duplicate',
      sku: 'EXISTING-SKU',
      price: 9.99,
    };
    await expect(service.create(dto)).rejects.toThrow('SKU already exists');
  });
});
```

#### PricingService

```typescript
describe('PricingService', () => {
  it('should calculate TTC from HT price', () => {
    const priceHT = 100;
    const tvaRate = 20;
    const priceTTC = service.calculatePriceTTC(priceHT, tvaRate);
    expect(priceTTC).toBe(120);
  });

  it('should search product by reference', async () => {
    const result = await service.searchByReference('FDB1234');
    expect(result.piece_ref).toBe('FDB1234');
    expect(result.price_ttc).toBeGreaterThan(result.price_ht);
  });
});
```

#### StockService

```typescript
describe('StockService', () => {
  it('should return stock info for product', async () => {
    const stock = await service.getProductStock('123');
    expect(stock.available).toBeGreaterThanOrEqual(0);
    expect(stock.status).toMatch(/in_stock|low_stock|out_of_stock/);
  });

  it('should generate reorder list for low stock', async () => {
    const list = await service.getReorderList();
    expect(list).toBeInstanceOf(Array);
    list.forEach(item => {
      expect(item.piece_stock).toBeLessThan(item.reorder_threshold);
    });
  });
});
```

---

## 📚 Dependencies

### NestJS Modules

- `@nestjs/common` - Core framework
- `@nestjs/cache-manager` - Redis caching
- `cache-manager` - Cache abstraction
- `cache-manager-redis-store` - Redis adapter

### Validation

- `zod` - Schema validation (DTOs)
- Custom `ZodValidationPipe` - NestJS integration

### Database

- `@supabase/supabase-js` - Supabase client
- `SupabaseBaseService` - Classe abstraite commune

---

## 🔄 Migration Path

### From Legacy to Consolidated (Completed)

**Phase 1** : Identification doublons
- ✅ Audit 13 services originaux
- ✅ Détection 49% duplication code

**Phase 2** : Consolidation services (6 Oct 2025)
- ✅ Fusion services similaires : 13 → 6
- ✅ Extraction logique commune : `SupabaseBaseService`
- ✅ Suppression code mort

**Phase 3** : Consolidation controllers (6 Oct 2025)
- ✅ Fusion endpoints redondants : 8 → 3
- ✅ Archivage V4 obsolète
- ✅ Déplacement tests hors `/controllers`

**Phase 4** : Cleanup final
- ✅ Suppression fichiers archivés
- ✅ Documentation mise à jour
- ✅ 0% duplication confirmé

---

## 🚀 Deployment

### Environment Variables

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Redis Cache
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=xxx

# API Config
NODE_ENV=production
PORT=3000
```

### Health Check

```bash
GET /api/health
Response: { "status": "ok", "timestamp": "2025-11-18T10:00:00Z" }
```

---

## 📖 Related Documentation

- [Product Catalog Management](./product-catalog.md) - Specs frontend + Meilisearch
- [Stock Management](./stock-management.md) - Gestion inventaire physique
- [ADR-001: Supabase Direct](../architecture/001-supabase-direct.md) - Choix architecture data
- [SupabaseBaseService](../../backend/src/database/services/supabase-base.service.ts) - Classe de base services

---

## ✅ Acceptance Criteria

### Critères Fonctionnels

- [ ] CRUD complet produits opérationnel (GET, POST, PUT, DELETE)
- [ ] Filtres multi-critères fonctionnels (gamme, marque, prix, stock, véhicule)
- [ ] Recherche simple et par référence < 100ms
- [ ] Recherche par véhicule retourne produits compatibles
- [ ] Pricing TTC/HT calculé correctement (TVA 20%)
- [ ] Cross-selling retourne recommandations pertinentes
- [ ] Stock temps réel validé à l'ajout panier
- [ ] Liste réapprovisionnement générée (stock < seuil)
- [ ] Interface admin fonctionnelle (level 3+)
- [ ] Toggle activation produit opérationnel

### Critères Techniques

- [ ] Validation Zod sur tous les DTOs
- [ ] Cache Redis actif (TTL configurés)
- [ ] Indexes DB créés sur colonnes clés
- [ ] Logs structurés (Winston/NestJS Logger)
- [ ] Gestion erreurs cohérente (try/catch + HttpException)
- [ ] Tests unitaires ≥ 80% coverage
- [ ] Tests intégration ≥ 60% coverage
- [ ] Aucun warning TypeScript strict
- [ ] Aucune dépendance circulaire

### Critères Performance

- [ ] GET /products < 150ms (p95)
- [ ] GET /products/:id < 100ms (p95)
- [ ] POST /products < 200ms (p95)
- [ ] GET /search < 100ms (p95)
- [ ] GET /filters/lists < 100ms (p95)
- [ ] GET /cross-selling/recommendations < 150ms (p95)
- [ ] Inventory report < 500ms (p95)

### Critères Sécurité

- [ ] JWT authentication sur endpoints protégés
- [ ] RBAC validé (admin, level 3+ pour admin endpoints)
- [ ] SQL injection impossible (Supabase PostgREST)
- [ ] XSS prevention (sanitization descriptions)
- [ ] Rate limiting actif (100 req/min public, 500 req/min admin)

---

## 🐛 Known Issues

1. **Mock data fallback** : Si produit non trouvé en DB, retourne données simulées (à supprimer en prod)
2. **piece_activ type inconsistency** : Colonne peut être `0/1` (number) ou `true/false` (boolean) selon version migration
3. **Search limitations** : Recherche simple (ILIKE), pas de fuzzy matching (délégué à Meilisearch)

---

## 🔮 Future Enhancements

1. **Variations produits** : Support couleurs, tailles, conditionnements
2. **Bulk operations** : Import/export CSV (planned in admin module)
3. **Price history** : Tracking évolution prix (analytics)
4. **Advanced cross-selling** : ML-based recommendations
5. **GraphQL API** : Alternative REST (évaluation en cours)

---

**Version:** 2.0.0  
**Last Updated:** 2025-11-18  
**Status:** ✅ Implemented & Consolidated  
**Maintainer:** Backend Team
