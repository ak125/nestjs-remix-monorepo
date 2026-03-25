import {
  type RagData,
  type BuilderResult,
  NEG_SOCIAL,
  resolveAmbiance,
} from './types';

/**
 * OG — Social preview optimisé (1200x630).
 *
 * [A] social / preview
 * [B] fond sombre dégradé adapté à la famille (pas uniforme)
 * [C] pièce neuve centrée, angle accrocheur
 * [D] éclairage dramatique latéral, halo subtil
 * [E] centré avec espace négatif pour preview text overlay (réseaux sociaux)
 * [F] no text, no logo, no watermark, no clutter
 * [G] accroche visuelle, CTR social, branding qualité
 *
 * RAG : domain.role, completeness_profile/category, key_visual_features
 */
export function buildOgPrompt(
  pgName: string,
  rag: RagData | null,
): BuilderResult {
  const fieldsUsed: string[] = [];
  let score = 0;
  const amb = resolveAmbiance(rag);

  if (rag?.completeness_profile || rag?.category) {
    fieldsUsed.push(
      rag?.completeness_profile ? 'completeness_profile' : 'category',
    );
    score++;
  }

  let roleHint = '';
  if (rag?.domain?.role) {
    const short =
      rag.domain.role.length > 80
        ? rag.domain.role.slice(0, 80)
        : rag.domain.role;
    roleHint = ` Fonction : ${short.toLowerCase()}.`;
    fieldsUsed.push('domain.role');
    score++;
  }

  // Visual features pour un rendu plus précis de la pièce
  let visualHint = '';
  if (rag?.key_visual_features?.identifying_shapes?.length) {
    visualHint = ` Forme caractéristique : ${rag.key_visual_features.identifying_shapes[0]}.`;
    fieldsUsed.push('key_visual_features');
    score++;
  }

  // Texte intégré : nom + accroche conversion
  const titleText = pgName.toUpperCase();
  let accroche = 'Pièces auto en stock';
  const minPrice = rag?.selection?.cost_range?.min;
  if (minPrice != null) {
    accroche = `Dès ${minPrice}€ — Livraison 24h`;
    fieldsUsed.push('selection.cost_range');
    score++;
  }

  const prompt = [
    `Photo produit automobile pour partage social, ratio 1200x630.`,
    `Fond : dégradé sombre, ${amb.accentTone} vers noir, ambiance ${amb.intention.split(',')[0]}.`,
    `${pgName} neuf centré, légèrement en dessous du centre vertical (rule of thirds).`,
    `Éclairage dramatique latéral gauche, rim light subtil à droite, halo ${amb.accentTone} derrière la pièce.`,
    `${visualHint}${roleHint}`,
    `Ultra réaliste, haute résolution, profondeur de champ très faible.`,
    `TEXTE DANS L'IMAGE : En bas centré, "${titleText}" en typographie blanche majuscule grande, moderne, sans serif. Dessous : "${accroche}" en plus petit, blanc légèrement transparent. Pas de logo, pas de watermark.`,
    `Format 1200:630.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    prompt,
    neg: NEG_SOCIAL,
    alt: `${pgName} — AutoMecanik`,
    caption: null,
    ragFieldsUsed: fieldsUsed,
    richnessScore: score,
  };
}
