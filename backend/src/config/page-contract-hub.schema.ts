/**
 * PageContract v1 Zod Schema — contrat formel pour le HUB Conseils.
 * Valide sections, media_slots, internal_links, SEO config.
 * Utilise par le hub-conseils frontend + prompts P0/P1.
 */

import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────

export const PageRole = z.enum([
  'HUB_CONSEILS',
  'CATEGORY_HUB',
  'ARTICLE_HOWTO',
  'ARTICLE_DIAGNOSTIC',
  'ARTICLE_BUYING_GUIDE',
  'ARTICLE_GLOSSARY',
]);

export const PrimaryIntent = z.enum([
  'REPARER_MONTER',
  'DIAGNOSTIQUER_PANNE',
  'CHOISIR_PIECE',
  'DECOUVRIR_CATEGORIES',
]);

export const SchemaOrg = z.enum([
  'CollectionPage',
  'ItemList',
  'FAQPage',
  'BreadcrumbList',
]);

export const LayoutVariant = z.enum([
  'HERO',
  'TABS',
  'CARDS_GRID',
  'LIST',
  'FAQ',
  'CTA',
  'MIXED',
]);

export const Density = z.enum(['COMPACT', 'DEFAULT', 'SPACIOUS']);

export const ContentBlockType = z.enum([
  'TEXT',
  'BULLETS',
  'CTA_ROW',
  'CATEGORY_CARDS',
  'ARTICLE_CARDS',
  'TABLE',
  'STEPS',
  'TRUST_BOX',
]);

export const MediaPlacement = z.enum([
  'HERO_BACKGROUND',
  'HERO_ILLUSTRATION',
  'INTENT_CARD',
  'CATEGORY_CARD_THUMB',
  'ARTICLE_CARD_THUMB',
  'INLINE',
  'SIDEBAR',
  'CTA_BANNER',
  'TABLE_FIGURE',
  'STEPS_DIAGRAM',
]);

export const MediaKind = z.enum([
  'IMAGE',
  'ICON',
  'ILLUSTRATION',
  'TABLE',
  'DIAGRAM',
]);

export const MediaPriority = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export const MediaFormat = z.enum(['SVG', 'WEBP', 'AVIF', 'PNG', 'JPG']);
export const MediaRatio = z.enum(['16:9', '4:3', '1:1', '4:5']);
export const Loading = z.enum(['eager', 'lazy']);
export const FetchPriority = z.enum(['high', 'auto', 'low']);
export const FallbackStrategy = z.enum([
  'NONE',
  'USE_CATEGORY_IMAGE',
  'USE_FALLBACK_IMAGE',
  'USE_ICON',
]);

// ── Content Block ────────────────────────────────────────

export const ContentBlock = z.object({
  type: ContentBlockType,
  id: z.string().regex(/^[a-z0-9-]{3,}$/),
  payload: z.record(z.any()),
});
export type ContentBlockType_T = z.infer<typeof ContentBlock>;

// ── Section ──────────────────────────────────────────────

export const Section = z.object({
  section_id: z.string().regex(/^[a-z0-9-]{3,}$/),
  title: z.string().min(3),
  purpose: z.string().min(20),
  layout: z.object({
    variant: LayoutVariant,
    columns: z.number().int().min(1).max(4).optional(),
    density: Density.default('DEFAULT'),
  }),
  content_blocks: z.array(ContentBlock).min(1),
  media_refs: z.array(z.string()).default([]),
  indexable: z.boolean().default(true),
});
export type Section_T = z.infer<typeof Section>;

// ── Link Rule ────────────────────────────────────────────

export const LinkRule = z.object({
  from: z.enum(['HUB', 'CATEGORY', 'ARTICLE']),
  to: z.enum(['HUB', 'CATEGORY', 'ARTICLE', 'ECOMMERCE_GAMME']),
  min_count: z.number().int().min(0).max(50),
  purpose: z.string().min(10),
});
export type LinkRule_T = z.infer<typeof LinkRule>;

// ── Media Slot ───────────────────────────────────────────

export const MediaSlot = z.object({
  media_id: z.string().regex(/^[a-z0-9-]{3,}$/),
  section_id: z.string().regex(/^[a-z0-9-]{3,}$/),
  placement: MediaPlacement,
  kind: MediaKind,
  priority: MediaPriority,
  asset: z.object({
    subject: z.string().min(10),
    format: MediaFormat,
    ratio: MediaRatio,
    min_width: z.number().int().min(64).default(640),
    max_kb: z.number().int().min(5).default(120),
    file_hint: z.string().default(''),
    style_notes: z.string().default(''),
  }),
  a11y: z.object({
    alt: z.string(),
    decorative: z.boolean(),
  }),
  performance: z.object({
    loading: Loading,
    preload: z.boolean(),
    fetchpriority: FetchPriority,
    sizes_hint: z.string().default(''),
  }),
  fallback: z.object({
    strategy: FallbackStrategy,
    fallback_media_id: z.string().optional(),
  }),
});
export type MediaSlot_T = z.infer<typeof MediaSlot>;

// ── PageContract ─────────────────────────────────────────

export const PageContract = z.object({
  version: z.literal('1.0.0'),

  page: z.object({
    page_id: z.string().min(3),
    page_role: PageRole,
    locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
    path: z.string().min(1),
    canonical_path: z.string().optional(),
    title: z.string().min(10),
    description: z.string().optional(),
    updated_at: z.string().datetime().optional(),
    theme: z.string().default('automecanik'),
  }),

  intent: z.object({
    primary_intent: PrimaryIntent,
    secondary_intents: z.array(PrimaryIntent).default([]),
    jobs_to_be_done: z.array(z.string().min(10)).min(1),
    audience: z
      .object({
        level: z
          .enum(['DEBUTANT', 'INTERMEDIAIRE', 'EXPERT', 'MIXTE'])
          .optional(),
        context: z.string().optional(),
      })
      .optional(),
    success_metrics: z
      .array(
        z.enum([
          'CTR_TO_CATEGORY',
          'CTR_TO_ARTICLE',
          'CTR_TO_ECOMMERCE_GAMME',
          'TIME_ON_PAGE',
          'SCROLL_DEPTH',
          'LOW_BOUNCE',
          'ASSISTED_CONVERSION',
        ]),
      )
      .min(1),
  }),

  seo: z.object({
    h1: z.string().min(10),
    meta_title: z.string().min(10).max(70),
    meta_description: z.string().min(50).max(160),
    indexation: z.object({
      index: z.boolean(),
      follow: z.boolean(),
      canonical: z.string().min(1),
      filters_policy: z.object({
        noindex_for_filters: z.boolean(),
        canonical_target: z.enum(['SELF', 'HUB', 'CATEGORY']),
      }),
      pagination: z
        .object({
          enabled: z.boolean().default(true),
          rel_next_prev: z.boolean().default(true),
          canonical_each_page: z.boolean().default(true),
        })
        .optional(),
    }),
    schema_org: z.array(SchemaOrg).min(1),
  }),

  sections: z.array(Section).min(3),

  internal_links: z.object({
    required_paths: z.array(z.string()).default([]),
    rules: z.array(LinkRule).default([]),
  }),

  media_slots: z.array(MediaSlot).min(1),
});
export type PageContract_T = z.infer<typeof PageContract>;
