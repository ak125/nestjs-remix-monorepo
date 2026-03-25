import {
  type RagData,
  type BuilderResult,
  NEG_PHOTO,
  resolveAmbiance,
} from './types';

/**
 * PRICE — Comparatif qualité/gamme (photos réalistes, PAS infographie).
 *
 * IMPORTANT : Les générateurs d'images IA ne savent PAS faire des infographies
 * avec texte/chiffres lisibles. Ce builder génère donc un comparatif visuel
 * de pièces par niveau de qualité (budget → premium → OEM).
 *
 * [A] comparatif qualité
 * [B] fond neutre gradué (du plus clair à gauche au plus sombre à droite)
 * [C] 3 pièces du même type, qualité croissante gauche→droite
 * [D] éclairage studio progressif, plus dramatique vers le premium
 * [E] alignement horizontal, 3 pièces, progression visuelle
 * [F] no text, no prices, no labels
 * [G] perception de valeur, montée en gamme, choix éclairé
 *
 * RAG : selection.quality_tiers[], selection.cost_range, selection.criteria[]
 */
export function buildPricePrompt(
  pgName: string,
  rag: RagData | null,
): BuilderResult {
  const fieldsUsed: string[] = [];
  let score = 0;
  const n = pgName.toLowerCase();
  const amb = resolveAmbiance(rag);

  // Quality tiers pour guider la progression visuelle
  let qualityDesc = 'budget, standard, premium';
  const tiers = rag?.selection?.quality_tiers ?? [];
  if (tiers.length > 0) {
    qualityDesc = tiers.map((t) => t.tier.toLowerCase()).join(', ');
    fieldsUsed.push('selection.quality_tiers');
    score += 2;
  }

  // Cost range tracked for scoring
  const range = rag?.selection?.cost_range;
  if (range?.min != null && range?.max != null) {
    fieldsUsed.push('selection.cost_range');
    score++;
  }

  // Visual features pour différencier les qualités
  let visualDiff = '';
  if (rag?.key_visual_features?.identifying_materials?.length) {
    visualDiff = ` Matériaux visiblement différents : ${rag.key_visual_features.identifying_materials.slice(0, 2).join(' vs ')}.`;
    fieldsUsed.push('key_visual_features');
    score++;
  }

  const tierCount = Math.min(Math.max(tiers.length, 3), 3);

  // Labels texte sous chaque pièce avec tier + prix
  let priceLabels = '';
  if (tiers.length > 0) {
    const labels = tiers.slice(0, 3).map((t) => {
      const price = t.price_range ? ` — ${t.price_range}` : '';
      return `"${t.tier}${price}"`;
    });
    priceLabels = ` TEXTE DANS L'IMAGE : Sous chaque pièce, un label avec le niveau de gamme et la fourchette de prix : ${labels.join(' / ')}. Police sans serif, couleur adaptée (gris clair pour éco, blanc pour standard, doré pour premium). Taille petite mais lisible.`;
  } else {
    priceLabels = ` TEXTE DANS L'IMAGE : Sous chaque pièce : "Éco" / "Standard" / "Premium" en texte blanc petit, police sans serif moderne.`;
  }

  const prompt = [
    `Photo comparative de ${tierCount} ${n} de qualité croissante, alignés de gauche à droite.`,
    `Fond : dégradé subtil du gris clair (gauche, entrée de gamme) vers ${amb.accentTone} (droite, premium).`,
    `À gauche : pièce basique, finition standard. Au centre : pièce qualité intermédiaire. À droite : pièce premium, finition impeccable, détails soignés.`,
    `Même angle, même échelle, progression visible de la qualité de fabrication.${visualDiff}`,
    `Éclairage : ${amb.lighting}. Plus contrasté et dramatique sur la pièce premium à droite.`,
    `Ultra réaliste, haute résolution.${priceLabels}`,
    `Intention : montrer visuellement la différence de qualité entre ${qualityDesc}.`,
    `Format 4:3.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    prompt,
    neg:
      NEG_PHOTO +
      ', text, numbers, prices, currency, labels, infographic, chart, bar chart, graph',
    alt: `${pgName} — comparatif qualité par gamme`,
    caption: `Différences de qualité ${n}`,
    ragFieldsUsed: fieldsUsed,
    richnessScore: score,
  };
}
