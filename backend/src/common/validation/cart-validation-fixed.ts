/**
 * 🛡️ SCHÉMAS DE VALIDATION ZOD POUR LE BACKEND - VERSION CORRIGÉE
 * 
 * Validation robuste des données panier côté serveur avec Zod
 */

import { z } from 'zod';
import { Injectable, BadRequestException, PipeTransform } from '@nestjs/common';

// 🔧 SCHÉMAS DE BASE

/**
 * Schéma Zod pour un ID de produit
 */
export const ProductIdSchema = z.string()
  .min(1, "L'ID du produit ne peut pas être vide")
  .max(50, "L'ID du produit ne peut pas dépasser 50 caractères")
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

// 📦 SCHÉMAS POUR LES REQUÊTES

/**
 * Schéma Zod pour ajouter un article au panier
 */
export const AddToCartRequestSchema = z.object({
  product_id: ProductIdSchema,
  quantity: QuantitySchema,
  price: PriceSchema.optional(),
  name: ProductNameSchema.optional(),
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional(),
  image_url: z.string().url("L'URL de l'image doit être valide").optional(),
  category: z.string().max(100, "La catégorie ne peut pas dépasser 100 caractères").optional(),
});

/**
 * Schéma Zod pour mettre à jour la quantité d'un article
 */
export const UpdateQuantityRequestSchema = z.object({
  quantity: QuantitySchema,
});

/**
 * Schéma Zod pour les codes promotionnels
 */
export const PromoCodeSchema = z.string()
  .min(3, "Le code promo doit contenir au moins 3 caractères")
  .max(20, "Le code promo ne peut pas dépasser 20 caractères")
  .regex(/^[A-Z0-9_-]+$/, "Le code promo ne peut contenir que des lettres majuscules, chiffres, tirets et underscores")
  .transform(str => str.toUpperCase());

/**
 * Schéma Zod pour appliquer un code promo
 */
export const ApplyPromoCodeRequestSchema = z.object({
  code: PromoCodeSchema,
});

/**
 * Schéma Zod pour supprimer un article du panier
 */
export const RemoveCartItemRequestSchema = z.object({
  product_id: ProductIdSchema,
});

/**
 * Schéma Zod pour vider complètement le panier
 */
export const ClearCartRequestSchema = z.object({
  confirm: z.literal(true, {
    message: 'Vous devez confirmer la suppression du panier',
  }),
});

/**
 * Schéma Zod pour les paramètres de route
 */
export const CartItemIdParamSchema = z.object({
  itemId: z
    .string()
    .min(1, "L'ID de l'article ne peut pas être vide")
    .max(50, "L'ID de l'article ne peut pas dépasser 50 caractères"),
});

/**
 * Schéma Zod pour les query parameters du panier
 */
export const CartQueryParamsSchema = z.object({
  include_metadata: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .default(true),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, 'La devise doit être un code ISO 3 lettres')
    .default('EUR')
    .optional(),
});

// 🛡️ PIPES DE VALIDATION NESTJS

/**
 * Pipe de validation Zod générique pour NestJS
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodSchema<any>) {}

  transform(value: any) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues.map((issue) => {
          const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
          return `${path}: ${issue.message}`;
        }).join(', ');
        
        console.log('🛡️ Validation Zod échouée:', errorMessages);
        throw new BadRequestException({
          message: `Validation échouée: ${errorMessages}`,
          errors: error.issues,
          statusCode: 400
        });
      }
      console.log('🛡️ Erreur de validation inconnue:', error);
      throw new BadRequestException('Validation échouée');
    }
  }
}

/**
 * Pipe spécifique pour les requêtes d'ajout au panier
 */
@Injectable()
export class AddToCartValidationPipe extends ZodValidationPipe {
  constructor() {
    super(AddToCartRequestSchema);
  }
}

/**
 * Pipe pour la mise à jour de quantité
 */
@Injectable()
export class UpdateQuantityValidationPipe extends ZodValidationPipe {
  constructor() {
    super(UpdateQuantityRequestSchema);
  }
}

/**
 * Pipe pour l'application de codes promo
 */
@Injectable()
export class PromoCodeValidationPipe extends ZodValidationPipe {
  constructor() {
    super(ApplyPromoCodeRequestSchema);
  }
}

/**
 * Pipe pour la suppression d'articles
 */
@Injectable()
export class RemoveCartItemValidationPipe extends ZodValidationPipe {
  constructor() {
    super(RemoveCartItemRequestSchema);
  }
}

/**
 * Pipe pour vider le panier
 */
@Injectable()
export class ClearCartValidationPipe extends ZodValidationPipe {
  constructor() {
    super(ClearCartRequestSchema);
  }
}

/**
 * Pipe pour les paramètres de route
 */
@Injectable()
export class CartItemIdValidationPipe extends ZodValidationPipe {
  constructor() {
    super(CartItemIdParamSchema);
  }
}

/**
 * Pipe pour les query parameters
 */
@Injectable()
export class CartQueryValidationPipe extends ZodValidationPipe {
  constructor() {
    super(CartQueryParamsSchema);
  }
}

// 📝 TYPES TYPESCRIPT

export type AddToCartRequest = z.infer<typeof AddToCartRequestSchema>;
export type UpdateQuantityRequest = z.infer<typeof UpdateQuantityRequestSchema>;
export type ApplyPromoCodeRequest = z.infer<typeof ApplyPromoCodeRequestSchema>;
export type RemoveCartItemRequest = z.infer<typeof RemoveCartItemRequestSchema>;
export type ClearCartRequest = z.infer<typeof ClearCartRequestSchema>;
export type CartItemIdParam = z.infer<typeof CartItemIdParamSchema>;
export type CartQueryParams = z.infer<typeof CartQueryParamsSchema>;

export type ProductId = z.infer<typeof ProductIdSchema>;
export type Quantity = z.infer<typeof QuantitySchema>;
export type Price = z.infer<typeof PriceSchema>;
export type ProductName = z.infer<typeof ProductNameSchema>;
export type PromoCode = z.infer<typeof PromoCodeSchema>;