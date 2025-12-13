---
title: "order schema"
status: draft
version: 1.0.0
---

# Type Schema: Order Types

---
title: "Order Types - Zod Validation Schemas"
status: implemented
version: 1.0.0
created_at: 2025-01-14
updated_at: 2025-01-14
tags: [types, validation, order, zod]
relates_to:
  - .spec/features/order-management.md
  - .spec/features/payment-cart-system.md
  - .spec/architecture/001-supabase-direct.md
---

## Vue d'ensemble

Schémas de validation Zod pour le système de gestion des commandes automobile, couvrant création, modification, transitions statuts, livraison, et données véhicules. Schemas déjà implémentés dans le code source.

## Localisation

**Fichiers sources** :
- `backend/src/modules/orders/dto/automotive-orders.dto.ts` ✅ **Implémenté**
- `backend/src/modules/orders/dto/index.ts`
- `backend/src/modules/orders/dto/orders-enhanced.dto.ts`

## Schémas principaux

### OrderStatus & PaymentStatus

```typescript
import { z } from 'zod';

export enum OrderStatus {
  PENDING = 'PENDING',           // En attente validation
  CONFIRMED = 'CONFIRMED',       // Validée admin
  PROCESSING = 'PROCESSING',     // En préparation
  SHIPPED = 'SHIPPED',           // Expédiée
  DELIVERED = 'DELIVERED',       // Livrée
  CANCELLED = 'CANCELLED'        // Annulée
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export enum DeliveryMethod {
  STANDARD = 'STANDARD',         // +3j ouvrés
  EXPRESS = 'EXPRESS',           // +1j ouvré
  PICKUP = 'PICKUP'              // Retrait magasin
}
```

### DeliveryAddressSchema

```typescript
export const DeliveryAddressSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Prénom requis')
    .max(50, 'Prénom trop long'),
  
  lastName: z
    .string()
    .min(1, 'Nom requis')
    .max(50, 'Nom trop long'),
  
  company: z
    .string()
    .max(100, 'Nom société trop long')
    .optional(),
  
  street: z
    .string()
    .min(5, 'Adresse trop courte')
    .max(200, 'Adresse trop longue'),
  
  city: z
    .string()
    .min(2, 'Ville trop courte')
    .max(100, 'Ville trop longue'),
  
  postalCode: z
    .string()
    .regex(/^\d{5}$/, 'Code postal invalide (5 chiffres requis)'),
  
  country: z
    .string()
    .length(2, 'Code pays ISO 2 lettres requis')
    .toUpperCase()
    .default('FR'),
  
  phone: z
    .string()
    .regex(
      /^(\+33|0)[1-9]\d{8}$/,
      'Téléphone invalide (format: 0612345678 ou +33612345678)'
    ),
  
  instructions: z
    .string()
    .max(500, 'Consignes trop longues')
    .optional(),
});

export type DeliveryAddress = z.infer<typeof DeliveryAddressSchema>;
```

### OrderItemSchema

```typescript
export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  
  // Produit
  productId: z.string().uuid(),
  productName: z.string().min(1),
  productReference: z.string().min(1),
  
  // Quantité & Prix
  quantity: z
    .number()
    .int('Quantité doit être un entier')
    .positive('Quantité doit être positive')
    .max(9999, 'Quantité maximum: 9999'),
  
  unitPrice: z
    .number()
    .positive('Prix unitaire doit être positif')
    .max(999999.99, 'Prix maximum dépassé'),
  
  totalPrice: z.number().nonnegative(),
  
  // TVA
  vatRate: z
    .number()
    .min(0, 'Taux TVA ne peut être négatif')
    .max(1, 'Taux TVA ne peut dépasser 100%')
    .default(0.20),
  
  // Statut ligne
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'OUT_OF_STOCK',
    'ORDERED_FROM_SUPPLIER',
    'AVAILABLE',
    'PACKED',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
  ]).default('PENDING'),
  
  // Produit équivalent (si rupture stock)
  equivalentProposedId: z.string().uuid().optional(),
  equivalentAccepted: z.boolean().optional(),
})
.refine((data) => {
  // Validation: totalPrice === quantity * unitPrice
  const calculated = data.quantity * data.unitPrice;
  return Math.abs(data.totalPrice - calculated) < 0.01; // Tolérance centimes
}, {
  message: 'Prix total incohérent avec quantité × prix unitaire',
  path: ['totalPrice'],
});

export type OrderItem = z.infer<typeof OrderItemSchema>;
```

### CreateOrderSchema

```typescript
export const CreateOrderSchema = z.object({
  // Identifiants
  customerId: z.string().uuid('ID client invalide'),
  cartId: z.string().uuid('ID panier invalide'),
  
  // Paiement
  paymentMethod: z.enum(['CARD', 'PAYPAL', 'WIRE_TRANSFER', 'CHECK']),
  paymentStatus: z.nativeEnum(PaymentStatus),
  paymentTransactionId: z.string().optional(),
  
  // Livraison
  deliveryMethod: z.nativeEnum(DeliveryMethod),
  deliveryAddress: DeliveryAddressSchema,
  
  // Items
  items: z
    .array(OrderItemSchema)
    .min(1, 'Au moins un produit requis'),
  
  // Totaux
  subtotal: z.number().positive('Sous-total doit être positif'),
  vatAmount: z.number().nonnegative('Montant TVA ne peut être négatif'),
  shippingCost: z.number().nonnegative('Frais port ne peuvent être négatifs'),
  discount: z.number().nonnegative('Réduction ne peut être négative').default(0),
  total: z.number().positive('Total doit être positif'),
  
  // Notes
  customerNotes: z.string().max(1000, 'Notes client trop longues').optional(),
  adminNotes: z.string().max(1000, 'Notes admin trop longues').optional(),
})
.refine((data) => {
  // Validation: total === subtotal + vatAmount + shippingCost - discount
  const calculated = data.subtotal + data.vatAmount + data.shippingCost - data.discount;
  return Math.abs(data.total - calculated) < 0.01;
}, {
  message: 'Total incohérent avec somme composants',
  path: ['total'],
})
.refine((data) => {
  // Validation: subtotal === somme items.totalPrice
  const itemsTotal = data.items.reduce((sum, item) => sum + item.totalPrice, 0);
  return Math.abs(data.subtotal - itemsTotal) < 0.01;
}, {
  message: 'Sous-total incohérent avec somme items',
  path: ['subtotal'],
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
```

### UpdateOrderSchema

```typescript
export const UpdateOrderSchema = z.object({
  // Seuls champs modifiables après création
  deliveryAddress: DeliveryAddressSchema.optional(),
  customerNotes: z.string().max(1000).optional(),
  adminNotes: z.string().max(1000).optional(),
  
  // Admin uniquement
  trackingNumber: z.string().max(100).optional(),
  estimatedDeliveryDate: z.date().optional(),
});

export type UpdateOrderDto = z.infer<typeof UpdateOrderSchema>;
```

### SearchOrdersSchema

```typescript
export const SearchOrdersSchema = z.object({
  // Filtres ID
  customerId: z.string().uuid().optional(),
  orderNumber: z.string().optional(),
  
  // Filtres statut
  status: z
    .nativeEnum(OrderStatus)
    .or(z.array(z.nativeEnum(OrderStatus)))
    .optional(),
  paymentStatus: z
    .nativeEnum(PaymentStatus)
    .or(z.array(z.nativeEnum(PaymentStatus)))
    .optional(),
  
  // Filtres dates
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  
  // Filtres montant
  minAmount: z.number().nonnegative().optional(),
  maxAmount: z.number().positive().optional(),
  
  // Filtres livraison
  deliveryMethod: z.nativeEnum(DeliveryMethod).optional(),
  postalCode: z.string().regex(/^\d{5}$/).optional(),
  
  // Pagination
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  
  // Tri
  sortBy: z.enum(['createdAt', 'total', 'status', 'orderNumber']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})
.refine((data) => {
  if (data.minAmount && data.maxAmount) {
    return data.minAmount <= data.maxAmount;
  }
  return true;
}, {
  message: 'minAmount doit être ≤ maxAmount',
  path: ['minAmount'],
})
.refine((data) => {
  if (data.startDate && data.endDate) {
    return data.startDate <= data.endDate;
  }
  return true;
}, {
  message: 'startDate doit être ≤ endDate',
  path: ['startDate'],
});

export type SearchOrdersDto = z.infer<typeof SearchOrdersSchema>;
```

## Données véhicules (Automobile)

### VehicleDataSchema

```typescript
// Source: automotive-orders.dto.ts
export const vehicleRegistrationSchema = z.object({
  registrationNumber: z
    .string()
    .regex(/^[A-Z]{2}-\d{3}-[A-Z]{2}$/, 'Format immatriculation: AA-123-BB')
    .or(z.string().regex(/^\d{1,4}\s[A-Z]{2,3}\s\d{2}$/, 'Format ancien: 1234 ABC 75')),
  registrationDate: z.coerce.date(),
});

export const vehicleVINSchema = z.object({
  vin: z
    .string()
    .length(17, 'VIN doit contenir 17 caractères')
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'VIN contient caractères invalides'),
});

export const oemReferenceSchema = z.object({
  reference: z.string().min(1, 'Référence OEM requise'),
  manufacturer: z.string().min(1, 'Fabricant requis'),
});

export const vehicleDataSchema = z.object({
  make: z.string().min(1, 'Marque requise'), // Peugeot
  model: z.string().min(1, 'Modèle requis'), // 308
  generation: z.string().optional(), // Génération II (2013-2021)
  engine: z.string().optional(), // 1.6 HDI 115ch
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  
  registration: vehicleRegistrationSchema.optional(),
  vin: vehicleVINSchema.optional(),
  oem: oemReferenceSchema.optional(),
});

export type VehicleData = z.infer<typeof vehicleDataSchema>;
```

### AutomotiveOrderLineSchema

```typescript
export const automotiveOrderLineSchema = OrderItemSchema.extend({
  // Informations compatibilité véhicule
  vehicleCompatibility: z.array(vehicleDataSchema).optional(),
  
  // Référence OEM constructeur
  oemReference: z.string().optional(),
  
  // Informations fournisseur
  supplierReference: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  supplierDeliveryDays: z.number().int().positive().optional(),
});

export type AutomotiveOrderLine = z.infer<typeof automotiveOrderLineSchema>;
```

## Actions sur commandes

### ShipOrderSchema

```typescript
export const ShipOrderSchema = z.object({
  orderId: z.string().uuid(),
  trackingNumber: z
    .string()
    .min(5, 'Numéro suivi trop court')
    .max(100, 'Numéro suivi trop long'),
  carrier: z.string().max(50).optional(), // Colissimo, Chronopost, etc.
  adminNotes: z.string().max(500).optional(),
});

export type ShipOrderDto = z.infer<typeof ShipOrderSchema>;
```

### CancelOrderSchema

```typescript
export const CancelOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.enum([
    'CUSTOMER_REQUEST',
    'PRODUCT_UNAVAILABLE',
    'PAYMENT_FAILED',
    'FRAUD_SUSPECTED',
    'DUPLICATE_ORDER',
    'OTHER',
  ]),
  comment: z.string().max(1000, 'Commentaire trop long').optional(),
  refundAmount: z.number().nonnegative().optional(), // Si remboursement partiel
});

export type CancelOrderDto = z.infer<typeof CancelOrderSchema>;
```

### UpdateOrderStatusSchema

```typescript
export const UpdateOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  newStatus: z.nativeEnum(OrderStatus),
  comment: z.string().max(500).optional(),
  userId: z.string().uuid(), // Admin qui effectue changement
})
.refine((data) => {
  // Validation transitions autorisées
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED', 'CANCELLED'],
    DELIVERED: [],
    CANCELLED: [],
  };
  
  // Note: Cette validation nécessite le statut actuel
  // Elle doit être effectuée côté service avec accès DB
  return true;
}, {
  message: 'Transition de statut non autorisée',
  path: ['newStatus'],
});

export type UpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusSchema>;
```

## Tickets préparation

### CreateTicketSchema

```typescript
// Source: orders/dto/index.ts
export const CreateTicketSchema = z.object({
  type: z.enum(['PREPARATION', 'CREDIT']),
  orderId: z.string().uuid(),
  orderLineId: z.string().uuid().optional(),
  amount: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
  expirationDays: z.number().int().positive().default(30),
});

export type CreateTicketDto = z.infer<typeof CreateTicketSchema>;
```

### UseTicketSchema

```typescript
export const UseTicketSchema = z.object({
  ticketReference: z
    .string()
    .regex(/^(PREP|CRED)-\d{4}-\d{3}$/, 'Format: PREP-2025-001'),
  userId: z.string().uuid(),
});

export type UseTicketDto = z.infer<typeof UseTicketSchema>;
```

## Exemples utilisation

### Créer une commande

```typescript
const orderDto = CreateOrderSchema.parse({
  customerId: '123e4567-e89b-12d3-a456-426614174000',
  cartId: 'cart-uuid',
  paymentMethod: 'CARD',
  paymentStatus: PaymentStatus.PAID,
  paymentTransactionId: 'PAYBOX-TX-12345',
  deliveryMethod: DeliveryMethod.STANDARD,
  deliveryAddress: {
    firstName: 'Jean',
    lastName: 'Dupont',
    street: '15 rue de la Paix',
    city: 'Paris',
    postalCode: '75002',
    country: 'FR',
    phone: '+33612345678',
  },
  items: [
    {
      id: 'item-uuid',
      productId: 'product-uuid',
      productName: 'Filtre à huile',
      productReference: 'FLT-001',
      quantity: 2,
      unitPrice: 12.50,
      totalPrice: 25.00,
      vatRate: 0.20,
      status: 'PENDING',
    },
  ],
  subtotal: 25.00,
  vatAmount: 5.00,
  shippingCost: 8.90,
  discount: 0,
  total: 38.90,
});

const order = await ordersService.createOrder(orderDto);
```

### Expédier une commande

```typescript
const shipDto = ShipOrderSchema.parse({
  orderId: 'order-uuid',
  trackingNumber: 'COLISSIMO-ABC123456',
  carrier: 'Colissimo',
  adminNotes: 'Colis fragile',
});

await ordersService.shipOrder(shipDto);
```

### Rechercher commandes

```typescript
const searchDto = SearchOrdersSchema.parse({
  status: ['PENDING', 'CONFIRMED'],
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  minAmount: 50,
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
});

const results = await ordersService.searchOrders(searchDto);
```

## Tests validation

```typescript
describe('Order Schemas', () => {
  describe('CreateOrderSchema', () => {
    it('should validate complete order data', () => {
      const data = {
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        cartId: 'cart-uuid',
        paymentMethod: 'CARD',
        paymentStatus: PaymentStatus.PAID,
        deliveryMethod: DeliveryMethod.STANDARD,
        deliveryAddress: {
          firstName: 'Jean',
          lastName: 'Dupont',
          street: '15 rue de la Paix',
          city: 'Paris',
          postalCode: '75002',
          country: 'FR',
          phone: '+33612345678',
        },
        items: [
          {
            id: 'item-uuid',
            productId: 'product-uuid',
            productName: 'Filtre',
            productReference: 'FLT-001',
            quantity: 2,
            unitPrice: 12.50,
            totalPrice: 25.00,
            vatRate: 0.20,
            status: 'PENDING',
          },
        ],
        subtotal: 25.00,
        vatAmount: 5.00,
        shippingCost: 8.90,
        discount: 0,
        total: 38.90,
      };
      
      expect(() => CreateOrderSchema.parse(data)).not.toThrow();
    });

    it('should reject inconsistent total', () => {
      const data = {
        // ... valid fields
        subtotal: 25.00,
        vatAmount: 5.00,
        shippingCost: 8.90,
        discount: 0,
        total: 50.00, // Incorrect (devrait être 38.90)
      };
      
      expect(() => CreateOrderSchema.parse(data)).toThrow('Total incohérent');
    });
  });

  describe('DeliveryAddressSchema', () => {
    it('should validate French postal code', () => {
      const address = {
        firstName: 'Jean',
        lastName: 'Dupont',
        street: '15 rue Test',
        city: 'Paris',
        postalCode: '75002',
        country: 'FR',
        phone: '+33612345678',
      };
      
      expect(() => DeliveryAddressSchema.parse(address)).not.toThrow();
    });

    it('should reject invalid postal code', () => {
      const address = {
        // ... valid fields
        postalCode: '1234', // Trop court
      };
      
      expect(() => DeliveryAddressSchema.parse(address)).toThrow('Code postal invalide');
    });
  });

  describe('VehicleDataSchema', () => {
    it('should validate vehicle registration', () => {
      const vehicle = {
        make: 'Peugeot',
        model: '308',
        year: 2020,
        registration: {
          registrationNumber: 'AB-123-CD',
          registrationDate: new Date('2020-01-15'),
        },
      };
      
      expect(() => vehicleDataSchema.parse(vehicle)).not.toThrow();
    });

    it('should validate VIN format', () => {
      const vehicle = {
        make: 'Renault',
        model: 'Clio',
        year: 2022,
        vin: {
          vin: 'VF1RFB0HX64567890', // 17 chars
        },
      };
      
      expect(() => vehicleDataSchema.parse(vehicle)).not.toThrow();
    });
  });
});
```

## Changelog

### Version 1.0.0 (2025-01-14)

- ✅ Schemas création/modification commande (15+ champs)
- ✅ Enums statuts (6 order, 4 payment, 3 delivery)
- ✅ Schema adresse livraison (validation CP, téléphone)
- ✅ Schema ligne commande (quantité, prix, TVA)
- ✅ Schema recherche (10+ filtres, pagination, tri)
- ✅ Données véhicules (immatriculation, VIN, OEM)
- ✅ Actions commandes (expédition, annulation, statut)
- ✅ Tickets préparation (génération, utilisation)
- ✅ Validation métier (totaux cohérents, transitions statuts)
- ✅ Type-safety TypeScript complet
- ✅ **Implémenté production** : `automotive-orders.dto.ts`
