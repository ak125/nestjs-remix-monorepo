# 🔗 Intégrations Module Orders - Architecture Système

**Date:** 2025-10-05  
**Module:** Orders  
**Relations:** Users, Cart, Payment, Products, Messages

---

## 📊 Vue d'Ensemble des Intégrations

Le module **Orders** est au cœur de l'application et interagit avec plusieurs autres modules pour gérer le cycle complet des commandes.

```
┌─────────────────────────────────────────────────────────────┐
│                     ÉCOSYSTÈME ORDERS                       │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
    ┌───▼───┐            ┌───▼───┐            ┌───▼────┐
    │ USERS │            │ CART  │            │PRODUCTS│
    └───┬───┘            └───┬───┘            └───┬────┘
        │                    │                    │
        │         ┌──────────▼────────┐          │
        │         │      ORDERS       │          │
        │         │   (Module Core)   │          │
        │         └──────────┬────────┘          │
        │                    │                    │
    ┌───▼────┐          ┌───▼────┐          ┌───▼────┐
    │MESSAGES│          │PAYMENT │          │SUPPLIER│
    └────────┘          └────────┘          └────────┘
```

---

## 🔗 1. Module USERS ↔ ORDERS

### Description
Le module Users gère l'authentification et les informations clients. Chaque commande est liée à un utilisateur (customer).

### Tables Impliquées

#### Users (___XTR_CUSTOMER)
```sql
___XTR_CUSTOMER
├── cst_id (PK)              → Identifiant unique client
├── cst_mail                 → Email (authentification)
├── cst_name                 → Nom de famille
├── cst_fname                → Prénom
├── cst_level                → Niveau compte (1-5)
├── cst_activ                → Compte actif (0/1)
├── cst_siret                → SIRET (si pro)
└── cst_company              → Nom entreprise
```

#### Orders (___XTR_ORDER)
```sql
___XTR_ORDER
├── ord_id (PK)              → ID commande
├── ord_cst_id (FK)          → ⚡ RÉFÉRENCE vers cst_id
├── ord_num                  → Numéro commande
├── ord_status               → Statut (1-99)
├── ord_date                 → Date création
└── ord_total_ttc            → Montant TTC
```

### Relations Clés
```typescript
// Relation 1:N (Un client → Plusieurs commandes)
User (1) ──────── (N) Orders

// Dans le code:
interface Order {
  ord_id: number;
  ord_cst_id: number;        // ⚡ FK vers ___XTR_CUSTOMER.cst_id
  customer?: Customer;        // Relation hydratée
}

interface Customer {
  cst_id: number;            // PK
  orders?: Order[];          // Collection inverse
}
```

### Intégration Backend

#### OrdersController
```typescript
@Controller('api/orders')
export class OrdersController {
  
  // 🔒 Route protégée - Récupère userId via AuthenticatedGuard
  @Get()
  @UseGuards(AuthenticatedGuard)
  async listMyOrders(@Request() req) {
    const userId = req.user?.id;  // ⚡ ID récupéré depuis session
    
    return this.ordersService.findByCustomer({
      customerId: parseInt(userId),
      page: 1,
      limit: 10
    });
  }
  
  // 🔒 Créer commande pour user authentifié
  @Post()
  @UseGuards(AuthenticatedGuard)
  async createOrder(@Request() req, @Body() createDto) {
    const userId = req.user?.id;  // ⚡ User depuis session
    
    return this.ordersService.create({
      ...createDto,
      customerId: parseInt(userId)  // ⚡ Lié automatiquement
    });
  }
}
```

#### OrdersService - Requêtes avec JOIN
```typescript
export class OrdersService {
  
  // Récupérer commandes avec infos client
  async findByCustomer(filters: OrderFilters) {
    const { customerId, page = 1, limit = 10 } = filters;
    
    // ⚡ JOIN avec table customer
    const { data, error } = await this.supabase
      .from('___xtr_order')
      .select(`
        *,
        customer:___xtr_customer!ord_cst_id (
          cst_id,
          cst_mail,
          cst_name,
          cst_fname,
          cst_level
        )
      `)
      .eq('ord_cst_id', customerId)  // ⚡ Filtre par customer
      .order('ord_date', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    
    return {
      orders: data,
      pagination: { page, limit, total: data.length }
    };
  }
}
```

### Guards & Sécurité

#### AuthenticatedGuard
```typescript
// Vérifie que user est connecté
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // ⚡ User récupéré depuis session Passport
    return request.isAuthenticated() && request.user?.id;
  }
}
```

#### Validation Propriétaire
```typescript
// Dans OrdersService
async validateOwnership(orderId: number, userId: number): Promise<boolean> {
  const { data } = await this.supabase
    .from('___xtr_order')
    .select('ord_cst_id')
    .eq('ord_id', orderId)
    .single();
  
  // ⚡ Vérifier que ord_cst_id === userId
  return data?.ord_cst_id === userId;
}
```

### Adresses de Livraison/Facturation

#### Tables Adresses
```sql
-- Adresse de facturation
___XTR_CUSTOMER_BILLING_ADDRESS
├── cba_id (PK)
├── cba_cst_id (FK)          → ⚡ Vers cst_id
├── cba_address
├── cba_zipcode
└── cba_city

-- Adresse de livraison
___XTR_CUSTOMER_DELIVERY_ADDRESS
├── cda_id (PK)
├── cda_cst_id (FK)          → ⚡ Vers cst_id
├── cda_address
├── cda_zipcode
└── cda_city
```

#### Récupération Adresses
```typescript
async getCustomerAddresses(customerId: number) {
  // Billing address
  const { data: billing } = await this.supabase
    .from('___xtr_customer_billing_address')
    .select('*')
    .eq('cba_cst_id', customerId)
    .single();
  
  // Delivery address
  const { data: delivery } = await this.supabase
    .from('___xtr_customer_delivery_address')
    .select('*')
    .eq('cda_cst_id', customerId)
    .single();
  
  return { billing, delivery };
}
```

---

## 🛒 2. Module CART ↔ ORDERS

### Description
Le panier (Cart) est transformé en commande lors de la validation du checkout.

### Flux de Transformation

```
┌─────────┐      ┌──────────┐      ┌─────────┐
│  CART   │─────▶│ CHECKOUT │─────▶│ ORDER   │
└─────────┘      └──────────┘      └─────────┘
   Items            Validation        Création
```

### Process de Conversion

#### 1. Récupérer le Panier
```typescript
async getCartItems(userId: number) {
  const { data: cartItems } = await this.supabase
    .from('___xtr_cart')
    .select(`
      *,
      product:___xtr_product!cart_product_id (
        prd_id,
        prd_name,
        prd_price_ttc
      )
    `)
    .eq('cart_cst_id', userId);
  
  return cartItems;
}
```

#### 2. Créer la Commande
```typescript
async createOrderFromCart(userId: number, checkoutData: CheckoutDto) {
  // 1. Récupérer items panier
  const cartItems = await this.getCartItems(userId);
  
  // 2. Calculer totaux
  const subtotal = cartItems.reduce((sum, item) => 
    sum + (item.product.prd_price_ttc * item.cart_quantity), 0
  );
  
  // 3. Créer la commande
  const { data: order } = await this.supabase
    .from('___xtr_order')
    .insert({
      ord_cst_id: userId,            // ⚡ Lien user
      ord_num: this.generateOrderNumber(),
      ord_date: new Date().toISOString(),
      ord_status: 1,                 // Pending
      ord_total_ht: subtotal,
      ord_total_ttc: subtotal * 1.20,
      ...checkoutData
    })
    .select()
    .single();
  
  // 4. Créer les lignes de commande
  const orderLines = cartItems.map(item => ({
    orl_ord_id: order.ord_id,       // ⚡ Lien order
    orl_prd_id: item.cart_product_id,
    orl_quantity: item.cart_quantity,
    orl_price_ht: item.product.prd_price_ttc / 1.20,
    orl_status: 1
  }));
  
  await this.supabase
    .from('___xtr_order_line')
    .insert(orderLines);
  
  // 5. Vider le panier
  await this.supabase
    .from('___xtr_cart')
    .delete()
    .eq('cart_cst_id', userId);
  
  return order;
}
```

---

## 💳 3. Module PAYMENT ↔ ORDERS

### Description
Gestion des paiements associés aux commandes (Stripe, PayPal, etc.)

### Tables Payment

```sql
___XTR_PAYMENT
├── pay_id (PK)
├── pay_ord_id (FK)          → ⚡ Vers ord_id
├── pay_amount
├── pay_method               → stripe, paypal, bank
├── pay_status               → pending, completed, failed
├── pay_transaction_id
└── pay_date
```

### Intégration

```typescript
async processPayment(orderId: number, paymentData: PaymentDto) {
  // 1. Récupérer commande
  const order = await this.getOrder(orderId);
  
  // 2. Créer transaction payment
  const payment = await this.paymentService.createTransaction({
    orderId: order.ord_id,
    amount: order.ord_total_ttc,
    method: paymentData.method
  });
  
  // 3. Mettre à jour statut commande si succès
  if (payment.status === 'completed') {
    await this.updateOrderStatus(orderId, 2); // Confirmed
  }
  
  return payment;
}
```

---

## 📦 4. Module PRODUCTS ↔ ORDERS

### Description
Les produits commandés sont liés via les lignes de commande.

### Tables Produits

```sql
___XTR_PRODUCT
├── prd_id (PK)
├── prd_name
├── prd_ref
├── prd_price_ttc
└── prd_stock

___XTR_ORDER_LINE
├── orl_id (PK)
├── orl_ord_id (FK)          → ⚡ Vers ord_id
├── orl_prd_id (FK)          → ⚡ Vers prd_id
├── orl_quantity
├── orl_price_ht
└── orl_status
```

### Relations

```typescript
// Relation Order → OrderLines → Products
async getOrderWithProducts(orderId: number) {
  const { data } = await this.supabase
    .from('___xtr_order')
    .select(`
      *,
      lines:___xtr_order_line!orl_ord_id (
        orl_id,
        orl_quantity,
        orl_price_ht,
        product:___xtr_product!orl_prd_id (
          prd_id,
          prd_name,
          prd_ref,
          prd_image
        )
      )
    `)
    .eq('ord_id', orderId)
    .single();
  
  return data;
}
```

### Gestion Stock

```typescript
async decrementStock(orderLines: OrderLine[]) {
  for (const line of orderLines) {
    await this.supabase
      .from('___xtr_product')
      .update({
        prd_stock: this.supabase.raw('prd_stock - ?', [line.orl_quantity])
      })
      .eq('prd_id', line.orl_prd_id);
  }
}
```

---

## 💬 5. Module MESSAGES ↔ ORDERS

### Description
Système de messagerie pour le support client lié aux commandes.

### Tables Messages

```sql
___XTR_MSG
├── msg_id (PK)
├── msg_cst_id (FK)          → ⚡ Vers cst_id (user)
├── msg_ord_id (FK)          → ⚡ Vers ord_id (order)
├── msg_subject
├── msg_content
├── msg_status               → open, closed
└── msg_date
```

### Intégration

```typescript
async createOrderMessage(orderId: number, userId: number, content: string) {
  const { data } = await this.supabase
    .from('___xtr_msg')
    .insert({
      msg_cst_id: userId,      // ⚡ User
      msg_ord_id: orderId,     // ⚡ Order
      msg_subject: `Commande #${orderId}`,
      msg_content: content,
      msg_status: 'open',
      msg_date: new Date().toISOString()
    })
    .select()
    .single();
  
  return data;
}

// Récupérer messages d'une commande
async getOrderMessages(orderId: number) {
  const { data } = await this.supabase
    .from('___xtr_msg')
    .select(`
      *,
      customer:___xtr_customer!msg_cst_id (
        cst_name,
        cst_fname,
        cst_mail
      )
    `)
    .eq('msg_ord_id', orderId)
    .order('msg_date', { ascending: false });
  
  return data;
}
```

---

## 🏪 6. Module SUPPLIER ↔ ORDERS

### Description
Gestion des fournisseurs pour l'approvisionnement des produits commandés.

### Tables Supplier

```sql
___XTR_SUPPLIER
├── sup_id (PK)
├── sup_name
├── sup_contact
└── sup_active

___XTR_SUPPLIER_LINK_PM
├── slp_id (PK)
├── slp_sup_id (FK)          → ⚡ Vers sup_id
├── slp_prd_id (FK)          → ⚡ Vers prd_id
├── slp_price
└── slp_delay
```

### Intégration

```typescript
async getSupplierForProduct(productId: number) {
  const { data } = await this.supabase
    .from('___xtr_supplier_link_pm')
    .select(`
      *,
      supplier:___xtr_supplier!slp_sup_id (
        sup_id,
        sup_name,
        sup_contact
      )
    `)
    .eq('slp_prd_id', productId)
    .order('slp_price', { ascending: true })
    .limit(1)
    .single();
  
  return data;
}
```

---

## 📊 Schéma Relationnel Complet

```sql
                    ┌─────────────────┐
                    │  XTR_CUSTOMER   │
                    │   (Users)       │
                    └────────┬────────┘
                             │ 1
                             │
                             │ N
                    ┌────────▼────────┐
        ┌──────────▶│   XTR_ORDER     │◀──────────┐
        │           │   (Orders)      │           │
        │           └────────┬────────┘           │
        │                    │ 1                  │
        │                    │                    │
        │                    │ N                  │
        │           ┌────────▼────────┐           │
        │           │ XTR_ORDER_LINE  │           │
        │           │ (Order Lines)   │           │
        │           └────────┬────────┘           │
        │                    │ N                  │
        │                    │                    │
        │                    │ 1                  │
        │           ┌────────▼────────┐           │
        │           │  XTR_PRODUCT    │           │
        │           │  (Products)     │           │
        │           └─────────────────┘           │
        │                                         │
┌───────▼────────┐                      ┌────────▼────────┐
│   XTR_MSG      │                      │  XTR_PAYMENT    │
│  (Messages)    │                      │  (Payments)     │
└────────────────┘                      └─────────────────┘
```

---

## 🔐 Sécurité & Validation

### Guards Utilisés

```typescript
// 1. AuthenticatedGuard - User connecté
@UseGuards(AuthenticatedGuard)
async listMyOrders(@Request() req) { }

// 2. IsAdminGuard - Admin seulement
@UseGuards(AuthenticatedGuard, IsAdminGuard)
async getAllOrders() { }

// 3. OrderOwnerGuard - Propriétaire de la commande
@UseGuards(AuthenticatedGuard, OrderOwnerGuard)
async getOrderDetail(@Param('id') orderId) { }
```

### Validation Propriétaire

```typescript
@Injectable()
export class OrderOwnerGuard implements CanActivate {
  constructor(private ordersService: OrdersService) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const orderId = request.params.id;
    const userId = request.user?.id;
    
    // ⚡ Vérifier ord_cst_id === userId
    return await this.ordersService.validateOwnership(orderId, userId);
  }
}
```

---

## 📋 Checklist Intégration

### Tests à Effectuer

#### User → Orders
- [ ] Créer commande avec userId
- [ ] Lister commandes d'un user
- [ ] Vérifier isolation (user ne voit que ses commandes)
- [ ] Tester avec adresses de livraison

#### Cart → Orders
- [ ] Transformer panier en commande
- [ ] Vérifier calculs totaux
- [ ] Tester vidage panier après commande
- [ ] Gérer stock produits

#### Payment → Orders
- [ ] Créer payment lié à order
- [ ] Mettre à jour statut après paiement
- [ ] Gérer échecs de paiement
- [ ] Tester remboursements

#### Products → Orders
- [ ] Récupérer produits d'une commande
- [ ] Vérifier décrément stock
- [ ] Gérer ruptures de stock
- [ ] Tester équivalences produits

#### Messages → Orders
- [ ] Créer message lié à commande
- [ ] Lister messages d'une commande
- [ ] Notifier user/admin
- [ ] Gérer statuts messages

---

## 🚀 Performance & Optimisation

### Requêtes Optimisées

```typescript
// ⚡ SELECT optimisé avec relations
async getOrdersOptimized(userId: number) {
  const { data } = await this.supabase
    .from('___xtr_order')
    .select(`
      ord_id,
      ord_num,
      ord_date,
      ord_status,
      ord_total_ttc,
      lines:___xtr_order_line!orl_ord_id (
        orl_id,
        orl_quantity,
        product:___xtr_product!orl_prd_id (
          prd_name,
          prd_image
        )
      )
    `)
    .eq('ord_cst_id', userId)
    .order('ord_date', { ascending: false })
    .limit(20);  // ⚡ Pagination
  
  return data;
}
```

### Cache Redis

```typescript
// Cache des commandes user
async getCachedUserOrders(userId: number) {
  const cacheKey = `user:${userId}:orders`;
  
  // 1. Chercher en cache
  let orders = await this.redis.get(cacheKey);
  
  if (!orders) {
    // 2. Récupérer en DB
    orders = await this.getOrdersOptimized(userId);
    
    // 3. Mettre en cache (5 min)
    await this.redis.setex(cacheKey, 300, JSON.stringify(orders));
  }
  
  return orders;
}
```

---

## 📚 Documentation Référence

### Liens Utiles
- [DATABASE-SCHEMA-ORDERS.md](./DATABASE-SCHEMA-ORDERS.md)
- [DATABASE-SCHEMA-USERS.md](./DATABASE-SCHEMA-USERS.md)
- [REFACTORING-ORDERS-FINAL.md](./REFACTORING-ORDERS-FINAL.md)

### Tables Système Principales

**Orders:**
- `___XTR_ORDER` - Commandes
- `___XTR_ORDER_LINE` - Lignes commande
- `___XTR_ORDER_LINE_STATUS` - Statuts lignes
- `___XTR_ORDER_STATUS` - Statuts commandes
- `___XTR_ORDER_LINE_EQUIV_TICKET` - Tickets équivalence

**Users:**
- `___XTR_CUSTOMER` - Clients
- `___XTR_CUSTOMER_BILLING_ADDRESS` - Adresses facturation
- `___XTR_CUSTOMER_DELIVERY_ADDRESS` - Adresses livraison

**Autres:**
- `___XTR_PRODUCT` - Produits
- `___XTR_MSG` - Messages
- `___XTR_SUPPLIER` - Fournisseurs
- `___CONFIG_ADMIN` - Configuration

---

**Créé le:** 2025-10-05  
**Module:** Orders  
**Relations:** Users, Cart, Payment, Products, Messages, Supplier  
**Status:** ✅ Documenté et validé
