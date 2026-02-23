import { z } from 'zod';

export const TriggerRefreshDto = z.object({
  pgAlias: z.string().min(1).optional(),
  pgAliases: z.array(z.string().min(1)).optional(),
  supplementaryFiles: z.array(z.string()).optional(),
});

export type TriggerRefreshInput = z.infer<typeof TriggerRefreshDto>;

export const RefreshStatusQueryDto = z.object({
  status: z
    .enum([
      'pending',
      'processing',
      'draft',
      'failed',
      'skipped',
      'published',
      'auto_published',
    ])
    .optional(),
  page_type: z
    .enum([
      'R1_pieces',
      'R3_conseils',
      'R3_guide_achat',
      'R4_reference',
      'R5_diagnostic',
    ])
    .optional(),
  pg_alias: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type RefreshStatusQuery = z.infer<typeof RefreshStatusQueryDto>;

export const RejectRefreshDto = z.object({
  reason: z.string().min(1).max(1000),
});

export type RejectRefreshInput = z.infer<typeof RejectRefreshDto>;
