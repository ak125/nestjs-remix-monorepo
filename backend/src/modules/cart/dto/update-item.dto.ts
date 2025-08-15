/**
 * 📝 UPDATE ITEM DTO - Validation pour la modification d'articles
 */

import { z } from 'zod';

// 🏷️ Schema Zod pour la validation
export const UpdateItemSchema = z.object({
  quantity: z.number().int().min(0, 'La quantité ne peut pas être négative'),
  custom_price: z.number().positive().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// 🔧 Type TypeScript inféré
export type UpdateItemDto = z.infer<typeof UpdateItemSchema>;

// 🎯 Fonction de validation
export function validateUpdateItem(data: unknown): UpdateItemDto {
  return UpdateItemSchema.parse(data);
}
