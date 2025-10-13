import { z } from 'zod';
import { PaymentStatus, PaymentMethod } from '../entities/payment.entity';

/**
 * Schema Zod pour filtrer les paiements
 * Remplacement de class-validator par Zod pour la validation
 */
export const PaymentFiltersSchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  userId: z.string().optional(),
  orderId: z.string().optional(),
  limit: z.number().int().min(1).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

/**
 * Type inféré du schema Zod
 */
export type PaymentFiltersDto = z.infer<typeof PaymentFiltersSchema>;
