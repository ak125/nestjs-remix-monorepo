import { z } from 'zod';
import { DomainValidationException } from '@common/exceptions';
import { SocialReviewSchema } from './social-review.dto';

const mediaReference = z
  .object({
    bucket: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,99}$/),
    // Object keys only: no URL, signed token, backslash or traversal segment.
    path: z
      .string()
      .min(1)
      .max(512)
      .regex(/^[a-zA-Z0-9_-][a-zA-Z0-9_./-]*$/)
      .refine((value) =>
        value
          .split('/')
          .every((part) => part !== '' && part !== '.' && part !== '..'),
      ),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    role: z.enum(['image', 'video', 'thumbnail', 'subtitles']),
  })
  .strict();

export const PublicationPreparationSchema = SocialReviewSchema.extend({
  request_id: z
    .string()
    .uuid()
    .transform((value) => value.toLowerCase()),
  account: z
    .object({
      external_id: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .regex(/^[a-zA-Z0-9_.:@-]+$/),
      label: z.string().trim().min(1).max(200),
    })
    .strict(),
  media: z
    .array(mediaReference)
    .max(20)
    .refine(
      (items) =>
        new Set(items.map((item) => `${item.bucket}/${item.path}`)).size ===
        items.length,
    ),
}).strict();

export type PublicationPreparationInput = z.infer<
  typeof PublicationPreparationSchema
>;

export const PublicationPreparationRecordSchema =
  PublicationPreparationSchema.extend({
    post_id: z.number().int().positive().safe(),
    actor: z.string().min(1),
    editorial_snapshot: z.record(z.string(), z.unknown()),
    approval_snapshot: z
      .object({
        state: z.literal('approved'),
        content_revision: z.number().int().positive().safe(),
        actor: z.string().min(1),
        decided_at: z.string().datetime({ offset: true }),
      })
      .passthrough(),
    created_at: z.string().datetime({ offset: true }),
  });
export type PublicationPreparationRecord = z.infer<
  typeof PublicationPreparationRecordSchema
>;

export function parsePublicationPreparation(
  value: unknown,
): PublicationPreparationInput {
  const result = PublicationPreparationSchema.safeParse(value);
  if (!result.success)
    throw new DomainValidationException({
      message:
        'Valid revision, request ID, declared account and media references required',
      field: 'preparation',
    });
  return result.data;
}
