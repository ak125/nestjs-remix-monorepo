/**
 * Evidence Grading Constants — Phase 2 RAG Advanced (P2.4)
 *
 * Defines grading thresholds, bucket-to-section mapping, and minimum
 * evidence requirements per section.
 *
 * @see .spec/00-canon/phase2-canon.md v1.1.0 — P2.4 Exploitation RAG avancee
 */

import type { EvidenceGrade } from '../workers/types/content-refresh.types';

// ── Version ──

export const EVIDENCE_GRADING_VERSION = '1.0.0';

// ── Grading Thresholds ──

/**
 * Grade an evidence item based on truth_level and purity_score.
 * Higher = more trustworthy.
 */
export interface EvidenceGradeThreshold {
  grade: EvidenceGrade;
  /** Minimum truth level (L1=highest, L4=lowest) */
  maxTruthLevel: 'L1' | 'L2' | 'L3' | 'L4';
  /** Minimum purity score (0-100) */
  minPurityScore: number;
}

export const EVIDENCE_GRADE_THRESHOLDS: EvidenceGradeThreshold[] = [
  { grade: 'strong', maxTruthLevel: 'L1', minPurityScore: 85 },
  { grade: 'support-only', maxTruthLevel: 'L2', minPurityScore: 70 },
  { grade: 'weak-support', maxTruthLevel: 'L2', minPurityScore: 0 },
  // Anything else (L3, L4, low purity) = forbidden-for-claim
];

const TRUTH_LEVEL_RANK: Record<string, number> = {
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
};

/**
 * Compute the evidence grade from truth_level and purity_score.
 */
export function computeEvidenceGrade(
  truthLevel: string | undefined,
  purityScore: number | undefined,
): EvidenceGrade {
  const rank = TRUTH_LEVEL_RANK[truthLevel ?? 'L4'] ?? 4;
  const purity = purityScore ?? 0;

  if (rank <= 1 && purity >= 85) return 'strong';
  if (rank <= 2 && purity >= 70) return 'support-only';
  if (rank <= 2) return 'weak-support';
  return 'forbidden-for-claim';
}

// ── Bucket-to-Section Mapping ──

/**
 * Maps RagSafePack bucket names to the content sections they support.
 * Used by distillGraded() to assign targetSections to each evidence item.
 */
export const BUCKET_TO_SECTION_MAP: Record<string, string[]> = {
  definitions: ['intro_role', 'composition', 'confusions'],
  selection_checks: [
    'how_to_choose',
    'selection_criteria',
    'decision_tree',
    'anti_mistakes',
  ],
  trust_proofs: ['risk', 'timing', 'costs'],
  support_notes: ['use_cases', 'motorisations'],
  faq_pairs: ['faq'],
  procedures: ['how_to_choose', 'sign_test'],
  spec_refs: ['regles_metier', 'composition'],
  confusions: ['confusions'],
  anti_claims: ['anti_mistakes', 'perception'],
};

// ── Minimum Evidence per Section ──

/**
 * Minimum number of evidence items required per section for RAG sufficiency.
 * Sections not listed here have no minimum requirement.
 */
export const MIN_EVIDENCE_PER_SECTION: Record<string, number> = {
  intro_role: 1,
  how_to_choose: 1,
  selection_criteria: 1,
  risk: 1,
  costs: 1,
  faq: 1,
  composition: 0,
  confusions: 0,
  anti_mistakes: 0,
  decision_tree: 0,
  timing: 0,
  use_cases: 0,
  perception: 0,
  sign_test: 0,
  symptoms: 0,
  obd_codes: 0,
  motorisations: 0,
  regles_metier: 0,
  buy_args: 0,
  equipementiers: 0,
};
