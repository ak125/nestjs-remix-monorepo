import { type RagData, type BuilderResult, NEG_SCHEMA } from './types';
import { scoreExplodedView } from './in-article-selection';

/**
 * EXPLODED_VIEW — Vue éclatée montage/fixation (salvage R3 buildFixationPrompt).
 *
 * [A] schéma technique / manuel d'atelier
 * [B] fond blanc pur, style manuel de service
 * [C] pièce en vue éclatée, points de fixation numérotés
 * [D] illustration technique, repères numérotés, flèches de couple
 * [E] composition manuel d'atelier, guide d'orientation
 * [F] no photo, no hands, no logo
 * [G] confiance au montage, anticipation des outils et étapes
 *
 * RAG : installation.tools[], installation.steps[], installation.prerequisite
 */
export function buildExplodedViewPrompt(
  pgName: string,
  rag: RagData | null,
): BuilderResult {
  const fieldsUsed: string[] = [];
  const n = pgName.toLowerCase();

  const tools = rag?.installation?.tools ?? [];
  if (tools.length) fieldsUsed.push('installation.tools');

  const steps = rag?.installation?.steps ?? [];
  if (steps.length) fieldsUsed.push('installation.steps');

  const prerequisite = rag?.installation?.prerequisite ?? '';
  if (prerequisite) fieldsUsed.push('installation.prerequisite');

  const tool1 = tools[0] ?? 'clé dynamométrique';
  const tool2 = tools[1] ?? 'clé à douille';

  const firstSteps = steps
    .slice(0, 3)
    .map((s) => s.slice(0, 40))
    .join(', ');

  const prompt = [
    `Schéma technique d'atelier automobile, style vue éclatée, fond blanc pur, repères numérotés, illustration professionnelle de manuel de service.`,
    `Vue éclatée du ${pgName} : points de montage et de fixation.`,
    `Montre ${tool1} et ${tool2} en usage, positions de vis numérotées, flèches d'indication de couple.`,
    firstSteps ? `Étapes clés illustrées : ${firstSteps}.` : '',
    prerequisite ? `Préparation : ${prerequisite.slice(0, 60)}.` : '',
    `Guide d'orientation du composant, annotations en français, style manuel d'atelier.`,
    `Format 4:3.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    prompt,
    neg: NEG_SCHEMA + ', assembled part, single intact part',
    alt: `Schéma démontage ${n}`,
    caption: `${pgName} — schéma de montage et fixation`,
    ragFieldsUsed: fieldsUsed,
    richnessScore: scoreExplodedView(rag),
  };
}
