import { z } from 'zod';

// Schéma Zod pour la mise à jour d'un article du panier
export const UpdateCartItemSchema = z.object({
  quantity: z
    .number({
      message: 'quantity doit être un nombre',
    })
    .int('quantity doit être un entier')
    .positive('quantity doit être positive')
    .max(99, 'Quantité maximale: 99'),
});

// Type TypeScript inféré du schéma Zod
export type UpdateCartItemDto = z.infer<typeof UpdateCartItemSchema>;

// Fonction de validation
export function validateUpdateCartItem(data: unknown): UpdateCartItemDto {
  return UpdateCartItemSchema.parse(data);
}
