import { BadRequestException, ConflictException } from '@nestjs/common';
import { z } from 'zod';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)));
export const renderBindingSchema = z
  .object({
    executionLogId: z.number().int().positive(),
    renderHash: hash,
    productionVersion: timestamp,
    fps: z.number().positive().max(240),
    totalFrames: z.number().int().positive(),
  })
  .strict();
export type RenderBinding = z.infer<typeof renderBindingSchema>;
const anchor = {
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
  target: z.string().trim().min(1).max(500),
  preserve: z.string().trim().max(2000),
  request: z.string().trim().min(1).max(4000),
};
const base = {
  expectedReviewRevision: z.number().int().nonnegative(),
  expectedRenderHash: hash,
  expectedProductionVersion: timestamp,
};
export const reviewMutationSchema = z.union([
  z
    .object({
      ...base,
      ...anchor,
      action: z.literal('add'),
      sourceExecutionId: z.number().int().positive().optional(),
      sourceCommentId: z.string().uuid().optional(),
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.enum(['resolve', 'reopen']),
      commentId: z.string().uuid(),
    })
    .strict(),
]);
const sourceSchema = z
  .object({
    executionLogId: z.number().int().positive(),
    commentId: z.string().uuid(),
    binding: renderBindingSchema,
    startFrame: anchor.startFrame,
    endFrame: anchor.endFrame,
  })
  .strict();
export const renderCommentSchema = z
  .object({
    ...anchor,
    id: z.string().uuid(),
    authorId: z.string().min(1),
    createdAt: timestamp,
    status: z.enum(['open', 'resolved']),
    binding: renderBindingSchema,
    updatedAt: timestamp.optional(),
    updatedBy: z.string().min(1).optional(),
    source: sourceSchema.optional(),
  })
  .strict();
export type RenderComment = z.infer<typeof renderCommentSchema>;
const reviewSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    comments: z.array(renderCommentSchema).max(200),
  })
  .strict();

export function readRenderReview(row: Record<string, any>) {
  const metadata = row.render_metadata;
  const result = renderBindingSchema.safeParse({
    executionLogId: row.id,
    renderHash: metadata?.checksumSha256,
    productionVersion: metadata?.productionVersion,
    fps: metadata?.fps,
    totalFrames: Math.round(metadata?.durationSecs * metadata?.fps),
  });
  if (
    row.status !== 'completed' ||
    row.render_status !== 'success' ||
    row.engine_name !== 'remotion' ||
    !row.render_output_path ||
    !result.success ||
    metadata?.stub === true ||
    metadata?.fallback === true
  ) {
    throw new ConflictException(
      'Exact rendered media and production version required for review',
    );
  }
  const stored = reviewSchema.safeParse(
    metadata.review ?? { revision: 0, comments: [] },
  );
  if (!stored.success)
    throw new ConflictException('Stored review cannot be interpreted safely');
  const binding = result.data;
  for (const comment of stored.data.comments) {
    if (
      JSON.stringify(comment.binding) !== JSON.stringify(binding) ||
      comment.startFrame >= comment.endFrame ||
      comment.endFrame > binding.totalFrames
    )
      throw new ConflictException('Stored comment binding mismatch');
  }
  return { binding, ...stored.data };
}

export function parseReviewMutation(input: unknown) {
  const result = reviewMutationSchema.safeParse(input);
  if (!result.success)
    throw new BadRequestException('Invalid render review input');
  const value = result.data;
  if (
    value.action === 'add' &&
    (value.startFrame >= value.endFrame ||
      Boolean(value.sourceExecutionId) !== Boolean(value.sourceCommentId))
  )
    throw new BadRequestException(
      'Invalid interval or incomplete source reference',
    );
  return value;
}
