/**
 * R4PageContract Zod Schema — contrat formel pour les pages R4 Reference.
 * Self-contained : tous les enums definis inline, pas d'imports externes.
 * 10 sections, 7 block types, media slots (hero + by_section), forbidden lexicons, hard gates.
 *
 * INTERDIT R4 : tout contenu procedural (HowTo), transactionnel (R1), diagnostic (R5).
 */

import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────

const SectionId = z.enum([
  'definition',
  'takeaways',
  'role_mecanique',
  'composition',
  'variants',
  'key_specs',
  'faq',
  'does_not',
  'rules',
  'scope',
]);

const Tone = z.enum([
  'indigo',
  'green',
  'blue',
  'amber',
  'red',
  'purple',
  'slate',
]);

// ── Keywords ─────────────────────────────────────────────

const KeywordMapping = z.object({
  term: z.string().min(2),
  reason: z.string().min(5),
  target_role: z.enum(['R1', 'R3', 'R5']),
});

const KeywordsBySection = z.object({
  target_keywords: z.array(z.string()).min(6).max(12),
  supporting_terms: z.array(z.string()).min(10).max(24),
  forbidden_terms: z.array(KeywordMapping).min(8).max(30),
});

// ── Content blocks (7 variants) ──────────────────────────

const BlockParagraph = z.object({
  type: z.literal('paragraph'),
  text: z.string().min(10),
});

const BlockBullets = z.object({
  type: z.literal('bullets'),
  items: z.array(z.string().min(6)).min(2).max(12),
});

const BlockNumbered = z.object({
  type: z.literal('numbered'),
  items: z.array(z.string().min(6)).min(3).max(12),
});

const BlockCards = z.object({
  type: z.literal('cards'),
  items: z
    .array(
      z.object({
        title: z.string().min(2),
        text: z.string().min(20),
      }),
    )
    .min(2)
    .max(8),
});

const BlockTable = z.object({
  type: z.literal('table'),
  columns: z.array(z.string()).min(2).max(6),
  rows: z.array(z.array(z.string()).min(2).max(6)).min(2).max(12),
  note: z.string().optional(),
});

const BlockFaq = z.object({
  type: z.literal('faq'),
  items: z
    .array(
      z.object({
        q: z.string().min(8),
        a: z.string().min(25),
      }),
    )
    .min(3)
    .max(10),
});

const BlockCallout = z.object({
  type: z.literal('callout'),
  tone: Tone,
  icon: z.string().optional(),
  title: z.string().min(2),
  text: z.string().min(10),
});

const ContentBlock = z.union([
  BlockParagraph,
  BlockBullets,
  BlockNumbered,
  BlockCards,
  BlockTable,
  BlockFaq,
  BlockCallout,
]);

// ── Media ────────────────────────────────────────────────

const MediaGoal = z.enum([
  'comprehension',
  'trust',
  'scanability',
  'disambiguation',
  'snippet_support',
]);
const MediaType = z.enum(['none', 'image', 'diagram', 'table', 'callout']);
const MediaVariant = z.enum([
  'photo_piece',
  'diagram_simple',
  'exploded_view',
  'mini_icon',
  'comparison_table',
  'specs_table',
  'callout_policy',
  'callout_scope',
  'none',
]);

const MediaSlot = z.object({
  type: MediaType,
  goal: MediaGoal,
  variant: MediaVariant.optional(),
  alt: z.string().optional(),
  image_brief: z
    .object({
      prompt: z.string().min(20),
      avoid: z.array(z.string()).min(3),
    })
    .optional(),
  table_schema: z
    .object({
      columns: z.array(z.string()).min(2).max(6),
      row_templates: z.array(z.string()).min(2).max(8),
      note: z.string().optional(),
    })
    .optional(),
});

// ── Headings ─────────────────────────────────────────────

const HeadingSection = z.object({
  id: SectionId,
  h2: z.string().min(1),
  h3: z.array(z.string()).max(3).optional().default([]),
});

// ── Section ──────────────────────────────────────────────

const Section = z.object({
  section_id: SectionId,
  h2: z.string().min(1),
  content_blocks: z.array(ContentBlock).min(1),
  keywords: KeywordsBySection,
});

// ══════════════════════════════════════════════════════════
// R4 Page Contract (top-level)
// ══════════════════════════════════════════════════════════

export const PageContractR4Schema = z.object({
  contract_version: z.string().regex(/^R4\.[0-9]+\.[0-9]+$/),
  page_role: z.literal('R4_REFERENCE'),
  entity: z.object({
    slug: z.string().min(1),
    short_title: z.string().min(1),
    system: z.string().min(1),
    variants: z.array(z.string()).optional().default([]),
    related_entities: z
      .array(
        z.object({
          slug: z.string(),
          title: z.string(),
          relation: z
            .enum(['interaction', 'confusion', 'system', 'related'])
            .optional(),
        }),
      )
      .optional()
      .default([]),
  }),
  intents: z.object({
    primary: z.object({
      role: z.literal('R4'),
      label: z.string().min(1),
      user_need: z.string().min(1),
    }),
    secondary: z
      .array(
        z.object({
          label: z.string(),
          allowed: z.boolean().optional().default(true),
        }),
      )
      .max(3)
      .optional()
      .default([]),
  }),
  headings: z.object({
    h1: z.string().min(1),
    sections: z.array(HeadingSection).min(7).max(9),
  }),
  sections: z.array(Section).min(7).max(10),
  media_slots: z.object({
    hero: z.object({
      type: z.enum(['image', 'diagram', 'none']),
      variant: z.enum([
        'photo_piece',
        'diagram_simple',
        'exploded_view',
        'og_template',
        'none',
      ]),
      goal: MediaGoal,
      alt: z.string().min(10),
      image_brief: z
        .object({
          prompt: z.string().min(20),
          avoid: z.array(z.string()).min(3),
        })
        .optional(),
    }),
    by_section: z
      .object({
        definition: MediaSlot.optional(),
        takeaways: MediaSlot.optional(),
        role_mecanique: MediaSlot.optional(),
        composition: MediaSlot.optional(),
        variants: MediaSlot.optional(),
        key_specs: MediaSlot.optional(),
        faq: MediaSlot.optional(),
        does_not: MediaSlot.optional(),
        rules: MediaSlot.optional(),
        scope: MediaSlot.optional(),
      })
      .strict(),
    sidebar: z
      .object({
        product_thumb: MediaSlot.optional(),
      })
      .strict()
      .optional(),
  }),
  forbidden: z.object({
    lexicons: z.object({
      R1: z.array(z.string()),
      R3: z.array(z.string()),
      R5: z.array(z.string()),
    }),
  }),
  validation: z.object({
    hard_gates: z
      .array(
        z.enum([
          'NO_HOWTO_FOCUS_IN_R4',
          'NO_TRANSACTIONAL_FOCUS_IN_R4',
          'NO_DIAGNOSTIC_FOCUS_IN_R4',
          'NO_DUPLICATE_SECTIONS',
          'R4_SECTIONS_COUNT_OK',
          'MEDIA_SLOTS_PRESENT',
          'CANONICAL_ORIGIN_UNIFIED',
        ]),
      )
      .min(5),
    notes: z.string().optional(),
  }),
});

export type PageContractR4 = z.infer<typeof PageContractR4Schema>;
