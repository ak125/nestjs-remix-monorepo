/**
 * 🛡️ SCHÉMAS DE VALIDATION ZOD POUR LE PANIER
 * 
 * Validation robuste des données panier avec Zod
 * 
 * @author GitHub Copilot
 * @version 2.0.0
 */

import { z } from 'zod';

// 📦 SCHÉMAS DE BASE

/**
 * Schéma Zod pour un identifiant de produit
 */
export const ProductIdSchema = z.string()
  .min(1, "L'ID du produit ne peut pas être vide")
  .max(100, "L'ID du produit ne peut pas dépasser 100 caractères")
  .regex(/^[a-zA-Z0-9_-]+$/, "L'ID du produit ne peut contenir que des lettres, chiffres, tirets et underscores");

/**
 * Schéma Zod pour une quantité
 */
export const QuantitySchema = z.number()
  .int("La quantité doit être un nombre entier")
  .min(1, "La quantité doit être au moins 1")
  .max(999, "La quantité ne peut pas dépasser 999");

/**
 * Schéma Zod pour un prix
 */
export const PriceSchema = z.number()
  .min(0, "Le prix ne peut pas être négatif")
  .max(999999.99, "Le prix ne peut pas dépasser 999,999.99")
  .multipleOf(0.01, "Le prix doit avoir au maximum 2 décimales");

/**
 * Schéma Zod pour un nom de produit
 */
export const ProductNameSchema = z.string()
  .min(1, "Le nom du produit ne peut pas être vide")
  .max(200, "Le nom du produit ne peut pas dépasser 200 caractères")
  .trim();

// 🛒 SCHÉMAS POUR LES ARTICLES DU PANIER

/**
 * Schéma Zod pour ajouter un article au panier
 */
export const AddToCartRequestSchema = z.object({
  product_id: ProductIdSchema,
  quantity: QuantitySchema,
  price: PriceSchema,
  name: ProductNameSchema,
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional(),
  image_url: z.string().url("L'URL de l'image doit être valide").optional(),
  category: z.string().max(100, "La catégorie ne peut pas dépasser 100 caractères").optional(),
});

/**
 * Schéma Zod pour un article dans le panier
 */
export const CartItemSchema = z.object({
  id: z.string().min(1, "L'ID de l'article ne peut pas être vide"),
  product_id: ProductIdSchema,
  quantity: QuantitySchema,
  price: PriceSchema,
  name: ProductNameSchema,
  description: z.string().optional(),
  image_url: z.string().url().optional(),
  category: z.string().optional(),
  addedAt: z.string().datetime("La date d'ajout doit être au format ISO"),
});

/**
 * Schéma Zod pour les métadonnées du panier
 */
export const CartMetadataSchema = z.object({
  subtotal: PriceSchema,
  tax: PriceSchema.optional(),
  shipping: PriceSchema.optional(),
  total: PriceSchema.optional(),
  promo_code: z.string().max(50).nullable(),
  discount: PriceSchema.optional(),
  shipping_address: z.object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    postal_code: z.string().min(1).max(20),
    country: z.string().min(1).max(100),
  }).optional().nullable(),
});

/**
 * Schéma Zod pour un panier complet
 */
export const CartSchema = z.object({
  id: z.string().min(1, "L'ID du panier ne peut pas être vide"),
  sessionId: z.string().min(1, "L'ID de session ne peut pas être vide"),
  userId: z.string().uuid("L'ID utilisateur doit être un UUID valide").optional().nullable(),
  items: z.array(CartItemSchema),
  metadata: CartMetadataSchema,
  createdAt: z.string().datetime("La date de création doit être au format ISO"),
  updatedAt: z.string().datetime("La date de mise à jour doit être au format ISO"),
});

// 🔄 SCHÉMAS POUR LES MISES À JOUR

/**
 * Schéma Zod pour mettre à jour la quantité d'un article
 */
export const UpdateCartItemQuantitySchema = z.object({
  quantity: QuantitySchema,
});

/**
 * Schéma Zod pour supprimer un article du panier
 */
export const RemoveCartItemSchema = z.object({
  product_id: ProductIdSchema,
});

/**
 * Schéma Zod pour appliquer un code promo
 */
export const ApplyPromoCodeSchema = z.object({
  promo_code: z.string()
    .min(1, "Le code promo ne peut pas être vide")
    .max(50, "Le code promo ne peut pas dépasser 50 caractères")
    .regex(/^[A-Z0-9_-]+$/, "Le code promo ne peut contenir que des majuscules, chiffres, tirets et underscores"),
});

// 📊 SCHÉMAS POUR LES RÉPONSES API

/**
 * Schéma Zod pour les réponses d'erreur
 */
export const CartErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
  timestamp: z.string().datetime(),
});

/**
 * Schéma Zod pour les réponses de succès
 */
export const CartSuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: CartSchema,
});

// 🏷️ TYPES TYPESCRIPT INFÉRÉS

export type AddToCartRequest = z.infer<typeof AddToCartRequestSchema>;
export type CartItem = z.infer<typeof CartItemSchema>;
export type CartMetadata = z.infer<typeof CartMetadataSchema>;
export type Cart = z.infer<typeof CartSchema>;
export type UpdateCartItemQuantity = z.infer<typeof UpdateCartItemQuantitySchema>;
export type RemoveCartItem = z.infer<typeof RemoveCartItemSchema>;
export type ApplyPromoCode = z.infer<typeof ApplyPromoCodeSchema>;
export type CartErrorResponse = z.infer<typeof CartErrorResponseSchema>;
export type CartSuccessResponse = z.infer<typeof CartSuccessResponseSchema>;

// 🛠️ UTILITAIRES DE VALIDATION

/**
 * Valide et parse une requête d'ajout au panier
 */
export const validateAddToCartRequest = (data: unknown): AddToCartRequest => {
  return AddToCartRequestSchema.parse(data);
};

/**
 * Valide et parse un panier complet
 */
export const validateCart = (data: unknown): Cart => {
  return CartSchema.parse(data);
};

/**
 * Validation sécurisée qui retourne un résultat avec erreurs
 */
export const safeValidateAddToCartRequest = (data: unknown) => {
  return AddToCartRequestSchema.safeParse(data);
};

/**
 * Validation sécurisée pour un panier
 */
export const safeValidateCart = (data: unknown) => {
  return CartSchema.safeParse(data);
};

// 🎯 SCHÉMAS PARTIELS POUR LES MISES À JOUR

/**
 * Schéma pour une mise à jour partielle d'article
 */
export const PartialCartItemSchema = CartItemSchema.partial().extend({
  id: z.string().min(1), // L'ID est toujours requis
});

/**
 * Schéma pour une mise à jour partielle de panier
 */
export const PartialCartSchema = CartSchema.partial().extend({
  id: z.string().min(1), // L'ID est toujours requis
});

export type PartialCartItem = z.infer<typeof PartialCartItemSchema>;
export type PartialCart = z.infer<typeof PartialCartSchema>;