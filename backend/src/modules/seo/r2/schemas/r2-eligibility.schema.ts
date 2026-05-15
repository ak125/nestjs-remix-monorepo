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

export const R2EligibilityVerdictEnum = z.enum([
  'eligible',
  'suppressed',
  'reject',
]);

export type R2EligibilityVerdictKind = z.infer<typeof R2EligibilityVerdictEnum>;

/**
 * Sibling target for SUPPRESSED canonical decision (cf ADR-066 + MEMORY
 * feedback_seo_suppressed_canonical_decision).
 */
export const SuppressedCanonicalTargetSchema = z.object({
  typeId: z.number().int().positive(),
  pgId: z.number().int().positive(),
});

export type SuppressedCanonicalTarget = z.infer<
  typeof SuppressedCanonicalTargetSchema
>;

// ── Full verdict (consumed by R2EligibilityService) ────────────────────────────

export const R2EligibilityVerdictSchema = z.object({
  eligible: z.boolean(),
  eligibilityScore: z.number().min(0).max(100), // composite weighted
  subscores: R2EligibilitySubscoresSchema,
  verdict: R2EligibilityVerdictEnum,
  reason: z.string(),
  suppressedCanonicalTarget: SuppressedCanonicalTargetSchema.optional(),
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
  suppressedTarget: z.number().int().positive().nullable().optional(),
  reason: z.string().nullable().optional(),
  evaluatedAt: z.date().optional(), // server default NOW()
});

export type R2EligibilityLogRow = z.infer<typeof R2EligibilityLogRowSchema>;
