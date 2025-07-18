# Instructions d'intégration du module Orders

## Installation automatique terminée

Le module Orders a été copié dans votre projet. Suivez ces étapes pour terminer l'intégration :

## 1. Installation des dépendances
```bash
npm install
```

## 2. Intégration dans AppModule
```typescript
import { OrdersModule } from './modules/orders/orders.module';

@Module({
  imports: [
    // ...autres modules
    OrdersModule,
  ],
})
export class AppModule {}
```

## 3. Configuration de la base de données

### Avec Prisma (recommandé)
Ajoutez ces modèles dans votre `schema.prisma`:

```prisma
model Order {
  id            String      @id @default(cuid())
  orderNumber   String      @unique
  customerId    String
  status        OrderStatus @default(PENDING)
  paymentMethod PaymentMethod
  paymentStatus PaymentStatus @default(PENDING)
  
  // Adresses
  billingAddress  Json
  deliveryAddress Json
  
  // Montants
  totalAmountHT  Float
  taxAmount      Float
  totalAmountTTC Float
  shippingCost   Float       @default(0)
  
  // Métadonnées
  customerNotes  String?
  internalNotes  String?
  
  // Dates
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  shippedAt    DateTime?
  deliveredAt  DateTime?
  
  // Relations
  orderLines   OrderLine[]
  
  @@map("orders")
}

model OrderLine {
  id              String @id @default(cuid())
  orderId         String
  productId       String
  productName     String
  productReference String
  quantity        Int
  unitPrice       Float
  totalPrice      Float
  
  // Relations
  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  
  @@map("order_lines")
}

enum OrderStatus {
  PENDING
  VALIDATED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

enum PaymentMethod {
  CREDIT_CARD
  BANK_TRANSFER
  PAYPAL
  CASH_ON_DELIVERY
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}
```

Puis exécutez :
```bash
npx prisma migrate dev --name add-orders
```

## 4. Variables d'environnement

Ajoutez ces variables dans votre `.env`:

```env
# Configuration Orders
ORDERS_MAX_CART_ITEMS=100
ORDERS_FREE_SHIPPING_THRESHOLD=50
ORDERS_TAX_RATE=0.20
ORDERS_DEFAULT_CURRENCY=EUR
ORDERS_MAX_ORDER_AMOUNT=10000
ORDERS_ENABLE_NOTIFICATIONS=true
ORDERS_ENABLE_AUDIT_LOG=true
```

## 5. Tests de l'API

### Créer une commande
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer_123",
    "billingAddress": {
      "firstName": "John",
      "lastName": "Doe",
      "address": "123 Main St",
      "city": "Paris",
      "postalCode": "75001",
      "country": "France"
    },
    "deliveryAddress": {
      "firstName": "John",
      "lastName": "Doe",
      "address": "123 Main St",
      "city": "Paris",
      "postalCode": "75001",
      "country": "France"
    },
    "orderLines": [
      {
        "productId": "prod_123",
        "productName": "Produit Test",
        "productReference": "REF-001",
        "quantity": 2,
        "unitPrice": 29.99,
        "totalPrice": 59.98
      }
    ],
    "paymentMethod": "credit_card",
    "totalAmountHT": 59.98,
    "taxAmount": 12.00,
    "totalAmountTTC": 71.98
  }'
```

### Lister les commandes
```bash
curl -X GET http://localhost:3000/orders
```

### Obtenir une commande
```bash
curl -X GET http://localhost:3000/orders/{orderId}
```

## 6. Fonctionnalités disponibles

- ✅ Création, lecture, mise à jour, suppression des commandes
- ✅ Gestion des statuts avec transitions
- ✅ Calcul automatique des frais de livraison
- ✅ Validation avec Zod (type-safe)
- ✅ Cache pour les performances
- ✅ Limitation du taux de requêtes
- ✅ Audit trail complet
- ✅ Support multi-devises
- ✅ Notifications par événements
- ✅ Filtres et pagination
- ✅ Calcul des taxes

## 7. Personnalisation

Le module peut être personnalisé via la configuration dans `OrdersModule`. Consultez le fichier `orders.module.ts` pour voir toutes les options disponibles.

## Support

Pour toute question ou problème, consultez la documentation ou créez une issue dans le projet.
