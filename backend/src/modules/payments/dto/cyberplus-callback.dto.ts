import { z } from 'zod';

/**
 * Schema Zod pour les callbacks Cyberplus/BNP
 * Remplacement de class-validator par Zod pour la validation
 */
export const CyberplusCallbackSchema = z.object({
  transaction_id: z.string(),
  order_id: z.string(),
  status: z.string(),
  statuscode: z.string().optional(),
  amount: z.number(),
  currency: z.string().optional().default('EUR'),
  payment_method: z.string().optional(),
  signature: z.string(),
  ip: z.string().optional(),
  ips: z.string().optional(),
  date_payment: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Type inféré du schema Zod
 */
export type CyberplusCallbackDto = z.infer<typeof CyberplusCallbackSchema>;
