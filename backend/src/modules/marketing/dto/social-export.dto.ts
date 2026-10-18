import { z } from 'zod';
import { DomainValidationException } from '@common/exceptions';

/** Reject non-existent ISO weeks as well as unsafe filename/query input. */
export const socialExportQuerySchema = z
  .object({
    week: z
      .string()
      .regex(/^[1-9]\d{3}-W\d{2}$/)
      .refine((value) => {
        const year = Number(value.slice(0, 4));
        const week = Number(value.slice(6));
        if (week < 1 || week > 53) return false;
        const jan4 = new Date(Date.UTC(year, 0, 4));
        const thursday = new Date(jan4);
        thursday.setUTCDate(4 - (jan4.getUTCDay() || 7) + 4 + (week - 1) * 7);
        return thursday.getUTCFullYear() === year;
      }, 'Non-existent ISO week'),
    channel: z.enum(['instagram', 'facebook', 'youtube']),
  })
  .strict();

export function parseSocialExport(input: unknown) {
  const result = socialExportQuerySchema.safeParse(input);
  if (!result.success) {
    throw new DomainValidationException({
      message: 'A valid ISO week and supported social channel are required',
      field: 'export',
    });
  }
  return result.data;
}
