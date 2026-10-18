import { z } from 'zod';
import { DomainValidationException } from '@common/exceptions';
import { SocialReviewSchema } from './social-review.dto';

export const SocialPublicationSchema = SocialReviewSchema.extend({
  approved_content_hash: z.string().regex(/^[a-f0-9]{64}$/),
  url: z
    .string()
    .max(2048)
    .url()
    .regex(/^https:\/\/[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^\s]*)?$/),
}).strict();
export type SocialPublicationTarget = z.infer<typeof SocialPublicationSchema>;
export function parseSocialPublication(
  value: unknown,
): SocialPublicationTarget {
  const result = SocialPublicationSchema.safeParse(value);
  if (!result.success)
    throw new DomainValidationException({
      message:
        'Current channel approval hash, versions and HTTPS publication URL required',
      field: 'publication',
    });
  return result.data;
}
