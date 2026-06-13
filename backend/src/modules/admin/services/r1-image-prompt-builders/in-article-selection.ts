import { type RagData } from './types';

/**
 * Heuristique de sélection des images in-article (salvage R3 pré-purge RAG).
 *
 * Portée depuis r3-image-prompt.service.ts (computeSlotRichnessScores +
 * selectInArticleSlots, gate G7 « max 2 images in-article ») avant suppression
 * du service legacy RAG-source.
 *
 * Règles :
 * - budget maximum : MAX_IN_ARTICLE_IMAGES (2) slots sélectionnés par gamme
 * - skip : un slot avec richnessScore 0 n'est jamais sélectionné ni généré
 * - tri : score DESC, puis ordre de priorité éditorial
 *   WEAR_MACRO > COMPARISON_AB > EXPLODED_VIEW
 *
 * Données : RagData partielle nullable injectée par l'appelant — aucune
 * lecture filesystem ici. Source future = facts exports-seo (ADR-059).
 */

/** Gate G7 — budget maximum d'images in-article par page */
export const MAX_IN_ARTICLE_IMAGES = 2;

/** Slots in-article, dans l'ordre de priorité éditorial (S2 > S3 > S4D legacy) */
export const IN_ARTICLE_SLOT_IDS = [
  'WEAR_MACRO',
  'COMPARISON_AB',
  'EXPLODED_VIEW',
] as const;

export type InArticleSlotId = (typeof IN_ARTICLE_SLOT_IDS)[number];

// ── Scoring par slot (source unique — builders + sélection) ──

/**
 * WEAR_MACRO — richesse du contexte « usure / symptômes ».
 * +1 wear_signs présents, +1 ≥2 symptômes, +1 symptôme sévérité sécurité.
 */
export function scoreWearMacro(rag: RagData | null): number {
  let score = 0;
  if (rag?.maintenance?.wear_signs?.length) score++;
  if ((rag?.diagnostic?.symptoms?.length ?? 0) >= 2) score++;
  if (rag?.diagnostic?.symptoms?.some((s) => s.severity === 'securite'))
    score++;
  return score;
}

/**
 * COMPARISON_AB — richesse du contexte « comparatif A vs B ».
 * +1 ≥3 critères de sélection, +1 confusion_with présent, +1 marques premium.
 */
export function scoreComparisonAb(rag: RagData | null): number {
  let score = 0;
  if ((rag?.selection?.criteria?.length ?? 0) >= 3) score++;
  if (rag?.domain?.confusion_with?.length) score++;
  if (rag?.selection?.brands?.premium?.length) score++;
  return score;
}

/**
 * EXPLODED_VIEW — richesse du contexte « vue éclatée / montage ».
 * +1 ≥5 étapes d'installation, +1 outils présents, +1 difficulté non triviale.
 */
export function scoreExplodedView(rag: RagData | null): number {
  let score = 0;
  if ((rag?.installation?.steps?.length ?? 0) >= 5) score++;
  if (rag?.installation?.tools?.length) score++;
  if (rag?.installation?.difficulty && rag.installation.difficulty !== 'simple')
    score++;
  return score;
}

/** Scores de richesse RAG pour les 3 slots in-article (0 → skip). */
export function computeInArticleRichnessScores(
  rag: RagData | null,
): Record<InArticleSlotId, number> {
  return {
    WEAR_MACRO: scoreWearMacro(rag),
    COMPARISON_AB: scoreComparisonAb(rag),
    EXPLODED_VIEW: scoreExplodedView(rag),
  };
}

/**
 * Sélectionne au plus `maxImages` slots in-article.
 * Tri : score DESC, puis priorité éditoriale (ordre IN_ARTICLE_SLOT_IDS).
 * Les slots à score 0 sont exclus (skip — jamais générés).
 */
export function selectInArticleSlots(
  scores: Partial<Record<InArticleSlotId, number>>,
  maxImages: number = MAX_IN_ARTICLE_IMAGES,
): InArticleSlotId[] {
  return [...IN_ARTICLE_SLOT_IDS]
    .map((slotId) => ({
      slotId,
      score: scores[slotId] ?? 0,
      priority: IN_ARTICLE_SLOT_IDS.indexOf(slotId),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.priority - b.priority)
    .slice(0, maxImages)
    .map((s) => s.slotId);
}
