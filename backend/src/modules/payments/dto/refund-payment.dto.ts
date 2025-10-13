import { z } from 'zod';

/**
 * Schema Zod pour les remboursements de paiement
 * Remplacement de class-validator par Zod pour la validation
 */
export const RefundPaymentSchema = z.object({
  amount: z.number().positive().min(0.01).optional(),
  reason: z.string().optional(),
});

/**
 * Type inféré du schema Zod
 */
export type RefundPaymentDto = z.infer<typeof RefundPaymentSchema>;
