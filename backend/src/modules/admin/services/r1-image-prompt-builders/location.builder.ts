import { type BuilderResult, NEG_PHOTO } from './types';
import type { RagData } from './types';

/**
 * LOCATION — Photo réaliste de la pièce en contexte véhicule.
 *
 * IMPORTANT : Les vues éclatées techniques avec légendes textuelles
 * sont mal générées par l'IA. Ce builder génère une photo réaliste
 * du compartiment moteur/véhicule avec la pièce mise en évidence.
 *
 * [A] technique / contextuelle
 * [B] compartiment moteur ou zone véhicule réelle
 * [C] pièce identifiable par contraste/luminosité dans son environnement
 * [D] éclairage naturel atelier ou compartiment moteur
 * [E] vue plongeante ou latérale selon l'accès
 * [F] no text, no arrows, no labels, no disassembled parts
 * [G] localisation, compréhension, repérage de la pièce
 *
 * RAG : location_on_vehicle{}, installation.*, key_visual_features
 */
export function buildLocationPrompt(
  pgName: string,
  rag: RagData | null,
): BuilderResult {
  const fieldsUsed: string[] = [];
  let score = 0;
  const n = pgName.toLowerCase();
  // Note: LOCATION uses realistic workshop lighting, not family ambiance

  // Localisation précise depuis le RAG
  let locationDesc = 'dans le compartiment moteur';
  const loc = rag?.location_on_vehicle;
  if (loc?.area) {
    locationDesc = `au niveau du ${loc.area}`;
    fieldsUsed.push('location_on_vehicle.area');
    score += 2;
  }

  // Angle de vue déduit de l'accès
  let viewAngle = 'vue plongeante dans le compartiment moteur';
  if (loc?.access) {
    if (loc.access.includes('dessous')) {
      viewAngle = 'vue depuis le dessous du véhicule, sur pont';
    } else if (loc.access.includes('dessus') || loc.access.includes('capot')) {
      viewAngle = 'vue plongeante capot ouvert';
    } else if (loc.access.includes('latéral') || loc.access.includes('côté')) {
      viewAngle = 'vue latérale du compartiment moteur';
    }
    fieldsUsed.push('location_on_vehicle.access');
    score++;
  }

  // Pièces adjacentes
  let adjacentHint = '';
  if (loc?.adjacent_parts && loc.adjacent_parts.length > 0) {
    adjacentHint = ` Pièces voisines visibles : ${loc.adjacent_parts.slice(0, 3).join(', ')}.`;
    fieldsUsed.push('location_on_vehicle.adjacent_parts');
    score++;
  }

  // Fallback installation si pas de location
  if (!loc?.area) {
    const steps = rag?.installation?.steps ?? [];
    if (steps.length > 0) {
      fieldsUsed.push('installation.steps');
      score++;
    }
    const tools = rag?.installation?.tools ?? [];
    if (tools.length > 0) {
      fieldsUsed.push('installation.tools');
      score++;
    }
  }

  // Label texte avec flèche
  let adjacentLabels = '';
  if (loc?.adjacent_parts && loc.adjacent_parts.length > 0) {
    const labels = loc.adjacent_parts
      .slice(0, 2)
      .map((p) => `"${p}"`)
      .join(', ');
    adjacentLabels = ` Pièces adjacentes étiquetées en texte gris clair plus petit : ${labels}.`;
  }

  const prompt = [
    `Photo réaliste automobile, ${viewAngle}.`,
    `Le ${pgName} est visible ${locationDesc}, légèrement mis en évidence par un contraste lumineux plus fort sur la pièce.`,
    `Environnement réaliste : moteur, durites, câbles, autres composants visibles autour.${adjacentHint}`,
    `Éclairage : lumière d'atelier réaliste, LED blanche, quelques ombres naturelles dans le compartiment moteur.`,
    `La pièce se distingue clairement de son environnement sans être détourée ni flottante.`,
    `Ultra réaliste, haute résolution.`,
    `TEXTE DANS L'IMAGE : Une flèche blanche fine pointe vers le ${n}. À côté de la flèche : "${pgName}" en texte blanc petit sur fond semi-transparent noir, police sans serif moderne.${adjacentLabels}`,
    `Intention : l'utilisateur comprend immédiatement où se trouve le ${n} sur son véhicule.`,
    `Format 4:3.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    prompt,
    neg:
      NEG_PHOTO +
      ', text, arrows, labels, numbers, exploded view, disassembled, floating part, white background, isolated part',
    alt: `Emplacement du ${n} sur le véhicule`,
    caption: `Où se trouve le ${n} sur le véhicule`,
    ragFieldsUsed: fieldsUsed,
    richnessScore: score,
  };
}
