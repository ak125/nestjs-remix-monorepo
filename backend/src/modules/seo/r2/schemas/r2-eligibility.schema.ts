/**
 * ADR-066 — R2 Eligibility schemas (Zod)
 *
 * Verdict du Gate 1 du pipeline R2 v2. Calculé AVANT compose / LLM / embeddings.
 *
 * Cf MEMORY feedback_seo_eligibility_gate_before_generation.
 */

import { z } from 'zod';

// ── Subscores (4 composantes du score composite) ──────────────────────────────

/**
 * Échelle unique [0, 100] pour tous les subscores (cf r2-eligibility.constants.ts).
 * JAMAIS [0, 1] — single source of truth.
 */
const SUBSCORE = z.number().min(0).max(100);

export const R2EligibilitySubscoresSchema = z.object({
  motor: SUBSCORE, // motorDeltaScore : delta mécanique
  compat: SUBSCORE, // compatibilityDeltaScore : delta catalogue
  commercial: SUBSCORE, // commercialDistinctivenessScore : Δfamilles + Δ OEM + ...
  crawl: SUBSCORE, // crawlValueScore : log(productCount) × searchVolume
});

export type R2EligibilitySubscores = z.infer<
  typeof R2EligibilitySubscoresSchema
>;

// ── Verdict (decision tree output) ─────────────────────────────────────────────
//
// ADR-067 (2026-05-15) : SUPPRESSED automatique INTERDIT.
// ADR-068 (2026-05-16) : renommage 'review' → 'review_required' (cohérence canon
// avec R2DecisionV2Enum.review_required). REJECT scope strict — 4 raisons UNIQUES
// (productCount_under_2 / data_invalid / url_impossible / compatibility_absent).
// Voir MEMORY feedback_no_auto_page_suppression_ever (canon-strict, 4 interdictions auto).
//
// Le pipeline ne peut émettre que 3 verdicts : eligible | review_required | reject.
// SUPPRESSED reste un statut DB mais devient manual-only (admin override UI).
export const R2EligibilityVerdictEnum = z.enum([
  'eligible',
  'review_required',
  'reject',
]);

export type R2EligibilityVerdictKind = z.infer<typeof R2EligibilityVerdictEnum>;

/**
 * ADR-068 (2026-05-16) — REJECT scope strict : 4 raisons UNIQUES.
 * Doit être aligné avec Rego policy `r2-content-write.rego` :
 *   valid_reject_reasons := {productCount_under_2, data_invalid, url_impossible, compatibility_absent}
 *
 * PAS pour similarité forte (catalog overlap, semantic cosine) → verdict 'review_required'.
 */
export const R2RejectReasonEnum = z.enum([
  'productCount_under_2',
  'data_invalid',
  'url_impossible',
  'compatibility_absent',
]);

export type R2RejectReasonKind = z.infer<typeof R2RejectReasonEnum>;

/**
 * Manual canonical target for admin SUPPRESSED override (ADR-067).
 * Le pipeline ne produit jamais cette valeur — admin UI uniquement
 * (via review queue flip). Conservé schema-side pour le path manual
 * et l'audit-trail des décisions humaines.
 */
export const ManualCanonicalTargetSchema = z.object({
  typeId: z.number().int().positive(),
  pgId: z.number().int().positive(),
});

export type ManualCanonicalTarget = z.infer<typeof ManualCanonicalTargetSchema>;

// ── Full verdict (consumed by R2EligibilityService) ────────────────────────────

export const R2EligibilityVerdictSchema = z.object({
  eligible: z.boolean(),
  eligibilityScore: z.number().min(0).max(100), // composite weighted
  subscores: R2EligibilitySubscoresSchema,
  verdict: R2EligibilityVerdictEnum,
  // ADR-068 : si verdict='reject', rejectReason DOIT être l'une des 4 raisons strict.
  // Undefined pour 'eligible' / 'review_required'.
  rejectReason: R2RejectReasonEnum.optional(),
  reason: z.string(),
});

export type R2EligibilityVerdict = z.infer<typeof R2EligibilityVerdictSchema>;

// ── Verdict ↔ DB row (audit trail in __seo_r2_eligibility_log) ─────────────────

export const R2EligibilityLogRowSchema = z.object({
  id: z.number().int().positive().optional(), // auto-increment
  pgId: z.number().int().positive(),
  typeId: z.number().int().positive(),
  attempt: z.number().int().min(1).default(1),
  eligibilityScore: z.number().min(0).max(100),
  subscores: R2EligibilitySubscoresSchema,
  verdict: R2EligibilityVerdictEnum,
  // ADR-067 : pipeline n'émet jamais SUPPRESSED. Kept nullable for legacy rows
  // and for the manual admin path (review queue → suppressed flip).
  manualCanonicalTarget: z.number().int().positive().nullable().optional(),
  reason: z.string().nullable().optional(),
  evaluatedAt: z.date().optional(), // server default NOW()
});

export type R2EligibilityLogRow = z.infer<typeof R2EligibilityLogRowSchema>;
