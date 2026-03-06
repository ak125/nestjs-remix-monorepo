import { z } from 'zod';

export const WebIngestRequestSchema = z.object({
  url: z.string().url().max(2048),
  truthLevel: z.enum(['L1', 'L2', 'L3', 'L4']).optional().default('L3'),
  force: z.boolean().optional().default(false),
});

export type WebIngestRequestDto = z.infer<typeof WebIngestRequestSchema>;
