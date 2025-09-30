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
    metadata: z.record(z.string(), z.any()).optional(),
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
