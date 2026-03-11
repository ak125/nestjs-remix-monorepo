/**
 * R7 PageContract Zod Schema V4 — contrat formel pour les pages R7_BRAND (constructeur).
 * 13 sections, 9 media slots, 7 anchor types, 6 JSON-LD types, 7 quality gates.
 * Utilisé par r7-keyword-planner et r7-content-batch comme référence de structure.
 *
 * Source de vérité : r7-keyword-plan.constants.ts
 * Pattern : miroir de page-contract-r6.schema.ts
 */

import { z } from 'zod';
import {
  R7_PLANNABLE_SECTIONS,
  R7_JSON_LD_TYPES,
} from './r7-keyword-plan.constants';

// ── Section Key (reuses existing const) ─────────────────

export const R7SectionKeySchema = z.enum(R7_PLANNABLE_SECTIONS);

// ── Term ────────────────────────────────────────────────

export const R7TermSchema = z.object({
  term: z.string().min(2),
  priority: z.enum(['P0', 'P1', 'P2']),
  source: z.enum(['rag', 'db', 'template_fallback']).optional(),
});
export type R7Term = z.infer<typeof R7TermSchema>;

// ── Content Block (discriminated union, 6 variants) ─────

const r7ParagraphBlock = z.object({
  type: z.literal('paragraph'),
  text: z.string().min(1),
});

const r7BulletsBlock = z.object({
  type: z.literal('bullets'),
  items: z.array(z.string().min(1)).min(1),
});

const r7StepsBlock = z.object({
  type: z.literal('steps'),
  items: z.array(z.string().min(1)).min(1).max(5),
});

const r7TableBlock = z.object({
  type: z.literal('table'),
  rows: z
    .array(z.tuple([z.string(), z.string()]))
    .min(2)
    .max(10),
});

const r7CtaBlock = z.object({
  type: z.literal('cta'),
  cta: z.object({
    label: z.string().min(1),
    target_type: z.enum(['selector', 'gammes_hub', 'models_hub']),
  }),
});

const r7NoteBlock = z.object({
  type: z.literal('note'),
  text: z.string().min(1),
});

export const R7ContentBlockSchema = z.discriminatedUnion('type', [
  r7ParagraphBlock,
  r7BulletsBlock,
  r7StepsBlock,
  r7TableBlock,
  r7CtaBlock,
  r7NoteBlock,
]);
export type R7ContentBlock = z.infer<typeof R7ContentBlockSchema>;

// ── Media Slot ──────────────────────────────────────────

export const R7MediaKind = z.enum([
  'image',
  'svg',
  'icon',
  'table',
  'component',
  'none',
]);

export const R7MediaPurpose = z.enum([
  'trust_branding',
  'visual_premium_light',
  'scanability',
  'category_recognition',
  'product_discovery',
  'model_discovery',
  'explain_selection',
  'scannable_maintenance',
  'answer_objections',
  'brand_recall',
]);

export const R7MediaPlacement = z.enum([
  'hero_left',
  'hero_background',
  'inline',
  'aside_desktop_top_mobile',
  'aside',
  'card_top',
  'card_media',
  'cards_left',
  'list_left',
  'gamme_card_top',
  'full_width',
  'none',
]);

export const R7MediaSlotSchema = z.object({
  slot_id: z.string().min(3).max(50),
  section_key: R7SectionKeySchema,
  kind: R7MediaKind,
  must_have: z.boolean(),
  purpose: R7MediaPurpose,
  placement: R7MediaPlacement,
  source_policy: z.string().min(3),
  format: z.array(z.enum(['avif', 'webp', 'png', 'jpg', 'svg'])).optional(),
  dims: z
    .object({
      w: z.number().int().positive().optional(),
      h: z.number().int().positive().optional(),
      ratio: z.string().optional(),
    })
    .optional(),
  loading: z.enum(['eager', 'lazy', 'inline', 'auto']).optional(),
  fetch_priority: z.enum(['high', 'low', 'auto']).optional(),
  alt_template: z.string().optional(),
});
export type R7MediaSlot = z.infer<typeof R7MediaSlotSchema>;

// ── Anchor ──────────────────────────────────────────────

export const R7AnchorTargetType = z.enum([
  'models_hub',
  'gammes_hub',
  'selector_cta',
  'faq',
  'compat_guide',
  'related_brands',
  'top_recherches',
]);

export const R7AnchorSchema = z.object({
  anchor: z.string().min(3),
  target_type: R7AnchorTargetType,
  priority: z.enum(['P0', 'P1']),
});
export type R7Anchor = z.infer<typeof R7AnchorSchema>;

// ── Section ─────────────────────────────────────────────

export const R7SectionSchema = z.object({
  section_key: R7SectionKeySchema,
  enabled: z.boolean(),
  headings: z
    .object({
      h2: z.string().optional(),
      h3: z.array(z.string()).optional(),
    })
    .default({}),
  content_blocks: z.array(R7ContentBlockSchema),
  terms_to_include: z.array(R7TermSchema).max(20),
  media_slot_ids: z.array(z.string().min(3)),
});
export type R7Section = z.infer<typeof R7SectionSchema>;

// ── Structured Data (JSON-LD @graph) ────────────────────

export const R7JsonLdTypeSchema = z.enum(R7_JSON_LD_TYPES);

export const R7StructuredDataSchema = z.object({
  json_ld_types: z.array(R7JsonLdTypeSchema),
  enable_graph: z.boolean().default(true),
});

// ── Quality ─────────────────────────────────────────────

export const R7QualityChecksSchema = z.object({
  has_microseo: z.boolean(),
  has_shortcuts: z.boolean(),
  has_compat_guide: z.boolean(),
  has_safe_table: z.boolean(),
  has_faq: z.boolean(),
  anchors_ok: z.boolean(),
  media_ok: z.boolean(),
  no_forbidden_terms: z.boolean(),
  about_truncated: z.boolean(),
});

export const R7QualitySchema = z.object({
  status: z.enum(['PASS', 'FAIL']),
  score: z.number().int().min(0).max(100),
  checks: R7QualityChecksSchema,
});

// ── Guards ──────────────────────────────────────────────

export const R7GuardsSchema = z.object({
  must_not_include: z.array(z.string()).min(6),
  do_not_target_keywords: z.array(z.string()).min(6),
  role_purity: z.object({
    required_role: z.literal('R7_BRAND'),
    allowed_roles_only: z.array(z.string()).default(['R7_BRAND']),
  }),
});

// ══════════════════════════════════════════════════════════
// Top-Level PageContract R7_BRAND V4
// ══════════════════════════════════════════════════════════

export const R7PageContractSchema = z.object({
  version: z.string().regex(/^v\d+(\.\d+){0,2}$/),
  page_role: z.literal('R7_BRAND'),

  route: z.object({
    pattern: z.literal('/constructeurs/{alias}.html'),
    path: z.string().min(5),
    canonical_policy: z.object({
      strip_query: z.boolean(),
      strip_trailing_slash: z.boolean(),
      force_html_ext: z.boolean(),
    }),
  }),

  brand: z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    alias: z.string().min(1),
    logo_url: z.string().min(1).optional(),
    theme: z
      .object({
        gradient_css: z.string().optional(),
        accent_color: z.string().optional(),
      })
      .optional(),
  }),

  intent: z.object({
    primary_intent: z.string().min(10),
    secondary_intents: z.array(z.string().min(8)).min(2).max(6),
    query_clusters: z.object({
      head: z.array(z.string()).min(6).max(12),
      mid: z.array(z.string()).min(12).max(20),
      long_tail: z.array(z.string()).min(18).max(30),
    }),
  }),

  seo: z
    .object({
      title: z.string().min(10).max(70),
      description: z.string().min(60).max(170),
      robots: z.string().optional(),
      og_title: z.string().optional(),
      og_description: z.string().optional(),
    })
    .optional(),

  headings: z
    .object({
      h1: z.string().min(5).optional(),
      h2_by_section: z.record(z.string()).optional(),
      h3_by_section: z.record(z.array(z.string())).optional(),
    })
    .optional(),

  sections: z.array(R7SectionSchema).min(9),

  media_slots: z.array(R7MediaSlotSchema).min(3),

  internal_link_plan: z
    .object({
      anchors: z.array(R7AnchorSchema).min(10).max(10),
    })
    .optional(),

  structured_data: R7StructuredDataSchema.optional(),

  guards: R7GuardsSchema,

  quality: R7QualitySchema,
});

export type R7PageContract = z.infer<typeof R7PageContractSchema>;
export const R7PageContractPartialSchema = R7PageContractSchema.partial();
export type R7PageContractPartial = z.infer<typeof R7PageContractPartialSchema>;

// ── Section Bundle V3 (per-section output from pipeline) ─

export const R7SectionBundleSchema = z.object({
  section_key: R7SectionKeySchema,
  intent_local: z.object({
    job_to_be_done: z.string(),
    primary_queries: z.array(z.string()),
    secondary_queries: z.array(z.string()),
  }),
  headings: z.object({
    h2: z.string().optional(),
    h3: z.array(z.string()).optional(),
  }),
  content_blocks: z.array(R7ContentBlockSchema),
  terms_to_include: z.array(R7TermSchema).max(20),
  anchors_out: z.array(R7AnchorSchema),
  media_slots: z.array(R7MediaSlotSchema),
  quality: z.object({
    section_score: z.number().int().min(0).max(100),
    why_it_scores: z.object({
      intent_fit: z.number().int().min(0).max(40),
      internal_link_value: z.number().int().min(0).max(25),
      uniqueness: z.number().int().min(0).max(20),
      ux_clarity: z.number().int().min(0).max(15),
    }),
    risks: z.array(z.string()),
    fixes: z.array(z.string()),
  }),
  guards: z.object({
    must_not_include: z.array(z.string()),
    must_include: z.array(z.string()),
    notes: z.string().default(''),
  }),
});
export type R7SectionBundle = z.infer<typeof R7SectionBundleSchema>;

// ── Gate Report (P99 output) ────────────────────────────

export const R7GateReportSchema = z.object({
  status: z.enum(['PASS', 'FAIL']),
  score: z.number().int().min(0).max(100),
  errors: z.array(z.string()),
  fixes: z.array(z.string()),
  gate_details: z.record(z.enum(['PASS', 'FAIL'])),
});
export type R7GateReport = z.infer<typeof R7GateReportSchema>;
