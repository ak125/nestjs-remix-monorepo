/**
 * ADR-066 — R2 Content Contract V2 (Zod)
 *
 * Extends `backend/src/config/r2-content-contract.schema.ts` (V1) with :
 *   - Décision enum étendu : SUPPRESSED, regenerate, reject
 *   - canonical_target_type_id field (mandatory si decision=SUPPRESSED)
 *   - content_hash field (mandatory si decision=INDEX)
 *   - Section S_MOTOR_DELTA dans le block enum
 *
 * Backward-compat : V1 contracts (version '1.0.0') restent valides via parsing
 * du schéma V1 original. V2 contracts utilisent version '2.0.0' marker.
 *
 * Discipline canon (cf MEMORY feedback_opa_rego_invariants_only) : ce schéma
 * Zod enforce les invariants Zod-isables (champs requis, ranges, enums).
 * Les invariants relationnels (anti-chain canonical, anti cross-gamme) sont
 * enforced par Rego policy r2-content-write.rego (vault).
 */

import { z } from 'zod';
import {
  R2BlockEnum,
  R2CanonicalSchema,
  R2RangeSchema,
  R2VehicleSchema,
  R2HeadingPolicySchema,
  R2RulesSchema,
} from '../../../../config/r2-content-contract.schema';

// ── V2 decision enum (étendu avec SUPPRESSED + regenerate + reject) ────────────

export const R2DecisionV2Enum = z.enum([
  'index',
  'noindex_follow', // V1 legacy compat
  'review_required', // queued for human admin review
  'suppressed', // NEW V2 : canonical to sibling INDEX page
  'regenerate', // retry pipeline (retry_count++)
  'reject', // permanently rejected, no retry
]);

export type R2DecisionV2 = z.infer<typeof R2DecisionV2Enum>;

// ── Status enum (DB row status __seo_r2_pages.status) ─────────────────────────

export const R2StatusV2Enum = z.enum([
  'draft',
  'published',
  'review',
  'rejected',
  'regenerating',
  'suppressed',
]);

export type R2StatusV2 = z.infer<typeof R2StatusV2Enum>;

// ── V2 block enum (ajoute S_MOTOR_DELTA) ───────────────────────────────────────

export const R2BlockV2Enum = z.enum([
  // Pattern miroir R8 9 sections + 1 spécifique R2 :
  'S_HERO',
  'S_COMPAT_SCOPE',
  'S_MOTOR_DELTA', // NEW V2 — per-motorisation specifics
  'S_SELECTION_GUIDE',
  'S_PRODUCT_GROUPS',
  'S_COMPAT_DETAIL',
  'S_OEM_COMPACT',
  'S_FAQ_SPECIFIC',
  'S_REASSURANCE', // zone confinée pour commercial signals
  'S_RELATED_GUIDES',
  // V1 compat (mappés vers V2 sections par renderer)
  ...R2BlockEnum.options,
]);

// ── Page plan V2 (sections + ordering) ────────────────────────────────────────

export const R2PagePlanV2Schema = z.object({
  h1: z.string().min(1).max(75),
  title: z.string().min(1).max(100),
  orderedBlocks: z.array(R2BlockV2Enum).min(1),
  specificBlocks: z.array(R2BlockV2Enum).min(0),
  compatibilitySummary: z.array(z.string()).default([]),
  selectionGuide: z.array(z.string()).default([]),
  catalogSignals: z.array(z.string()).default([]),
  subgroups: z.array(z.string()).default([]),
  faqQuestions: z.array(z.string()).default([]),
  motorDeltaTraits: z.array(z.string()).default([]), // NEW V2
});

export type R2PagePlanV2 = z.infer<typeof R2PagePlanV2Schema>;

// ── Status block (avec SUPPRESSED canonical_target_type_id) ───────────────────

export const R2StatusBlockSchema = z.object({
  seoReady: z.boolean(),
  publishable: z.boolean(),
  decision: R2DecisionV2Enum,
  /**
   * MANDATORY si decision='suppressed'. Pointe le sibling type_id (même pg_id)
   * dont decision='index'. Anti-chain + anti cross-gamme enforced par Rego.
   *
   * cf MEMORY feedback_seo_suppressed_canonical_decision + feedback_canonical_chain_prevention.
   */
  canonicalTargetTypeId: z.number().int().positive().optional(),
  sitemapEligible: z.boolean(), // false si SUPPRESSED ou reject
  reasons: z.array(z.string()).default([]),
});

export type R2StatusBlock = z.infer<typeof R2StatusBlockSchema>;

// ── Audit block ────────────────────────────────────────────────────────────────

export const R2AuditV2Schema = z.object({
  computedAt: z.date(),
  validatorVersion: z.string().default('2.0.0'),
  contractVersion: z.literal('2.0.0'),
  builderVersion: z.string().optional(),
  pipelineVersion: z.string().optional(),
  scoringNotes: z.array(z.string()).default([]),
});

export type R2AuditV2 = z.infer<typeof R2AuditV2Schema>;

// ── Full R2 Content Contract V2 ────────────────────────────────────────────────

export const R2ContentContractV2Schema = z
  .object({
    version: z.literal('2.0.0'),
    pageType: z.literal('R2_RANGE_VEHICLE'),
    canonical: R2CanonicalSchema,
    vehicle: R2VehicleSchema,
    range: R2RangeSchema,
    headingPolicy: R2HeadingPolicySchema,
    rules: R2RulesSchema,
    pagePlan: R2PagePlanV2Schema,
    fingerprints: z.object({
      contentFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
      blockSignature: z.string().regex(/^[0-9a-f]{64}$/),
      faqSignature: z.string().regex(/^[0-9a-f]{64}$/),
      productSetSignature: z.string().regex(/^[0-9a-f]{64}$/),
      compatibilitySignature: z.string().regex(/^[0-9a-f]{64}$/),
      catalogSignature: z.string().regex(/^[0-9a-f]{64}$/),
    }),
    /**
     * Content hash for embedding invalidation (improvement self-review G).
     * MANDATORY si status='published' AND decision='index'.
     */
    contentHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    /**
     * Input hash for replay safety. Deterministic via fast-json-stable-stringify.
     * cf MEMORY feedback_deterministic_input_hash_canonical_json.
     */
    inputHash: z.string().regex(/^[0-9a-f]{64}$/),
    status: R2StatusBlockSchema,
    audit: R2AuditV2Schema,
  })
  .superRefine((data, ctx) => {
    // ── Invariant : decision='suppressed' → canonicalTargetTypeId non-null ────
    if (data.status.decision === 'suppressed') {
      if (!data.status.canonicalTargetTypeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "decision='suppressed' requires canonicalTargetTypeId (sibling type_id with decision='index'). Anti-chain enforced by Rego.",
          path: ['status', 'canonicalTargetTypeId'],
        });
      }
      if (data.status.sitemapEligible) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "decision='suppressed' MUST have sitemapEligible=false (excluded from sitemap, canonical link only).",
          path: ['status', 'sitemapEligible'],
        });
      }
    }

    // ── Invariant : decision='index' → contentHash non-null ───────────────────
    if (data.status.decision === 'index' && !data.contentHash) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "decision='index' requires contentHash (sha256 of content_main).",
        path: ['contentHash'],
      });
    }

    // ── Invariant : decision='reject' → sitemapEligible=false ─────────────────
    if (data.status.decision === 'reject' && data.status.sitemapEligible) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "decision='reject' MUST have sitemapEligible=false.",
        path: ['status', 'sitemapEligible'],
      });
    }
  });

export type R2ContentContractV2 = z.infer<typeof R2ContentContractV2Schema>;
