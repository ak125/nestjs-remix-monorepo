/**
 * PageContract R4 Media + Layout Schema
 * Contrat formel pour les pages R4 Glossaire : hub, system hub, term.
 * Couvre sections, media_slots (creative briefs), table_specs, SEO.
 *
 * Complementaire a page-contract-r4.schema.ts (contenu terme).
 * Celui-ci gere le layout, les medias et la structure de page.
 */

import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────

export const R4PageType = z.enum([
  'R4_glossary_hub',
  'R4_glossary_system_hub',
  'R4_glossary_term',
]);

export const R4SectionKind = z.enum([
  'hero',
  'intent_banner',
  'system_hubs',
  'search_and_filters',
  'results',
  'editorial_seo_block',
  'guides_bridge',
  'faq',
  'conversion_bridge',
  'term_definition',
  'term_location',
  'term_function',
  'term_symptoms',
  'term_confusions',
  'term_variants',
  'term_related',
]);

export const R4MediaSlotType = z.enum([
  'icon_svg',
  'illustration_svg',
  'schema_location_svg',
  'schema_flow_svg',
  'photo_webp',
  'og_image',
]);

export const R4MediaAnchor = z.enum([
  'hero_right',
  'hero_inline',
  'card_icon',
  'h2_top',
  'h2_inline',
  'table_lead',
  'sidebar',
]);

export const R4CreativeStyle = z.enum([
  'line_art',
  'flat_icon',
  'diagram_clean',
  'minimal_technical',
  'photoreal_light',
]);

export const R4TablePurpose = z.enum([
  'symptom_to_action',
  'confusion_compare',
  'variants',
  'quick_facts',
  'troubleshooting_high_level',
]);

export const R4SeoRole = z.enum([
  'ux_scannability',
  'explain_location',
  'explain_flow',
  'brand',
  'serp_og',
  'support_intent',
]);

export const R4SchemaOrg = z.enum([
  'WebPage',
  'BreadcrumbList',
  'FAQPage',
  'DefinedTerm',
  'DefinedTermSet',
]);

// ── Sub-schemas ──────────────────────────────────────────

const Robots = z.object({
  index: z.boolean(),
  follow: z.boolean(),
  max_snippet: z.number().int().min(-1).max(320).optional(),
  max_image_preview: z.enum(['none', 'standard', 'large']).optional(),
  max_video_preview: z.number().int().min(-1).max(60).optional(),
});

const Breadcrumb = z.object({
  label: z.string().min(1).max(40),
  path: z.string().regex(/^\//),
});

const Seo = z.object({
  title: z.string().min(20).max(65),
  description: z.string().min(120).max(170),
  canonical_path: z.string().regex(/^\//),
  robots: Robots,
  breadcrumbs: z.array(Breadcrumb).max(6).optional(),
  schema_org: z.array(R4SchemaOrg).optional(),
});

const TableColumn = z.object({
  key: z.string().regex(/^[a-z0-9_-]{2,40}$/),
  label: z.string().min(1).max(40),
});

const TableSpec = z.object({
  id: z.string().regex(/^[a-z0-9_-]{3,80}$/),
  title: z.string().min(1).max(90),
  purpose: R4TablePurpose.optional(),
  columns: z.array(TableColumn).min(2).max(5),
  row_count_target: z.number().int().min(3).max(12).default(6),
});

const Section = z.object({
  id: z.string().regex(/^[a-z0-9_-]{3,80}$/),
  kind: R4SectionKind,
  title: z.string().min(1).max(80),
  order: z.number().int().min(0).max(200),
  copy_hint: z.string().max(500).optional(),
  required: z.boolean().default(true),
  media_refs: z.array(z.string().regex(/^[a-z0-9_-]{3,80}$/)).optional(),
  table_specs: z.array(TableSpec).optional(),
});

const Placement = z.object({
  section_id: z.string().regex(/^[a-z0-9_-]{3,80}$/),
  anchor: R4MediaAnchor,
  device: z.enum(['mobile', 'desktop', 'both']),
});

const CreativeBrief = z.object({
  subject: z.string().min(5).max(160),
  style: R4CreativeStyle,
  constraints: z.array(z.string().min(2).max(120)).min(1).max(8),
  do_not: z.array(z.string().min(2).max(120)).min(1).max(8),
});

const Tech = z.object({
  format: z.enum(['svg', 'webp']),
  width: z.number().int().min(16).max(2400),
  height: z.number().int().min(16).max(2400),
  lazy: z.boolean(),
  loading: z.enum(['lazy', 'eager']),
  sizes: z.string().min(3).max(200),
  file_path_hint: z.string().min(5).max(220),
});

const MediaSlot = z.object({
  id: z.string().regex(/^[a-z0-9_-]{3,80}$/),
  slot_type: R4MediaSlotType,
  placement: Placement,
  priority: z.number().int().min(1).max(5),
  must_have: z.boolean(),
  seo_role: R4SeoRole,
  creative_brief: CreativeBrief,
  alt_text: z.string().min(5).max(140),
  tech: Tech,
  a11y: z
    .object({
      decorative: z.boolean().default(false),
      aria_label: z.string().max(80).optional(),
    })
    .optional(),
  source: z
    .object({
      derivation: z.enum(['generated', 'stock', 'inhouse']).optional(),
      notes: z.string().max(200).optional(),
    })
    .optional(),
});

// ── Main Schema ─────────────────────────────────────────

export const PageContractR4MediaSchema = z.object({
  contract_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  page_type: R4PageType,
  page_id: z.string().min(3).max(180),
  locale: z.enum(['fr-FR']),
  seo: Seo,
  sections: z.array(Section).min(3),
  media_slots: z.array(MediaSlot).min(1),
  quality: z
    .object({
      intent: z.string().min(10).max(180).optional(),
      anti_cannibalization: z
        .object({
          allowed: z.array(z.string()).optional(),
          forbidden: z.array(z.string()).optional(),
        })
        .optional(),
      content_score_target: z.number().int().min(70).max(100).optional(),
    })
    .optional(),
});

// ── Inferred Types ──────────────────────────────────────

export type PageContractR4Media = z.infer<typeof PageContractR4MediaSchema>;
export type R4Section = z.infer<typeof Section>;
export type R4MediaSlot = z.infer<typeof MediaSlot>;
export type R4TableSpec = z.infer<typeof TableSpec>;
export type R4CreativeBrief = z.infer<typeof CreativeBrief>;
export type R4Tech = z.infer<typeof Tech>;
export type R4Placement = z.infer<typeof Placement>;
