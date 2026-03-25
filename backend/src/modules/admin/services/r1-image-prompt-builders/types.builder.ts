import { type RagData, type BuilderResult, NEG_PHOTO } from './types';

/**
 * TYPES — Comparatif réaliste des variantes.
 *
 * [A] comparatif / catalogue
 * [B] fond blanc pur ou gris très clair, surface propre
 * [C] variantes côte à côte, même échelle, même angle
 * [D] éclairage studio flat uniforme, pas d'ombres dures
 * [E] alignement horizontal, espacement régulier, même taille
 * [F] no text labels, no arrows, no dimensions (IA ne sait pas)
 * [G] clarté, compréhension immédiate des différences visuelles
 *
 * RAG : variants[], key_visual_features, selection.criteria[], domain.confusion_with[]
 */
export function buildTypesPrompt(
  pgName: string,
  rag: RagData | null,
): BuilderResult {
  const fieldsUsed: string[] = [];
  let score = 0;
  const n = pgName.toLowerCase();
  // Note: TYPES always uses white background, not family ambiance

  // Variantes explicites du RAG
  let variantsDesc = '';
  const variants = rag?.variants ?? [];
  if (variants.length > 0) {
    const items = variants.slice(0, 3).map((v) => {
      const shapes = v.visual_differences?.slice(0, 2).join(', ') ?? '';
      return shapes ? `${v.name} (${shapes})` : v.name;
    });
    variantsDesc = ` Montrer côte à côte : ${items.join(' — ')}.`;
    fieldsUsed.push('variants');
    score += 2;
  } else {
    const criteria = rag?.selection?.criteria ?? [];
    if (criteria.length > 0) {
      variantsDesc = ` Variantes distinguées par : ${criteria
        .slice(0, 3)
        .map((c) => c.toLowerCase())
        .join(', ')}.`;
      fieldsUsed.push('selection.criteria');
      score++;
    }
  }

  // Key visual features pour guider l'IA sur les formes
  let visualHint = '';
  if (rag?.key_visual_features?.identifying_shapes?.length) {
    visualHint = ` Formes distinctives : ${rag.key_visual_features.identifying_shapes.slice(0, 3).join(', ')}.`;
    fieldsUsed.push('key_visual_features');
    score++;
  }

  // Confusion pour contexte
  let confusionHint = '';
  const confusions = rag?.domain?.confusion_with ?? [];
  if (confusions.length > 0) {
    confusionHint = ` Ne montrer que des ${n}, pas de ${confusions[0].term.replace(/-/g, ' ')}.`;
    fieldsUsed.push('domain.confusion_with');
    score++;
  }

  const variantCount = Math.min(Math.max(variants.length, 2), 3);

  // Labels texte sous chaque variante
  let labelsInstruction = '';
  if (variants.length > 0) {
    const labels = variants.slice(0, 3).map((v) => {
      // Extraire un nom court (premier mot significatif ou alias court)
      const shortName = v.aliases?.[0] ?? v.name.split('(')[0].trim();
      return `"${shortName}"`;
    });
    labelsInstruction = ` TEXTE DANS L'IMAGE : Sous chaque variante, son nom en texte blanc petit sur bandeau semi-transparent noir : ${labels.join(' / ')}. Police sans serif, moderne, même style pour chaque label.`;
  }

  const prompt = [
    `Photo catalogue comparative, ${variantCount} variantes de ${n} alignées côte à côte sur fond blanc pur.`,
    `Chaque variante à la même échelle, même angle trois-quarts, espacement régulier.`,
    `Ultra réaliste, éclairage studio flat uniforme, pas d'ombres portées dures.`,
    `${variantsDesc}${visualHint}${confusionHint}`,
    `Haute résolution, chaque pièce nettement distincte visuellement.${labelsInstruction}`,
    `Format 4:3.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    prompt,
    neg:
      NEG_PHOTO +
      ', text, labels, arrows, annotations, dimensions, numbers, letters',
    alt: `Types de ${n} — comparatif visuel`,
    caption: `Comment distinguer les types de ${n}`,
    ragFieldsUsed: fieldsUsed,
    richnessScore: score,
  };
}
