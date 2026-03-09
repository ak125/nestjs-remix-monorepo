/**
 * Cart Zod Schemas — contrats de validation pour le module panier
 *
 * Source de verite pour les types CartItem, CartSummary, CartAction.
 * Les types TS sont inferes via z.infer<>.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const moneySchema = z.number().finite().min(0);
export const currencySchema = z.string().min(1).default("EUR");

// ---------------------------------------------------------------------------
// CartItem
// ---------------------------------------------------------------------------

export const cartItemSchema = z
  .object({
    id: z.string(),
    user_id: z.string().optional(),
    product_id: z.string(),
    quantity: z.coerce.number().int().min(1).max(99),
    price: moneySchema,
    created_at: z.string().optional(),
    updated_at: z.string().optional(),

    // Nom produit (au moins un des deux doit etre present)
    name: z.string().optional(),
    product_name: z.string().optional(),

    // References & marque
    product_sku: z.string().optional(),
    product_ref: z.string().optional(),
    product_brand: z.string().nullable().optional(),

    // Images
    product_image: z.string().optional(),
    image_url: z.string().optional(),

    // Poids & stock
    weight: z.number().optional(),
    stock_available: z.number().optional(),

    // Prix calcules
    unit_price: moneySchema.optional(),
    total_price: moneySchema.optional(),

    // Consignes (batteries, alternateurs)
    consigne_unit: moneySchema.optional(),
    consigne_total: moneySchema.optional(),
    has_consigne: z.boolean().optional(),

    // Cross-sell
    pg_id: z.number().optional(),

    // Vehicle context (type_id du vehicule a l'ajout)
    type_id: z.number().optional(),

    // Metadata flexible
    options: z.record(z.any()).optional(),

    // Metier auto (futur)
    compatibility_status: z
      .enum(["verified", "unverified", "unknown"])
      .optional(),
  })
  .superRefine((item, ctx) => {
    if (!item.product_name && !item.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le produit doit avoir un nom (product_name ou name).",
        path: ["product_name"],
      });
    }
    if (item.unit_price == null && item.price == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le produit doit avoir un prix (unit_price ou price).",
        path: ["unit_price"],
      });
    }
  });

// ---------------------------------------------------------------------------
// CartSummary
// ---------------------------------------------------------------------------

export const cartSummarySchema = z.object({
  total_items: z.coerce.number().int().min(0),
  subtotal: moneySchema,
  tax_amount: moneySchema,
  shipping_cost: moneySchema,
  consigne_total: moneySchema,
  discount_amount: moneySchema.optional(),
  total_price: moneySchema,
  currency: currencySchema,
});

// ---------------------------------------------------------------------------
// Cart (complet)
// ---------------------------------------------------------------------------

export const cartSchema = z.object({
  items: z.array(cartItemSchema),
  summary: cartSummarySchema,
  metadata: z
    .object({
      user_id: z.string().optional(),
      session_id: z.string().optional(),
      last_updated: z.string().optional(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Action input (formulaire panier)
// ---------------------------------------------------------------------------

export const cartActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("update"),
    productId: z.string().min(1),
    quantity: z.coerce.number().int().min(1).max(99),
  }),
  z.object({
    intent: z.literal("remove"),
    productId: z.string().min(1),
  }),
  z.object({
    intent: z.literal("clear"),
  }),
]);

// ---------------------------------------------------------------------------
// Action response
// ---------------------------------------------------------------------------

export const cartActionResponseSchema = z.object({
  success: z.boolean().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  cart: cartSchema.optional(),
});

// ---------------------------------------------------------------------------
// Types inferes
// ---------------------------------------------------------------------------

export type CartItem = z.infer<typeof cartItemSchema>;
export type CartSummary = z.infer<typeof cartSummarySchema>;
export type Cart = z.infer<typeof cartSchema>;
export type CartActionInput = z.infer<typeof cartActionSchema>;
export type CartActionResponse = z.infer<typeof cartActionResponseSchema>;

/** Alias retro-compatible */
export type CartData = Cart;
