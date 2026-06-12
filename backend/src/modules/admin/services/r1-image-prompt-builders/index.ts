export { type RagData, type BuilderResult, type SlotBuilder } from './types';
export { buildHeroPrompt } from './hero.builder';
export { buildTypesPrompt } from './types.builder';
export { buildPricePrompt } from './price.builder';
export { buildLocationPrompt } from './location.builder';
export { buildOgPrompt } from './og.builder';

// ── In-article (salvage R3 pré-purge RAG — non câblé dans SLOT_BUILDERS) ──
export { buildWearMacroPrompt } from './wear-macro.builder';
export { buildComparisonAbPrompt } from './comparison-ab.builder';
export { buildExplodedViewPrompt } from './exploded-view.builder';
export {
  MAX_IN_ARTICLE_IMAGES,
  IN_ARTICLE_SLOT_IDS,
  type InArticleSlotId,
  scoreWearMacro,
  scoreComparisonAb,
  scoreExplodedView,
  computeInArticleRichnessScores,
  selectInArticleSlots,
} from './in-article-selection';

import { type SlotBuilder } from './types';
import { buildHeroPrompt } from './hero.builder';
import { buildTypesPrompt } from './types.builder';
import { buildPricePrompt } from './price.builder';
import { buildLocationPrompt } from './location.builder';
import { buildOgPrompt } from './og.builder';
import { buildWearMacroPrompt } from './wear-macro.builder';
import { buildComparisonAbPrompt } from './comparison-ab.builder';
import { buildExplodedViewPrompt } from './exploded-view.builder';

/** Map slot ID → builder function */
export const SLOT_BUILDERS: Record<string, SlotBuilder> = {
  HERO: buildHeroPrompt,
  TYPES: buildTypesPrompt,
  PRICE: buildPricePrompt,
  LOCATION: buildLocationPrompt,
  OG: buildOgPrompt,
};

/** Slot metadata (non-RAG, structurel) — rank = ordre d'affichage admin */
export const SLOT_META: Record<
  string,
  { section: string; aspect: string; width: number; cost: number; rank: number }
> = {
  HERO: {
    section: 'R1_S1_HERO',
    aspect: '16:9',
    width: 1200,
    cost: 0,
    rank: 1,
  },
  TYPES: {
    section: 'R1_S4_MICRO_SEO',
    aspect: '4:3',
    width: 800,
    cost: 1,
    rank: 2,
  },
  PRICE: {
    section: 'R1_S4_MICRO_SEO',
    aspect: '4:3',
    width: 800,
    cost: 1,
    rank: 3,
  },
  LOCATION: {
    section: 'R1_S5_COMPAT',
    aspect: '4:3',
    width: 800,
    cost: 1,
    rank: 4,
  },
  OG: { section: 'META', aspect: '1200:630', width: 1200, cost: 0, rank: 5 },
};

export const SLOT_IDS = Object.keys(SLOT_BUILDERS);

// ── Slots in-article (salvage R3 pré-purge RAG) ──
//
// VOLONTAIREMENT séparés de SLOT_BUILDERS : SLOT_IDS dérive de SLOT_BUILDERS
// et pilote la boucle de génération live de r1-image-prompt.service.ts — les
// y ajouter changerait les écritures DB des consommateurs existants
// (admin.r1-images / r1-qa). Le câblage runtime de ces slots est une décision
// future (consommation via facts exports-seo, ADR-059), gouvernée par
// l'heuristique de in-article-selection.ts (max 2 images, skip score 0).
//
// Sections/aspects : fidèles à MEDIA_LAYOUT_CONTRACT
// (config/media-slots.constants.ts — S2_SYMPTOM_IMAGE, S3_SCHEMA_IMAGE,
// S4D_SCHEMA_IMAGE).

/** Map slot in-article → builder (non câblé dans la génération live) */
export const IN_ARTICLE_SLOT_BUILDERS: Record<string, SlotBuilder> = {
  WEAR_MACRO: buildWearMacroPrompt,
  COMPARISON_AB: buildComparisonAbPrompt,
  EXPLODED_VIEW: buildExplodedViewPrompt,
};

/** Metadata des slots in-article — même shape que SLOT_META, ranks après OG */
export const IN_ARTICLE_SLOT_META: Record<
  string,
  { section: string; aspect: string; width: number; cost: number; rank: number }
> = {
  WEAR_MACRO: {
    section: 'S2',
    aspect: '16:9',
    width: 800,
    cost: 1,
    rank: 6,
  },
  COMPARISON_AB: {
    section: 'S3',
    aspect: '4:3',
    width: 800,
    cost: 1,
    rank: 7,
  },
  EXPLODED_VIEW: {
    section: 'S4_DEPOSE',
    aspect: '4:3',
    width: 800,
    cost: 1,
    rank: 8,
  },
};
