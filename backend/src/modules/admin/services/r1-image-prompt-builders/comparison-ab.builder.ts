import { type RagData, type BuilderResult, NEG_SCHEMA } from './types';
import { scoreComparisonAb } from './in-article-selection';

/**
 * COMPARISON_AB — Schéma comparatif A vs B (salvage R3 buildComparisonPrompt).
 *
 * Côté A vs côté B résolu depuis domain.confusion_with (gamme vs terme
 * confondu), sinon variantes extraites de selection.criteria, sinon
 * « Type A » / « Type B » générique.
 *
 * [A] schéma technique / pédagogie anti-confusion
 * [B] fond blanc pur, style dessin d'ingénierie
 * [C] deux variantes côte à côte, différences fléchées
 * [D] illustration technique propre, pas de photoréalisme
 * [E] side-by-side symétrique, annotations en français
 * [F] no photo, no studio lighting, no logo
 * [G] choix éclairé, lever la confusion entre deux pièces proches
 *
 * RAG : domain.confusion_with[], selection.criteria[]
 */
export function buildComparisonAbPrompt(
  pgName: string,
  rag: RagData | null,
): BuilderResult {
  const fieldsUsed: string[] = [];

  const confusion = rag?.domain?.confusion_with ?? [];
  if (confusion.length) fieldsUsed.push('domain.confusion_with');

  const criteria = rag?.selection?.criteria ?? [];
  if (criteria.length) fieldsUsed.push('selection.criteria');

  // Résolution des deux côtés du comparatif
  let variantA = 'Type A';
  let variantB = 'Type B';
  if (confusion.length > 0) {
    variantA = pgName;
    variantB = confusion[0].term.replace(/-/g, ' ');
  } else if (criteria.length >= 2) {
    // Tente d'extraire des variantes type depuis le texte des critères.
    // NOTE : la version legacy R3 utilisait /:\s*(.+?)(?:,|\.|$)/ (non-greedy,
    // stoppait à la 1ère virgule) → la capture ne contenait jamais de virgule
    // et ce fallback était du code mort. Corrigé : capture jusqu'au point/fin.
    const typeMatch = criteria
      .find((c) => c.toLowerCase().includes('type'))
      ?.match(/:\s*([^.]+)/);
    if (typeMatch) {
      const types = typeMatch[1]
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (types.length >= 2) {
        variantA = types[0];
        variantB = types[1];
      }
    }
  }

  const criteriaLabels = criteria
    .slice(0, 3)
    .map((c) => {
      const colonIdx = c.indexOf(':');
      return colonIdx > 0 ? c.slice(0, colonIdx).trim() : c.slice(0, 30);
    })
    .join(', ');

  const prompt = [
    `Illustration technique, fond blanc pur, schéma précis et annoté, style dessin d'ingénierie automobile, professionnel, sans photoréalisme.`,
    `Schéma comparatif côte à côte de « ${variantA} » vs « ${variantB} »${pgName !== variantA ? ` (${pgName})` : ''}.`,
    criteriaLabels
      ? `Flèches annotées montrant les différences clés : ${criteriaLabels}.`
      : '',
    `Vue en coupe ou écorché si pertinent, traits propres, annotations en français.`,
    `Format 4:3.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    prompt,
    neg: NEG_SCHEMA,
    alt: `Schéma comparatif ${pgName.toLowerCase()}`,
    caption: `${variantA} vs ${variantB} — schéma comparatif`,
    ragFieldsUsed: fieldsUsed,
    richnessScore: scoreComparisonAb(rag),
  };
}
