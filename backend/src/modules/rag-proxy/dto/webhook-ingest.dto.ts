import { z } from 'zod';

export const WebhookIngestionCompleteSchema = z.object({
  job_id: z.string().min(1),
  source: z.enum(['pdf', 'web']),
  status: z.enum(['done', 'failed']),
  files_created: z.array(z.string()).default([]),
});

export interface WebhookIngestionCompleteDto {
  job_id: string;
  source: 'pdf' | 'web';
  status: 'done' | 'failed';
  files_created?: string[];
}
