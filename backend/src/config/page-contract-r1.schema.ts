/**
 * R1PageContract Zod Schema — contrat formel pour les pages gamme R1 transactionnelles.
 * Valide intent lock (P1), visual plan, media slots, content contract, hard rules.
 * Utilise par r1-content-pipeline et r1-content-batch comme reference de structure.
 *
 * v2.4 — Corrections appliquees :
 *   A1: how_to_check min(20) unifie
 *   A2: asset_id optional+nullable
 *   A3: fallback optional
 *   B1: interest_nuggets Array<{angle, hook, rag_source}>
 *   B2: allowed_lexicon (nom existant)
 *   B3: confusion_pairs + writing_constraints inclus
 *   B4: R1_MEDIA_RULES reutilise
 *   C2: hero_cta_helper_line ajoute
 */

import { z } from 'zod';
import { R1_MEDIA_RULES } from './r1-media-rules.constants';

// ── Enums ────────────────────────────────────────────────

export const AllowedSubintent = z.enum([
  'compatibility_checks',
  'mounting_variants',
  'identifier_check',
  'exchange_standard',
  'consigne',
  'delivery_returns_support',
]);
export type AllowedSubintent = z.infer<typeof AllowedSubintent>;

export const TableElement = z.enum([
  'Référence / équivalence',
  'Connectique',
  'Dimensions',
  'Fixations',
  'Norme / homologation',
  'Échange standard',
  'Consigne',
  'Identifiant',
]);
export type TableElement = z.infer<typeof TableElement>;

export const MediaSlotId = z.enum([
  'selector_category_image',
  'equipementiers_logo_strip',
  'cross_sell_icons',
  'og_image',
  'breadcrumb_icon',
  'empty_state_icon',
]);
export type MediaSlotId = z.infer<typeof MediaSlotId>;

// ── Table rows ───────────────────────────────────────────

export const R1TableRowSchema = z.object({
  element: TableElement,
  how_to_check: z.string().min(20).max(180),
});
export type R1TableRow = z.infer<typeof R1TableRowSchema>;

// ── Interest nuggets (E-E-A-T tracable) ──────────────────

export const R1InterestNuggetSchema = z.object({
  angle: z.string().min(5).max(80),
  hook: z.string().min(10).max(120),
  rag_source: z.string().min(3).max(200),
});
export type R1InterestNugget = z.infer<typeof R1InterestNuggetSchema>;

// ── Confusion pairs ──────────────────────────────────────

export const R1ConfusionPairSchema = z.object({
  term: z.string().min(2).max(60),
  confused_with: z.string().min(2).max(60),
  distinction: z.string().min(10).max(200),
});
export type R1ConfusionPair = z.infer<typeof R1ConfusionPairSchema>;

// ── Writing constraints ──────────────────────────────────

export const R1WritingConstraintsSchema = z.object({
  max_words: z.number().int().positive(),
  min_words: z.number().int().positive(),
  tone: z.string().min(3).max(40),
  person: z.string().min(1).max(20),
  zero_diagnostic: z.boolean(),
  zero_howto: z.boolean(),
});
export type R1WritingConstraints = z.infer<typeof R1WritingConstraintsSchema>;

// ── Visual plan ──────────────────────────────────────────

export const R1VisualPlanSchema = z.object({
  hero_wallpaper: z.literal('none'),
  selector_category_image: z.literal('required'),
  compatibilities_cards: z.literal('icons_only'),
  compatibilities_label_rule: z.literal('label_1_2_words_required'),
  equipementiers: z.literal('logo_strip'),
  cross_sell: z.literal('icon_grid'),
  cross_sell_rules: z.object({
    max_items: z.number().int().min(1).max(6),
    same_family_only: z.literal(true),
  }),
  sticky_mobile_cta: z.literal('enabled'),
  hero_primary_cta: z.object({
    label: z.string().min(6).max(48),
    action: z.literal('use_vehicle_selector'),
  }),
});
export type R1VisualPlan = z.infer<typeof R1VisualPlanSchema>;

// ── Content contract ─────────────────────────────────────

export const R1ContentContractSchema = z.object({
  total_words_target: z.tuple([z.number().int(), z.number().int()]),
  micro_seo_words_target: z.tuple([z.number().int(), z.number().int()]),
  faq_answer_words_target: z.tuple([z.number().int(), z.number().int()]),
  max_gamme_mentions: z.number().int().min(1).max(10),
  max_compatible_mentions: z.number().int().min(0).max(2),
});
export type R1ContentContract = z.infer<typeof R1ContentContractSchema>;

// ── Hard rules ───────────────────────────────────────────

export const R1HardRulesSchema = z.object({
  ban_howto_markers: z.array(z.string()).min(6).max(30),
  ban_absolute_claims: z.array(z.string()).min(3).max(20),
  ban_price_push: z.array(z.string()).min(3).max(20),
});
export type R1HardRules = z.infer<typeof R1HardRulesSchema>;

// ── Media slot constraints ───────────────────────────────

export const R1MediaSlotConstraintsSchema = z.object({
  no_vehicle: z.boolean(),
  no_text_overlay: z.boolean(),
  formats: z
    .array(z.enum(['1:1', '4:3', '1200x630', 'svg']))
    .min(1)
    .max(4),
  crop: z.enum(['center', 'contain']),
  background: z.enum(['transparent', 'neutral']),
});
export type R1MediaSlotConstraints = z.infer<
  typeof R1MediaSlotConstraintsSchema
>;

// ── Media slot ───────────────────────────────────────────

export const R1MediaSlotSchema = z.object({
  slot: MediaSlotId,
  type: z.enum(['image', 'logo', 'icon']),
  required: z.boolean(),
  usage: z.string().min(10).max(180),
  asset_id: z.string().nullable().optional(),
  fallback: z.array(z.string()).max(4).optional(),
  constraints: R1MediaSlotConstraintsSchema,
  alt_template: z.string().min(2).max(120),
});
export type R1MediaSlot = z.infer<typeof R1MediaSlotSchema>;

// ── Media slots (rules from R1_MEDIA_RULES + slots array) ─

export const R1MediaRulesSchema = z.object({
  no_wallpaper: z.literal(R1_MEDIA_RULES.no_wallpaper),
  selector_category_image_required: z.literal(
    R1_MEDIA_RULES.selector_category_image_required,
  ),
  logos_must_be_official_or_internal: z.literal(
    R1_MEDIA_RULES.logos_must_be_official_or_internal,
  ),
  compat_icons_only: z.literal(R1_MEDIA_RULES.compat_icons_only),
  cross_sell_icons_only: z.literal(R1_MEDIA_RULES.cross_sell_icons_only),
  no_vehicle_photos: z.literal(R1_MEDIA_RULES.no_vehicle_photos),
  alt_style: z.literal(R1_MEDIA_RULES.alt_style),
});

export const R1MediaSlotsSchema = z.object({
  rules: R1MediaRulesSchema,
  slots: z.array(R1MediaSlotSchema).min(4).max(6),
});
export type R1MediaSlots = z.infer<typeof R1MediaSlotsSchema>;

// ── PageContractR1 (top-level) ───────────────────────────

export const PageContractR1Schema = z
  .object({
    page_role: z.literal('R1_ROUTER'),
    primary_intent: z.string().min(20).max(220),
    allowed_subintents: z.array(AllowedSubintent).min(3).max(6),
    forbidden_topics: z.array(z.string()).min(12).max(24),
    allowed_lexicon: z.array(z.string()).min(12).max(16),
    forbidden_lexicon: z.array(z.string()).min(25).max(35),

    // P1 contract fields (B3)
    confusion_pairs: z.array(R1ConfusionPairSchema).min(0).max(10),
    writing_constraints: R1WritingConstraintsSchema,

    // E-E-A-T tracable nuggets (B1)
    interest_nuggets: z.array(R1InterestNuggetSchema).length(3),

    table_rows_library: z.array(R1TableRowSchema).length(8),
    safe_table_plan: z.array(R1TableRowSchema).min(4).max(6),

    visual_plan: R1VisualPlanSchema,
    content_contract: R1ContentContractSchema,
    hard_rules: R1HardRulesSchema,
    media_slots: R1MediaSlotsSchema,

    // P3 output (C2)
    hero_cta_helper_line: z.string().min(10).max(180),
  })
  .superRefine((data, ctx) => {
    // C1: Si exchange_standard dans subintents → minItems 4
    if (data.allowed_subintents.includes('exchange_standard')) {
      if (data.allowed_subintents.length < 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_small,
          minimum: 4,
          type: 'array',
          inclusive: true,
          message:
            'allowed_subintents requires at least 4 items when exchange_standard is included',
          path: ['allowed_subintents'],
        });
      }
    }

    // Validate safe_table_plan elements are subset of table_rows_library elements
    const libraryElements = new Set(
      data.table_rows_library.map((r) => r.element),
    );
    for (let i = 0; i < data.safe_table_plan.length; i++) {
      if (!libraryElements.has(data.safe_table_plan[i].element)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `safe_table_plan[${i}].element "${data.safe_table_plan[i].element}" not found in table_rows_library`,
          path: ['safe_table_plan', i, 'element'],
        });
      }
    }
  });

export type PageContractR1 = z.infer<typeof PageContractR1Schema>;

// ── Partial schema (intermediate pipeline phases) ────────

export const PageContractR1PartialSchema =
  PageContractR1Schema.innerType().partial();
export type PageContractR1Partial = z.infer<typeof PageContractR1PartialSchema>;
