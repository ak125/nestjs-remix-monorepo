import { z } from 'zod';
import { DomainValidationException } from '@common/exceptions';

export const SocialReviewSchema = z
  .object({
    channel: z.enum(['instagram', 'facebook', 'youtube']),
    content_revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    review_version: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

export type SocialReviewTarget = z.infer<typeof SocialReviewSchema>;

export function parseSocialReview(value: unknown): SocialReviewTarget {
  const parsed = SocialReviewSchema.safeParse(value);
  if (!parsed.success) {
    throw new DomainValidationException({
      message: 'Network, content revision and review version are required',
      field: 'review',
    });
  }
  return parsed.data;
}
