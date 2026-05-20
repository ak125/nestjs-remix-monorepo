/**
 * ADR-066 — R2 Composition input schemas (Zod)
 *
 * Defines R1Signals + R8Signals + MotorDelta + Cluster — the inputs of the
 * pure `compose()` function (Gate 2 du pipeline R2 v2).
 *
 * Persisted as Source of Truth in `__seo_r2_composition_inputs` table
 * (cf MEMORY feedback_seo_sot_is_composition_input_not_content) for replay-safe
 * regeneration 18+ months later.
 *
 * Hash déterministe via `fast-json-stable-stringify` (clés triées) AVANT sha256.
 * JAMAIS JSON.stringify natif (cf MEMORY feedback_deterministic_input_hash_canonical_json).
 */

import { z } from 'zod';
import { FuelTypeEnum } from '../../../../config/r2-content-contract.schema';

// ── R1 Signals (gamme routeur) ─────────────────────────────────────────────────

export const R1KeywordPlanSchema = z.object({
  primaryKw: z.string().min(1),
  intentSignals: z.array(z.string()).default([]),
  selectionCriteria: z.array(z.string()).default([]),
  faqQuestions: z.array(z.string()).default([]),
});

export const R1SignalsSchema = z.object({
  pgId: z.number().int().positive(),
  pgAlias: z.string().min(1),
  keywordPlan: R1KeywordPlanSchema,
  ragContent: z.string().nullable(), // /opt/automecanik/rag/knowledge/gammes/{pgAlias}.md
  gammeConseil: z.string().nullable(), // __seo_gamme_conseil JSONB serialized
});

export type R1Signals = z.infer<typeof R1SignalsSchema>;

// ── R8 Signals (vehicle page neighbor data) ────────────────────────────────────

export const R8NeighborPageSchema = z.object({
  typeId: z.number().int().positive(),
  contentFingerprint: z.string().min(1),
  productSetSignature: z.string().min(1),
  compatibilitySignature: z.string().min(1),
  catalogSignature: z.string().min(1),
  decision: z.enum([
    'index',
    'suppressed',
    'review_required',
    'regenerate',
    'reject',
  ]),
});

export const R8SignalsSchema = z.object({
  neighborFamilyKey: z.string().min(1), // brand::model::fuel::body or vehicle_family_id
  neighborPages: z.array(R8NeighborPageSchema).default([]),
  sharedProductRatio: z.number().min(0).max(1).default(0),
  sharedOemRatio: z.number().min(0).max(1).default(0),
  sharedSupplierRatio: z.number().min(0).max(1).default(0),
});

export type R8Signals = z.infer<typeof R8SignalsSchema>;

// ── Motor Delta (per-motorisation distinctiveness) ─────────────────────────────

export const MotorDeltaSchema = z.object({
  typeId: z.number().int().positive(),
  fuelType: FuelTypeEnum,
  powerHp: z.number().int().positive().nullable(),
  engineCode: z.string().nullable(),
  literage: z.string().nullable(), // type_liter (e.g., "1.6", "2.0")
  bodyType: z.string().nullable(),
  productionYearFrom: z.number().int().min(1900).max(2100).nullable(),
  productionYearTo: z.number().int().min(1900).max(2100).nullable(),
  // Computed deltas vs nearest sibling (within same cluster)
  hasPowerDelta: z.boolean(), // |Δhp| > 15
  hasEngineDelta: z.boolean(), // engineCode differs
  hasPeriodDelta: z.boolean(), // year ranges disjoint
  hasFuelDelta: z.boolean(), // fuelType differs
  hasBodyDelta: z.boolean(), // bodyType differs
  uniqueProductFamilies: z.array(z.string()).default([]),
  productCount: z.number().int().min(0),
});

export type MotorDelta = z.infer<typeof MotorDeltaSchema>;

// ── Cluster (siblings group for diversity) ─────────────────────────────────────

export const ClusterSchema = z.object({
  gammeId: z.number().int().positive(), // pg_id
  clusterKey: z.string().min(1), // brand::model::fuel::body × pg_id (v1) or vehicle_family_id::pg_id (v2)
  typeIds: z.array(z.number().int().positive()),
  clusterSize: z.number().int().positive(),
  pilotTier: z
    .enum(['G1_PILOT', 'G1_GENERAL', 'G2_GENERAL'])
    .default('G1_GENERAL'),
});

export type Cluster = z.infer<typeof ClusterSchema>;

// ── CatalogSignature (sha256 sorted_oem + subgroups + family_counts) ───────────

export const CatalogSignatureSchema = z.object({
  signature: z.string().regex(/^[0-9a-f]{64}$/, 'must be sha256 hex'),
  sortedOemRefs: z.array(z.string()).default([]), // top-30 OEM refs sorted
  subgroupsKeys: z.array(z.string()).default([]),
  productFamilyCounts: z
    .record(z.string(), z.number().int().min(0))
    .default({}),
});

export type CatalogSignature = z.infer<typeof CatalogSignatureSchema>;

// ── R2CompositionInput (assembled, SoT replay-safe) ────────────────────────────

export const R2CompositionInputSchema = z.object({
  pgId: z.number().int().positive(),
  typeId: z.number().int().positive(),
  r1: R1SignalsSchema,
  r8: R8SignalsSchema,
  motor: MotorDeltaSchema,
  cluster: ClusterSchema,
  catalogSignature: CatalogSignatureSchema,
});

export type R2CompositionInput = z.infer<typeof R2CompositionInputSchema>;

// ── R2CompositionInputSnapshot (DB row in __seo_r2_composition_inputs) ─────────

export const R2CompositionInputSnapshotSchema = z.object({
  pgId: z.number().int().positive(),
  typeId: z.number().int().positive(),
  inputHash: z
    .string()
    .regex(
      /^[0-9a-f]{64}$/,
      'must be sha256 hex of fast-json-stable-stringify(input)',
    ),
  r1Signals: z.unknown(), // JSONB R1Signals
  r8Signals: z.unknown(), // JSONB R8Signals
  motorDelta: z.unknown(), // JSONB MotorDelta
  clusterKey: z.string().min(1),
  catalogSignature: z.string().regex(/^[0-9a-f]{64}$/),
  capturedAt: z.date(),
});

export type R2CompositionInputSnapshot = z.infer<
  typeof R2CompositionInputSnapshotSchema
>;
