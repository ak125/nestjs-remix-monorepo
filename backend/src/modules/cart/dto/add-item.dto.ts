/**
 * 📝 ADD ITEM DTO - Validation pour l'ajout d'articles
 */

import { z } from 'zod';

// 🏷️ Schema Zod pour la validation (accepte productId ET product_id)
export const AddItemSchema = z
  .object({
    // Support des deux formats pour compatibilité frontend
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
    quantity: z.union([
      z.number().int().positive('La quantité doit être positive'),
      z
        .string()
        .regex(/^\d+$/, 'Quantité doit être numérique')
        .transform(Number),
    ]),
    product_variant_id: z.string().uuid().optional(),
    // F5 autorité de prix : le prix de vente est autorité SERVEUR (catalogue).
    // `custom_price` client volontairement RETIRÉ — un override de prix fourni par
    // le client sur cet endpoint (OptionalAuthGuard, anonyme autorisé) = price-tampering.
    // Toute clé custom_price/customPrice envoyée est ignorée (strip Zod) + loggée au boundary.
    metadata: z.record(z.string(), z.any()).optional(),
    type_id: z.number().int().positive().optional(),
    // F1 attribution : URL/chemin de la page d'où l'article a été ajouté au panier
    // (source d'ajout par-ligne). Threadé jusqu'à ___xtr_order_line.orl_website_url.
    website_url: z.string().trim().max(2048).optional(),
  })
  .refine((data) => data.productId || data.product_id, {
    message: "Il faut fournir soit 'productId' soit 'product_id'",
    path: ['productId', 'product_id'],
  })
  .transform((data) => ({
    ...data,
    // Normaliser vers product_id pour le backend
    product_id: data.productId || data.product_id,
  }));

// 🔧 Type TypeScript inféré
export type AddItemDto = z.infer<typeof AddItemSchema>;

// 🎯 Fonction de validation
export function validateAddItem(data: unknown): AddItemDto {
  return AddItemSchema.parse(data);
}
