import { z } from 'zod';

// Schéma Zod pour l'application d'un code promo
export const ApplyPromoSchema = z.object({
  promoCode: z
    .string({
      message: 'promoCode doit être une chaîne de caractères',
    })
    .min(1, 'Le code promo ne peut pas être vide')
    .max(20, 'Le code promo ne peut pas dépasser 20 caractères')
    .regex(/^[A-Z0-9_-]+$/i, 'Le code promo ne peut contenir que des lettres, chiffres, tirets et underscores'),
});

// Type TypeScript inféré du schéma Zod
export type ApplyPromoDto = z.infer<typeof ApplyPromoSchema>;

// Fonction de validation
export function validateApplyPromo(data: unknown): ApplyPromoDto {
  return ApplyPromoSchema.parse(data);
}
