/**
 * R6 Keyword Plan constants V2 — Buying Guide (choisir / comparer / compat / qualite / budget / marques / pieges / pro).
 * 10 sections, 13 block types, 8 gates, intent classification tokens.
 * Used by page-contract-r6.schema.ts and r6-keyword-planner / r6-content-batch agents.
 *
 * INTERDIT R6 : tout contenu procedural detaille (HowTo) + diagnostic complet.
 */

export const R6_KP_PIPELINE_PHASES = [
  'P0_AUDIT',
  'P1_SECTION_PLANNER',
  'P2_CONTENT_GEN',
  'P3_CANNIB_GUARD',
  'P4_QA',
  'complete',
] as const;
export const R6_SECTION_IDS = [
  'hero_decision',
  'summary_pick_fast',
  'quality_tiers',
  'compatibility',
  'price_guide',
  'brands_guide',
  'pitfalls',
  'when_pro',
  'faq_r6',
  'cta_final',
] as const;
export type R6SectionId = (typeof R6_SECTION_IDS)[number];

export const R6_MEDIA_PLACEMENTS = [
  'hero',
  'after_h2',
  'before_block',
  'after_block',
  'inline_left',
  'inline_right',
  'aside',
  'end_section',
] as const;
export const R6_MEDIA_SOURCES = [
  'cdn',
  'catalog',
  'internal',
  'rag',
  'generated',
  'none',
] as const;
// ── Media budget ────────────────────────────────────────

export const R6_MEDIA_BUDGET = {
  maxImages: 4,
  maxInArticleImages: 3,
  maxCallouts: 4,
  maxTablesPerSection: 1,
  zeroCostTypes: [
    'table',
    'checklist',
    'callout',
    'cards',
    'quote',
    'diagram',
  ] as const,
} as const;

// ── Anti-cannibalization term lists ─────────────────────
// R6 yields to ALL other roles (lowest priority)

/** R6 forbidden from R1 — transactional terms */
export const R6_FORBIDDEN_FROM_R1 = [
  'acheter',
  'commander',
  'livraison',
  'promo',
  'remise',
  'pas cher',
  'ajouter au panier',
  'expedition',
  'soldes',
  'prix discount',
  'en stock',
  'livraison rapide',
] as const;

/** R6 forbidden from R3 — how-to/mounting terms */
export const R6_FORBIDDEN_FROM_R3 = [
  'etape',
  'pas-a-pas',
  'tuto',
  'tutoriel',
  'montage',
  'demonter',
  'visser',
  'devisser',
  'couple de serrage',
  'demontage',
  'remontage',
  'comment remplacer',
  'comment changer',
  'outils necessaires',
] as const;

/** R6 forbidden from R5 — diagnostic terms */
export const R6_FORBIDDEN_FROM_R5 = [
  'diagnostic',
  'panne',
  'voyant',
  'code erreur',
  'OBD',
  'code defaut',
  'calculateur',
  'capteur defaillant',
  'multimetre',
  'valise diagnostic',
] as const;

/** R6 forbidden from R4 — encyclopedic terms */
export const R6_FORBIDDEN_FROM_R4 = [
  'definition de',
  'encyclopedie',
  'historique',
  'invente en',
  'etymologie',
] as const;

export const R6_QUALITY_TIER_IDS = [
  'oe',
  'equiv_oe',
  'adaptable',
  'reconditionne',
  'echange_standard',
] as const;

export const R6_SECTION_TERM_MINIMUMS: Record<R6SectionId, number> = {
  hero_decision: 3,
  summary_pick_fast: 4,
  quality_tiers: 4,
  compatibility: 3,
  price_guide: 2,
  brands_guide: 3,
  pitfalls: 4,
  when_pro: 2,
  faq_r6: 2,
  cta_final: 1,
};
