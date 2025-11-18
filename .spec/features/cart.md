---
title: "Cart Module - Shopping Cart & Session Management"
status: implemented
version: 1.0.0
authors: [Backend Team]
created: 2025-11-18
updated: 2025-11-18
relates-to:
  - ./payment-cart-system.md
  - ./products.md
  - ./orders.md
  - ./promo.md
  - ../architecture/001-supabase-direct.md
tags: [cart, shopping, session, redis, critical]
priority: critical
coverage:
  modules: [cart]
  routes: [/api/cart/*, /api/cart/items/*, /api/cart/promo, /api/cart/shipping/*]
  services: [CartService, CartCalculationService, CartValidationService, CartAnalyticsService, CartDataService]
---

# Cart Module - Shopping Cart & Session Management

## 📝 Overview

Module backend **consolidé** gérant le panier d'achat avec support multi-contextes (invité/authentifié), calculs automatiques TTC/HT, intégration codes promo, gestion des frais de livraison, et analytics d'abandon. Architecture moderne avec **Redis cache** pour sessions et **Supabase PostgreSQL** pour analytics.

**Consolidation réalisée** :
- Services : 4 services spécialisés + 1 data layer
- Controllers : 1 controller REST moderne
- Cache : Redis pour sessions (5 min TTL)
- Database : PostgreSQL pour analytics (audits, conversions)

**Contextes supportés** :
- **Invité** : Panier session anonyme (cookie `userSession`)
- **Authentifié** : Panier lié à user_id
- **Fusion** : Merge automatique invité → authentifié à la connexion

**Fonctionnalités clés** :
- CRUD complet : Ajout, mise à jour, suppression articles
- Calculs automatiques : TVA 20%, frais de port, remises quantité
- Codes promo : Intégration PromoModule (Zod + Cache)
- Analytics : Taux d'abandon, valeur moyenne, produits abandonnés
- Recommandations : Suggestions produits complémentaires

## 🎯 Goals

### Objectifs Principaux

1. **Panier multi-contextes** : Support invité + authentifié + fusion
2. **Calculs automatiques** : TVA, shipping, remises quantité
3. **Codes promo** : Validation, application, tracking utilisation
4. **Session persistante** : Cache Redis 5 min TTL
5. **Analytics abandon** : Tracking paniers abandonnés, conversion
6. **Performance** : < 150ms (p95) GET cart, < 200ms POST items

### Objectifs Secondaires

- Recommandations produits (ML future)
- Comparaison prix (historique)
- Wishlist integration (v2)
- Export panier (PDF/Email)

## 🚫 Non-Goals

- **Paiements directs** : Délégué à PaymentsModule
- **Gestion stock** : Délégué à ProductsModule
- **Commandes** : Délégué à OrdersModule
- **Multi-devises** : EUR uniquement (v1)

## 🏗️ Architecture

### Services (5)

```typescript
CartModule
├── CartService                     // Logique métier principale (codes promo)
├── CartCalculationService          // Calculs prix/TVA/shipping
├── CartValidationService           // Validation stock/limites
├── CartAnalyticsService            // Analytics abandon/conversion
└── CartDataService                 // Data layer Redis + PostgreSQL
```

### Controllers (1)

```typescript
CartController                      // /api/cart/* - API REST complète
```

### Workflow Session

```
🔑 Invité
  ↓ Cookie userSession créé
📦 Panier Redis (session_id)
  ↓ Client ajoute articles
🛒 Panier stocké Redis (5 min TTL)
  ↓ Client se connecte
🔀 FUSION automatique
  ↓ Merge paniers invité + authentifié
✅ Panier Redis (user_id)
  ↓ Client valide commande
💳 Conversion → OrdersModule
```

### Workflow Calculs

```
📦 Items panier (product_id, quantity)
  ↓ Récupération prix base
💰 Prix avec remises quantité
  ↓ Application TVA 20%
🧾 Subtotal TTC
  ↓ Calcul frais de port (poids + zone)
🚚 Shipping fee (gratuit > 150€)
  ↓ Application code promo (si présent)
🏷️ Total avec réduction
  ↓ Calcul final
✅ Grand Total
```

## 📊 Data Model

### Redis Cache (`cart:*`)

**Clé pattern** : `cart:{userId|sessionId}`

**Structure JSON** :
```json
{
  "userId": "12345",
  "sessionId": "sess_abc123",
  "items": [
    {
      "itemId": "12345-456-1699901234",
      "productId": 456,
      "quantity": 2,
      "price": 45.50,
      "priceHT": 37.92,
      "priceTTC": 45.50,
      "name": "Plaquettes de frein avant",
      "reference": "BRK-2024-001",
      "imageUrl": "/uploads/products/brk-001.jpg",
      "weight": 2.5,
      "stock": 12,
      "brand": "BOSCH",
      "category": "Freinage",
      "addedAt": "2025-01-14T10:00:00Z"
    }
  ],
  "totals": {
    "subtotalHT": 75.84,
    "tva": 15.17,
    "subtotalTTC": 91.00,
    "shippingFee": 15.90,
    "promoDiscount": 10.00,
    "grandTotal": 96.90,
    "totalWeight": 5.0,
    "itemCount": 2
  },
  "promo": {
    "code": "WELCOME10",
    "discount": 10.00,
    "type": "FIXED",
    "appliedAt": "2025-01-14T10:05:00Z"
  },
  "shipping": {
    "methodId": 1,
    "methodName": "Colissimo",
    "zone": "FR",
    "cost": 15.90,
    "isFree": false,
    "estimatedDays": 3,
    "postalCode": "75001",
    "address": "10 Rue de Rivoli"
  },
  "createdAt": "2025-01-14T10:00:00Z",
  "updatedAt": "2025-01-14T10:05:00Z",
  "expiresAt": "2025-01-14T10:10:00Z"
}
```

**TTL** : 5 minutes (renouvelé à chaque opération)

---

### Table `cart_analytics` (PostgreSQL - Supabase)

```sql
CREATE TABLE cart_analytics (
  cart_id                 SERIAL PRIMARY KEY,
  
  -- Identifiants
  user_id                 INTEGER REFERENCES users(user_id),
  session_id              VARCHAR(255),
  
  -- Statuts
  cart_status             VARCHAR(50) DEFAULT 'ACTIVE',       -- ACTIVE/ABANDONED/CONVERTED
  
  -- Données panier
  total_items             INTEGER DEFAULT 0,
  total_value             DECIMAL(10,2) DEFAULT 0,
  total_weight            DECIMAL(10,2) DEFAULT 0,
  
  -- Codes promo
  promo_code              VARCHAR(50),
  promo_discount          DECIMAL(10,2),
  
  -- Shipping
  shipping_zone           VARCHAR(10),
  shipping_cost           DECIMAL(10,2),
  
  -- Analytics
  viewed_count            INTEGER DEFAULT 1,                  -- Nombre vues panier
  updated_count           INTEGER DEFAULT 0,                  -- Nombre modifications
  
  -- Timestamps
  cart_created_at         TIMESTAMP DEFAULT NOW(),
  cart_updated_at         TIMESTAMP DEFAULT NOW(),
  cart_abandoned_at       TIMESTAMP,                          -- Date abandon
  cart_converted_at       TIMESTAMP,                          -- Date conversion
  
  -- Conversion
  order_id                INTEGER REFERENCES commandes(commande_id),
  
  -- Indexes performances
  INDEX idx_cart_user (user_id),
  INDEX idx_cart_session (session_id),
  INDEX idx_cart_status (cart_status),
  INDEX idx_cart_created (cart_created_at),
  INDEX idx_cart_abandoned (cart_abandoned_at)
);
```

### Table `cart_items_analytics` (Items abandonnés)

```sql
CREATE TABLE cart_items_analytics (
  item_id                 SERIAL PRIMARY KEY,
  cart_id                 INTEGER REFERENCES cart_analytics(cart_id) ON DELETE CASCADE,
  
  product_id              INTEGER REFERENCES pieces(piece_id),
  quantity                INTEGER NOT NULL,
  price                   DECIMAL(10,2) NOT NULL,
  
  -- Métadonnées produit (snapshot)
  product_name            VARCHAR(255),
  product_category        VARCHAR(100),
  product_brand           VARCHAR(100),
  
  added_at                TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_cart_items_cart (cart_id),
  INDEX idx_cart_items_product (product_id)
);
```

## 🔌 API Endpoints

### CartController (`/api/cart`)

#### 1. GET `/api/cart` - Récupérer panier actuel

**Access:** Public (invité ou authentifié)

**Headers:**
```
Cookie: userSession=sess_abc123
Authorization: Bearer {token} (optionnel si authentifié)
```

**Response:**
```json
{
  "cart_id": "cart_12345",
  "user_id": 12345,
  "session_id": "sess_abc123",
  "items": [
    {
      "itemId": "12345-456-1699901234",
      "productId": 456,
      "quantity": 2,
      "price": 45.50,
      "priceHT": 37.92,
      "priceTTC": 45.50,
      "name": "Plaquettes de frein avant",
      "reference": "BRK-2024-001",
      "imageUrl": "/uploads/products/brk-001.jpg",
      "weight": 2.5,
      "stock": 12,
      "brand": "BOSCH",
      "category": "Freinage"
    }
  ],
  "totals": {
    "total_items": 2,
    "item_count": 2,
    "subtotal": 91.00,
    "consigne_total": 0,
    "tax": 15.17,
    "shipping": 15.90,
    "discount": 10.00,
    "total": 96.90
  },
  "metadata": {
    "currency": "EUR",
    "last_updated": "2025-01-14T10:05:00Z"
  },
  "created_at": "2025-01-14T10:00:00Z",
  "updated_at": "2025-01-14T10:05:00Z"
}
```

**Logique:**
1. Extraire `user_id` (token JWT) OU `session_id` (cookie `userSession`)
2. Récupérer panier depuis Redis (`cart:{userId|sessionId}`)
3. Si pas trouvé → Retourner panier vide
4. Enrichir items avec métadonnées produits (nom, image, stock)
5. Calculer totaux (subtotal, TVA, shipping, promo)
6. Renouveler TTL Redis (5 min)
7. Retourner panier complet

**Performance:** < 150ms (p95)  
**Cache:** Redis 5 min TTL

---

#### 2. GET `/api/cart/merge-info` - Info fusion panier (post-login)

**Access:** Authenticated user

**Response:**
```json
{
  "merged": true,
  "guestItems": 3,
  "existingItems": 2,
  "totalItems": 5,
  "message": "Vos 3 nouveaux articles ont été ajoutés aux 2 articles déjà présents dans votre panier.",
  "timestamp": "2025-01-14T10:05:00Z"
}
```

**Logique:**
1. Vérifier session contient `cartMergeInfo`
2. Récupérer info fusion (nombre items invité + items existants)
3. Effacer info après lecture (affichage unique)
4. Retourner message fusion ou "Aucune fusion récente"

**Usage:** Afficher notification frontend après connexion

---

#### 3. POST `/api/cart/items` - Ajouter article

**Access:** Public

**Body:**
```json
{
  "product_id": 456,
  "quantity": 2,
  "custom_price": null,
  "replace": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Article ajouté au panier",
  "item": {
    "itemId": "12345-456-1699901234",
    "productId": 456,
    "quantity": 2,
    "price": 45.50,
    "name": "Plaquettes de frein avant"
  },
  "productId": 456,
  "quantity": 2
}
```

**Logique:**
1. Valider `product_id` existe (ProductsModule)
2. Vérifier stock disponible (StockService)
3. Si `replace=true` → Remplacer quantité existante
4. Si `replace=false` → Incrémenter quantité existante
5. Générer `itemId` unique (`userId-productId-timestamp`)
6. Enrichir item avec métadonnées produit (nom, prix, image)
7. Calculer prix avec remises quantité (si applicable)
8. Sauvegarder dans Redis (`cart:{userId|sessionId}`)
9. Renouveler TTL 5 min
10. Créer/update analytics PostgreSQL (`cart_analytics`)
11. Retourner item ajouté

**Erreurs:**
- 400 : Validation failed (product_id invalide, quantity <= 0)
- 404 : Produit inexistant
- 422 : Stock insuffisant

**Performance:** < 200ms (p95)

---

#### 4. POST `/api/cart/add` - Alias POST /items

**Access:** Public

**Body:** Identique POST `/api/cart/items`

**Response:** Identique POST `/api/cart/items`

**Usage:** Compatibilité frontend legacy

---

#### 5. PUT `/api/cart/items/:itemId` - Mettre à jour quantité

**Access:** Public

**Params:**
- `itemId` : ID de l'item (`12345-456-1699901234`)

**Body:**
```json
{
  "quantity": 5
}
```

**Response:**
```json
{
  "success": true,
  "message": "Article mis à jour avec succès",
  "item": {
    "itemId": "12345-456-1699901234",
    "productId": 456,
    "quantity": 5,
    "price": 45.50
  }
}
```

**Logique:**
1. Valider `itemId` format valide
2. Récupérer panier Redis
3. Trouver item par `itemId`
4. Si `quantity = 0` → Supprimer item
5. Si `quantity > 0` → Vérifier stock disponible
6. Mettre à jour quantité
7. Recalculer totaux
8. Sauvegarder Redis
9. Update analytics PostgreSQL
10. Retourner item mis à jour

**Erreurs:**
- 400 : itemId invalide, quantity négative
- 404 : Item inexistant dans panier
- 422 : Stock insuffisant

**Performance:** < 180ms (p95)

---

#### 6. PATCH `/api/cart/items/:itemId` - Alias PUT (REST standard)

**Access:** Public

**Body:** Identique PUT `/api/cart/items/:itemId`

**Response:** Identique PUT `/api/cart/items/:itemId`

---

#### 7. DELETE `/api/cart/items/:itemId` - Supprimer article

**Access:** Public

**Params:**
- `itemId` : ID de l'item

**Response:**
```json
{
  "success": true,
  "message": "Article supprimé avec succès",
  "itemId": "12345-456-1699901234"
}
```

**Logique:**
1. Valider `itemId` fourni
2. Récupérer panier Redis
3. Supprimer item par `itemId`
4. Recalculer totaux
5. Sauvegarder Redis
6. Update analytics PostgreSQL
7. Retourner confirmation

**Erreurs:**
- 400 : itemId manquant
- 404 : Item inexistant

**Performance:** < 150ms (p95)

---

#### 8. DELETE `/api/cart` - Vider panier complet

**Access:** Public

**Response:**
```json
{
  "message": "Panier vidé avec succès",
  "sessionId": "sess_abc123",
  "userId": 12345,
  "success": true
}
```

**Logique:**
1. Récupérer `userId` ou `sessionId`
2. Supprimer clé Redis (`cart:{userId|sessionId}`)
3. Marquer analytics PostgreSQL comme ABANDONED
4. Retourner confirmation

**Performance:** < 100ms (p95)

---

### Codes Promo

#### 9. POST `/api/cart/promo` - Appliquer code promo

**Access:** Public

**Body:**
```json
{
  "promoCode": "WELCOME10"
}
```

**Response:**
```json
{
  "valid": true,
  "discount": 10.00,
  "finalTotal": 86.90,
  "message": "Réduction de 10.00€ appliquée"
}
```

**Logique:**
1. Valider `promoCode` format (Zod)
2. Récupérer panier Redis
3. Calculer subtotal actuel
4. Appeler `PromoService.validatePromoCode()` (Zod + Cache)
5. Vérifier validité (dates, limites utilisation, montant minimum)
6. Calculer réduction (FIXED/PERCENTAGE)
7. Enregistrer dans Redis (`promo` field)
8. Recalculer grand total
9. Retourner résultat validation

**Erreurs:**
- 400 : Code promo vide, format invalide
- 404 : Code promo inexistant
- 422 : Code promo expiré, montant minimum non atteint, limite utilisations atteinte

**Performance:** < 200ms (p95)  
**Cache:** PromoService utilise Redis (1 min TTL)

---

#### 10. DELETE `/api/cart/promo` - Retirer code promo

**Access:** Public

**Response:**
```json
{
  "success": true,
  "message": "Code promo retiré avec succès"
}
```

**Logique:**
1. Récupérer panier Redis
2. Supprimer champ `promo`
3. Recalculer totaux sans réduction
4. Sauvegarder Redis
5. Retourner confirmation

**Performance:** < 100ms (p95)

---

### Shipping

#### 11. POST `/api/cart/shipping/calculate` - Calculer frais livraison

**Access:** Public

**Body:**
```json
{
  "postalCode": "75001"
}
```

**Response:**
```json
{
  "success": true,
  "shipping": {
    "zone": "FR",
    "cost": 15.90,
    "isFree": false,
    "estimatedDays": 3,
    "method": "Colissimo"
  },
  "remainingForFreeShipping": 59.00
}
```

**Logique:**
1. Valider `postalCode` fourni
2. Récupérer panier Redis
3. Calculer poids total items
4. Calculer subtotal panier
5. Déterminer zone shipping (France/Europe/International)
6. Appeler `ShippingService.calculateShippingEstimate()`
7. Vérifier seuil livraison gratuite (150€)
8. Calculer montant restant pour franco de port
9. Retourner estimation

**Performance:** < 250ms (p95)

---

#### 12. POST `/api/cart/shipping` - Appliquer méthode livraison

**Access:** Public

**Body:**
```json
{
  "postalCode": "75001",
  "address": "10 Rue de Rivoli"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Méthode de livraison appliquée avec succès",
  "shipping": {
    "zone": "FR",
    "cost": 15.90,
    "isFree": false,
    "estimatedDays": 3,
    "method": "Colissimo"
  }
}
```

**Logique:**
1. Valider `postalCode` et `address` (optionnel)
2. Récupérer panier Redis
3. Calculer shipping (même logique que `/calculate`)
4. Enregistrer dans Redis (`shipping` field)
5. Recalculer grand total avec frais de port
6. Sauvegarder Redis
7. Retourner méthode appliquée

**Performance:** < 250ms (p95)

---

#### 13. DELETE `/api/cart/shipping` - Retirer méthode livraison

**Access:** Public

**Response:**
```json
{
  "success": true,
  "message": "Méthode de livraison retirée avec succès"
}
```

**Logique:**
1. Récupérer panier Redis
2. Supprimer champ `shipping`
3. Recalculer totaux sans frais de port
4. Sauvegarder Redis
5. Retourner confirmation

**Performance:** < 100ms (p95)

---

### Analytics

#### 14. GET `/api/cart/analytics/report` - Rapport analytics complet

**Access:** Admin level 8+

**Response:**
```json
{
  "success": true,
  "report": {
    "abandonmentRate": {
      "totalCarts": 1234,
      "convertedCarts": 567,
      "abandonedCarts": 667,
      "conversionRate": 45.9,
      "abandonmentRate": 54.1
    },
    "averageCartValue": {
      "average": 125.50,
      "median": 98.00,
      "min": 15.00,
      "max": 850.00
    },
    "topAbandonedProducts": [
      {
        "productId": 456,
        "productName": "Plaquettes de frein avant",
        "abandonCount": 123,
        "totalValue": 5598.50
      }
    ],
    "period": {
      "from": "2025-01-01",
      "to": "2025-01-31"
    }
  }
}
```

**Logique:**
1. Requête agrégée PostgreSQL (`cart_analytics`)
2. Calculer taux abandon (abandoned / total)
3. Calculer taux conversion (converted / total)
4. Calculer valeur moyenne (AVG total_value WHERE converted)
5. Top 10 produits abandonnés (JOIN cart_items_analytics)
6. Grouper par période (30 derniers jours)
7. Retourner rapport complet

**Performance:** < 500ms (p95)  
**Cache:** Redis 1 min TTL

---

#### 15. GET `/api/cart/analytics/abandonment` - Taux abandon/conversion

**Access:** Admin level 8+

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalCarts": 1234,
    "convertedCarts": 567,
    "abandonedCarts": 667,
    "conversionRate": 45.9,
    "abandonmentRate": 54.1,
    "period": "last_30_days"
  }
}
```

**Performance:** < 300ms (p95)

---

#### 16. GET `/api/cart/analytics/average-value` - Valeur moyenne panier

**Access:** Admin level 8+

**Response:**
```json
{
  "success": true,
  "stats": {
    "average": 125.50,
    "median": 98.00,
    "min": 15.00,
    "max": 850.00,
    "totalRevenue": 71158.50,
    "convertedCartsCount": 567
  }
}
```

**Performance:** < 300ms (p95)

---

#### 17. GET `/api/cart/analytics/abandoned-products` - Produits abandonnés

**Access:** Admin level 8+

**Response:**
```json
{
  "success": true,
  "count": 10,
  "products": [
    {
      "productId": 456,
      "productName": "Plaquettes de frein avant",
      "productCategory": "Freinage",
      "productBrand": "BOSCH",
      "abandonCount": 123,
      "totalQuantity": 246,
      "totalValue": 5598.50,
      "averagePrice": 45.50
    }
  ]
}
```

**Performance:** < 400ms (p95)

---

### Recommandations

#### 18. GET `/api/cart/recommendations` - Suggestions produits

**Access:** Public

**Response:**
```json
{
  "success": true,
  "recommendations": [
    {
      "id": "99901",
      "name": "Liquide de refroidissement 5L",
      "price": 12.99,
      "imageUrl": "/images/products/coolant.jpg",
      "category": "Entretien",
      "stock": "in-stock",
      "brand": "TOTAL",
      "reason": "Souvent acheté ensemble"
    }
  ],
  "cartItemCount": 2,
  "timestamp": "2025-01-14T10:05:00Z"
}
```

**Logique:**
1. Récupérer panier actuel
2. Extraire catégories produits panier
3. Algorithme recommandations basique (v1) :
   - Produits même catégorie
   - Produits fréquemment achetés ensemble (cross-selling)
   - Produits compatibles véhicule (si défini)
4. Limiter à 3 produits
5. Retourner suggestions

**Future (v2)** : Machine Learning avec historique achats

**Performance:** < 250ms (p95)

---

## 🔒 Security

### Session Management

**Cookie `userSession`** :
- HttpOnly : `true` (protection XSS)
- Secure : `true` (HTTPS uniquement)
- SameSite : `Strict` (protection CSRF)
- Max-Age : 5 minutes (aligné sur TTL Redis)

**Token JWT** (optionnel si authentifié) :
- Header : `Authorization: Bearer {token}`
- Expiration : 1 heure
- Payload : `{ id: userId, email, role }`

### Rate Limiting

- **GET /api/cart** : 100 req/min/IP
- **POST /api/cart/items** : 50 req/min/IP (prévenir spam)
- **POST /api/cart/promo** : 10 req/min/IP (prévenir brute force)
- **Admin analytics** : 100 req/min/user

### Validation Input

**Zod schemas** :
- `AddItemSchema` : product_id (number), quantity (1-999), custom_price (optional)
- `UpdateItemSchema` : quantity (0-999)
- `ApplyPromoSchema` : promoCode (alphanumeric, 3-50 chars)

### Access Control

- **Endpoints publics** : GET/POST/PUT/DELETE cart, promo, shipping
- **Endpoints admin** : Analytics (level 8+)
- **Fusion panier** : Authentification requise

---

## 📈 Performance

### Objectifs

| Endpoint | Target P95 | Cache TTL |
|----------|-----------|-----------|
| GET /api/cart | < 150ms | Redis 5 min |
| POST /api/cart/items | < 200ms | Redis 5 min |
| PUT /api/cart/items/:id | < 180ms | Redis 5 min |
| DELETE /api/cart/items/:id | < 150ms | Redis 5 min |
| POST /api/cart/promo | < 200ms | PromoService Redis 1 min |
| POST /api/cart/shipping/calculate | < 250ms | N/A |
| GET /api/cart/analytics/report | < 500ms | Redis 1 min |

### Optimisations

1. **Redis cache** : Sessions panier (5 min TTL auto-renouvelé)
2. **PromoService cache** : Codes promo (1 min TTL)
3. **Indexes PostgreSQL** : Sur `user_id`, `session_id`, `cart_status`, `cart_created_at`
4. **Requêtes agrégées** : Analytics calculées avec SQL aggregates
5. **Lazy loading** : Métadonnées produits chargées à la demande

---

## 🧪 Tests

### Coverage Targets

- **Unit tests** : ≥ 80% (services)
- **Integration tests** : ≥ 60% (controller + Redis + DB)
- **E2E tests** : Flows critiques (ajout item, fusion panier, conversion)

### Tests Prioritaires

#### CartService

```typescript
describe('CartService', () => {
  it('should apply valid promo code', async () => {
    const result = await service.applyPromoCode('sess123', 'WELCOME10');
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(10.00);
  });

  it('should reject expired promo code', async () => {
    const result = await service.applyPromoCode('sess123', 'EXPIRED');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('expiré');
  });
});
```

#### CartCalculationService

```typescript
describe('CartCalculationService', () => {
  it('should calculate cart totals with TVA 20%', async () => {
    const items = [
      { product_id: 1, quantity: 2, price: 50.00 }
    ];
    const result = await service.calculateCart(items);
    expect(result.subtotalHT).toBe(100.00);
    expect(result.tva).toBe(20.00);
    expect(result.totalTTC).toBe(120.00);
  });

  it('should apply free shipping above 150€', async () => {
    const items = [
      { product_id: 1, quantity: 4, price: 50.00 }
    ];
    const result = await service.calculateCart(items);
    expect(result.shippingFee).toBe(0); // > 150€
  });
});
```

#### CartValidationService

```typescript
describe('CartValidationService', () => {
  it('should validate stock availability', async () => {
    const result = await service.validateStock(456, 2);
    expect(result.isValid).toBe(true);
  });

  it('should reject insufficient stock', async () => {
    const result = await service.validateStock(456, 999);
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('insuffisant');
  });
});
```

---

## 📚 Dependencies

### NestJS Modules

- `@nestjs/common` - Core framework
- `@nestjs/config` - Configuration
- `ioredis` - Redis client

### External Services

- **Redis** - Cache sessions panier (5 min TTL)
- **PromoModule** - Validation codes promo (Zod + Cache)
- **ShippingModule** - Calcul frais de port
- **ProductsModule** - Métadonnées produits, stock
- **OrdersModule** - Conversion panier → commande

### Database

- `@supabase/supabase-js` - Supabase client
- `SupabaseBaseService` - Classe de base

---

## 🔄 Fusion Panier (Guest → Authenticated)

### Workflow Détaillé

```typescript
/**
 * Fusion automatique panier invité → authentifié à la connexion
 * 
 * Déclencheur : AuthModule après login réussi
 * 
 * Logique :
 * 1. Récupérer panier invité (session_id)
 * 2. Récupérer panier authentifié (user_id)
 * 3. Merge items :
 *    - Si produit existe dans les 2 → Additionner quantités
 *    - Si produit uniquement invité → Ajouter au panier auth
 * 4. Transférer promo/shipping si définis (invité → auth)
 * 5. Recalculer totaux
 * 6. Sauvegarder panier fusionné Redis (user_id)
 * 7. Supprimer panier invité Redis (session_id)
 * 8. Stocker info fusion en session (affichage notification)
 * 9. Retourner panier fusionné
 */
```

**Exemple** :

```
Avant connexion :
  Invité (sess_abc123) : 3 articles (A, B, C)
  Authentifié (user_12345) : 2 articles (B, D)

Après connexion :
  Fusionné (user_12345) : 5 articles distincts
    - A : quantité invité
    - B : quantité invité + quantité auth
    - C : quantité invité
    - D : quantité auth inchangée

Notification :
  "Vos 3 nouveaux articles ont été ajoutés aux 2 articles déjà présents"
```

---

## 🚀 Deployment

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=xxx
REDIS_DB=0
REDIS_TTL=300                       # 5 minutes

# Cart Settings
CART_SESSION_COOKIE=userSession
CART_FREE_SHIPPING_THRESHOLD=150    # €
CART_MAX_ITEMS=50                   # Limite items/panier
CART_MAX_QUANTITY_PER_ITEM=999

# TVA
CART_TVA_RATE=0.20                  # 20%

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
```

### Redis Configuration

**docker-compose.yml** :
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
```

**Connection pooling** :
```typescript
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB),
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
});
```

---

## 📖 Related Documentation

- [Payment Cart System](./payment-cart-system.md) - Frontend checkout flow
- [Products Module](./products.md) - Métadonnées produits, stock
- [Orders Module](./orders.md) - Conversion panier → commande
- [Promo Module](./promo.md) - Codes promo, validation Zod
- [Shipping Module](./shipping.md) - Calcul frais de port
- [ADR-001: Supabase Direct](../architecture/001-supabase-direct.md)

---

## ✅ Acceptance Criteria

### Critères Fonctionnels

- [ ] CRUD complet : GET, POST, PUT, DELETE items
- [ ] Panier multi-contextes (invité + authentifié)
- [ ] Fusion automatique à la connexion
- [ ] Calculs automatiques (TVA, shipping, remises)
- [ ] Codes promo validation et application
- [ ] Frais de port dynamiques (zone, poids, seuil franco)
- [ ] Analytics abandon et conversion
- [ ] Recommendations produits
- [ ] Session persistante Redis (5 min TTL)

### Critères Techniques

- [ ] Validation Zod sur tous les DTOs
- [ ] Tests unitaires ≥ 80% coverage
- [ ] Tests intégration ≥ 60% coverage
- [ ] Redis cache fonctionnel (TTL 5 min)
- [ ] Indexes PostgreSQL créés (analytics)
- [ ] Rate limiting actif (prévenir spam)
- [ ] Cookie sécurisé (HttpOnly, Secure, SameSite)

### Critères Performance

- [ ] GET /api/cart < 150ms (p95)
- [ ] POST /api/cart/items < 200ms (p95)
- [ ] PUT /api/cart/items/:id < 180ms (p95)
- [ ] DELETE /api/cart/items/:id < 150ms (p95)
- [ ] POST /api/cart/promo < 200ms (p95)
- [ ] GET /api/cart/analytics/report < 500ms (p95)

### Critères Sécurité

- [ ] Cookie HttpOnly + Secure + SameSite
- [ ] Rate limiting actif (spam prevention)
- [ ] Validation input Zod (injection prevention)
- [ ] Access control admin (analytics)

---

## 🐛 Known Issues

1. **Validation stock désactivée temporairement** : Warning logs présents (déboguer intégration StockService)
2. **Recommandations basiques** : Algorithme simple v1 (ML prévu v2)
3. **Fusion panier** : Notification affichée 1 seule fois (session-based)

---

## 🔮 Future Enhancements

1. **Machine Learning recommendations** : Algorithme ML basé sur historique achats
2. **Wishlist integration** : Transfert panier → wishlist
3. **Export panier** : PDF/Email pour devis
4. **Multi-devises** : Support EUR, USD, GBP
5. **Comparaison prix** : Historique prix produits
6. **A/B testing** : Seuils franco de port, codes promo
7. **Real-time sync** : WebSockets pour sync multi-devices
8. **Scheduled cleanup** : Cron job purge paniers expirés (> 30 jours)

---

**Version:** 1.0.0  
**Last Updated:** 2025-11-18  
**Status:** ✅ Implemented (Production)  
**Maintainer:** Backend Team
