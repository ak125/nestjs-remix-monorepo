import { type RagData, type BuilderResult, NEG_PHOTO } from './types';
import { scoreWearMacro } from './in-article-selection';

/**
 * WEAR_MACRO — Photo macro d'usure réaliste (salvage R3 buildSymptomPrompt).
 *
 * [A] diagnostic / symptôme visuel
 * [B] établi d'atelier neutre, environnement réparation
 * [C] pièce usée/endommagée, signes d'usure du RAG visibles
 * [D] lumière naturelle d'atelier, macro, faible profondeur de champ
 * [E] gros plan sur la zone d'usure, pièce identifiable
 * [F] no hands, no text, no logo
 * [G] reconnaissance du symptôme, urgence de remplacement
 *
 * RAG : maintenance.wear_signs[], diagnostic.symptoms[] (sévérité sécurité)
 */
export function buildWearMacroPrompt(
  pgName: string,
  rag: RagData | null,
): BuilderResult {
  const fieldsUsed: string[] = [];
  const n = pgName.toLowerCase();

  const wearSigns = rag?.maintenance?.wear_signs ?? [];
  if (wearSigns.length) fieldsUsed.push('maintenance.wear_signs');

  const sign1 = wearSigns[0] ?? 'usure visible';
  const sign2 = wearSigns[1] ?? 'dégradation de surface';

  const symptoms = rag?.diagnostic?.symptoms ?? [];
  if (symptoms.length) fieldsUsed.push('diagnostic.symptoms');

  const criticalSymptom = symptoms.find((s) => s.severity === 'securite');
  const symptomHint = criticalSymptom
    ? ` Symptôme critique associé : ${criticalSymptom.label.slice(0, 60)}.`
    : '';

  const prompt = [
    `Photo macro de réparation automobile, objectif macro, dégâts d'usure réalistes, lumière naturelle d'atelier, faible profondeur de champ.`,
    `${pgName} usé et endommagé montrant « ${sign1} » et « ${sign2} », état réaliste posé sur un établi.`,
    `${symptomHint}`,
    `Fond d'atelier neutre, aucune main humaine visible, pièce clairement identifiable.`,
    `Ultra réaliste, haute résolution.`,
    `Format 16:9.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    prompt,
    neg: NEG_PHOTO + ', brand new part, clean part, pristine condition',
    alt: `Symptômes usure ${n} : ${sign1.slice(0, 40)}`,
    caption: `${pgName} usé — ${sign1.slice(0, 60)}`,
    ragFieldsUsed: fieldsUsed,
    richnessScore: scoreWearMacro(rag),
  };
}
