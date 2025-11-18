/**
 * Type Schema: Cart Types
 * 
 * @module cart.schema
 * @description Schémas de validation Zod pour le système panier e-commerce
 * @version 1.0.0
 * @created 2025-01-14
 * @updated 2025-11-18
 * @relates-to
 *   - .spec/features/payment-cart-system.md
 *   - .spec/architecture/001-supabase-direct.md
 */

import { z } from 'zod';

// ============================================================================
// SCHEMAS DTO (Data Transfer Objects)
// ============================================================================

/**
 * Schema pour ajouter un item au panier
 * Support dual format (camelCase + snake_case) pour compatibilité frontend
 */
export const AddItemSchema = z
  .object({
    // Support dual format (camelCase + snake_case)
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

/**
 * Schema pour mettre à jour un item du panier
 */
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

/**
 * Schema pour supprimer un item du panier
 */
export const RemoveItemSchema = z.object({
  itemId: z.string().uuid('ID item invalide'),
});

export type RemoveItemDto = z.infer<typeof RemoveItemSchema>;

/**
 * Schema pour appliquer un code promo
 */
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

// ============================================================================
// SCHEMAS ENTITÉS
// ============================================================================

/**
 * Schema pour un item du panier
 */
export const CartItemSchema = z
  .object({
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

/**
 * Schema pour une session panier
 */
export const CartSessionSchema = z
  .object({
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

/**
 * Schema pour les calculs de panier
 */
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

/**
 * Schema pour les règles de code promo
 */
export const PromoCodeRulesSchema = z
  .object({
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

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Valide le stock d'un item
 * @throws Error si stock insuffisant
 */
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

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  AddItemSchema,
  UpdateItemSchema,
  RemoveItemSchema,
  ApplyPromoSchema,
  CartItemSchema,
  CartSessionSchema,
  CartCalculationSchema,
  PromoCodeRulesSchema,
  validateStock,
};
