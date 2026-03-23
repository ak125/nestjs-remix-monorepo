import { type RagData, type BuilderResult, NEG_PHOTO } from './types';

/**
 * OG — Social preview.
 * Branding léger, lisibilité mobile, ratio social dédié.
 * RAG : domain.role, category
 */
export function buildOgPrompt(
  pgName: string,
  rag: RagData | null,
): BuilderResult {
  const fieldsUsed: string[] = [];
  let score = 0;

  let categoryHint = '';
  if (rag?.category) {
    categoryHint = `, ambiance ${rag.category.toLowerCase()}`;
    fieldsUsed.push('category');
    score++;
  }

  let roleHint = '';
  if (rag?.domain?.role) {
    const short =
      rag.domain.role.length > 50
        ? rag.domain.role.slice(0, 50)
        : rag.domain.role;
    roleHint = `. Fonction : ${short.toLowerCase()}.`;
    fieldsUsed.push('domain.role');
    score++;
  }

  const prompt = `Image partage social 1200x630. Fond sombre dégradé automobile${categoryHint}. ${pgName} neuf centré, éclairage dramatique latéral. Pas de texte${roleHint} Format 1200:630.`;

  return {
    prompt,
    neg: NEG_PHOTO,
    alt: `${pgName} — AutoMecanik`,
    caption: null,
    ragFieldsUsed: fieldsUsed,
    richnessScore: score,
  };
}
