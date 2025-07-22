import { z } from 'zod';

// ================================================================
// SCHÉMAS ZOD POUR LA VALIDATION DES DONNÉES DU PANIER
// ================================================================

// Schéma pour les détails d'un produit
export const ProductDetailSchema = z.object({
  piece_id: z.number(),
  piece_ref: z.string(),
  piece_name: z.string(),
  piece_price_ttc: z.number(),
  piece_weight: z.number().optional(),
  piece_stock: z.number().optional(),
  piece_img_url: z.string().optional(),
  piece_brand: z.string().optional(),
});

// Schéma pour un article du panier de base
export const CartItemSchema = z.object({
  id: z.number(),
  user_id: z.string(),
  product_id: z.number(),
  quantity: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Schéma pour un article du panier avec détails produit
export const CartItemWithProductSchema = CartItemSchema.extend({
  product: ProductDetailSchema.optional(),
  unit_price: z.number(),
  total_price: z.number(),
});

// Schéma pour le résumé du panier
export const CartSummarySchema = z.object({
  total_items: z.number(),
  total_quantity: z.number(),
  subtotal: z.number(),
  shipping_cost: z.number().optional(),
  promo_discount: z.number().optional(),
  total: z.number(),
  currency: z.string(),
});

// Schéma pour l'estimation de livraison
export const EstimatedShippingSchema = z.object({
  weight: z.number(),
  estimated_cost: z.number(),
});

// Schéma pour la réponse complète du panier
export const CartResponseSchema = z.object({
  items: z.array(CartItemWithProductSchema),
  summary: CartSummarySchema,
  promo_code: z.string().optional(),
  estimated_shipping: EstimatedShippingSchema.optional(),
});

// Schéma pour les messages de réponse
export const CartMessageResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.any().optional(),
});

// ================================================================
// TYPES TYPESCRIPT INFÉRÉS DES SCHÉMAS ZOD
// ================================================================

export type ProductDetailDto = z.infer<typeof ProductDetailSchema>;
export type CartItemDto = z.infer<typeof CartItemSchema>;
export type CartItemWithProductDto = z.infer<typeof CartItemWithProductSchema>;
export type CartSummaryDto = z.infer<typeof CartSummarySchema>;
export type EstimatedShippingDto = z.infer<typeof EstimatedShippingSchema>;
export type CartResponseDto = z.infer<typeof CartResponseSchema>;
export type CartMessageResponseDto = z.infer<typeof CartMessageResponseSchema>;

// ================================================================
// FONCTIONS DE VALIDATION
// ================================================================

export function validateCartItem(data: unknown): CartItemDto {
  return CartItemSchema.parse(data);
}

export function validateCartItemWithProduct(
  data: unknown,
): CartItemWithProductDto {
  return CartItemWithProductSchema.parse(data);
}

export function validateCartSummary(data: unknown): CartSummaryDto {
  return CartSummarySchema.parse(data);
}

export function validateCartResponse(data: unknown): CartResponseDto {
  return CartResponseSchema.parse(data);
}

export function validateCartMessageResponse(
  data: unknown,
): CartMessageResponseDto {
  return CartMessageResponseSchema.parse(data);
}

// ================================================================
// SCHÉMAS DE VALIDATION POUR LES PARAMÈTRES DE REQUÊTE
// ================================================================

// Schéma pour les paramètres de pagination
export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});

// Schéma pour les paramètres de tri
export const SortSchema = z.object({
  sort_by: z
    .enum(['created_at', 'updated_at', 'product_name', 'quantity', 'price'])
    .default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

// Schéma pour les filtres du panier
export const CartFiltersSchema = z.object({
  include_product_details: z.boolean().default(true),
  min_quantity: z.number().int().positive().optional(),
  max_quantity: z.number().int().positive().optional(),
  product_category: z.string().optional(),
});

// Schéma combiné pour les paramètres de requête du panier
export const CartQueryParamsSchema =
  PaginationSchema.merge(SortSchema).merge(CartFiltersSchema);

export type PaginationDto = z.infer<typeof PaginationSchema>;
export type SortDto = z.infer<typeof SortSchema>;
export type CartFiltersDto = z.infer<typeof CartFiltersSchema>;
export type CartQueryParamsDto = z.infer<typeof CartQueryParamsSchema>;

// ================================================================
// SCHÉMAS POUR LES RÈGLES MÉTIER DU PANIER
// ================================================================

export const CartRulesSchema = z.object({
  max_quantity_per_item: z.number().int().positive().default(99),
  max_total_items: z.number().int().positive().default(50),
  min_order_amount: z.number().positive().default(10.0),
  free_shipping_threshold: z.number().positive().default(50.0),
  allowed_product_types: z
    .array(z.string())
    .default(['piece', 'accessoire', 'service']),
});

export type CartRulesDto = z.infer<typeof CartRulesSchema>;

// ================================================================
// SCHÉMAS POUR LA VALIDATION DES MÉTADONNÉES
// ================================================================

export const CartItemMetadataSchema = z.object({
  source: z.enum(['web', 'mobile', 'api']).optional(),
  session_id: z.string().optional(),
  referrer: z.string().url().optional(),
  promo_code: z.string().optional(),
  notes: z.string().max(500).optional(),
  custom_options: z.record(z.string(), z.any()).optional(),
});

export type CartItemMetadataDto = z.infer<typeof CartItemMetadataSchema>;

// ================================================================
// SCHÉMAS POUR LES REQUÊTES D'AJOUT ET MODIFICATION
// ================================================================

// Schéma pour ajouter un article au panier
export const AddToCartSchema = z.object({
  product_id: z.number().int().positive({
    message: "L'ID du produit doit être un nombre entier positif",
  }),
  quantity: z
    .number()
    .int()
    .min(1, {
      message: 'La quantité doit être au minimum de 1',
    })
    .max(99, {
      message: 'La quantité maximale est de 99',
    }),
  notes: z.string().max(500).optional(),
  custom_options: z.record(z.string(), z.any()).optional(),
  metadata: CartItemMetadataSchema.optional(),
});

// Schéma pour mettre à jour un article du panier
export const UpdateCartItemSchema = z.object({
  quantity: z
    .number()
    .int()
    .min(1, {
      message: 'La quantité doit être au minimum de 1',
    })
    .max(99, {
      message: 'La quantité maximale est de 99',
    }),
  notes: z.string().max(500).optional(),
  custom_options: z.record(z.string(), z.any()).optional(),
  metadata: CartItemMetadataSchema.optional(),
});

export type AddToCartDto = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemDto = z.infer<typeof UpdateCartItemSchema>;
