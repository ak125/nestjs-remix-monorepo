# Services Data - API Reference

Documentation complète des services d'accès données (Repository Pattern).

## 🏗️ Architecture

Tous les services héritent de `SupabaseBaseService` qui fournit :

- ✅ Client Supabase initialisé avec service role
- ✅ Circuit breaker intégré (protection pannes)
- ✅ Retry automatique avec exponential backoff
- ✅ Logging structuré
- ✅ Bypass RLS automatique

```typescript
@Injectable()
export abstract class SupabaseBaseService {
  protected readonly supabase: SupabaseClient;
  protected readonly logger: Logger;
  
  // Circuit breaker (5 échecs → OPEN → 60s timeout)
  private circuitBreaker: CircuitBreakerState;
  
  // Retry avec backoff [1s, 2s, 4s]
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries = 3
  ): Promise<T | null>
  
  // Status monitoring
  getCircuitBreakerStatus(): CircuitBreakerState
}
```

## 📦 Services disponibles

| Service | Tables | Description |
|---------|--------|-------------|
| `CartDataService` | Redis + `pieces` | Paniers e-commerce session Redis |
| `OrderDataService` | `___xtr_order` | CRUD commandes utilisateur |
| `OrderRepository` | `___xtr_order`, `___xtr_order_line` | Accès bas niveau commandes |
| `UserDataService` | `___xtr_customer` | Clients B2C |
| `StaffDataService` | `___xtr_customer` | Utilisateurs B2B (flag `cst_level`) |
| `PromoDataService` | `promo_codes` | Codes promotionnels |
| `ShippingDataService` | `shipping_rates_cache` | Calcul frais de port |
| `RedisCacheService` | Redis | Cache générique |
| `PaymentService` | `ic_postback` | Webhooks Paybox |
| `InvoicesService` | `___xtr_invoice` | Génération factures PDF |
| `LegacyOrderService` | `___xtr_order` | Rétrocompatibilité PHP |
| `LegacyUserService` | `___xtr_customer` | Rétrocompatibilité PHP |

## 🛒 CartDataService

Gestion paniers e-commerce en Redis avec validation produits Supabase.

### Schémas de validation

```typescript
const CartItemSchema = z.object({
  id: z.string().optional(),
  user_id: z.string(),
  product_id: z.string(),
  quantity: z.number().min(1).max(99),
  price: z.number().min(0),
  product_name: z.string().optional(),
  product_sku: z.string().optional(),
  product_brand: z.string().optional(),
  product_image: z.string().optional(),
  weight: z.number().min(0).optional(),
  options: z.record(z.string(), z.any()).optional(),
});

type CartItem = z.infer<typeof CartItemSchema>;
```

### Méthodes principales

#### `getCartWithMetadata(sessionId: string)`

Récupère panier complet avec métriques calculées.

**Paramètres** :
- `sessionId` (string) - ID session utilisateur

**Retour** :
```typescript
{
  metadata: {
    user_id: string,
    subtotal: number,
    total: number,
    promo_code?: string,
    promo_discount: number,
  },
  items: CartItem[], // Items enrichis avec données produits
  stats: {
    itemCount: number,
    totalQuantity: number,
    subtotal: number,
    consigne_total: number, // Consignes emballages
    total: number,
    hasPromo: boolean,
    promoDiscount: number,
    hasShipping: boolean,
    shippingCost: number,
  },
  appliedPromo?: AppliedPromo,
}
```

**Exemple** :
```typescript
const cart = await cartService.getCartWithMetadata('sess_abc123');

console.log(`Panier: ${cart.stats.itemCount} articles`);
console.log(`Total: ${cart.stats.total}€ TTC`);
if (cart.appliedPromo) {
  console.log(`Promo: -${cart.stats.promoDiscount}€`);
}
```

#### `addCartItem(sessionId, productId, quantity, customPrice?, replace?)`

Ajoute/met à jour un produit dans le panier.

**Paramètres** :
- `sessionId` (string) - ID session
- `productId` (number) - ID produit (FK `pieces.piece_id`)
- `quantity` (number) - Quantité (1-99)
- `customPrice` (number, optionnel) - Prix personnalisé (override DB)
- `replace` (boolean, optionnel) - Remplacer quantité au lieu d'additionner

**Retour** : `CartItem` - Item ajouté/mis à jour

**Validation** :
- Produit existe en base (`pieces` table)
- Quantité respecte min/max vente
- Prix > 0

**Exemple** :
```typescript
// Ajouter 2 disques de frein
const item = await cartService.addCartItem('sess_abc', 12345, 2);

// Forcer quantité à 1 (remplacer au lieu d'ajouter)
const item = await cartService.addCartItem('sess_abc', 12345, 1, null, true);
```

#### `removeCartItem(sessionId, productId)`

Retire un produit du panier.

**Paramètres** :
- `sessionId` (string)
- `productId` (string) - ID produit à retirer

**Retour** : `void`

**Exemple** :
```typescript
await cartService.removeCartItem('sess_abc', '12345');
```

#### `clearCart(sessionId)`

Vide complètement le panier.

**Paramètres** :
- `sessionId` (string)

**Retour** : `void`

**Exemple** :
```typescript
// Après paiement confirmé
await cartService.clearCart(order.sessionId);
```

#### `applyPromoCode(sessionId, promoCode)`

Applique un code promotionnel au panier.

**Paramètres** :
- `sessionId` (string)
- `promoCode` (string) - Code promo (ex: "NOEL2024")

**Retour** :
```typescript
{
  success: boolean,
  discount_amount: number,
  promo: AppliedPromo,
}
```

**Validation** :
- Code existe en DB (`promo_codes`)
- Code actif (`active = 1`)
- Date validité respectée (`valid_from` ≤ now ≤ `valid_until`)
- Montant minimum panier respecté
- Limite utilisation non atteinte

**Exemple** :
```typescript
const result = await cartService.applyPromoCode('sess_abc', 'NOEL2024');

if (result.success) {
  console.log(`Réduction: -${result.discount_amount}€`);
} else {
  console.error('Code promo invalide');
}
```

#### `getProductWithAllData(productId)`

Récupère détails complets d'un produit (internal).

**Requête SQL** :
```sql
SELECT 
  p.piece_id,
  p.piece_ref,
  p.piece_name,
  p.piece_des,
  p.piece_weight_kgm,
  pm.pm_name AS piece_marque,
  pp.pri_vente_ttc AS price_ttc,
  pp.pri_consigne_ttc AS consigne_ttc,
  pmi.pmi_name AS image_filename
FROM pieces p
LEFT JOIN pieces_marque pm ON p.piece_pm_id = pm.pm_id
LEFT JOIN pieces_price pp ON p.piece_id = pp.pri_piece_id
LEFT JOIN pieces_media_img pmi ON p.piece_id = pmi.pmi_piece_id
WHERE p.piece_id = ?
  AND p.piece_display = '1'
LIMIT 1;
```

### Configuration Redis

```typescript
// Clés Redis
const CART_REDIS_PREFIX = 'cart:';
const PROMO_REDIS_PREFIX = 'cart:promo:';

// TTL (Time To Live)
const CART_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 jours

// Structure clés
cart:{sessionId} → CartItem[]
cart:promo:{sessionId} → AppliedPromo
```

### Workflow typique

```typescript
// 1. Ajouter produits au panier
await cartService.addCartItem(sessionId, 12345, 2);
await cartService.addCartItem(sessionId, 67890, 1);

// 2. Appliquer code promo
await cartService.applyPromoCode(sessionId, 'PROMO10');

// 3. Calculer frais de port
const shipping = await shippingService.calculateRate(cart, zipCode);
await cartService.applyShipping(sessionId, shipping);

// 4. Récupérer total final
const cart = await cartService.getCartWithMetadata(sessionId);
console.log(`Total à payer: ${cart.stats.total}€ TTC`);

// 5. Créer commande
const order = await orderService.createFromCart(sessionId);

// 6. Vider panier après paiement
await cartService.clearCart(sessionId);
```

## 📦 OrderDataService

Gestion CRUD commandes utilisateur.

### Méthodes

#### `getUserOrders(userId: string)`

Récupère toutes les commandes d'un utilisateur.

**Paramètres** :
- `userId` (string) - ID client (FK `___xtr_customer.cst_id`)

**Retour** : `Order[]` - Liste commandes triées par date DESC

**Exemple** :
```typescript
const orders = await orderService.getUserOrders('12345');

orders.forEach(order => {
  console.log(`${order.orderNumber} - ${order.status} - ${order.totalTtc}€`);
});
```

#### `getOrderById(orderId: number)`

Récupère une commande spécifique.

**Paramètres** :
- `orderId` (number) - ID commande

**Retour** : `Order`

**Exceptions** :
- `NotFoundException` si commande introuvable

**Exemple** :
```typescript
try {
  const order = await orderService.getOrderById(456);
  console.log(`Commande ${order.orderNumber} créée le ${order.createdAt}`);
} catch (error) {
  console.error('Commande introuvable');
}
```

#### `createOrder(orderData: Partial<Order>)`

Crée une nouvelle commande.

**Paramètres** :
- `orderData` (Partial<Order>) - Données commande

**Structure** :
```typescript
{
  customerId: string,
  status: OrderStatus,
  totalHt: number,
  totalTtc: number,
  shippingCost: number,
  promoCode?: string,
  promoDiscount?: number,
  paymentMethod: string,
  paymentStatus: string,
}
```

**Retour** : `Order` - Commande créée

**Exemple** :
```typescript
const order = await orderService.createOrder({
  customerId: '12345',
  status: OrderStatus.Pending,
  totalHt: 85.50,
  totalTtc: 102.60,
  shippingCost: 7.90,
  promoCode: 'NOEL2024',
  promoDiscount: 10.00,
  paymentMethod: 'CB',
  paymentStatus: 'pending',
});

console.log(`Commande créée: ${order.orderNumber}`);
```

#### `updateOrderStatus(orderId: number, status: OrderStatus)`

Met à jour le statut d'une commande.

**Statuts disponibles** :
```typescript
enum OrderStatus {
  Draft = 1,        // Panier
  Pending = 2,      // Attente paiement
  Paid = 3,         // Payé
  Processing = 4,   // Préparation
  Shipped = 5,      // Expédié
  Delivered = 6,    // Livré
  Cancelled = 7,    // Annulé
}
```

**Exemple** :
```typescript
// Marquer commande comme payée après webhook Paybox
await orderService.updateOrderStatus(order.id, OrderStatus.Paid);

// Marquer comme expédiée
await orderService.updateOrderStatus(order.id, OrderStatus.Shipped);
```

### Mappers

```typescript
class OrderMapper {
  // DB (snake_case) → TypeScript (camelCase)
  static fromDb(dbOrder: any): Order {
    return {
      id: dbOrder.ord_id,
      orderNumber: dbOrder.ord_number,
      customerId: dbOrder.ord_cst_id,
      status: dbOrder.ord_status,
      totalHt: parseFloat(dbOrder.ord_total_ht),
      totalTtc: parseFloat(dbOrder.ord_total_ttc),
      createdAt: new Date(dbOrder.ord_created_at),
    };
  }
  
  // TypeScript → DB
  static toDb(order: Partial<Order>): any {
    return {
      ord_cst_id: order.customerId,
      ord_status: order.status,
      ord_total_ht: order.totalHt,
      ord_total_ttc: order.totalTtc,
      ord_created_at: order.createdAt,
    };
  }
}
```

## 👤 UserDataService

Gestion clients B2C.

### Méthodes principales

#### `findByEmail(email: string)`

Recherche client par email.

**Retour** : `Customer | null`

**Exemple** :
```typescript
const customer = await userService.findByEmail('john@example.com');

if (customer) {
  console.log(`Client trouvé: ${customer.name} ${customer.firstName}`);
} else {
  console.log('Client introuvable');
}
```

#### `create(customerData)`

Crée un nouveau client.

**Paramètres** :
```typescript
{
  email: string,
  password: string,    // Hash bcrypt avant insertion
  name: string,
  firstName: string,
  phone?: string,
  isCompany: boolean,
  companyName?: string,
  siret?: string,
  isPro: boolean,      // Tarifs pro si true
}
```

**Exemple** :
```typescript
const hashedPassword = await bcrypt.hash(plainPassword, 10);

const customer = await userService.create({
  email: 'john@example.com',
  password: hashedPassword,
  name: 'Doe',
  firstName: 'John',
  phone: '0612345678',
  isCompany: false,
  isPro: false,
});
```

#### `updateProfile(customerId, updateData)`

Met à jour profil client.

**Exemple** :
```typescript
await userService.updateProfile(customer.id, {
  phone: '0687654321',
  firstName: 'Jean',
});
```

## 🎫 PromoDataService

Gestion codes promotionnels.

### Méthodes

#### `validatePromoCode(code: string, cartTotal: number)`

Valide un code promo et calcule la réduction.

**Validation** :
- ✅ Code existe en DB
- ✅ Code actif
- ✅ Date validité respectée
- ✅ Montant minimum panier respecté
- ✅ Limite utilisation non atteinte

**Retour** :
```typescript
{
  valid: boolean,
  promo?: {
    id: number,
    code: string,
    type: 'percentage' | 'fixed',
    value: number,
    discount_amount: number, // Montant calculé
  },
  error?: string,
}
```

**Exemple** :
```typescript
const result = await promoService.validatePromoCode('NOEL2024', 150.00);

if (result.valid) {
  console.log(`Réduction: -${result.promo.discount_amount}€`);
} else {
  console.error(`Erreur: ${result.error}`);
}
```

#### `incrementUsage(promoId: number)`

Incrémente compteur utilisation après commande validée.

**Exemple** :
```typescript
// Après paiement confirmé
await promoService.incrementUsage(promo.id);
```

## 🚚 ShippingDataService

Calcul frais de port basé sur poids et zone géographique.

### Méthodes

#### `calculateRate(weight: number, zipCode: string, country: string)`

Calcule frais de port depuis cache ou API transporteur.

**Paramètres** :
- `weight` (number) - Poids total en kg
- `zipCode` (string) - Code postal livraison
- `country` (string) - Pays (ISO 3166-1)

**Retour** :
```typescript
{
  rate: number,
  method: string,
  deliveryTime: string,
  zone: string,
}
```

**Zones** :
- `france` - France métropolitaine
- `corse` - Corse
- `domtom1` - Guadeloupe, Martinique, Réunion
- `domtom2` - Guyane, Mayotte, Polynésie

**Exemple** :
```typescript
const cart = await cartService.getCartWithMetadata(sessionId);
const totalWeight = cart.items.reduce((sum, item) => 
  sum + (item.weight || 0) * item.quantity, 0
);

const shipping = await shippingService.calculateRate(
  totalWeight,
  '75001',
  'FR'
);

console.log(`Frais de port: ${shipping.rate}€ (${shipping.deliveryTime})`);
```

## 💾 RedisCacheService

Cache générique multi-usages.

### Méthodes

#### `set(key: string, value: any, ttl?: number)`

Stocke une valeur dans Redis.

**Paramètres** :
- `key` (string) - Clé unique
- `value` (any) - Valeur (sérialisée JSON)
- `ttl` (number, optionnel) - Durée de vie en secondes

**Exemple** :
```typescript
// Cache 5 minutes
await cacheService.set('product:12345', productData, 300);
```

#### `get<T>(key: string)`

Récupère une valeur depuis Redis.

**Retour** : `T | null`

**Exemple** :
```typescript
const cached = await cacheService.get<Product>('product:12345');

if (cached) {
  return cached; // Cache hit
} else {
  // Cache miss → requête DB
  const product = await db.getProduct(12345);
  await cacheService.set('product:12345', product, 300);
  return product;
}
```

#### `delete(key: string)`

Supprime une clé du cache.

**Exemple** :
```typescript
// Invalider cache après mise à jour produit
await cacheService.delete('product:12345');
```

#### `clear(pattern: string)`

Supprime toutes les clés matchant un pattern.

**Exemple** :
```typescript
// Invalider tous les paniers
await cacheService.clear('cart:*');

// Invalider cache produits gamme freinage
await cacheService.clear('products:FREINAGE:*');
```

## 🔐 Bonnes pratiques

### Gestion des erreurs

```typescript
try {
  const order = await orderService.getOrderById(123);
} catch (error) {
  if (error instanceof NotFoundException) {
    return res.status(404).json({ error: 'Commande introuvable' });
  }
  
  this.logger.error('Erreur récupération commande:', error);
  return res.status(500).json({ error: 'Erreur serveur' });
}
```

### Utilisation du circuit breaker

```typescript
// Vérifier état circuit breaker avant opérations critiques
const cbStatus = orderService.getCircuitBreakerStatus();

if (cbStatus.state === 'open') {
  return res.status(503).json({ 
    error: 'Service temporairement indisponible',
    retryAfter: 60 
  });
}
```

### Cache strategy

```typescript
// Pattern : Cache-Aside
async getProduct(productId: number): Promise<Product> {
  // 1. Vérifier cache
  const cached = await cacheService.get<Product>(`product:${productId}`);
  if (cached) return cached;
  
  // 2. Requête DB si cache miss
  const product = await db.getProduct(productId);
  
  // 3. Mettre en cache (TTL 5 min)
  await cacheService.set(`product:${productId}`, product, 300);
  
  return product;
}
```

## 🔗 Voir aussi

- [Vue d'ensemble](./overview.md) - Architecture complète
- [Schéma Supabase](./supabase-schema.md) - Tables SQL
- [Schéma Prisma](./prisma-schema.md) - Auth + Analytics
- [Authentication](../guides/authentication.md) - JWT workflow
