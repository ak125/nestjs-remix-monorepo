import { type RagData, type BuilderResult, NEG_PHOTO } from './types';

/**
 * HERO — Photo produit contextualisée.
 * Cadrage page, confiance, OEM / équipementier.
 * RAG : domain.role + selection.criteria[0..2]
 */
export function buildHeroPrompt(
  pgName: string,
  rag: RagData | null,
): BuilderResult {
  const fieldsUsed: string[] = [];
  let score = 0;

  let roleHint = '';
  if (rag?.domain?.role) {
    const role =
      rag.domain.role.length > 80
        ? rag.domain.role.slice(0, 80)
        : rag.domain.role;
    roleHint = ` Pièce servant à ${role.toLowerCase()}.`;
    fieldsUsed.push('domain.role');
    score++;
  }

  let criteriaHint = '';
  const criteria = rag?.selection?.criteria?.slice(0, 2) ?? [];
  if (criteria.length > 0) {
    criteriaHint = ` Montrant ${criteria.join(' et ').toLowerCase()}.`;
    fieldsUsed.push('selection.criteria');
    score++;
  }

  const prompt = `Photo produit sur fond neutre. ${pgName} neuf, éclairage studio professionnel. Pièce automobile haute résolution, détail des points de fixation et connectique.${roleHint}${criteriaHint} Format 16:9.`;

  return {
    prompt,
    neg: NEG_PHOTO,
    alt: `${pgName} — photo produit`,
    caption: `${pgName} — vue détaillée`,
    ragFieldsUsed: fieldsUsed,
    richnessScore: score,
  };
}
