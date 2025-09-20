/**
 * 📝 ADD ITEM DTO - Validation pour l'ajout d'articles
 */

import { z } from 'zod';

// 🏷️ Schema Zod pour la validation
export const AddItemSchema = z.object({
  product_id: z.string().uuid('ID produit invalide'),
  quantity: z.number().int().positive('La quantité doit être positive'),
  product_variant_id: z.string().uuid().optional(),
  custom_price: z.number().positive().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// 🔧 Type TypeScript inféré
export type AddItemDto = z.infer<typeof AddItemSchema>;

// 🎯 Fonction de validation
export function validateAddItem(data: unknown): AddItemDto {
  return AddItemSchema.parse(data);
}
