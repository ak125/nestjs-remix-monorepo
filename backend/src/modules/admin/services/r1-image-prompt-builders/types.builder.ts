import { type RagData, type BuilderResult, NEG_SCHEMA } from './types';

/**
 * TYPES — Schéma comparatif des variantes.
 * Clarification pédagogique, différences physiques.
 * RAG : selection.criteria[], domain.confusion_with[]
 */
export function buildTypesPrompt(
  pgName: string,
  rag: RagData | null,
): BuilderResult {
  const fieldsUsed: string[] = [];
  let score = 0;
  const n = pgName.toLowerCase();

  let variantsHint = '';
  const variants = rag?.variants ?? [];
  if (variants.length > 0) {
    const names = variants
      .slice(0, 3)
      .map((v) => v.name)
      .join(', ');
    const diffs = variants
      .flatMap((v) => v.visual_differences ?? [])
      .slice(0, 3)
      .join(', ');
    variantsHint = ` Types principaux : ${names}.${diffs ? ` Différences visuelles : ${diffs}.` : ''}`;
    fieldsUsed.push('variants');
    score += 2;
  } else {
    const criteria = rag?.selection?.criteria ?? [];
    if (criteria.length > 0) {
      const top = criteria
        .slice(0, 3)
        .map((c) => c.toLowerCase())
        .join(', ');
      variantsHint = ` Variantes distinguées par : ${top}.`;
      fieldsUsed.push('selection.criteria');
      score++;
    }
  }

  let confusionHint = '';
  const confusions = rag?.domain?.confusion_with ?? [];
  if (confusions.length > 0) {
    const names = confusions.slice(0, 2).map((c) => c.term.replace(/-/g, ' '));
    confusionHint = ` Ne pas confondre avec : ${names.join(', ')}.`;
    fieldsUsed.push('domain.confusion_with');
    score++;
  }

  const prompt = `Schéma technique comparatif, fond blanc, style flat design vectoriel. Les différents types de ${n} avec flèches sur les différences physiques. Légendes et cotes dimensionnelles. Rendu net sans ombre.${variantsHint}${confusionHint} Format 4:3.`;

  return {
    prompt,
    neg: NEG_SCHEMA,
    alt: `Types de ${n} — schéma comparatif`,
    caption: `Comment distinguer les types de ${n}`,
    ragFieldsUsed: fieldsUsed,
    richnessScore: score,
  };
}
