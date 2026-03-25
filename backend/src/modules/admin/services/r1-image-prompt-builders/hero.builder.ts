import {
  type RagData,
  type BuilderResult,
  NEG_PHOTO,
  resolveAmbiance,
} from './types';

/**
 * HERO — Photo produit OEM premium contextualisée.
 *
 * [A] catalogue / hero
 * [B] fond adapté par famille (huile dorée / métal froid / etc.)
 * [C] pièce neuve, angle 3/4, détails techniques visibles
 * [D] studio professionnel, température adaptée à la famille
 * [E] centré, profondeur de champ faible, espace négatif pour le header
 * [F] no text, no logo, no wrong parts
 * [G] confiance, qualité OEM, expertise automobile
 *
 * RAG : domain.role, selection.criteria[0..2], completeness_profile/category
 */
export function buildHeroPrompt(
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
    const role =
      rag.domain.role.length > 80
        ? rag.domain.role.slice(0, 80)
        : rag.domain.role;
    roleHint = ` Fonction : ${role.toLowerCase()}.`;
    fieldsUsed.push('domain.role');
    score++;
  }

  let detailsHint = '';
  if (rag?.key_visual_features?.identifying_shapes?.length) {
    detailsHint = ` Détails visibles : ${rag.key_visual_features.identifying_shapes.slice(0, 2).join(', ')}.`;
    fieldsUsed.push('key_visual_features');
    score++;
  } else {
    const criteria = rag?.selection?.criteria?.slice(0, 2) ?? [];
    if (criteria.length > 0) {
      detailsHint = ` Montrant : ${criteria.join(', ').toLowerCase()}.`;
      fieldsUsed.push('selection.criteria');
      score++;
    }
  }

  // Texte intégré dans l'image
  const titleText = pgName.toUpperCase();
  let baselineText = '';
  if (rag?.domain?.role) {
    // Extraire une baseline courte (max 50 chars)
    const words = rag.domain.role.split(' ').slice(0, 6).join(' ');
    baselineText = words.length > 50 ? words.slice(0, 47) + '...' : words;
  }

  const prompt = [
    `Photo produit automobile premium, ultra réaliste, haute résolution.`,
    `${pgName} neuf, angle trois-quarts, légère rotation pour montrer le volume.`,
    `Fond : ${amb.background}.`,
    `Éclairage : ${amb.lighting}.`,
    `Profondeur de champ faible, mise au point sur la pièce, arrière-plan doux.`,
    `${amb.technicalDetails} clairement visibles.`,
    `${detailsHint}${roleHint}`,
    `Intention : ${amb.intention}.`,
    `TEXTE DANS L'IMAGE : En bas centré, "${titleText}" en typographie blanche majuscule, moderne, sans serif, taille grande et lisible.${baselineText ? ` Sous le titre : "${baselineText}" en plus petit, même police, blanc légèrement transparent.` : ''}`,
    `Format 16:9.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    prompt,
    neg: NEG_PHOTO,
    alt: `${pgName} — pièce automobile neuve`,
    caption: `${pgName} — vue détaillée`,
    ragFieldsUsed: fieldsUsed,
    richnessScore: score,
  };
}
