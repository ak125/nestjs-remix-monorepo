# Module Cart - API de Gestion du Panier avec Validation Zod

## 📋 Vue d'ensemble

Le module Cart fournit une API complète pour la gestion du panier d'achats dans le monorepo NestJS/Remix. Il utilise **Zod** pour la validation robuste des données, Supabase comme service de base de données et s'interface avec la table PostgreSQL `cart_items`.

## 🛡️ Validation avec Zod

### Pourquoi Zod ?

- **Validation runtime** : Contrairement à TypeScript (compile-time), Zod valide les données au moment de l'exécution
- **Messages d'erreur clairs** : Erreurs détaillées et compréhensibles pour le développement et le débogage
- **Inférence de types** : Génération automatique des types TypeScript à partir des schémas
- **Extensibilité** : Schémas complexes, transformations et validations personnalisées

### Schémas de Validation Principaux

#### AddToCartSchema
```typescript
const AddToCartSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive().max(99),
  metadata: z.record(z.string(), z.any()).optional()
});
```

#### UpdateCartItemSchema  
```typescript
const UpdateCartItemSchema = z.object({
  quantity: z.number().int().positive().max(99)
});
```

#### CartItemMetadataSchema
```typescript
const CartItemMetadataSchema = z.object({
  source: z.enum(['web', 'mobile', 'api']).optional(),
  session_id: z.string().optional(),
  referrer: z.string().url().optional(),
  promo_code: z.string().optional(),
  notes: z.string().max(500).optional(),
  custom_options: z.record(z.string(), z.any()).optional()
});
```

### Exemples de Validation

#### ✅ Données Valides
```json
{
  "product_id": 123,
  "quantity": 2,
  "metadata": {
    "source": "web",
    "session_id": "sess_abc123",
    "notes": "Commande urgente"
  }
}
```

#### ❌ Données Invalides
```json
{
  "product_id": "abc",        // ❌ Doit être un nombre
  "quantity": -1,             // ❌ Doit être positif
  "metadata": {
    "source": "invalid"      // ❌ Doit être 'web', 'mobile', ou 'api'
  }
}
```

### Messages d'Erreur Zod

Les erreurs de validation retournent des messages détaillés :

```json
{
  "success": false,
  "message": "Données invalides pour add to cart data: Expected number, received string",
  "statusCode": 400
}
```

## 🗄️ Structure de Base de Données

### Table `cart_items`
```sql
- id: number (PRIMARY KEY)
- user_id: string (FOREIGN KEY vers ___xtr_customer.cst_id)  
- product_id: number (FOREIGN KEY vers pieces.piece_id)
- quantity: number
- created_at: string (timestamp)
- updated_at: string (timestamp)
- metadata: jsonb (optionnel)
```

## 🚀 API Endpoints

### Récupération du Panier

#### `GET /cart`
Récupère le panier complet avec résumé et détails des produits.

**Headers requis:**
```
x-user-id: string
```

**Réponse:**
```json
{
  "items": [
    {
      "id": 1,
      "user_id": "user123",
      "product_id": 456,
      "quantity": 2,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z",
      "product": {
        "piece_id": 456,
        "piece_ref": "REF123",
        "piece_name": "Pièce auto",
        "piece_price_ttc": 29.99,
        "piece_weight": 0.5,
        "piece_stock": 10
      },
      "unit_price": 29.99,
      "total_price": 59.98
    }
  ],
  "summary": {
    "total_items": 1,
    "total_quantity": 2,
    "subtotal": 59.98,
    "shipping_cost": 5.99,
    "total": 65.97,
    "currency": "EUR"
  },
  "estimated_shipping": {
    "weight": 1.0,
    "estimated_cost": 5.99
  }
}
```

#### `GET /cart/items`
Récupère uniquement la liste des articles du panier.

#### `GET /cart/summary` 
Récupère uniquement le résumé du panier.

#### `GET /cart/count`
Récupère le nombre total d'articles dans le panier.

**Réponse:**
```json
{
  "count": 5
}
```

### Gestion des Articles

#### `POST /cart/add`
Ajoute un article au panier ou met à jour la quantité s'il existe déjà.

**Body:**
```json
{
  "product_id": 456,
  "quantity": 2,
  "metadata": {
    "source": "web",
    "promo_code": "WELCOME10"
  }
}
```

**Réponse:**
```json
{
  "success": true,
  "message": "Article ajouté au panier avec succès",
  "data": {
    "id": 1,
    "user_id": "user123",
    "product_id": 456,
    "quantity": 2,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
}
```

#### `PUT /cart/items/:itemId`
Met à jour la quantité d'un article existant.

**Body:**
```json
{
  "quantity": 3
}
```

#### `DELETE /cart/items/:itemId`
Supprime un article spécifique du panier.

#### `DELETE /cart/clear`
Vide complètement le panier de l'utilisateur.

### Actions Rapides

#### `POST /cart/items/:itemId/increment`
Incrémente la quantité d'un article de 1.

#### `POST /cart/items/:itemId/decrement`
Décrémente la quantité d'un article de 1. Si la quantité devient 0, l'article est supprimé.

## 🔧 Configuration et Règles

### Règles par Défaut du Panier
```typescript
{
  max_quantity_per_item: 99,
  max_total_items: 50,
  min_order_amount: 10.00,
  free_shipping_threshold: 50.00,
  allowed_product_types: ['piece', 'accessoire', 'service']
}
```

### Calcul des Frais de Port
- Frais minimum: 5.99€
- Calcul: `max(5.99, poids_total * 0.1)`
- Livraison gratuite si total > 50€

## 🛡️ Validations

### Validation du Stock
- Vérification automatique de la disponibilité
- Contrôle des quantités demandées vs stock disponible
- Messages d'erreur explicites en cas de stock insuffisant

### Validation des Règles Métier
- Quantité maximale par article
- Nombre maximal d'articles dans le panier
- Montant minimum de commande

## 🗂️ Structure des Fichiers avec Zod

```
src/modules/cart/
├── dto/
│   ├── cart.dto.ts                 # Schémas Zod complets + types inférés
│   ├── add-to-cart.dto.ts         # Schéma Zod pour l'ajout + validation  
│   └── update-cart-item.dto.ts    # Schéma Zod pour mise à jour + validation
├── interfaces/
│   └── cart.interface.ts          # Interfaces TypeScript complémentaires
├── cart.controller.ts             # Contrôleur avec validation Zod intégrée
├── cart.service.ts                # Service avec validation des règles métier
├── cart.module.ts                 # Module NestJS
└── README.md                      # Documentation complète
```

## 🔧 Architecture de Validation

### 1. Validation au Niveau du Contrôleur
- Validation immédiate des données entrantes
- Messages d'erreur clairs pour l'API
- Validation des headers (x-user-id)

### 2. Validation au Niveau du Service  
- Validation des règles métier
- Validation des données inter-services
- Validation des métadonnées complexes

### 3. Validation au Niveau de la Base de Données
- Validation des contraintes de stock
- Validation des relations (user_id, product_id)
- Validation des données calculées (prix, poids)

## 📊 Avantages de l'Approche Zod

### 🎯 Sécurité Renforcée
- Validation runtime des données utilisateur
- Protection contre les injections de données
- Validation stricte des types et formats

### 🚀 Expérience Développeur Améliorée  
- Auto-complétion TypeScript parfaite
- Erreurs de validation détaillées
- Refactoring sûr des schémas

### 🔄 Maintenabilité
- Schémas centralisés et réutilisables
- Évolution facile des validations
- Tests de validation automatisés

### ⚡ Performance
- Validation rapide et efficace
- Pas de dépendances lourdes (class-validator, class-transformer)
- Bundle plus léger

## 🔄 Intégration avec Supabase

Le module utilise `SupabaseRestService` pour toutes les opérations de base de données :

- **Méthodes ajoutées:**
  - `getCartItems(userId)`: Récupère les articles avec détails produit
  - `addToCart(userId, productId, quantity)`: Ajoute/met à jour un article
  - `updateCartItemQuantity(userId, itemId, quantity)`: Met à jour la quantité
  - `removeFromCart(userId, itemId)`: Supprime un article
  - `clearCart(userId)`: Vide le panier
  - `getCartSummary(userId)`: Calcule le résumé
  - `getCompleteCart(userId)`: Récupère le panier complet

## 🧪 Tests et Utilisation

### Test avec cURL - Exemples de Validation

```bash
# ✅ Ajout valide
curl -X POST http://localhost:3001/cart/add \
  -H "x-user-id: test-user-123" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "quantity": 2,
    "metadata": {
      "source": "web",
      "notes": "Test avec métadonnées"
    }
  }'

# ❌ Test validation product_id invalide
curl -X POST http://localhost:3001/cart/add \
  -H "x-user-id: test-user-123" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "abc",
    "quantity": 2
  }'
# Réponse: 400 Bad Request - "Expected number, received string"

# ❌ Test validation quantity négative
curl -X POST http://localhost:3001/cart/add \
  -H "x-user-id: test-user-123" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "quantity": -1
  }'
# Réponse: 400 Bad Request - "Number must be greater than 0"

# ❌ Test validation quantity trop élevée
curl -X POST http://localhost:3001/cart/add \
  -H "x-user-id: test-user-123" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "quantity": 150
  }'
# Réponse: 400 Bad Request - "Number must be less than or equal to 99"

# ✅ Mise à jour valide
curl -X PUT http://localhost:3001/cart/items/1 \
  -H "x-user-id: test-user-123" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 5
  }'

# ❌ Test validation header manquant
curl -X GET http://localhost:3001/cart
# Réponse: 400 Bad Request - "Header x-user-id requis et non vide"
```

## 🧪 Tests de Validation Automatisés

Le projet inclut un script de test spécialisé pour la validation Zod :

```bash
# Exécuter les tests de validation
./test-cart-zod-validation.sh
```

Ce script teste automatiquement :
- ✅ Validation des types de données
- ✅ Validation des champs requis/optionnels  
- ✅ Validation des valeurs limites
- ✅ Validation des headers
- ✅ Gestion des erreurs JSON malformées
- ✅ Validation des métadonnées personnalisées

## 📝 Notes Importantes

1. **Authentification**: Le module utilise actuellement le header `x-user-id` pour identifier l'utilisateur. À terme, il faudra intégrer le système JWT du projet.

2. **Relations de Base de Données**: 
   - `user_id` → `___xtr_customer.cst_id`
   - `product_id` → `pieces.piece_id`

3. **Gestion des Erreurs**: Toutes les opérations incluent une gestion d'erreur complète avec logging.

4. **Performance**: Les requêtes utilisent des JOINs optimisés pour récupérer les détails des produits en une seule requête.

5. **Extensibilité**: Le champ `metadata` permet d'ajouter des informations personnalisées (codes promo, source, etc.).

## 🔮 Évolutions Futures

- [ ] Intégration complète avec le système JWT
- [ ] Gestion des codes promo
- [ ] Cache Redis pour les paniers fréquemment consultés  
- [ ] Synchronisation panier invité/utilisateur connecté
- [ ] Notifications en temps réel des changements de stock
- [ ] API GraphQL en complément du REST
