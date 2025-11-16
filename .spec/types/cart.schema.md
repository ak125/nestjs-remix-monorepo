# Type Schema: Cart Types

---
title: "Cart Types - Zod Validation Schemas"
status: implemented
version: 1.0.0
created_at: 2025-01-14
updated_at: 2025-01-14
tags: [types, validation, cart, zod]
relates_to:
  - .spec/features/payment-cart-system.md
  - .spec/architecture/001-supabase-direct.md
---

## Vue d'ensemble

Schémas de validation Zod pour le système panier e-commerce, couvrant ajout/modification/suppression items, application codes promo, calculs totaux, et gestion sessions (invité + authentifié). Assure cohérence données et validation métier.

## Localisation

**Fichiers sources** :
- `backend/src/modules/cart/dto/add-item.dto.ts`
- `backend/src/modules/cart/dto/update-item.dto.ts`
- `backend/src/modules/cart/dto/apply-promo.dto.ts`

## Schémas principaux

### AddItemSchema

```typescript
import { z } from 'zod';

export const AddItemSchema = z
  .object({
    // Support dual format (camelCase + snake_case) pour compatibilité frontend
    productId: z
      .union([
        z.string().uuid('ID produit UUID invalide'),
        z.number().int().positive('ID produit numérique invalide'),
        z
          .string()
          .regex(/^\d+$/, 'ID produit doit être numérique')
          .transform(Number),
      ])
      .optional(),
    
    product_id: z
      .union([
        z.string().uuid('ID produit UUID invalide'),
        z.number().int().positive('ID produit numérique invalide'),
        z
          .string()
          .regex(/^\d+$/, 'ID produit doit être numérique')
          .transform(Number),
      ])
      .optional(),
    
    // Quantité (obligatoire)
    quantity: z.union([
      z.number().int().positive('La quantité doit être positive'),
      z
        .string()
        .regex(/^\d+$/, 'Quantité doit être numérique')
        .transform(Number),
    ]),
    
    // Variante produit (taille, couleur, etc.)
    product_variant_id: z.string().uuid().optional(),
    
    // Prix personnalisé (admin uniquement)
    custom_price: z
      .union([
        z.number().positive().optional(),
        z
          .string()
          .regex(/^\d+(\.\d+)?$/, 'Prix doit être numérique')
          .transform(Number)
          .optional(),
      ])
      .optional(),
    
    // Métadonnées additionnelles
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .refine((data) => data.productId || data.product_id, {
    message: "Il faut fournir soit 'productId' soit 'product_id'",
    path: ['productId', 'product_id'],
  })
  .transform((data) => ({
    ...data,
    product_id: data.productId || data.product_id, // Normaliser
  }));

export type AddItemDto = z.infer<typeof AddItemSchema>;
```

### UpdateItemSchema

```typescript
export const UpdateItemSchema = z.object({
  // Identifiant item panier
  itemId: z.string().uuid('ID item invalide'),
  
  // Quantité (peut être 0 pour suppression)
  quantity: z
    .number()
    .int('La quantité doit être un entier')
    .min(0, 'La quantité ne peut être négative')
    .max(9999, 'Quantité maximum: 9999'),
  
  // Métadonnées modifiables
  metadata: z.record(z.string(), z.any()).optional(),
});

export type UpdateItemDto = z.infer<typeof UpdateItemSchema>;
```

### RemoveItemSchema

```typescript
export const RemoveItemSchema = z.object({
  itemId: z.string().uuid('ID item invalide'),
});

export type RemoveItemDto = z.infer<typeof RemoveItemSchema>;
```

### ApplyPromoSchema

```typescript
export const ApplyPromoSchema = z.object({
  // Code promo
  code: z
    .string()
    .min(3, 'Code promo trop court')
    .max(50, 'Code promo trop long')
    .regex(/^[A-Z0-9-_]+$/i, 'Code promo contient caractères invalides')
    .transform((val) => val.toUpperCase()),
  
  // Contexte d'application
  cartId: z.string().uuid('ID panier invalide').optional(),
  userId: z.string().uuid('ID utilisateur invalide').optional(),
});

export type ApplyPromoDto = z.infer<typeof ApplyPromoSchema>;
```

## Entités Panier

### CartItemSchema

```typescript
export const CartItemSchema = z.object({
  id: z.string().uuid(),
  
  // Produit
  product_id: z.union([z.string().uuid(), z.number().int().positive()]),
  product_name: z.string().min(1),
  product_sku: z.string().min(1),
  product_image: z.string().url().optional(),
  
  // Variante
  product_variant_id: z.string().uuid().optional(),
  variant_name: z.string().optional(), // Ex: "Rouge - Taille L"
  
  // Quantité & Prix
  quantity: z.number().int().positive(),
  unit_price: z.number().positive(),
  subtotal: z.number().nonnegative(), // quantity * unit_price
  
  // Réductions
  discount_percent: z.number().min(0).max(100).default(0),
  discount_amount: z.number().nonnegative().default(0),
  total_price: z.number().nonnegative(), // subtotal - discount_amount
  
  // TVA
  vat_rate: z.number().min(0).max(1).default(0.20), // 20%
  vat_amount: z.number().nonnegative(),
  
  // Stock & Disponibilité
  in_stock: z.boolean(),
  stock_quantity: z.number().int().nonnegative(),
  max_quantity_per_order: z.number().int().positive().default(99),
  
  // Métadonnées
  metadata: z.record(z.string(), z.any()).optional(),
  
  // Horodatage
  added_at: z.date(),
  updated_at: z.date(),
})
.refine((data) => {
  // Validation: quantity <= stock_quantity si in_stock
  if (data.in_stock && data.quantity > data.stock_quantity) {
    return false;
  }
  return true;
}, {
  message: 'Quantité demandée supérieure au stock disponible',
  path: ['quantity'],
})
.refine((data) => {
  // Validation: quantity <= max_quantity_per_order
  return data.quantity <= data.max_quantity_per_order;
}, {
  message: 'Quantité maximum par commande dépassée',
  path: ['quantity'],
});

export type CartItem = z.infer<typeof CartItemSchema>;
```

### CartSessionSchema

```typescript
export const CartSessionSchema = z.object({
  id: z.string().uuid(),
  
  // Utilisateur (null si invité)
  user_id: z.string().uuid().nullable(),
  session_id: z.string().min(1), // Cookie session invité
  
  // Items
  items: z.array(CartItemSchema).default([]),
  items_count: z.number().int().nonnegative(), // Total items
  
  // Totaux
  subtotal: z.number().nonnegative(), // HT
  vat_amount: z.number().nonnegative(),
  shipping_cost: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  total: z.number().nonnegative(), // TTC
  
  // Code promo
  promo_code: z.string().optional(),
  promo_discount_percent: z.number().min(0).max(100).optional(),
  promo_discount_amount: z.number().nonnegative().optional(),
  
  // Livraison
  delivery_method: z.enum(['STANDARD', 'EXPRESS', 'PICKUP']).optional(),
  delivery_address: z
    .object({
      street: z.string(),
      city: z.string(),
      postal_code: z.string(),
      country: z.string().default('FR'),
    })
    .optional(),
  
  // Statut
  is_active: z.boolean().default(true),
  is_merged: z.boolean().default(false), // Fusion invité → auth
  
  // Expiration
  expires_at: z.date(),
  
  // Horodatage
  created_at: z.date(),
  updated_at: z.date(),
  last_activity_at: z.date(),
})
.refine((data) => {
  // Validation: items_count === items.length
  return data.items_count === data.items.length;
}, {
  message: 'Compteur items incohérent',
  path: ['items_count'],
})
.refine((data) => {
  // Validation: subtotal = somme items.total_price
  const calculatedSubtotal = data.items.reduce(
    (sum, item) => sum + item.total_price,
    0
  );
  return Math.abs(data.subtotal - calculatedSubtotal) < 0.01; // Tolérance centimes
}, {
  message: 'Sous-total incohérent avec somme items',
  path: ['subtotal'],
});

export type CartSession = z.infer<typeof CartSessionSchema>;
```

## Calculs panier

### CartCalculationSchema

```typescript
export const CartCalculationSchema = z.object({
  // Entrées
  items: z.array(CartItemSchema),
  promo_code: z.string().optional(),
  delivery_method: z.enum(['STANDARD', 'EXPRESS', 'PICKUP']).optional(),
  delivery_postal_code: z.string().optional(),
  
  // Sorties calculées
  calculations: z.object({
    subtotal_ht: z.number().nonnegative(),
    vat_amount: z.number().nonnegative(),
    subtotal_ttc: z.number().nonnegative(),
    
    shipping_cost: z.number().nonnegative(),
    
    promo_discount: z.number().nonnegative(),
    promo_description: z.string().optional(),
    
    total_ttc: z.number().nonnegative(),
    
    // Détails TVA
    vat_breakdown: z.array(
      z.object({
        rate: z.number(), // 0.20 pour 20%
        base: z.number(), // Montant HT
        amount: z.number(), // Montant TVA
      })
    ),
  }),
});

export type CartCalculation = z.infer<typeof CartCalculationSchema>;
```

## Validation métier

### Règles stock

```typescript
export function validateStock(item: CartItem): boolean {
  if (!item.in_stock) {
    throw new Error(`Produit ${item.product_name} hors stock`);
  }
  
  if (item.quantity > item.stock_quantity) {
    throw new Error(
      `Stock insuffisant pour ${item.product_name} (disponible: ${item.stock_quantity})`
    );
  }
  
  if (item.quantity > item.max_quantity_per_order) {
    throw new Error(
      `Quantité maximum dépassée pour ${item.product_name} (max: ${item.max_quantity_per_order})`
    );
  }
  
  return true;
}
```

### Règles promo

```typescript
export const PromoCodeRulesSchema = z.object({
  code: z.string(),
  discount_type: z.enum(['PERCENT', 'FIXED']),
  discount_value: z.number().positive(),
  
  // Conditions d'application
  min_amount: z.number().nonnegative().optional(),
  max_discount: z.number().positive().optional(),
  
  // Restrictions produits
  applicable_product_ids: z.array(z.string().uuid()).optional(),
  excluded_product_ids: z.array(z.string().uuid()).optional(),
  
  // Restrictions catégories
  applicable_category_ids: z.array(z.number().int()).optional(),
  
  // Restrictions utilisateur
  first_order_only: z.boolean().default(false),
  max_uses_per_user: z.number().int().positive().optional(),
  
  // Validité
  valid_from: z.date(),
  valid_until: z.date(),
  is_active: z.boolean(),
})
.refine((data) => {
  // Validation: valid_from <= valid_until
  return data.valid_from <= data.valid_until;
}, {
  message: 'Date fin doit être >= date début',
  path: ['valid_until'],
});

export type PromoCodeRules = z.infer<typeof PromoCodeRulesSchema>;
```

## Exemples utilisation

### Ajouter item au panier

```typescript
const addItemDto = AddItemSchema.parse({
  product_id: '123e4567-e89b-12d3-a456-426614174000',
  quantity: 2,
});

await cartService.addItem(cartId, addItemDto);
```

### Mettre à jour quantité

```typescript
const updateDto = UpdateItemSchema.parse({
  itemId: 'item-uuid',
  quantity: 5,
});

await cartService.updateItem(cartId, updateDto);
```

### Appliquer code promo

```typescript
const promoDto = ApplyPromoSchema.parse({
  code: 'PROMO2025',
  cartId: 'cart-uuid',
});

const result = await cartService.applyPromo(promoDto);
// result: { discount: 10.00, newTotal: 89.99 }
```

## Tests validation

```typescript
describe('Cart Schemas', () => {
  describe('AddItemSchema', () => {
    it('should accept UUID product_id', () => {
      const data = {
        product_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 1,
      };
      
      expect(() => AddItemSchema.parse(data)).not.toThrow();
    });

    it('should accept numeric productId', () => {
      const data = {
        productId: 12345,
        quantity: 2,
      };
      
      const result = AddItemSchema.parse(data);
      expect(result.product_id).toBe(12345);
    });

    it('should reject negative quantity', () => {
      const data = {
        product_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: -1,
      };
      
      expect(() => AddItemSchema.parse(data)).toThrow('quantité doit être positive');
    });
  });

  describe('CartItemSchema', () => {
    it('should validate stock availability', () => {
      const item = {
        id: 'item-uuid',
        product_id: 123,
        product_name: 'Filtre',
        product_sku: 'FLT-001',
        quantity: 10,
        unit_price: 12.50,
        subtotal: 125.00,
        discount_amount: 0,
        total_price: 125.00,
        vat_rate: 0.20,
        vat_amount: 25.00,
        in_stock: true,
        stock_quantity: 5, // Stock insuffisant
        added_at: new Date(),
        updated_at: new Date(),
      };
      
      expect(() => CartItemSchema.parse(item)).toThrow('stock disponible');
    });
  });

  describe('CartSessionSchema', () => {
    it('should validate subtotal consistency', () => {
      const cart = {
        id: 'cart-uuid',
        user_id: null,
        session_id: 'session-123',
        items: [
          {
            // ... item avec total_price: 50.00
          },
          {
            // ... item avec total_price: 30.00
          },
        ],
        items_count: 2,
        subtotal: 100.00, // Incorrect (devrait être 80.00)
        vat_amount: 16.00,
        total: 96.00,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        created_at: new Date(),
        updated_at: new Date(),
        last_activity_at: new Date(),
      };
      
      expect(() => CartSessionSchema.parse(cart)).toThrow('Sous-total incohérent');
    });
  });
});
```

## Changelog

### Version 1.0.0 (2025-01-14)

- ✅ Schema ajout item (dual format productId/product_id)
- ✅ Schema modification item (quantité, métadonnées)
- ✅ Schema application code promo (validation format)
- ✅ Entité CartItem (15+ champs, validation stock)
- ✅ Entité CartSession (20+ champs, calculs cohérence)
- ✅ Validation métier (stock, quantité max)
- ✅ Règles promo (7 types restrictions)
- ✅ Transformations (normalisation camelCase/snake_case)
- ✅ Type-safety TypeScript complet
