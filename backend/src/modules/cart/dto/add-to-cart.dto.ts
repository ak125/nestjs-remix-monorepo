import { z } from 'zod';

// Schéma Zod pour l'ajout d'articles au panier
export const AddToCartSchema = z.object({
  product_id: z
    .number({
      message: 'product_id doit être un nombre',
    })
    .int('product_id doit être un entier')
    .positive('product_id doit être positif'),

  quantity: z
    .number({
      message: 'quantity doit être un nombre',
    })
    .int('quantity doit être un entier')
    .positive('quantity doit être positive')
    .max(99, 'Quantité maximale: 99'),

  metadata: z.record(z.string(), z.any()).optional(),
});

// Type TypeScript inféré du schéma Zod
export type AddToCartDto = z.infer<typeof AddToCartSchema>;

// Fonction de validation
export function validateAddToCart(data: unknown): AddToCartDto {
  return AddToCartSchema.parse(data);
}
