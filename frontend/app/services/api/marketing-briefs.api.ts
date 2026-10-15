import { z } from "zod";

export const briefRowSchema = z.object({
  id: z.string().min(1),
  agent_id: z.string(),
  business_unit: z.enum(["ECOMMERCE", "LOCAL", "HYBRID"]),
  channel: z.string(),
  conversion_goal: z.enum(["CALL", "VISIT", "QUOTE", "ORDER"]),
  cta: z.string(),
  target_segment: z.string(),
  brand_gate_level: z.enum(["PASS", "WARN", "FAIL"]).nullable(),
  status: z.enum(["draft", "reviewed", "approved", "published", "archived"]),
  created_at: z.string().datetime({ offset: true }),
  reviewed_by: z.string().nullable(),
  approved_by: z.string().nullable(),
});
export type BriefRow = z.infer<typeof briefRowSchema>;
export const briefDecisionSchema = z
  .object({
    status: z.enum(["reviewed", "approved", "archived"]),
    expected_updated_at: z.string().datetime({ offset: true }),
  })
  .strict();
export const briefDetailSchema = briefRowSchema.extend({
  id: z.string().uuid(),
  updated_at: z.string().datetime({ offset: true }),
  reviewed_at: z.string().datetime({ offset: true }).nullable(),
  approved_at: z.string().datetime({ offset: true }).nullable(),
  published_at: z.string().datetime({ offset: true }).nullable(),
  compliance_gate_level: z.enum(["PASS", "WARN", "FAIL"]).nullable(),
  payload: z.record(z.string(), z.unknown()),
  coverage_manifest: z.record(z.string(), z.unknown()),
  gate_summary: z.record(z.string(), z.unknown()).nullable(),
  social_post_id: z.number().int().positive().safe().nullable(),
});
export const briefDetailResponseSchema = z.object({
  success: z.literal(true),
  data: briefDetailSchema,
  review: z.object({
    allowed_actions: z.array(briefDecisionSchema.shape.status),
    blocked_reason: z.string().nullable(),
  }),
});
export const briefsResponseSchema = z.object({
  success: z.literal(true),
  data: z
    .object({
      items: z.array(briefRowSchema),
      total: z.number().int().nonnegative().safe(),
      page: z.number().int().positive().safe(),
      limit: z.number().int().min(1).max(100),
    })
    .refine(
      (data) =>
        data.total >= data.items.length && data.items.length <= data.limit,
    ),
});

export const socialWeekSchema = z
  .string()
  .regex(/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/);
export const socialBriefSourceSchema = z.object({
  brief: z
    .object({
      id: z.string().uuid(),
      cta: z.string().optional(),
      approved_by: z.string().nullable().optional(),
      approved_at: z.string().nullable().optional(),
    })
    .passthrough(),
  linked_content_revision: z.number().int().positive().safe(),
  linked_by: z.string().optional(),
  linked_at: z.string().optional(),
});
export type SocialBriefSource = z.infer<typeof socialBriefSourceSchema>;
export const socialLinkCandidateSchema = z.object({
  id: z.number().int().positive().safe(),
  week_iso: socialWeekSchema,
  status: z.string(),
  content_revision: z.number().int().positive().safe(),
  review_version: z.number().int().nonnegative().safe(),
  channels_list: z.array(z.string()),
  channels: z.record(
    z.string(),
    z.object({ caption: z.string().optional() }).passthrough(),
  ),
  source_brief: socialBriefSourceSchema.nullable().optional(),
});
export const briefSocialLinkSchema = z
  .object({
    post_id: z.coerce.number().int().positive().safe(),
    expected_updated_at: z.string().datetime({ offset: true }),
    content_revision: z.coerce.number().int().positive().safe(),
    review_version: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().nonnegative().safe()),
  })
  .strict();
export const briefSocialReceiptSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.number().int().positive().safe(),
    week_iso: socialWeekSchema,
    content_revision: z.number().int().positive().safe(),
    review_version: z.number().int().nonnegative().safe(),
    source_brief: socialBriefSourceSchema,
  }),
});
