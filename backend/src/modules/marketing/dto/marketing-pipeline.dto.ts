import { z } from 'zod';
import { DomainValidationException } from '@common/exceptions';
import { socialExportQuerySchema } from './social-export.dto';

export const pipelineWeekSchema = z
  .object({ week_iso: socialExportQuerySchema.shape.week })
  .strict();

export const pipelinePlanSchema = pipelineWeekSchema.extend({
  gamme_aliases: z
    .array(z.string().trim().min(1))
    .transform((aliases) => [...new Set(aliases)])
    .optional(),
});

export const pipelineCopySchema = pipelineWeekSchema.extend({
  dry_run: z.boolean().default(false),
});

export function parsePipelineInput<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new DomainValidationException({
      message: 'Invalid marketing pipeline input',
      field: result.error.issues[0]?.path.join('.') || 'pipeline',
    });
  }
  return result.data;
}
