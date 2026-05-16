/**
 * R4 Keyword Plan constants — pipeline phases v2, section config, gate definitions,
 * system templates, quality thresholds.
 * Used by r4-keyword-planner (2-pass Discover → Compile)
 * and r4-content-batch (Blueprint → B1-B9 Sections → Assemble → Lint).
 *
 * R4 = definition canonique + verite mecanique. NO procedures.
 */

export const R4_FORBIDDEN_FROM_R1 = [
  'acheter',
  'prix',
  'pas cher',
  'promo',
  'livraison',
  'compatible avec',
  'meilleur',
  'top',
  'comparatif prix',
  'stock',
  'reference OEM',
] as const;

export const R4_FORBIDDEN_FROM_R3 = [
  'changer',
  'remplacer',
  'installer',
  'tutoriel',
  'etapes',
  'procedure',
  'outils',
  'difficulte',
  'temps',
  'couple de serrage',
  'rodage',
  'comment faire',
] as const;

export const R4_FORBIDDEN_FROM_R5 = [
  'symptome',
  'panne',
  'cause',
  'pourquoi ca vibre',
  'bruit',
  'voyant',
  'solutions',
  'reparer',
] as const;

export const R4_FORBIDDEN_FROM_R6 = [
  'guide achat',
  'quel choisir',
  'budget',
  'marques recommandees',
  'rapport qualite prix',
] as const;

export const R4_CONTENT_TABLE = '__seo_reference' as const;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _R4_CONTENT_SECTIONS = [
  'R4_B1_DEFINITION',
  'R4_B2_ROLE',
  'R4_B3_COMPOSITION',
  'R4_B4_VARIANTS',
  'R4_B5_KEY_SPECS',
  'R4_B6_FAQ',
  'R4_B7_DOES_NOT',
  'R4_B8_RULES',
  'R4_B9_SCOPE',
] as const;
export type R4ContentSection = (typeof _R4_CONTENT_SECTIONS)[number];

export const R4_CONTENT_THRESHOLDS = {
  minLintScore: 70,
  maxForbiddenInContent: 0,
  minKeywordsUsedPerSection: 4,
  minSectionsForPublish: 7,
} as const;
