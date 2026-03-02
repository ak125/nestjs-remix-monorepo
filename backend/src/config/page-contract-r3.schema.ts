/**
 * R3PageContract Zod Schema — contrat formel pour les sorties des agents SEO R3.
 * Valide section plans, media slots, query clusters, gate reports.
 * Utilise par keyword-planner et conseil-batch comme reference de structure.
 */

import { z } from 'zod';
import {
  PLANNABLE_SECTIONS,
  MEDIA_SLOT_TYPES,
  MEDIA_PLACEMENTS,
  MEDIA_BUDGET,
} from './keyword-plan.constants';

// ── Section ID (reuses existing enum) ────────────────────

export const SectionIdSchema = z.enum(PLANNABLE_SECTIONS);
export type SectionId = z.infer<typeof SectionIdSchema>;

// ── Query item ───────────────────────────────────────────

export const R3QueryItemSchema = z.object({
  query: z.string().min(3),
  volume_hint: z.enum(['high', 'mid', 'low']).optional(),
  section_target: SectionIdSchema.optional(),
  paa_questions: z.array(z.string()).optional(),
});
export type R3QueryItem = z.infer<typeof R3QueryItemSchema>;

// ── Heading section ──────────────────────────────────────

export const R3HeadingSectionSchema = z.object({
  section_id: SectionIdSchema,
  h2: z.string().min(5).max(90),
  h3s: z.array(z.string().min(3).max(90)).optional(),
  goal: z.string().min(10).max(220).optional(),
});
export type R3HeadingSection = z.infer<typeof R3HeadingSectionSchema>;

// ── Snippet block ────────────────────────────────────────

export const R3SnippetBlockSchema = z.object({
  type: z.enum(MEDIA_SLOT_TYPES),
  trigger_query: z.string().optional(),
  target_position: z.enum(['featured', 'paragraph', 'list']).optional(),
});
export type R3SnippetBlock = z.infer<typeof R3SnippetBlockSchema>;

// ── Internal link (typed target roles) ───────────────────

export const R3InternalLinkSchema = z.object({
  anchor_text: z.string().min(3).max(60),
  href: z.string().startsWith('/'),
  target_role: z.enum(['R4_GLOSSARY', 'R3_GUIDE', 'R1_CATEGORY']),
});
export type R3InternalLink = z.infer<typeof R3InternalLinkSchema>;

// ── Image spec (enriched) ────────────────────────────────

export const R3ImageSpecSchema = z.object({
  topic: z.string().min(3),
  format: z.enum(['webp', 'avif']),
  aspect_ratio: z.enum(['16:9', '4:3', '1:1']),
  min_width: z.number().int().min(320).max(2400),
  alt_template: z.string().min(5).max(140),
  loading: z.enum(['eager', 'lazy']),
  caption_template: z.string().max(140).optional(),
  fetchpriority: z.enum(['high', 'auto', 'low']).optional(),
});
export type R3ImageSpec = z.infer<typeof R3ImageSpecSchema>;

// ── Table spec ───────────────────────────────────────────

export const R3TableSpecSchema = z.object({
  columns: z.array(z.string().min(1).max(50)).min(2).max(6),
  row_count_target: z.string().regex(/^\d+-\d+$/),
});
export type R3TableSpec = z.infer<typeof R3TableSpecSchema>;

// ── List spec ────────────────────────────────────────────

export const R3ListSpecSchema = z.object({
  item_count_target: z.string().regex(/^\d+-\d+$/),
});
export type R3ListSpec = z.infer<typeof R3ListSpecSchema>;

// ── Media slot (discriminated union, 7 variants) ─────────

const baseSlot = {
  slot_id: z.string().min(3).max(50),
  placement: z.enum(MEDIA_PLACEMENTS),
  purpose: z.string().min(5).max(180),
};

export const R3MediaSlotSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseSlot,
    type: z.literal('image'),
    budget_cost: z.literal(1),
    image_spec: R3ImageSpecSchema,
  }),
  z.object({
    ...baseSlot,
    type: z.literal('table'),
    budget_cost: z.literal(0),
    table_spec: R3TableSpecSchema,
  }),
  z.object({
    ...baseSlot,
    type: z.literal('steps'),
    budget_cost: z.literal(0),
    list_spec: R3ListSpecSchema.optional(),
  }),
  z.object({
    ...baseSlot,
    type: z.literal('checklist'),
    budget_cost: z.literal(0),
    list_spec: R3ListSpecSchema.optional(),
  }),
  z.object({
    ...baseSlot,
    type: z.literal('faq'),
    budget_cost: z.literal(0),
    list_spec: R3ListSpecSchema.optional(),
  }),
  z.object({
    ...baseSlot,
    type: z.literal('cards'),
    budget_cost: z.literal(0),
  }),
  z.object({
    ...baseSlot,
    type: z.literal('callout'),
    budget_cost: z.literal(0),
  }),
]);
export type R3MediaSlot = z.infer<typeof R3MediaSlotSchema>;

// ── Section plan ─────────────────────────────────────────

export const R3SectionPlanSchema = z.object({
  include_terms: z.array(z.string().min(2).max(60)).min(1),
  micro_phrases: z.array(z.string().min(8).max(200)).optional(),
  faq_questions: z.array(z.string().min(5).max(120)).optional(),
  forbidden_overlap: z.array(z.string().min(3).max(120)).optional(),
  snippet_block: R3SnippetBlockSchema.optional(),
  internal_links: z.array(R3InternalLinkSchema).optional(),
  media_slots: z.array(R3MediaSlotSchema).optional(),
});
export type R3SectionPlan = z.infer<typeof R3SectionPlanSchema>;

// ── Per-section include_terms minimums ───────────────────

export const SECTION_TERM_MINIMUMS: Record<string, number> = {
  S1: 5,
  S2: 5,
  S2_DIAG: 5,
  S3: 6,
  S4_DEPOSE: 5,
  S4_REPOSE: 4,
  S5: 4,
  S6: 3,
  S_GARAGE: 3,
  S7: 2,
  S8: 3,
  META: 3,
};

// ── Section terms map with superRefine (minimums + G7) ──

export const R3SectionTermsMapSchema = z
  .record(SectionIdSchema, R3SectionPlanSchema)
  .superRefine((map, ctx) => {
    // Per-section include_terms minimum
    for (const [sectionId, plan] of Object.entries(map)) {
      const min = SECTION_TERM_MINIMUMS[sectionId] ?? 1;
      if ((plan.include_terms?.length ?? 0) < min) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_small,
          minimum: min,
          type: 'array',
          inclusive: true,
          message: `${sectionId}: include_terms requires at least ${min} items`,
          path: [sectionId, 'include_terms'],
        });
      }
    }

    // G7 media budget: count image budget_cost across all sections
    let imageBudgetUsed = 0;
    for (const plan of Object.values(map)) {
      for (const slot of plan.media_slots ?? []) {
        if (slot.type === 'image') {
          imageBudgetUsed += slot.budget_cost;
        }
      }
    }
    if (imageBudgetUsed > MEDIA_BUDGET.maxInArticleImages) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `G7 budget exceeded: ${imageBudgetUsed} images > max ${MEDIA_BUDGET.maxInArticleImages}`,
        path: ['_media_budget'],
      });
    }
  });
export type R3SectionTermsMap = z.infer<typeof R3SectionTermsMapSchema>;

// ── Gate report ──────────────────────────────────────────

export const R3GateResultSchema = z.object({
  gate: z.string(),
  status: z.enum(['pass', 'fail', 'warn']),
  message: z.string(),
  fixes_applied: z.array(z.string()).optional(),
});

export const R3GateReportSchema = z.record(z.string(), R3GateResultSchema);
export type R3GateReport = z.infer<typeof R3GateReportSchema>;

// ── SEO brief ────────────────────────────────────────────

export const R3SeoBriefSchema = z.object({
  meta_title: z.string().min(20).max(70).optional(),
  meta_description: z.string().min(100).max(170).optional(),
  canonical_policy: z.enum(['self']).optional(),
  recommended_anchors: z.array(z.string().startsWith('/')).optional(),
});
export type R3SeoBrief = z.infer<typeof R3SeoBriefSchema>;

// ── Media recommendation (P0 output) ────────────────────

export const R3MediaRecommendationSchema = z.object({
  section_id: SectionIdSchema,
  recommended_slots: z.array(R3MediaSlotSchema),
  rationale: z.string().optional(),
});
export type R3MediaRecommendation = z.infer<typeof R3MediaRecommendationSchema>;

// ── R3 Page Contract (top-level) ─────────────────────────

export const R3PageContractSchema = z.object({
  // Identity
  pg_id: z.number().int().positive(),
  pg_alias: z.string().min(3),
  gamme_name: z.string().min(3),

  // Pipeline position
  pipeline_phase: z.enum(['P0', 'P1', 'P2-P9', 'P10', 'P11', 'complete']),
  built_by: z.string(),

  // Intent + boundaries
  primary_intent: z.enum([
    'informational',
    'how-to',
    'diagnostic',
    'comparison',
  ]),
  secondary_intents: z.array(z.string()).optional(),
  boundaries: z
    .object({
      forbidden_terms: z.array(z.string()),
      scope_limit: z.string().optional(),
    })
    .optional(),

  // Heading plan (P1 output)
  heading_plan: z.array(R3HeadingSectionSchema).optional(),

  // Query clusters (P1 output)
  query_clusters: z
    .object({
      head: z.array(R3QueryItemSchema),
      mid_tail: z.array(R3QueryItemSchema).optional(),
      long_tail: z.array(R3QueryItemSchema).optional(),
      paa: z.array(R3QueryItemSchema).optional(),
    })
    .optional(),

  // Section terms (P2-P9 output)
  section_terms: R3SectionTermsMapSchema.optional(),

  // SEO brief (P10 output)
  seo_brief: R3SeoBriefSchema.optional(),

  // Gate report (P11 output)
  gate_report: R3GateReportSchema.optional(),
  quality_score: z.number().int().min(0).max(100).optional(),

  // Audit result (P0 output)
  audit_result: z
    .object({
      priority_score: z.number(),
      sections_to_create: z.array(z.string()),
      sections_to_improve: z.array(z.string()),
      sections_blocked: z.array(z.string()).optional(),
      rag_stale: z.boolean().optional(),
    })
    .optional(),

  // Media recommendations (P0 output)
  media_recommendations: z.array(R3MediaRecommendationSchema).optional(),
});
export type R3PageContract = z.infer<typeof R3PageContractSchema>;

// ── Partial schema (intermediate pipeline phases) ────────

export const R3PageContractPartialSchema = R3PageContractSchema.partial();
export type R3PageContractPartial = z.infer<typeof R3PageContractPartialSchema>;
