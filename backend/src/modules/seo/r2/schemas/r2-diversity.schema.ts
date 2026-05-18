/**
 * ADR-066 — R2 Diversity report schema (Zod)
 *
 * Gate 3 output : 8 metrics + 6 fingerprints + 5 LSH MinHash bands.
 *
 * STRUCTURAL-FIRST ordering (cf MEMORY feedback_seo_catalog_signature_before_text_diversity):
 *   3.a catalog_signature → overlap > 0.92 = SUPPRESSED si sibling INDEX fiable, REJECT sinon
 *   3.b structural delta (motor + commercialDistinctiveness, déjà en input)
 *   3.c LSH MinHash bands (Jaccard sur shingles)
 *   3.d pgvector cosine embeddings (only si 3.a-c ambigu)
 *
 * Persisté splitté entre __seo_r2_metrics (scores) + __seo_r2_signatures
 * (fingerprints + bands) + __seo_r2_embeddings (vector).
 */

import { z } from 'zod';

// ── Fingerprints (6 sha256 hex hashes) ─────────────────────────────────────────

const SHA256_HEX = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'must be sha256 hex (64 chars)');

export const R2FingerprintsSchema = z.object({
  contentFingerprint: SHA256_HEX,
  blockSignature: SHA256_HEX,
  faqSignature: SHA256_HEX,
  productSetSignature: SHA256_HEX,
  compatibilitySignature: SHA256_HEX,
  catalogSignature: SHA256_HEX,
});

export type R2Fingerprints = z.infer<typeof R2FingerprintsSchema>;

// ── LSH MinHash bands (5 bands × 10 rows each, total 200 perms) ────────────────

export const R2LshBandsSchema = z.object({
  band1: z.string().min(1),
  band2: z.string().min(1),
  band3: z.string().min(1),
  band4: z.string().min(1),
  band5: z.string().min(1),
});

export type R2LshBands = z.infer<typeof R2LshBandsSchema>;

// ── Metrics (8 numeric metrics, échelle variable selon métrique) ───────────────

export const R2DiversityMetricsSchema = z.object({
  overallSeoScore: z.number().int().min(0).max(100), // composite final
  motorDeltaScore: z.number().int().min(0).max(100), // reused from eligibility
  compatDeltaScore: z.number().int().min(0).max(100), // reused from eligibility
  commercialDistinctivenessScore: z.number().int().min(0).max(100), // reused from eligibility
  crawlValueScore: z.number().int().min(0).max(100), // reused from eligibility
  semanticSimilarityScore: z.number().min(0).max(1), // pgvector cosine
  collisionRiskScore: z.number().min(0).max(1), // LSH-based collision proba
  catalogOverlapScore: z.number().min(0).max(1), // Jaccard catalog_signature bands
  specificBlockCount: z.number().int().min(0), // sections specifically authored
  boilerplateRatio: z.number().min(0).max(1), // ratio reusable content
});

export type R2DiversityMetrics = z.infer<typeof R2DiversityMetricsSchema>;

// ── Diversity Report (consumed by R2GovernanceGate) ────────────────────────────

export const R2DiversityReportSchema = z.object({
  pgId: z.number().int().positive(),
  typeId: z.number().int().positive(),
  metrics: R2DiversityMetricsSchema,
  fingerprints: R2FingerprintsSchema,
  lshBands: R2LshBandsSchema,
  /**
   * Embedding vector content_hash key (links to __seo_r2_embeddings row).
   * Used for auto-invalidation when content changes (improvement self-review G).
   */
  embeddingContentHash: SHA256_HEX.optional(),
  /**
   * Early-decision signal from catalog_signature gate (3.a).
   * - if `catalogOverlapScore > 0.92` AND sibling INDEX exists in cluster
   *   → suggest SUPPRESSED with sibling target (governance gate confirms)
   * - if `> 0.92` AND no reliable sibling → suggest REJECT
   */
  catalogEarlyDecision: z
    .enum(['continue', 'suppress', 'reject'])
    .default('continue'),
  /**
   * If catalogEarlyDecision = 'suppress', target sibling type_id.
   */
  suggestedCanonicalTargetTypeId: z.number().int().positive().optional(),
  computedAt: z.date(),
});

export type R2DiversityReport = z.infer<typeof R2DiversityReportSchema>;
