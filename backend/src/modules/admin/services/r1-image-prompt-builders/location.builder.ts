import { type RagData, type BuilderResult, NEG_SCHEMA } from './types';

/**
 * LOCATION — Vue technique positionnée.
 * Pédagogie emplacement, contexte montage.
 * RAG : location_on_vehicle{}, installation.tools[], installation.steps[], installation.difficulty
 */
export function buildLocationPrompt(
  pgName: string,
  rag: RagData | null,
): BuilderResult {
  const fieldsUsed: string[] = [];
  let score = 0;
  const n = pgName.toLowerCase();

  // Priorité 1 : location_on_vehicle (v4 racine)
  let locationHint = '';
  const loc = rag?.location_on_vehicle;
  if (loc?.area) {
    locationHint = ` Situé : ${loc.area}.`;
    if (loc.access) locationHint += ` Accès : ${loc.access}.`;
    if (loc.adjacent_parts && loc.adjacent_parts.length > 0) {
      locationHint += ` Pièces adjacentes : ${loc.adjacent_parts.slice(0, 3).join(', ')}.`;
    }
    fieldsUsed.push('location_on_vehicle');
    score += 2;
  }

  // Fallback : installation context
  let contextHint = '';
  if (!loc?.area) {
    const steps = rag?.installation?.steps ?? [];
    if (steps.length > 0) {
      const first = steps[0].length > 60 ? steps[0].slice(0, 60) : steps[0];
      contextHint = ` Contexte montage : ${first.toLowerCase()}.`;
      fieldsUsed.push('installation.steps');
      score++;
    }
  }

  let toolsHint = '';
  const tools = rag?.installation?.tools ?? [];
  if (tools.length > 0) {
    toolsHint = ` Outils visibles : ${tools.slice(0, 3).join(', ')}.`;
    fieldsUsed.push('installation.tools');
    score++;
  }

  let difficultyHint = '';
  if (
    rag?.installation?.difficulty &&
    rag.installation.difficulty !== 'simple'
  ) {
    difficultyHint = ` Niveau : ${rag.installation.difficulty}.`;
    fieldsUsed.push('installation.difficulty');
    score++;
  }

  const prompt = `Vue éclatée technique, dessin technique automobile, fond blanc. ${pgName} à son emplacement sur le moteur ou le véhicule.${locationHint} Pièces adjacentes visibles avec flèches légendées et numéros de repère. Trait fin, rendu schématique.${contextHint}${toolsHint}${difficultyHint} Format 4:3.`;

  return {
    prompt,
    neg: NEG_SCHEMA,
    alt: `Emplacement du ${n} sur le véhicule`,
    caption: `Où se trouve le ${n} sur le véhicule`,
    ragFieldsUsed: fieldsUsed,
    richnessScore: score,
  };
}
