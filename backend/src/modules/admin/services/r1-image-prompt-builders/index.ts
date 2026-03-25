export { type RagData, type BuilderResult, type SlotBuilder } from './types';
export { buildHeroPrompt } from './hero.builder';
export { buildTypesPrompt } from './types.builder';
export { buildPricePrompt } from './price.builder';
export { buildLocationPrompt } from './location.builder';
export { buildOgPrompt } from './og.builder';

import { type SlotBuilder } from './types';
import { buildHeroPrompt } from './hero.builder';
import { buildTypesPrompt } from './types.builder';
import { buildPricePrompt } from './price.builder';
import { buildLocationPrompt } from './location.builder';
import { buildOgPrompt } from './og.builder';

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
