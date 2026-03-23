import { type RagData, type BuilderResult, NEG_SCHEMA } from './types';

/**
 * PRICE — Infographie prix contextualisée.
 * Réassurance valeur, rapport qualité / choix.
 * RAG : selection.cost_range{min, max}, selection.criteria[]
 */
export function buildPricePrompt(
  pgName: string,
  rag: RagData | null,
): BuilderResult {
  const fieldsUsed: string[] = [];
  let score = 0;
  const n = pgName.toLowerCase();

  let rangeHint = '';
  const range = rag?.selection?.cost_range;
  if (range?.min != null && range?.max != null) {
    rangeHint = ` Fourchette réelle : ${range.min}€ à ${range.max}€.`;
    fieldsUsed.push('selection.cost_range');
    score++;
  }

  let tiersHint = 'éco, standard, premium';
  const criteria = rag?.selection?.criteria ?? [];
  if (criteria.length >= 2) {
    tiersHint = criteria
      .slice(0, 3)
      .map((c) => c.toLowerCase())
      .join(', ');
    fieldsUsed.push('selection.criteria');
    score++;
  }

  const prompt = `Infographie prix, design minimaliste flat, fond blanc. Fourchettes de prix du ${n} par niveau de gamme (${tiersHint}). Barres horizontales, code couleur vert/bleu/orange. Sans ombre, rendu vectoriel.${rangeHint} Format 4:3.`;

  return {
    prompt,
    neg: NEG_SCHEMA,
    alt: `Prix ${n} — fourchettes par gamme`,
    caption: `Fourchettes de prix ${n}`,
    ragFieldsUsed: fieldsUsed,
    richnessScore: score,
  };
}
