# 🔌 PRODUCTS API - Référence Complète

**Date:** 6 octobre 2025  
**Version:** 1.0  
**Base URL:** `http://localhost:3000`

---

## 📋 TABLE DES MATIÈRES

1. [Vue d'ensemble](#-vue-densemble)
2. [Authentication](#-authentication)
3. [ProductsController](#-productscontroller)
4. [FilteringController](#-filteringcontroller)
5. [TechnicalDataController](#-technicaldatacontroller)
6. [CrossSellingController](#-crosssellingcontroller)
7. [Codes d'erreur](#-codes-derreur)
8. [Rate Limiting](#-rate-limiting)
9. [Exemples](#-exemples)

---

## 🎯 VUE D'ENSEMBLE

### Endpoints Disponibles

| Controller | Base Route | Endpoints | Fonction |
|------------|-----------|-----------|----------|
| **ProductsController** | `/api/products` | 15 | CRUD produits, recherche, prix, stock |
| **FilteringController** | `/api/products/filters` | 8 | Filtrage multi-critères, facettes |
| **TechnicalDataController** | `/api/products/technical-data` | 8 | Specs techniques, compatibilité |
| **CrossSellingController** | `/api/cross-selling` | 6 | Recommandations, ventes croisées |

**Total:** 37 endpoints

---

## 🔐 AUTHENTICATION

### Headers Requis

```http
# Lecture (Public)
GET /api/products
Authorization: Non requis

# Écriture (Admin uniquement)
POST /api/products
Authorization: Bearer <JWT_TOKEN>
X-Admin-Key: <ADMIN_API_KEY>
```

### Rôles

- **Public:** Lecture seule (GET)
- **User:** Lecture + panier
- **Admin:** CRUD complet
- **System:** Tous accès

---

## 🛍️ PRODUCTSCONTROLLER

### Base Route: `/api/products`

---

#### 1. Liste tous les produits

```http
GET /api/products
```

**Query Parameters:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `search` | string | Non | Recherche textuelle |
| `rangeId` | number | Non | Filtrer par gamme |
| `brandId` | number | Non | Filtrer par marque |
| `limit` | number | Non | Limite résultats (défaut: 50, max: 100) |
| `page` | number | Non | Page (défaut: 0) |
| `sortBy` | string | Non | Tri: name, price, created_at |
| `sortOrder` | string | Non | asc ou desc |

**Exemple:**
```bash
curl "http://localhost:3000/api/products?search=embrayage&limit=20&sortBy=price"
```

**Réponse 200:**
```json
{
  "data": [
    {
      "piece_id": 30,
      "piece_ref": "VAL826704",
      "piece_name": "Kit d'embrayage complet Valeo",
      "piece_gamme_id": 5,
      "piece_marque_id": 12,
      "pieces_gamme": {
        "gamme_id": 5,
        "gamme_name": "Embrayage",
        "gamme_alias": "embrayage"
      },
      "pieces_marque": {
        "marque_id": 12,
        "marque_name": "Valeo",
        "marque_logo": "/logos/valeo.jpg"
      }
    }
  ],
  "total": 145,
  "page": 0,
  "limit": 20
}
```

---

#### 2. Détail d'un produit

```http
GET /api/products/:id
```

**Path Parameters:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `id` | number | Oui | ID du produit |

**Exemple:**
```bash
curl http://localhost:3000/api/products/30
```

**Réponse 200:**
```json
{
  "piece_id": 30,
  "piece_ref": "VAL826704",
  "piece_ref_brut": "826704",
  "piece_name": "Kit d'embrayage complet Valeo",
  "piece_description": "Kit complet comprenant disque, mécanisme et butée...",
  "piece_gamme_id": 5,
  "piece_marque_id": 12,
  "piece_pm_id": 2,
  "piece_is_active": true,
  "piece_created_at": "2024-01-15T10:00:00Z",
  "pieces_gamme": {...},
  "pieces_marque": {...}
}
```

**Erreurs:**
- `404` - Produit non trouvé
- `400` - ID invalide

---

#### 3. Recherche par référence

```http
GET /api/products/reference/:ref
```

**Path Parameters:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `ref` | string | Oui | Référence produit |

**Exemple:**
```bash
curl http://localhost:3000/api/products/reference/VAL826704
```

**Réponse 200:**
```json
{
  "piece_id": 30,
  "piece_ref": "VAL826704",
  "piece_name": "Kit d'embrayage complet Valeo",
  ...
}
```

---

#### 4. Liste des gammes

```http
GET /api/products/gammes
```

**Exemple:**
```bash
curl http://localhost:3000/api/products/gammes
```

**Réponse 200:**
```json
{
  "data": [
    {
      "gamme_id": 5,
      "gamme_name": "Embrayage",
      "gamme_alias": "embrayage",
      "gamme_description": "Kits et pièces d'embrayage",
      "gamme_img": "/images/gammes/embrayage.jpg",
      "gamme_order": 1,
      "products_count": 145
    },
    {
      "gamme_id": 7,
      "gamme_name": "Freinage",
      "gamme_alias": "freinage",
      "gamme_description": "Disques, plaquettes, étriers",
      "gamme_img": "/images/gammes/freinage.jpg",
      "gamme_order": 2,
      "products_count": 320
    }
  ],
  "total": 24
}
```

---

#### 5. Produits d'une gamme

```http
GET /api/products/gammes/:gammeId/products
```

**Path Parameters:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `gammeId` | number | Oui | ID de la gamme |

**Query Parameters:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `limit` | number | Non | Limite (défaut: 50) |
| `page` | number | Non | Page (défaut: 0) |

**Exemple:**
```bash
curl "http://localhost:3000/api/products/gammes/5/products?limit=20"
```

**Réponse 200:**
```json
{
  "gamme": {
    "gamme_id": 5,
    "gamme_name": "Embrayage"
  },
  "products": [
    {...},
    {...}
  ],
  "total": 145,
  "page": 0,
  "limit": 20
}
```

---

#### 6. Recherche générale

```http
GET /api/products/search
```

**Query Parameters:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `q` | string | Oui | Terme recherché |
| `gammeId` | number | Non | Filtrer par gamme |
| `brandId` | number | Non | Filtrer par marque |
| `limit` | number | Non | Limite (défaut: 50) |

**Exemple:**
```bash
curl "http://localhost:3000/api/products/search?q=embrayage+valeo&limit=10"
```

**Réponse 200:**
```json
{
  "query": "embrayage valeo",
  "results": [
    {
      "piece_id": 30,
      "piece_ref": "VAL826704",
      "piece_name": "Kit d'embrayage complet Valeo",
      "relevance_score": 0.95,
      "highlight": {
        "piece_name": "Kit d'<em>embrayage</em> complet <em>Valeo</em>"
      }
    }
  ],
  "total": 8,
  "took_ms": 15
}
```

---

#### 7. Recherche par véhicule

```http
GET /api/products/vehicle
```

**Query Parameters:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `marqueId` | number | Oui | ID marque véhicule |
| `modeleId` | number | Non | ID modèle véhicule |
| `typeId` | number | Non | ID type véhicule |
| `gammeId` | number | Non | Filtrer par gamme produits |

**Exemple:**
```bash
curl "http://localhost:3000/api/products/vehicle?marqueId=1&modeleId=42&typeId=156"
```

**Réponse 200:**
```json
{
  "vehicle": {
    "marque": "Renault",
    "modele": "Clio III",
    "type": "1.5 dCi 90",
    "years": "2005-2012"
  },
  "products": [
    {
      "piece_id": 30,
      "piece_ref": "VAL826704",
      "piece_name": "Kit d'embrayage complet",
      "compatibility_score": 100
    }
  ],
  "total": 245,
  "by_gamme": {
    "Embrayage": 12,
    "Freinage": 45,
    "Amortisseurs": 8
  }
}
```

---

#### 8. Produits populaires

```http
GET /api/products/popular
```

**Query Parameters:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `gammeId` | number | Non | Filtrer par gamme |
| `limit` | number | Non | Limite (défaut: 10) |
| `period` | string | Non | week, month, year (défaut: month) |

**Exemple:**
```bash
curl "http://localhost:3000/api/products/popular?limit=5&period=month"
```

**Réponse 200:**
```json
{
  "products": [
    {
      "piece_id": 30,
      "piece_ref": "VAL826704",
      "piece_name": "Kit d'embrayage complet",
      "views": 1250,
      "orders": 45,
      "popularity_score": 0.92
    }
  ],
  "period": "month",
  "total": 5
}
```

---

#### 9. Créer un produit (Admin)

```http
POST /api/products
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Kit d'embrayage Valeo Premium",
  "sku": "VAL826705",
  "description": "Kit complet haute qualité...",
  "price": 285.99,
  "stock_quantity": 50,
  "range_id": 5,
  "brand_id": 12,
  "is_active": true
}
```

**Réponse 201:**
```json
{
  "piece_id": 345,
  "piece_ref": "VAL826705",
  "piece_name": "Kit d'embrayage Valeo Premium",
  "created_at": "2025-10-06T14:30:00Z"
}
```

**Erreurs:**
- `400` - Validation échouée
- `401` - Non authentifié
- `403` - Non autorisé (admin requis)
- `409` - SKU déjà existant

---

#### 10. Modifier un produit (Admin)

```http
PUT /api/products/:id
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body (partiel):**
```json
{
  "name": "Kit d'embrayage Valeo Premium+",
  "price": 295.99
}
```

**Réponse 200:**
```json
{
  "piece_id": 345,
  "piece_ref": "VAL826705",
  "piece_name": "Kit d'embrayage Valeo Premium+",
  "updated_at": "2025-10-06T14:35:00Z"
}
```

---

#### 11. Supprimer un produit (Admin)

```http
DELETE /api/products/:id
Authorization: Bearer <JWT_TOKEN>
```

**Réponse 204:**
```
No Content
```

**Erreurs:**
- `404` - Produit non trouvé
- `409` - Produit dans des commandes actives

---

#### 12. Prix du produit

```http
GET /api/products/:id/pricing
```

**Query Parameters:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `quantity` | number | Non | Quantité (défaut: 1) |

**Exemple:**
```bash
curl "http://localhost:3000/api/products/30/pricing?quantity=2"
```

**Réponse 200:**
```json
{
  "priceTTC": 242.69,
  "consigneTTC": 50.00,
  "totalTTC": 585.38,
  "formatted": {
    "integer": 585,
    "decimals": "38",
    "currency": "€"
  },
  "isExchangeStandard": true,
  "advanced": {
    "unit_price_ttc": 242.69,
    "unit_consigne_ttc": 50.00,
    "quantity_sale": 1,
    "total_units": 2,
    "price_ht": 487.82,
    "vat_rate": 20,
    "margin": 91.00
  },
  "_metadata": {
    "piece_id": 30,
    "quantity_requested": 2,
    "cache_hit": false,
    "response_time": 45.2
  }
}
```

---

#### 13. Prix en lot

```http
POST /api/products/bulk-pricing
Content-Type: application/json
```

**Body:**
```json
{
  "items": [
    { "pieceId": 30, "quantity": 2 },
    { "pieceId": 45, "quantity": 1 },
    { "pieceId": 67, "quantity": 3 }
  ]
}
```

**Réponse 200:**
```json
{
  "items": [
    {
      "pieceId": 30,
      "quantity": 2,
      "unit_price_ttc": 242.69,
      "total_ttc": 585.38
    },
    {
      "pieceId": 45,
      "quantity": 1,
      "unit_price_ttc": 89.90,
      "total_ttc": 89.90
    }
  ],
  "summary": {
    "total_items": 3,
    "subtotal_ttc": 942.28,
    "total_vat": 157.05,
    "grand_total_ttc": 942.28
  }
}
```

---

#### 14. Stock du produit

```http
GET /api/products/:id/stock
```

**Exemple:**
```bash
curl http://localhost:3000/api/products/30/stock
```

**Réponse 200 (Mode UNLIMITED):**
```json
{
  "available": 999,
  "reserved": 0,
  "total": 999,
  "status": "in_stock",
  "needsReorder": false
}
```

**Réponse 200 (Mode TRACKED):**
```json
{
  "available": 15,
  "reserved": 5,
  "total": 20,
  "status": "low_stock",
  "needsReorder": true,
  "reorderQuantity": 85
}
```

---

#### 15. Mettre à jour le stock (Admin)

```http
PUT /api/products/:id/stock
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "quantity": 100,
  "operation": "set"
}
```

**Operations:**
- `set` - Définir le stock
- `increment` - Ajouter au stock
- `decrement` - Retirer du stock

**Réponse 200:**
```json
{
  "piece_id": 30,
  "previous_stock": 20,
  "new_stock": 100,
  "operation": "set",
  "updated_at": "2025-10-06T14:40:00Z"
}
```

---

## 🔍 FILTERINGCONTROLLER

### Base Route: `/api/products/filters`

---

#### 1. Filtrer par gamme

```http
GET /api/products/filters/gamme/:id
```

**Query Parameters:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `brandId` | number | Non | Filtrer par marque |
| `priceMin` | number | Non | Prix minimum |
| `priceMax` | number | Non | Prix maximum |
| `inStockOnly` | boolean | Non | Seulement en stock |
| `limit` | number | Non | Limite |
| `page` | number | Non | Page |

**Exemple:**
```bash
curl "http://localhost:3000/api/products/filters/gamme/5?brandId=12&inStockOnly=true"
```

---

#### 2. Filtrer par prix

```http
GET /api/products/filters/price
```

**Query Parameters:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `min` | number | Oui | Prix minimum |
| `max` | number | Oui | Prix maximum |
| `gammeId` | number | Non | Filtrer par gamme |

**Exemple:**
```bash
curl "http://localhost:3000/api/products/filters/price?min=100&max=300"
```

---

#### 3. Facettes disponibles

```http
GET /api/products/filters/facets
```

**Query Parameters:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `gammeId` | number | Non | Pour une gamme spécifique |

**Exemple:**
```bash
curl "http://localhost:3000/api/products/filters/facets?gammeId=5"
```

**Réponse 200:**
```json
{
  "brands": [
    { "id": 12, "name": "Valeo", "count": 45 },
    { "id": 8, "name": "Bosch", "count": 32 }
  ],
  "price_ranges": [
    { "min": 0, "max": 100, "count": 25 },
    { "min": 100, "max": 300, "count": 65 },
    { "min": 300, "max": 500, "count": 15 }
  ],
  "criteria": [
    {
      "name": "Diamètre",
      "values": [
        { "value": "240mm", "count": 12 },
        { "value": "250mm", "count": 8 }
      ]
    }
  ]
}
```

---

## 🔧 TECHNICALDATACONTROLLER

### Base Route: `/api/products/technical-data`

---

#### 1. Spécifications techniques

```http
GET /api/products/technical-data/:id/specs
```

**Exemple:**
```bash
curl http://localhost:3000/api/products/technical-data/30/specs
```

**Réponse 200:**
```json
{
  "piece_id": 30,
  "piece_ref": "VAL826704",
  "piece_name": "Kit d'embrayage complet",
  "technical_specs": {
    "criteria": [
      {
        "criteria_id": 1,
        "name": "Diamètre",
        "value": "240mm",
        "unit": "mm",
        "type": "number"
      },
      {
        "criteria_id": 2,
        "name": "Nombre de dents",
        "value": "24",
        "unit": "",
        "type": "number"
      }
    ],
    "total_criteria": 5
  }
}
```

---

#### 2. Véhicules compatibles

```http
GET /api/products/technical-data/:id/vehicles
```

**Query Parameters:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `limit` | number | Non | Limite (défaut: 50) |

**Exemple:**
```bash
curl http://localhost:3000/api/products/technical-data/30/vehicles
```

**Réponse 200:**
```json
{
  "piece_id": 30,
  "compatibility": {
    "total_vehicles": 15,
    "vehicles": [
      {
        "marque": "Renault",
        "modele": "Clio III",
        "types": [
          {
            "type_id": 156,
            "name": "1.5 dCi 90",
            "power_kw": 66,
            "power_hp": 90,
            "year_start": 2005,
            "year_end": 2012,
            "motor_codes": ["K9K 766", "K9K 768"]
          }
        ]
      }
    ]
  }
}
```

---

#### 3. Références OEM

```http
GET /api/products/technical-data/:id/oem
```

**Exemple:**
```bash
curl http://localhost:3000/api/products/technical-data/30/oem
```

**Réponse 200:**
```json
{
  "piece_id": 30,
  "piece_ref": "VAL826704",
  "oem_references": [
    {
      "oem_id": 1,
      "oem_ref": "302057532R",
      "oem_brand": "Renault"
    },
    {
      "oem_id": 2,
      "oem_ref": "30100-ED000",
      "oem_brand": "Nissan"
    }
  ],
  "total": 2
}
```

---

#### 4. Chercher par OEM

```http
GET /api/products/technical-data/oem/:ref
```

**Exemple:**
```bash
curl http://localhost:3000/api/products/technical-data/oem/302057532R
```

**Réponse 200:**
```json
{
  "oem_ref": "302057532R",
  "oem_brand": "Renault",
  "products": [
    {
      "piece_id": 30,
      "piece_ref": "VAL826704",
      "piece_name": "Kit d'embrayage complet",
      "match_type": "exact"
    }
  ]
}
```

---

## 🔄 CROSSSELLINGCONTROLLER

### Base Route: `/api/cross-selling`

---

#### 1. Cross-selling par gamme

```http
GET /api/cross-selling/gamme/:id
```

**Query Parameters:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `typeId` | number | Non | Type véhicule |
| `limit` | number | Non | Limite (défaut: 10) |

**Exemple:**
```bash
curl "http://localhost:3000/api/cross-selling/gamme/5?typeId=156"
```

**Réponse 200:**
```json
{
  "success": true,
  "data": {
    "cross_gammes": [
      {
        "pg_id": 7,
        "pg_name": "Volant moteur",
        "pg_alias": "volant-moteur",
        "pg_img": "/images/gammes/volant.jpg",
        "products_count": 12,
        "cross_level": 1,
        "source": "config",
        "metadata": {
          "family_id": 5,
          "compatibility_score": 95,
          "trending": true
        }
      }
    ],
    "total_found": 5,
    "sources_used": ["config", "family"],
    "recommendations": [
      "Pensez au volant moteur pour un kit complet"
    ]
  },
  "performance": {
    "response_time": 45.8,
    "cache_hit": false,
    "sources_queried": 2
  }
}
```

---

#### 2. Produits liés

```http
GET /api/cross-selling/product/:id
```

**Exemple:**
```bash
curl http://localhost:3000/api/cross-selling/product/30
```

---

#### 3. Fréquemment achetés ensemble

```http
GET /api/cross-selling/bought-together/:id
```

**Exemple:**
```bash
curl http://localhost:3000/api/cross-selling/bought-together/30
```

**Réponse 200:**
```json
{
  "piece_id": 30,
  "piece_name": "Kit d'embrayage complet",
  "frequently_bought_with": [
    {
      "piece_id": 45,
      "piece_name": "Volant moteur",
      "co_purchase_count": 125,
      "co_purchase_rate": 0.45
    },
    {
      "piece_id": 67,
      "piece_name": "Butée d'embrayage",
      "co_purchase_count": 98,
      "co_purchase_rate": 0.35
    }
  ],
  "period": "last_6_months"
}
```

---

## ❌ CODES D'ERREUR

### HTTP Status Codes

| Code | Nom | Description |
|------|-----|-------------|
| `200` | OK | Succès |
| `201` | Created | Ressource créée |
| `204` | No Content | Suppression réussie |
| `400` | Bad Request | Paramètres invalides |
| `401` | Unauthorized | Authentication requise |
| `403` | Forbidden | Permissions insuffisantes |
| `404` | Not Found | Ressource introuvable |
| `409` | Conflict | Conflit (ex: SKU existant) |
| `422` | Unprocessable Entity | Validation échouée |
| `429` | Too Many Requests | Rate limit dépassé |
| `500` | Internal Server Error | Erreur serveur |
| `503` | Service Unavailable | Service indisponible |

### Format d'Erreur

```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Le produit avec l'ID 999 n'existe pas",
    "details": {
      "piece_id": 999
    },
    "timestamp": "2025-10-06T14:45:00Z",
    "path": "/api/products/999"
  }
}
```

### Codes d'Erreur Métier

| Code | HTTP | Description |
|------|------|-------------|
| `PRODUCT_NOT_FOUND` | 404 | Produit introuvable |
| `INVALID_SKU` | 400 | SKU invalide |
| `SKU_ALREADY_EXISTS` | 409 | SKU déjà utilisé |
| `INVALID_PRICE` | 400 | Prix invalide |
| `STOCK_INSUFFICIENT` | 400 | Stock insuffisant |
| `INVALID_GAMME` | 400 | Gamme inexistante |
| `INVALID_BRAND` | 400 | Marque inexistante |
| `VALIDATION_ERROR` | 422 | Validation échouée |

---

## ⏱️ RATE LIMITING

### Limites par Défaut

| Type | Limite | Période | Reset |
|------|--------|---------|-------|
| **Public** | 100 req | 1 minute | Rolling |
| **Authenticated** | 500 req | 1 minute | Rolling |
| **Admin** | 1000 req | 1 minute | Rolling |

### Headers de Rate Limit

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1696604400
Retry-After: 60
```

### Réponse 429

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Trop de requêtes. Réessayez dans 60 secondes.",
    "retry_after": 60
  }
}
```

---

## 📊 EXEMPLES

### Collection Postman

Importez la collection: `/docs/postman/products-api.json`

### Exemples cURL

```bash
# 1. Liste produits avec recherche
curl -X GET \
  "http://localhost:3000/api/products?search=embrayage&limit=10" \
  -H "Accept: application/json"

# 2. Détail produit
curl -X GET \
  "http://localhost:3000/api/products/30" \
  -H "Accept: application/json"

# 3. Prix avec quantité
curl -X GET \
  "http://localhost:3000/api/products/30/pricing?quantity=2" \
  -H "Accept: application/json"

# 4. Créer produit (Admin)
curl -X POST \
  "http://localhost:3000/api/products" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nouveau produit",
    "sku": "NEW-001",
    "price": 99.99
  }'

# 5. Cross-selling
curl -X GET \
  "http://localhost:3000/api/cross-selling/gamme/5?typeId=156" \
  -H "Accept: application/json"
```

### Exemples JavaScript/TypeScript

```typescript
// Fetch API
async function getProducts(search: string) {
  const response = await fetch(
    `http://localhost:3000/api/products?search=${encodeURIComponent(search)}`
  );
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
}

// Axios
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// GET
const products = await api.get('/api/products', {
  params: { search: 'embrayage', limit: 10 }
});

// POST (Admin)
const newProduct = await api.post('/api/products', {
  name: 'Nouveau produit',
  sku: 'NEW-001',
  price: 99.99
}, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## 📚 RESSOURCES

### Documentation
- 📖 [Documentation Complète](./PRODUCTS-MODULE-DOCUMENTATION.md)
- 🚀 [Guide Démarrage Rapide](./PRODUCTS-QUICK-START.md)
- 📊 [Rapport Consolidation](./PRODUCT-CONSOLIDATION-FINAL-REPORT.md)

### Outils
- 🔌 Postman Collection: `/docs/postman/products-api.json`
- 📝 Swagger UI: `http://localhost:3000/api/docs` (à venir)
- 🧪 Tests E2E: `/backend/tests/e2e/products/`

### Support
- 🐛 **Bugs:** GitHub Issues
- 💬 **Questions:** Slack #api-support
- 📧 **Email:** api-support@example.com

---

**Document créé:** 6 octobre 2025  
**Dernière mise à jour:** 6 octobre 2025  
**Version:** 1.0  

---

*"Une API claire, c'est une intégration rapide."* 🔌
