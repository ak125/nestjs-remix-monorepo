import { z } from 'zod';

// Schéma pour les métadonnées d'un article du panier
export const CartItemMetadataSchema = z.object({
  color: z.string().optional(),
  size: z.string().optional(),
  warranty: z.string().optional(),
  installation_required: z.boolean().optional(),
  custom_notes: z
    .string()
    .max(500, 'Notes personnalisées limitées à 500 caractères')
    .optional(),
  gift_wrapping: z.boolean().optional(),
  gift_message: z
    .string()
    .max(200, 'Message cadeau limité à 200 caractères')
    .optional(),
});

// Schéma pour les règles du panier
export const CartRulesSchema = z.object({
  max_quantity_per_item: z.number().int().positive().default(99),
  max_total_items: z.number().int().positive().default(50),
  min_order_amount: z.number().positive().default(0),
  max_order_amount: z.number().positive().default(10000),
  allow_backorder: z.boolean().default(false),
  require_login: z.boolean().default(true),
  shipping_zones: z.array(z.string()).default(['FR', 'EU']),
  payment_methods: z
    .array(z.string())
    .default(['CARD', 'PAYPAL', 'BANK_TRANSFER']),
});

// Schéma pour un produit dans le panier
export const CartProductSchema = z.object({
  piece_id: z.number().int().positive(),
  piece_ref: z.string(),
  piece_name: z.string(),
  piece_price_ttc: z.number().positive(),
  piece_weight: z.number().nonnegative().optional(),
  piece_stock: z.number().int().nonnegative().optional(),
  piece_img_url: z.string().url().optional(),
  piece_brand: z.string().optional(),
});

// Schéma pour un article du panier avec produit
export const CartItemWithProductSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.string().min(1),
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
  created_at: z.string(),
  updated_at: z.string(),
  metadata: CartItemMetadataSchema.optional(),
  product: CartProductSchema.optional(),
  unit_price: z.number().positive(),
  total_price: z.number().positive(),
});

// Schéma pour le résumé du panier
export const CartSummarySchema = z.object({
  total_items: z.number().int().nonnegative(),
  total_quantity: z.number().int().nonnegative(),
  subtotal: z.number().nonnegative(),
  shipping_cost: z.number().nonnegative().optional(),
  promo_discount: z.number().nonnegative().optional(),
  total: z.number().nonnegative(),
  currency: z
    .string()
    .length(3, 'Code devise doit faire 3 caractères')
    .default('EUR'),
});

// Schéma pour l'estimation de livraison
export const EstimatedShippingSchema = z.object({
  weight: z.number().nonnegative(),
  estimated_cost: z.number().nonnegative(),
});

// Schéma pour la réponse complète du panier
export const CartResponseSchema = z.object({
  items: z.array(CartItemWithProductSchema),
  summary: CartSummarySchema,
  promo_code: z.string().optional(),
  estimated_shipping: EstimatedShippingSchema.optional(),
});

// Types TypeScript inférés
export type CartItemMetadata = z.infer<typeof CartItemMetadataSchema>;
export type CartRules = z.infer<typeof CartRulesSchema>;
export type CartProduct = z.infer<typeof CartProductSchema>;
export type CartItemWithProduct = z.infer<typeof CartItemWithProductSchema>;
export type CartSummary = z.infer<typeof CartSummarySchema>;
export type EstimatedShipping = z.infer<typeof EstimatedShippingSchema>;
export type CartResponse = z.infer<typeof CartResponseSchema>;

// Fonctions de validation
export function validateCartResponse(data: unknown): CartResponse {
  return CartResponseSchema.parse(data);
}

export function validateCartSummary(data: unknown): CartSummary {
  return CartSummarySchema.parse(data);
}

export function validateCartItemMetadata(data: unknown): CartItemMetadata {
  return CartItemMetadataSchema.parse(data);
}

export function validateCartRules(data: unknown): CartRules {
  return CartRulesSchema.parse(data);
}

// Validations sûres qui retournent un objet de résultat
export function safeValidateCartResponse(data: unknown) {
  return CartResponseSchema.safeParse(data);
}

export function safeValidateCartSummary(data: unknown) {
  return CartSummarySchema.safeParse(data);
}

export function safeValidateCartItemMetadata(data: unknown) {
  return CartItemMetadataSchema.safeParse(data);
}
