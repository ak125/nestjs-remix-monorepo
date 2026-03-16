/**
 * duplicate-gate.schema.ts
 *
 * Anti-duplicate gate for R2_PRODUCT and R8_VEHICLE surfaces.
 * Fingerprints, neighbors, scores, and publication decisions.
 *
 * Scores: 0 = quasi-clone, 100 = fully distinct.
 * Thresholds: PASS >= 70, REVIEW >= 50, BLOCK < 50.
 */
import { z } from 'zod';

// ── Enums ──

export const DuplicateRoleSchema = z.enum(['R2_PRODUCT', 'R8_VEHICLE']);
export type DuplicateRole = z.infer<typeof DuplicateRoleSchema>;

export const DuplicateStatusSchema = z.enum([
  'PASS',
  'REVIEW_REQUIRED',
  'BLOCK_DUPLICATE_R2',
  'BLOCK_DUPLICATE_R8',
]);
export type DuplicateStatus = z.infer<typeof DuplicateStatusSchema>;

// ── Fingerprints ──

export const DuplicateFingerprintsSchema = z.object({
  content_fingerprint: z.string().min(1),
  product_set_signature: z.string().nullable().optional(),
  vehicle_scope_signature: z.string().nullable().optional(),
  faq_signature: z.string().nullable().optional(),
  category_signature: z.string().nullable().optional(),
  vehicle_identity_signature: z.string().nullable().optional(),
  engine_family_signature: z.string().nullable().optional(),
  maintenance_signature: z.string().nullable().optional(),
  catalog_context_signature: z.string().nullable().optional(),
});

// ── Neighbors ──

export const DuplicateNeighborSchema = z.object({
  neighbor_id: z.string().min(1),
  slug: z.string().min(1),
  canonical_role: z.string().min(1),
  similarity_score: z.number().min(0).max(100),
  notes: z.string().nullable().optional(),
});

// ── Scores ──

export const DuplicateScoresSchema = z.object({
  content_similarity_score: z.number().min(0).max(100),

  // R2-specific
  product_set_uniqueness_score: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .optional(),
  compatibility_delta_score: z.number().min(0).max(100).nullable().optional(),
  catalog_structure_delta_score: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .optional(),
  transactional_specificity_score: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .optional(),

  // R8-specific
  vehicle_identity_delta_score: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .optional(),
  engine_family_delta_score: z.number().min(0).max(100).nullable().optional(),
  maintenance_delta_score: z.number().min(0).max(100).nullable().optional(),
  catalog_context_delta_score: z.number().min(0).max(100).nullable().optional(),

  // Shared
  route_slug_uniqueness_score: z.number().min(0).max(100),
  global_duplicate_resistance_score: z.number().min(0).max(100),
});

// ── Decision ──

export const DuplicateDecisionSchema = z.object({
  status: DuplicateStatusSchema,
  indexing_allowed: z.boolean(),
  publication_allowed: z.boolean(),
  review_required: z.boolean(),
  blocking_reasons: z.array(z.string()).default([]),
  warning_flags: z.array(z.string()).default([]),
});

// ── Full audit record ──

export const DuplicateGateAuditSchema = z.object({
  canonical_role: DuplicateRoleSchema,
  entity_id: z.string().min(1),
  pg_id: z.number().int().nullable().optional(),
  slug: z.string().min(1),
  fingerprints: DuplicateFingerprintsSchema,
  neighbors: z.array(DuplicateNeighborSchema).max(10),
  scores: DuplicateScoresSchema,
  decision: DuplicateDecisionSchema,
  created_at: z.string().datetime(),
});

export type DuplicateGateAudit = z.infer<typeof DuplicateGateAuditSchema>;

// ── Score computation ──

export function computeR2DuplicateResistanceScore(input: {
  content_similarity_score: number;
  product_set_uniqueness_score: number;
  compatibility_delta_score: number;
  catalog_structure_delta_score: number;
  transactional_specificity_score: number;
  route_slug_uniqueness_score: number;
}): number {
  return (
    Math.round(
      (0.25 * input.content_similarity_score +
        0.2 * input.product_set_uniqueness_score +
        0.2 * input.compatibility_delta_score +
        0.15 * input.catalog_structure_delta_score +
        0.1 * input.transactional_specificity_score +
        0.1 * input.route_slug_uniqueness_score) *
        100,
    ) / 100
  );
}

export function computeR8DuplicateResistanceScore(input: {
  content_similarity_score: number;
  vehicle_identity_delta_score: number;
  engine_family_delta_score: number;
  maintenance_delta_score: number;
  catalog_context_delta_score: number;
  route_slug_uniqueness_score: number;
}): number {
  return (
    Math.round(
      (0.25 * input.content_similarity_score +
        0.2 * input.vehicle_identity_delta_score +
        0.15 * input.engine_family_delta_score +
        0.15 * input.maintenance_delta_score +
        0.15 * input.catalog_context_delta_score +
        0.1 * input.route_slug_uniqueness_score) *
        100,
    ) / 100
  );
}

// ── Decision functions ──

export function decideR2DuplicateStatus(scores: {
  global_duplicate_resistance_score: number;
  content_similarity_score: number;
  product_set_uniqueness_score: number;
  compatibility_delta_score: number;
}): DuplicateStatus {
  if (
    scores.global_duplicate_resistance_score < 50 ||
    scores.content_similarity_score < 30 ||
    scores.product_set_uniqueness_score < 35 ||
    scores.compatibility_delta_score < 35
  ) {
    return 'BLOCK_DUPLICATE_R2';
  }
  if (scores.global_duplicate_resistance_score < 70) {
    return 'REVIEW_REQUIRED';
  }
  return 'PASS';
}

export function decideR8DuplicateStatus(scores: {
  global_duplicate_resistance_score: number;
  content_similarity_score: number;
  vehicle_identity_delta_score: number;
  maintenance_delta_score: number;
}): DuplicateStatus {
  if (
    scores.global_duplicate_resistance_score < 50 ||
    scores.content_similarity_score < 30 ||
    scores.vehicle_identity_delta_score < 35 ||
    scores.maintenance_delta_score < 30
  ) {
    return 'BLOCK_DUPLICATE_R8';
  }
  if (scores.global_duplicate_resistance_score < 70) {
    return 'REVIEW_REQUIRED';
  }
  return 'PASS';
}
