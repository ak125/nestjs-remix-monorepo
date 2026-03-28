import { z } from 'zod';

export const ManualIngestRequestSchema = z.object({
  title: z.string().min(5).max(300),
  content: z.string().min(50).max(100_000),
  gamme_aliases: z.array(z.string().min(2).max(100)).min(1),
  source_url: z.string().url().max(2048).optional(),
  truth_level: z.enum(['L1', 'L2', 'L3']).optional().default('L2'),
  category: z
    .enum([
      'knowledge',
      'knowledge/guide',
      'knowledge/reference',
      'knowledge/canonical',
      'diagnostic',
      'diagnostic/diagnostic',
      'maintenance',
      'selection',
      'faq',
    ])
    .optional()
    .default('knowledge'),
  domain: z.string().max(100).optional(),
});

export type ManualIngestRequestDto = z.infer<typeof ManualIngestRequestSchema>;
