/**
 * R6PageContract Zod Schema V2 — contrat formel pour les pages R6 Guide d'Achat.
 * 10 sections, 13 block types, intent classification, media budget GR7.
 * Utilise par r6-keyword-planner et r6-content-batch comme reference de structure.
 *
 * INTERDIT R6 : tout contenu procedural detaille (HowTo) + diagnostic complet.
 * Pattern : miroir de page-contract-r3.schema.ts
 */

import { z } from 'zod';
import {
  R6_SECTION_IDS,
  R6_MEDIA_PLACEMENTS,
  R6_MEDIA_SOURCES,
  R6_KP_PIPELINE_PHASES,
  R6_MEDIA_BUDGET,
  R6_SECTION_TERM_MINIMUMS,
  R6_QUALITY_TIER_IDS,
  type R6SectionId,
} from './r6-keyword-plan.constants';

// ── Section ID (reuses existing enum) ───────────────────

export const R6SectionIdSchema = z.enum(R6_SECTION_IDS);

// ── Alt text template ───────────────────────────────────

export const R6AltTextSchema = z.object({
  template: z.string().min(5).max(140),
  variables: z.record(z.string()).optional(),
});
export type R6AltText = z.infer<typeof R6AltTextSchema>;

// ── Media slot (discriminated union, 7 variants) ────────

const r6BaseSlot = {
  slot_id: z.string().min(3).max(50),
  placement: z.enum(R6_MEDIA_PLACEMENTS),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  source: z.enum(R6_MEDIA_SOURCES).default('none'),
  alt: R6AltTextSchema,
  caption: z.string().max(140).optional(),
  loading: z.enum(['eager', 'lazy']).default('lazy'),
  fetch_priority: z.enum(['high', 'auto', 'low']).optional(),
  notes: z.string().max(200).optional(),
};

export const R6MediaSlotSchema = z.discriminatedUnion('type', [
  // image — cost 1
  z.object({
    ...r6BaseSlot,
    type: z.literal('image'),
    budget_cost: z.literal(1),
    src: z.string().optional(),
    src_key: z.string().optional(),
    aspect_ratio: z.enum(['16:9', '4:3', '1:1']).optional(),
    min_width: z.number().int().min(320).max(1920).optional(),
    format: z.enum(['webp', 'avif']).default('webp'),
  }),
  // diagram — cost 0
  z.object({
    ...r6BaseSlot,
    type: z.literal('diagram'),
    budget_cost: z.literal(0),
    src: z.string().optional(),
    src_key: z.string().optional(),
  }),
  // table — cost 0
  z.object({
    ...r6BaseSlot,
    type: z.literal('table'),
    budget_cost: z.literal(0),
    columns: z.array(z.string().min(1).max(50)).min(2).max(6),
    row_count_target: z
      .string()
      .regex(/^\d+-\d+$/)
      .optional(),
  }),
  // checklist — cost 0
  z.object({
    ...r6BaseSlot,
    type: z.literal('checklist'),
    budget_cost: z.literal(0),
    item_count_target: z
      .string()
      .regex(/^\d+-\d+$/)
      .optional(),
  }),
  // callout — cost 0
  z.object({
    ...r6BaseSlot,
    type: z.literal('callout'),
    budget_cost: z.literal(0),
    callout_style: z.enum(['info', 'warning', 'tip', 'budget']).optional(),
    content_hint: z.string().max(200).optional(),
  }),
  // cards — cost 0
  z.object({
    ...r6BaseSlot,
    type: z.literal('cards'),
    budget_cost: z.literal(0),
    card_count_target: z
      .string()
      .regex(/^\d+-\d+$/)
      .optional(),
  }),
  // quote — cost 0
  z.object({
    ...r6BaseSlot,
    type: z.literal('quote'),
    budget_cost: z.literal(0),
    attribution: z.string().max(100).optional(),
  }),
]);
export type R6MediaSlot = z.infer<typeof R6MediaSlotSchema>;

// ── Quality tier ID (for QualityTiersTable block) ───────

export const R6QualityTierIdSchema = z.enum(R6_QUALITY_TIER_IDS);

// ══════════════════════════════════════════════════════════
// Content blocks V2 (discriminated union, 13 variants)
// ══════════════════════════════════════════════════════════

// ── RichText (generic) ──────────────────────────────────

export const R6RichTextBlockSchema = z.object({
  block_type: z.literal('RichText'),
  content: z.string().min(10),
  word_count: z.number().int().min(20).optional(),
  media_slots: z.array(R6MediaSlotSchema).optional(),
});

// ── HeroDecision (NEW V2 — hero_decision section) ───────

export const R6HeroDecisionBlockSchema = z.object({
  block_type: z.literal('HeroDecision'),
  h1: z.string().min(20).max(90),
  promise: z.string().min(20).max(200),
  bullets: z.array(z.string().min(5).max(100)).min(2).max(5),
  cta_label: z.string().min(3).max(40).optional(),
  cta_href: z.string().startsWith('/').optional(),
  media_slots: z.array(R6MediaSlotSchema).optional(),
});

// ── DecisionQuick (kept from V1) ────────────────────────

export const R6DecisionQuickBlockSchema = z.object({
  block_type: z.literal('DecisionQuick'),
  question: z.string().min(10).max(120),
  options: z
    .array(
      z.object({
        label: z.string().min(3).max(80),
        outcome: z.string().min(5).max(200),
        recommendation_anchor: z.string().optional(),
      }),
    )
    .min(2)
    .max(6),
});

// ── QualityTiersTable (NEW V2 — replaces CompareTable) ──

export const R6QualityTiersTableBlockSchema = z.object({
  block_type: z.literal('QualityTiersTable'),
  tiers: z
    .array(
      z.object({
        tier_id: R6QualityTierIdSchema,
        label: z.string().min(2).max(50),
        description: z.string().min(10).max(200),
        target_profile: z.string().max(120).optional(),
        price_hint: z.string().max(80).optional(),
        available: z.boolean().default(true),
      }),
    )
    .min(2)
    .max(5),
  notes: z.array(z.string().max(200)).optional(),
  facts_used: z.array(z.string()).optional(),
});

// ── CompatibilityChecklist (V2 rename from CompatibilityBox) ──

export const R6CompatibilityChecklistBlockSchema = z.object({
  block_type: z.literal('CompatibilityChecklist'),
  axes: z
    .array(
      z.object({
        axis: z.string().min(3).max(60),
        where_to_find: z.string().max(120),
        risk_if_wrong: z.string().max(120),
      }),
    )
    .min(2)
    .max(6),
  disclaimers: z.array(z.string().min(6).max(200)).min(1),
});

// ── PriceGuide (NEW V2 — price_guide section) ──────────

export const R6PriceGuideBlockSchema = z.object({
  block_type: z.literal('PriceGuide'),
  mode: z.enum(['ranges', 'factors']),
  tiers: z
    .array(
      z.object({
        label: z.string().min(2).max(50),
        range_hint: z.string().max(80),
        target_profile: z.string().max(120),
        safe_wording: z.string().min(10).max(200),
      }),
    )
    .min(2)
    .max(4)
    .optional(),
  variation_factors: z
    .array(z.string().min(5).max(120))
    .min(2)
    .max(6)
    .optional(),
  disclaimer: z.string().max(300),
});

// ── BrandsGuide (NEW V2 — brands_guide section) ────────
// Anti-defamation: JAMAIS nommer de marques a eviter

export const R6BrandsGuideBlockSchema = z.object({
  block_type: z.literal('BrandsGuide'),
  recognized_brands: z
    .array(
      z.object({
        name: z.string().min(2).max(50),
        speciality: z.string().max(100).optional(),
      }),
    )
    .max(10)
    .optional(),
  quality_signals: z
    .array(
      z.object({
        signal: z.string().min(5).max(120),
        why_it_matters: z.string().max(200),
      }),
    )
    .min(2)
    .max(6),
  alert_signs: z.array(z.string().min(5).max(120)).min(2).max(5),
});

// ── BudgetTiers (kept from V1 — legacy fallback) ────────

export const R6BudgetTiersBlockSchema = z.object({
  block_type: z.literal('BudgetTiers'),
  tiers: z
    .array(
      z.object({
        label: z.string().min(2).max(50),
        range_hint: z.string().max(80),
        target_profile: z.string().max(120),
        safe_wording: z.string().min(10).max(200),
      }),
    )
    .min(2)
    .max(4),
  disclaimer: z.string().max(300),
});

// ── Checklist (kept — pitfalls section) ─────────────────

export const R6ChecklistBlockSchema = z.object({
  block_type: z.literal('Checklist'),
  title: z.string().min(3).max(80).default('Avant de commander'),
  items: z
    .array(
      z.object({
        item: z.string().min(5).max(200),
        priority: z.enum(['critical', 'important', 'nice_to_have']),
        source_field: z.string().optional(),
      }),
    )
    .min(4)
    .max(15),
});

// ── WhenPro (NEW V2 — when_pro section) ─────────────────
// PAS de procedure : juste quand et pourquoi faire appel a un pro

export const R6WhenProBlockSchema = z.object({
  block_type: z.literal('WhenPro'),
  cases: z
    .array(
      z.object({
        situation: z.string().min(10).max(120),
        why_pro: z.string().min(10).max(200),
        keywords: z.array(z.string().max(40)).max(3).optional(),
      }),
    )
    .min(2)
    .max(6),
});

// ── FAQ (kept from V1) ──────────────────────────────────

export const R6FaqBlockSchema = z.object({
  block_type: z.literal('FAQ'),
  items: z
    .array(
      z.object({
        question: z.string().min(10).max(150),
        answer: z.string().min(30).max(500),
        source: z.enum(['paa', 'rag', 'brief']).optional(),
      }),
    )
    .min(6)
    .max(12),
});

// ── FurtherReading (kept — cta_final section) ───────────

export const R6FurtherReadingBlockSchema = z.object({
  block_type: z.literal('FurtherReading'),
  links: z
    .array(
      z.object({
        label: z.string().min(5).max(80),
        href: z.string().startsWith('/'),
        target_role: z.enum([
          'R1_ROUTER',
          'R3_GUIDE',
          'R3_CONSEILS',
          'R4_REFERENCE',
          'R5_DIAGNOSTIC',
        ]),
      }),
    )
    .min(1)
    .max(4),
});

// ── InternalLinks (kept — cta_final section) ────────────

export const R6InternalLinksBlockSchema = z.object({
  block_type: z.literal('InternalLinks'),
  links: z
    .array(
      z.object({
        anchor_text: z.string().min(3).max(60),
        href: z.string().startsWith('/'),
        target_role: z.enum([
          'R1_ROUTER',
          'R3_GUIDE',
          'R3_CONSEILS',
          'R4_REFERENCE',
        ]),
        section_id: R6SectionIdSchema.optional(),
      }),
    )
    .min(1)
    .max(6),
});

// ── Union of all R6 block schemas V2 (13 variants) ──────

export const R6BlockSchema = z.discriminatedUnion('block_type', [
  R6RichTextBlockSchema,
  R6HeroDecisionBlockSchema,
  R6DecisionQuickBlockSchema,
  R6QualityTiersTableBlockSchema,
  R6CompatibilityChecklistBlockSchema,
  R6PriceGuideBlockSchema,
  R6BrandsGuideBlockSchema,
  R6BudgetTiersBlockSchema,
  R6ChecklistBlockSchema,
  R6WhenProBlockSchema,
  R6FaqBlockSchema,
  R6FurtherReadingBlockSchema,
  R6InternalLinksBlockSchema,
]);
export type R6Block = z.infer<typeof R6BlockSchema>;

// ── Section plan ────────────────────────────────────────

export const R6SectionPlanSchema = z.object({
  section_id: R6SectionIdSchema,
  include_terms: z.array(z.string().min(2).max(60)).min(1),
  forbidden_overlap: z.array(z.string()).optional(),
  blocks: z.array(R6BlockSchema).min(1),
  media_slots: z.array(R6MediaSlotSchema).optional(),
  serp_format_target: z
    .enum(['paragraph', 'table', 'list', 'faq', 'mixed'])
    .optional(),
  anti_cannibalization: z
    .object({
      r1_forbidden_matched: z.array(z.string()),
      r3_forbidden_matched: z.array(z.string()),
      r5_forbidden_matched: z.array(z.string()),
      jaccard_overlap: z.number().min(0).max(1),
    })
    .optional(),
});
export type R6SectionPlan = z.infer<typeof R6SectionPlanSchema>;

// ── Section terms map with superRefine (minimums + GR7 + required sections V2) ─

export const R6SectionsMapSchema = z
  .record(R6SectionIdSchema, R6SectionPlanSchema)
  .superRefine((map, ctx) => {
    // Per-section include_terms minimum
    for (const [sectionId, plan] of Object.entries(map)) {
      const min = R6_SECTION_TERM_MINIMUMS[sectionId as R6SectionId] ?? 1;
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

    // GR7 media budget: count image budget_cost across all sections
    let imageBudgetUsed = 0;
    for (const plan of Object.values(map)) {
      for (const slot of plan.media_slots ?? []) {
        if (slot.type === 'image') {
          imageBudgetUsed += slot.budget_cost;
        }
      }
    }
    if (imageBudgetUsed > R6_MEDIA_BUDGET.maxInArticleImages) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `GR7 budget exceeded: ${imageBudgetUsed} images > max ${R6_MEDIA_BUDGET.maxInArticleImages}`,
        path: ['_media_budget'],
      });
    }

    // V2: 9 required sections (all except cta_final)
    const requiredSections: R6SectionId[] = [
      'hero_decision',
      'summary_pick_fast',
      'quality_tiers',
      'compatibility',
      'price_guide',
      'brands_guide',
      'pitfalls',
      'when_pro',
      'faq_r6',
    ];
    for (const req of requiredSections) {
      if (!map[req]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Required section '${req}' is missing`,
          path: [req],
        });
      }
    }
  });
export type R6SectionsMap = z.infer<typeof R6SectionsMapSchema>;

// ── Gate report ─────────────────────────────────────────

export const R6GateResultSchema = z.object({
  gate: z.string(),
  status: z.enum(['pass', 'fail', 'warn']),
  message: z.string(),
  fixes_applied: z.array(z.string()).optional(),
});

export const R6GateReportSchema = z.record(z.string(), R6GateResultSchema);
export type R6GateReport = z.infer<typeof R6GateReportSchema>;

// ── Intent classification result ────────────────────────

export const R6IntentResultSchema = z.object({
  intent_type: z.enum(['R6', 'R3', 'R5', 'R1', 'ambiguous']),
  score_r6: z.number().min(0).max(100),
  score_r3: z.number().min(0).max(100).optional(),
  score_r5: z.number().min(0).max(100).optional(),
  howto_strict_hits: z.array(z.string()).optional(),
  howto_soft_hits: z.array(z.string()).optional(),
  buying_token_hits: z.array(z.string()).optional(),
  is_valid_r6: z.boolean(),
});
export type R6IntentResult = z.infer<typeof R6IntentResultSchema>;

// ── SEO brief ───────────────────────────────────────────

export const R6SeoBriefSchema = z.object({
  meta_title: z.string().min(20).max(70).optional(),
  meta_description: z.string().min(100).max(170).optional(),
  canonical_policy: z.enum(['self']).optional(),
  primary_keyword: z.string().min(3).optional(),
  secondary_keywords: z.array(z.string()).optional(),
});
export type R6SeoBrief = z.infer<typeof R6SeoBriefSchema>;

// ── Hero V2 (now backed by HeroDecision block) ─────────

export const R6HeroSchema = z.object({
  h1: z.string().min(20).max(90),
  subtitle: z.string().min(10).max(180).optional(),
  media_slots: z.array(R6MediaSlotSchema).optional(),
  takeaways: z.array(z.string().min(5).max(100)).min(2).max(5),
});
export type R6Hero = z.infer<typeof R6HeroSchema>;

// ── Governance ──────────────────────────────────────────

export const R6GovernanceSchema = z.object({
  cannibalization_priority: z.literal('lowest'),
  jaccard_r1: z.number().min(0).max(1),
  jaccard_r3: z.number().min(0).max(1),
  jaccard_r5: z.number().min(0).max(1),
  max_allowed_overlap: z.literal(0.12),
  gate_report: R6GateReportSchema.optional(),
});
export type R6Governance = z.infer<typeof R6GovernanceSchema>;

// ── Media slots proposal (P0 output) ────────────────────

export const R6MediaSlotsProposalSchema = z.object({
  hero: R6MediaSlotSchema.optional(),
  by_section: z.record(R6SectionIdSchema, z.array(R6MediaSlotSchema)),
  constraints: z
    .object({
      max_images_in_article: z.number().int().min(1).max(5).default(3),
      hero_always_eager: z.boolean().default(true),
      max_callouts_per_page: z.number().int().min(1).max(6).default(4),
    })
    .optional(),
});
export type R6MediaSlotsProposal = z.infer<typeof R6MediaSlotsProposalSchema>;

// ══════════════════════════════════════════════════════════
// R6 Page Contract V2 (top-level)
// ══════════════════════════════════════════════════════════

export const R6PageContractSchema = z.object({
  // ── Identity ────────────────────────────────────────────
  pg_id: z.number().int().positive(),
  pg_alias: z.string().min(3),
  gamme_name: z.string().min(3),

  // ── Intent & role V2 ───────────────────────────────────
  intentType: z.literal('R6').default('R6'),
  pageRole: z.literal('R6_BUYING_GUIDE').default('R6_BUYING_GUIDE'),
  canonicalRoleUrl: z.string().startsWith('/').optional(),
  roleVersion: z.enum(['v1', 'v2']).default('v2'),

  // ── Pipeline position ──────────────────────────────────
  pipeline_phase: z.enum(R6_KP_PIPELINE_PHASES),
  built_by: z.string(),
  built_at: z.string().datetime().optional(),

  // ── Meta ───────────────────────────────────────────────
  meta: z.object({
    role: z.literal('R6_GUIDE_ACHAT'),
    language: z.literal('fr-FR').default('fr-FR'),
  }),

  // ── SEO ────────────────────────────────────────────────
  seo: R6SeoBriefSchema.optional(),

  // ── Hero ───────────────────────────────────────────────
  hero: R6HeroSchema.optional(),

  // ── Sections (core of the contract) ────────────────────
  sections: R6SectionsMapSchema.optional(),

  // ── Intent classification result ───────────────────────
  intent_result: R6IntentResultSchema.optional(),

  // ── Governance + anti-cannibalization ──────────────────
  governance: R6GovernanceSchema.optional(),

  // ── Audit result (P0 output) ───────────────────────────
  audit_result: z
    .object({
      priority_score: z.number(),
      backlog: z.array(
        z.object({
          priority: z.enum(['P0', 'P1', 'P2']),
          area: z.string(),
          issue: z.string(),
          location: R6SectionIdSchema.optional(),
          recommended_fix: z.string(),
        }),
      ),
      hard_gates: z.array(z.string()),
      media_slots_proposal: R6MediaSlotsProposalSchema.optional(),
      overlaps: z
        .array(
          z.object({
            type: z.enum(['R1', 'R3', 'R5', 'R4', 'dedup']),
            section_id: R6SectionIdSchema.optional(),
            evidence_snippet: z.string(),
            fix: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),

  // ── Gate report (P4 output) ────────────────────────────
  gate_report: R6GateReportSchema.optional(),
  quality_score: z.number().int().min(0).max(100).optional(),
});
export type R6PageContract = z.infer<typeof R6PageContractSchema>;

// ── Partial schema (intermediate pipeline phases) ───────

export const R6PageContractPartialSchema = R6PageContractSchema.partial();
export type R6PageContractPartial = z.infer<typeof R6PageContractPartialSchema>;
