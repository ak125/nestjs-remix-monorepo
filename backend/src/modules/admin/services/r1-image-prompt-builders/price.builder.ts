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

  // Priorité 1 : quality_tiers explicites
  // Priorité 2 : cost_range.note (contient souvent les tiers en texte)
  // Fallback : selection.criteria
  let tiersHint = 'éco, standard, premium';
  const tiers = rag?.selection?.quality_tiers ?? [];
  if (tiers.length > 0) {
    tiersHint = tiers
      .map((t) => `${t.tier}${t.price_range ? ` (${t.price_range})` : ''}`)
      .join(', ');
    fieldsUsed.push('selection.quality_tiers');
    score += 2;
  } else if (range?.note) {
    tiersHint = range.note.length > 80 ? range.note.slice(0, 80) : range.note;
    fieldsUsed.push('selection.cost_range.note');
    score++;
  } else {
    const criteria = rag?.selection?.criteria ?? [];
    if (criteria.length >= 2) {
      tiersHint = criteria
        .slice(0, 3)
        .map((c) => c.toLowerCase())
        .join(', ');
      fieldsUsed.push('selection.criteria');
      score++;
    }
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
