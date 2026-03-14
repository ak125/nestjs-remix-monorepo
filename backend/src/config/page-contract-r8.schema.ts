/**
 * R8 PageContract Zod Schema V1 — contrat formel pour les pages R8_VEHICLE (fiche vehicule).
 * 10 sections, 12 content block types, media slots, QA, guards.
 * Utilise par r8-keyword-planner et r8-content-batch comme reference de structure.
 *
 * Source de verite : r8-keyword-plan.constants.ts
 * Pattern : miroir de page-contract-r7.schema.ts
 */

import { z } from 'zod';
import {
  R8_PLANNABLE_SECTIONS,
  R8_MEDIA_KINDS,
  R8_MEDIA_PLACEMENTS,
  R8_MEDIA_PURPOSES,
  R8_V5_ALL_BLOCK_TYPES,
  R8_V5_PLANNABLE_SECTIONS,
  R8_REASON_CODES,
} from './r8-keyword-plan.constants';

// ── Section Key (reuses existing const) ─────────────────

export const R8SectionKeySchema = z.enum(R8_PLANNABLE_SECTIONS);
export type R8SectionKey = z.infer<typeof R8SectionKeySchema>;

// ── Intent Tags ─────────────────────────────────────────

export const R8IntentTagSchema = z.enum([
  'compat',
  'catalog',
  'trust',
  'anti_error',
  'navigation',
]);
export type R8IntentTag = z.infer<typeof R8IntentTagSchema>;

// ── Content Blocks (discriminated union, 12 types) ──────

const r8RichTextBlock = z.object({
  type: z.literal('rich_text'),
  text: z.string().min(1).optional(),
  html: z.string().min(1).optional(),
});

const r8BulletsBlock = z.object({
  type: z.literal('bullets'),
  items: z.array(z.string().min(1)).min(1),
});

const r8BadgeRowBlock = z.object({
  type: z.literal('badge_row'),
  badges: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        icon: z.string().optional(),
        tone: z
          .enum(['neutral', 'success', 'info', 'warning'])
          .default('neutral'),
      }),
    )
    .min(1),
});

const r8ChipsNavBlock = z.object({
  type: z.literal('chips_nav'),
  chips: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        target: z.string().min(1).max(80),
      }),
    )
    .min(1),
});

const r8SearchBoxBlock = z.object({
  type: z.literal('search_box_spec'),
  placeholder: z.string().min(3).max(80).optional(),
  help: z.string().max(160).optional(),
});

const r8TableBlock = z.object({
  type: z.literal('table'),
  table: z.object({
    rows: z
      .array(
        z.object({
          k: z.string().min(1).max(60),
          v: z.string().min(1).max(160),
        }),
      )
      .min(2)
      .max(12),
    variant: z.enum(['safe_2col']).default('safe_2col'),
  }),
});

const r8FaqBlock = z.object({
  type: z.literal('faq'),
  faq: z
    .array(
      z.object({
        q: z.string().min(5).max(140),
        a: z.string().min(20).max(520),
      }),
    )
    .min(1)
    .max(8),
});

const r8CtaBlock = z.object({
  type: z.literal('cta'),
  cta: z.object({
    primary_label: z.string().min(1).optional(),
    primary_href: z.string().min(1).optional(),
    secondary_label: z.string().optional(),
    secondary_href: z.string().optional(),
  }),
});

const r8CardsGridBlock = z.object({
  type: z.literal('cards_grid'),
  items: z.array(z.string().min(1)).min(1),
});

const r8FormSpecBlock = z.object({
  type: z.literal('form_spec'),
  form: z.object({
    fields: z
      .array(
        z.object({
          name: z.string().min(1).max(40),
          label: z.string().min(2).max(60),
          help: z.string().max(160).optional(),
          placeholder: z.string().max(80).optional(),
        }),
      )
      .min(1)
      .max(6),
  }),
});

const r8DividerBlock = z.object({
  type: z.literal('divider'),
});

const r8NoticeBlock = z.object({
  type: z.literal('notice'),
  notice: z.object({
    tone: z.enum(['info', 'warning', 'success']).default('info'),
    message: z.string().min(10).max(220),
  }),
});

export const R8ContentBlockSchema = z.discriminatedUnion('type', [
  r8RichTextBlock,
  r8BulletsBlock,
  r8BadgeRowBlock,
  r8ChipsNavBlock,
  r8SearchBoxBlock,
  r8TableBlock,
  r8FaqBlock,
  r8CtaBlock,
  r8CardsGridBlock,
  r8FormSpecBlock,
  r8DividerBlock,
  r8NoticeBlock,
]);
export type R8ContentBlock = z.infer<typeof R8ContentBlockSchema>;

// ── Media Slot ──────────────────────────────────────────

export const R8MediaSlotSchema = z.object({
  slot_id: z.string().regex(/^[A-Z0-9_]{6,80}$/),
  section_key: R8SectionKeySchema,
  kind: z.enum(R8_MEDIA_KINDS),
  placement: z.enum(R8_MEDIA_PLACEMENTS),
  purpose: z.enum(R8_MEDIA_PURPOSES),

  asset: z
    .object({
      src: z.string().optional(),
      alt: z.string().max(140).optional(),
      width: z.number().int().min(16).max(2400).optional(),
      height: z.number().int().min(16).max(2400).optional(),
      loading: z.enum(['eager', 'lazy']).default('lazy'),
      fetchPriority: z.enum(['high', 'auto', 'low']).default('auto'),
    })
    .optional(),

  fallback: z
    .object({
      kind: z.enum(['icon', 'svg', 'none']).default('icon'),
      icon_name: z.string().optional(),
    })
    .optional(),

  rules: z
    .object({
      must_exist: z.boolean().default(false),
      max_kb: z.number().int().min(10).max(800).default(180),
      avoid_wallpaper: z.boolean().default(true),
      allow_logos_only: z.boolean().default(false),
    })
    .default({
      must_exist: false,
      max_kb: 180,
      avoid_wallpaper: true,
      allow_logos_only: false,
    }),
});
export type R8MediaSlot = z.infer<typeof R8MediaSlotSchema>;

// ── Section ─────────────────────────────────────────────

export const R8SectionSchema = z.object({
  section_key: R8SectionKeySchema,
  heading: z.object({
    h2: z.string().min(3).max(90),
    h3: z.array(z.string()).default([]),
  }),
  allowed_intents: z.array(R8IntentTagSchema).min(1),
  blocks: z.array(R8ContentBlockSchema).min(1),

  terms: z
    .object({
      include_terms: z.array(z.string()).default([]),
      avoid_terms: z.array(z.string()).default([]),
    })
    .default({ include_terms: [], avoid_terms: [] }),

  media_slot_refs: z.array(z.string().min(3).max(80)).default([]),
});
export type R8Section = z.infer<typeof R8SectionSchema>;

// ── Vehicle ─────────────────────────────────────────────

export const R8VehicleSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  type: z.string().min(1),
  power_ps: z.union([z.number().int(), z.string().min(1)]),
  fuel: z.string().min(1),
  body: z.string().min(1),
  year_from: z.union([z.number().int(), z.string().min(1)]),
  year_to: z.union([z.number().int(), z.string().min(1), z.null()]).optional(),

  engine_codes: z.array(z.string()).default([]),
  cnit_codes: z.array(z.string()).default([]),
  mine_codes: z.array(z.string()).default([]),

  brand_alias: z.string().optional(),
  model_alias: z.string().optional(),
  type_alias: z.string().optional(),
  brand_id: z.union([z.number().int(), z.string()]).optional(),
  model_id: z.union([z.number().int(), z.string()]).optional(),
  type_id: z.union([z.number().int(), z.string()]).optional(),

  model_image_path: z.union([z.string(), z.null()]).optional(),
});
export type R8Vehicle = z.infer<typeof R8VehicleSchema>;

// ── SEO ─────────────────────────────────────────────────

export const R8InternalLinkSchema = z.object({
  label: z.string().min(2).max(80),
  href: z.string().min(1),
  target_type: z.enum(['R2_CATEGORY', 'R3_GUIDE', 'R5_DIAGNOSTIC', 'OTHER']),
  notes: z.string().optional(),
});

export const R8SeoSchema = z.object({
  title: z.string().min(10).max(75),
  description: z.string().min(80).max(170),
  keywords: z.string().optional(),
  h1: z.string().min(8).max(120),
  canonical: z.string().min(10),
  robots: z.enum(['index, follow', 'noindex, nofollow']),
  internal_links: z.array(R8InternalLinkSchema).max(12).default([]),
  schema_org: z.record(z.any()),
});
export type R8Seo = z.infer<typeof R8SeoSchema>;

// ── QA ──────────────────────────────────────────────────

export const R8QaSchema = z.object({
  purity_score: z.number().int().min(0).max(100).default(90),
  cannibalization_flags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});
export type R8Qa = z.infer<typeof R8QaSchema>;

// ── Quality Checks ──────────────────────────────────────

export const R8QualityChecksSchema = z.object({
  has_compat_check: z.boolean(),
  has_seo_intro: z.boolean(),
  has_safe_table: z.boolean(),
  has_catalog: z.boolean(),
  has_faq: z.boolean(),
  has_anti_errors: z.boolean(),
  has_trust: z.boolean(),
  media_ok: z.boolean(),
  no_forbidden_terms: z.boolean(),
});

export const R8QualitySchema = z.object({
  status: z.enum(['PASS', 'FAIL']),
  score: z.number().int().min(0).max(100),
  checks: R8QualityChecksSchema,
});

// ── Guards ──────────────────────────────────────────────

export const R8GuardsSchema = z.object({
  must_not_include: z.array(z.string()).min(6),
  do_not_target_keywords: z.array(z.string()).min(6),
  role_purity: z.object({
    required_role: z.literal('R8_VEHICLE'),
    allowed_roles_only: z.array(z.string()).default(['R8_VEHICLE']),
  }),
});

// ══════════════════════════════════════════════════════════
// Top-Level PageContract R8_VEHICLE V1
// ══════════════════════════════════════════════════════════

export const R8PageContractSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  page_role: z.literal('R8_VEHICLE'),
  page_id: z.string().min(8).max(128),
  locale: z.string().default('fr-FR'),

  vehicle: R8VehicleSchema,
  seo: R8SeoSchema,

  section_keys: z
    .array(R8SectionKeySchema)
    .default([
      'S_IDENTITY',
      'S_COMPAT_CHECK',
      'S_FAST_ACCESS',
      'S_SEO_INTRO',
      'S_SAFE_TABLE',
      'S_CATALOG',
      'S_BESTSELLERS',
      'S_ANTI_ERRORS',
      'S_FAQ',
      'S_TRUST',
    ]),

  sections: z.array(R8SectionSchema).min(6),
  media_slots: z.array(R8MediaSlotSchema).default([]),

  guards: R8GuardsSchema,
  quality: R8QualitySchema,
  qa: R8QaSchema.default({ purity_score: 90, cannibalization_flags: [] }),
});

export type R8PageContract = z.infer<typeof R8PageContractSchema>;
export const R8PageContractPartialSchema = R8PageContractSchema.partial();
export type R8PageContractPartial = z.infer<typeof R8PageContractPartialSchema>;

// ── Section Bundle (per-section output from pipeline) ───

export const R8SectionBundleSchema = z.object({
  section_key: R8SectionKeySchema,
  heading: z.object({
    h2: z.string().optional(),
    h3: z.array(z.string()).optional(),
  }),
  allowed_intents: z.array(R8IntentTagSchema).min(1),
  blocks: z.array(R8ContentBlockSchema).min(1),

  terms: z
    .object({
      include_terms: z.array(z.string()).default([]),
      avoid_terms: z.array(z.string()).default([]),
    })
    .default({ include_terms: [], avoid_terms: [] }),

  media_slot_refs: z.array(z.string().min(3).max(80)).default([]),
  new_media_slots: z.array(R8MediaSlotSchema).max(2).optional(),

  quality: z.object({
    section_score: z.number().int().min(0).max(100),
    why_it_scores: z.object({
      intent_fit: z.number().int().min(0).max(40),
      catalog_coverage: z.number().int().min(0).max(25),
      uniqueness: z.number().int().min(0).max(20),
      ux_clarity: z.number().int().min(0).max(15),
    }),
    risks: z.array(z.string()),
    fixes: z.array(z.string()),
  }),
});
export type R8SectionBundle = z.infer<typeof R8SectionBundleSchema>;

// ── Gate Report (P7 QA output) ──────────────────────────

export const R8GateReportSchema = z.object({
  status: z.enum(['PASS', 'FAIL']),
  score: z.number().int().min(0).max(100),
  errors: z.array(z.string()),
  fixes: z.array(z.string()),
  gate_details: z.record(z.enum(['PASS', 'FAIL'])),
});
export type R8GateReport = z.infer<typeof R8GateReportSchema>;

// ══════════════════════════════════════════════════════════
// R8 V5 — Content Diversity System Schemas
// 4-layer: Composer → Fingerprint → Validator → Governance
// ══════════════════════════════════════════════════════════

// ── V5 Enums ────────────────────────────────────────────

export const R8SeoDecisionSchema = z.enum([
  'INDEX',
  'REVIEW_REQUIRED',
  'REGENERATE',
  'REJECT',
]);
export type R8SeoDecisionType = z.infer<typeof R8SeoDecisionSchema>;

export const R8V5BlockTypeSchema = z.enum(
  R8_V5_ALL_BLOCK_TYPES as unknown as [string, ...string[]],
);
export type R8V5BlockTypeEnum = z.infer<typeof R8V5BlockTypeSchema>;

export const R8V5SectionKeySchema = z.enum(
  R8_V5_PLANNABLE_SECTIONS as unknown as [string, ...string[]],
);
export type R8V5SectionKeyType = z.infer<typeof R8V5SectionKeySchema>;

export const R8ReasonCodeSchema = z.enum(
  R8_REASON_CODES as unknown as [string, ...string[]],
);
export type R8ReasonCodeType = z.infer<typeof R8ReasonCodeSchema>;

// ── Block Instance (single content block with diversity metadata) ──

export const R8BlockInstanceSchema = z.object({
  id: z.string().min(3),
  type: R8V5BlockTypeSchema,
  title: z.string().min(2),
  visible: z.boolean(),
  specificityWeight: z.number().min(0).max(1),
  boilerplateRisk: z.number().min(0).max(1),
  semanticPayload: z.array(z.string()).default([]),
  renderedText: z.string().min(1),
  dataSignals: z.record(z.string(), z.unknown()).optional(),
});
export type R8BlockInstance = z.infer<typeof R8BlockInstanceSchema>;

// ── Content Fingerprint (6 hashes for dedup) ────────────

export const R8ContentFingerprintSchema = z.object({
  hash: z.string().min(8),
  normalizedTextHash: z.string().min(8),
  blockSequenceHash: z.string().min(8),
  semanticKeyHash: z.string().min(8),
  categoryOrderHash: z.string().min(8),
  faqHash: z.string().min(8),
  topTokens: z.array(z.string()).default([]),
  blockTypeSequence: z.array(R8V5BlockTypeSchema),
});
export type R8ContentFingerprint = z.infer<typeof R8ContentFingerprintSchema>;

// ── Diversity Metrics (8 scores) ────────────────────────

export const R8DiversityMetricsSchema = z.object({
  specificContentRatio: z.number().min(0).max(1),
  boilerplateRatio: z.number().min(0).max(1),
  diversityScore: z.number().min(0).max(100),
  semanticSimilarityScore: z.number().min(0).max(100),
  categoryOrderDiversityScore: z.number().min(0).max(100),
  faqReuseRiskScore: z.number().min(0).max(100),
  catalogDeltaScore: z.number().min(0).max(100),
  commercialIntentScore: z.number().min(0).max(100),
});
export type R8DiversityMetrics = z.infer<typeof R8DiversityMetricsSchema>;

// ── Variant Analysis (sibling comparison) ───────────────

export const R8VariantAnalysisSchema = z.object({
  siblings_analyzed: z.array(
    z.object({
      type_id: z.string(),
      type_name: z.string(),
      power: z.string(),
      fuel: z.string(),
      shared_families_pct: z.number().min(0).max(1),
      unique_families: z.array(z.string()),
      engine_code_differs: z.boolean(),
    }),
  ),
  differentiators: z.array(
    z.object({
      axis: z.enum([
        'engine',
        'power',
        'period',
        'body',
        'fuel',
        'families',
        'maintenance',
      ]),
      description: z.string(),
      impact: z.enum(['high', 'medium', 'low']),
    }),
  ),
  recommended_emphasis: z.array(z.string()),
});
export type R8VariantAnalysis = z.infer<typeof R8VariantAnalysisSchema>;

// ── FAQ Entry (with specificity weight) ─────────────────

export const R8FaqEntrySchema = z.object({
  q: z.string().min(5),
  a: z.string().min(15),
  specificityWeight: z.number().min(0).max(1),
});
export type R8FaqEntry = z.infer<typeof R8FaqEntrySchema>;

// ── Category Ranking Entry ──────────────────────────────

export const R8CategoryRankingEntrySchema = z.object({
  categoryId: z.string().min(1),
  label: z.string().min(1),
  rank: z.number().int().positive(),
  reasonSignals: z.array(z.string()).default([]),
});
export type R8CategoryRankingEntry = z.infer<
  typeof R8CategoryRankingEntrySchema
>;

// ── Catalog Delta (vs nearest neighbors) ────────────────

export const R8CatalogDeltaSchema = z.object({
  addedFamilies: z.array(z.string()).default([]),
  removedFamilies: z.array(z.string()).default([]),
  reorderedFamilies: z.array(z.string()).default([]),
  emphasizedFamilies: z.array(z.string()).default([]),
  deltaScore: z.number().min(0).max(100),
});
export type R8CatalogDelta = z.infer<typeof R8CatalogDeltaSchema>;

// ── Governance Decision (central contract) ──────────────

export const R8GovernanceDecisionSchema = z.object({
  decision: R8SeoDecisionSchema,
  sitemapIncluded: z.boolean(),
  robotsDirective: z.enum(['index, follow', 'noindex, nofollow']),
  contentFingerprint: z.string().min(8),
  faqSignature: z.string().min(8),
  categorySignature: z.string().min(8),
  nearestNeighborIds: z.array(z.string()).default([]),
  scores: R8DiversityMetricsSchema,
  reasons: z.array(R8ReasonCodeSchema).default([]),
  warnings: z.array(z.string()).default([]),
});
export type R8GovernanceDecision = z.infer<typeof R8GovernanceDecisionSchema>;

// ── V5 Page Plan (top-level with superRefine) ───────────

export const R8V5PagePlanSchema = z
  .object({
    pageId: z.string().min(8),
    pageRole: z.literal('R8'),
    vehicle: R8VehicleSchema,

    canonical: z.object({
      url: z.string().min(10),
      strategy: z.literal('SELF_CANONICAL'),
    }),

    composition: z.object({
      availableBlocks: z.array(R8BlockInstanceSchema).min(6),
      selectedBlockIds: z.array(z.string()).min(4),
      minRequiredSpecificBlocks: z.number().int().min(4),
      minSpecificContentRatio: z.number().min(0.5).max(1),
      dynamicBlockTypesRequired: z.array(R8V5BlockTypeSchema).min(4),
    }),

    dynamicContent: z.object({
      faq: z.array(R8FaqEntrySchema).min(3).max(8),
      categoryRanking: z.array(R8CategoryRankingEntrySchema).min(3),
      catalogDelta: R8CatalogDeltaSchema,
      variantSummary: z.string().min(20),
    }),

    metrics: R8DiversityMetricsSchema,
    fingerprint: R8ContentFingerprintSchema,
    governance: R8GovernanceDecisionSchema,
  })
  .superRefine((plan, ctx) => {
    // Gate 1: specific content ratio
    if (
      plan.metrics.specificContentRatio <
      plan.composition.minSpecificContentRatio
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'specificContentRatio below threshold',
        path: ['metrics', 'specificContentRatio'],
      });
    }

    // Gate 2: enough high-specificity blocks
    const selected = plan.composition.availableBlocks.filter((b) =>
      plan.composition.selectedBlockIds.includes(b.id),
    );
    const highSpecBlocks = selected.filter((b) => b.specificityWeight >= 0.65);
    if (highSpecBlocks.length < plan.composition.minRequiredSpecificBlocks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `not enough high-specificity blocks: ${highSpecBlocks.length} < ${plan.composition.minRequiredSpecificBlocks}`,
        path: ['composition', 'selectedBlockIds'],
      });
    }

    // Gate 3: all required block types present
    const selectedTypes = new Set(selected.map((b) => b.type));
    for (const req of plan.composition.dynamicBlockTypesRequired) {
      if (!selectedTypes.has(req)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `missing required block type: ${req}`,
          path: ['composition', 'dynamicBlockTypesRequired'],
        });
      }
    }
  });
export type R8V5PagePlan = z.infer<typeof R8V5PagePlanSchema>;

// ── Validation Result (P3 output) ───────────────────────

export const R8ValidationResultSchema = z.object({
  seoDecision: R8SeoDecisionSchema,
  scores: R8DiversityMetricsSchema,
  reasons: z.array(R8ReasonCodeSchema).default([]),
  warnings: z.array(z.string()).default([]),
  sitemapIncluded: z.boolean(),
  robotsDirective: z.enum(['index, follow', 'noindex, nofollow']),
});
export type R8ValidationResult = z.infer<typeof R8ValidationResultSchema>;
