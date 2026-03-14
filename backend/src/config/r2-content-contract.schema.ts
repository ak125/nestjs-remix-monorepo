/**
 * R2 Content Contract — Zod + TypeScript V1
 * Contrat formel pour les pages R2 (gamme × véhicule).
 *
 * La singularité SEO d'une page R2 vient de :
 * - l'ensemble produit (productSetUniquenessScore)
 * - les règles de compatibilité (compatibilityDeltaScore)
 * - la structure catalogue (catalogStructureDeltaScore)
 *
 * Source de vérité complémentaire : r2-keyword-plan.constants.ts (generation agent)
 */

import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────

export const FuelTypeEnum = z.enum([
  'essence',
  'diesel',
  'hybride',
  'electrique',
  'gpl',
  'autre',
]);

export const R2DecisionEnum = z.enum([
  'index',
  'noindex_follow',
  'review_required',
]);

export const R2BlockEnum = z.enum([
  'heroRangeVehicle',
  'compatibilitySummary',
  'selectionGuide',
  'activeFiltersSummary',
  'productSubgroups',
  'productListing',
  'oemReferencesCompact',
  'faqSpecific',
  'compatibilityInfoBox',
  'technicalStatsCompact',
  'relatedGuidesMinimal',
  'reassuranceMinimal',
]);

export const R2SpecificBlockEnum = z.enum([
  'compatibilitySummary',
  'selectionGuide',
  'activeFiltersSummary',
  'productSubgroups',
  'oemReferencesCompact',
  'faqSpecific',
  'compatibilityInfoBox',
  'technicalStatsCompact',
  'relatedGuidesMinimal',
]);

// ── Sub-schemas ──────────────────────────────────────────

export const R2CanonicalSchema = z.object({
  mode: z.literal('self'),
  url: z.string().url(),
});

export const R2VehicleSchema = z.object({
  brandSlug: z.string().min(1),
  modelSlug: z.string().min(1),
  vehicleSlug: z.string().min(1),
  fuelType: FuelTypeEnum,
  engineCode: z.string().optional(),
  phase: z.string().optional(),
  bodyType: z.string().optional(),
  powerHp: z.number().int().positive().optional(),
  productionStartYear: z.number().int().min(1900).max(2100).optional(),
  productionEndYear: z.number().int().min(1900).max(2100).optional(),
  label: z.string().min(1),
});

export const R2RangeSchema = z.object({
  rangeSlug: z.string().min(1),
  rangeLabel: z.string().min(1),
  rangeFamily: z.string().min(1),
  positionVariants: z
    .array(
      z.enum(['avant', 'arriere', 'avant_arriere', 'non_positionnel', 'autre']),
    )
    .optional(),
});

export const R2HeadingPolicySchema = z.object({
  h1MaxLength: z.number().int().positive().default(75),
  titleMaxLength: z.number().int().positive().default(100),
  h1MustContainRangeAndVehicle: z.boolean().default(true),
  h1MustNotContainCommercialBoilerplate: z.boolean().default(true),
});

export const R2RulesSchema = z.object({
  selfCanonicalRequired: z.boolean().default(true),
  minSpecificBlocks: z.number().int().min(1).default(4),
  maxBoilerplateRatio: z.number().min(0).max(1).default(0.28),
  mustHaveCompatibilitySummary: z.boolean().default(true),
  mustHaveSelectionGuide: z.boolean().default(true),
  mustHaveCatalogSignals: z.boolean().default(true),
  minProductSetUniquenessScore: z.number().int().min(0).max(100).default(30),
  minCompatibilityDeltaScore: z.number().int().min(0).max(100).default(35),
  minCatalogStructureDeltaScore: z.number().int().min(0).max(100).default(30),
  maxSemanticSimilarityScore: z.number().min(0).max(1).default(0.8),
  maxFaqReuseRiskScore: z.number().min(0).max(1).default(0.55),
  maxFingerprintCollisionRiskScore: z.number().min(0).max(1).default(0.8),
  minOverallSeoScoreForIndex: z.number().int().min(0).max(100).default(68),
});

export const R2SubgroupSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  productCount: z.number().int().min(0),
  oemCount: z.number().int().min(0).optional(),
});

export const R2PagePlanSchema = z.object({
  h1: z.string().min(1),
  title: z.string().min(1),
  orderedBlocks: z.array(R2BlockEnum).min(1),
  specificBlocks: z.array(R2SpecificBlockEnum).min(1),
  compatibilitySummary: z.array(z.string().min(1)).default([]),
  selectionGuide: z.array(z.string().min(1)).default([]),
  catalogSignals: z.array(z.string().min(1)).default([]),
  subgroups: z.array(R2SubgroupSchema).default([]),
  faqQuestions: z.array(z.string().min(1)).default([]),
});

export const R2MetricsSchema = z.object({
  specificBlockCount: z.number().int().min(0),
  boilerplateRatio: z.number().min(0).max(1),
  hasCompatibilitySummary: z.boolean(),
  hasSelectionGuide: z.boolean(),
  hasCatalogSignals: z.boolean(),
  productSetUniquenessScore: z.number().int().min(0).max(100),
  compatibilityDeltaScore: z.number().int().min(0).max(100),
  catalogStructureDeltaScore: z.number().int().min(0).max(100),
  semanticSimilarityScore: z.number().min(0).max(1),
  faqReuseRiskScore: z.number().min(0).max(1),
  fingerprintCollisionRiskScore: z.number().min(0).max(1),
  overallSeoScore: z.number().int().min(0).max(100),
});

export const R2FingerprintSchema = z.object({
  contentFingerprint: z.string().min(8),
  blockSignature: z.string().min(8),
  faqSignature: z.string().min(8),
  subgroupSignature: z.string().min(8),
  productSetSignature: z.string().min(8),
  compatibilitySignature: z.string().min(8),
});

export const R2StatusSchema = z.object({
  seoReady: z.boolean(),
  publishable: z.boolean(),
  decision: R2DecisionEnum,
  sitemapEligible: z.boolean(),
  reasons: z.array(z.string().min(1)).default([]),
});

export const R2AuditSchema = z.object({
  computedAt: z.string().datetime(),
  validatorVersion: z.string().min(1),
  scoringNotes: z.array(z.string().min(1)).default([]),
});

// ── Top-level contract ───────────────────────────────────

export const R2ContentContractSchema = z
  .object({
    version: z.literal('1.0.0'),
    pageType: z.literal('R2_RANGE_VEHICLE'),
    canonical: R2CanonicalSchema,
    vehicle: R2VehicleSchema,
    range: R2RangeSchema,
    headingPolicy: R2HeadingPolicySchema,
    rules: R2RulesSchema,
    pagePlan: R2PagePlanSchema,
    metrics: R2MetricsSchema,
    fingerprint: R2FingerprintSchema,
    status: R2StatusSchema,
    audit: R2AuditSchema,
  })
  .superRefine((data, ctx) => {
    const { rules, metrics, pagePlan } = data;

    if (rules.selfCanonicalRequired && data.canonical.mode !== 'self') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['canonical', 'mode'],
        message: 'Self canonical is required.',
      });
    }

    if (metrics.specificBlockCount < rules.minSpecificBlocks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metrics', 'specificBlockCount'],
        message: 'Not enough specific blocks.',
      });
    }

    if (metrics.boilerplateRatio > rules.maxBoilerplateRatio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metrics', 'boilerplateRatio'],
        message: 'Boilerplate ratio too high.',
      });
    }

    if (
      rules.mustHaveCompatibilitySummary &&
      !metrics.hasCompatibilitySummary
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metrics', 'hasCompatibilitySummary'],
        message: 'Compatibility summary is required.',
      });
    }

    if (rules.mustHaveSelectionGuide && !metrics.hasSelectionGuide) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metrics', 'hasSelectionGuide'],
        message: 'Selection guide is required.',
      });
    }

    if (rules.mustHaveCatalogSignals && !metrics.hasCatalogSignals) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metrics', 'hasCatalogSignals'],
        message: 'Catalog signals are required.',
      });
    }

    if (
      metrics.productSetUniquenessScore < rules.minProductSetUniquenessScore
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metrics', 'productSetUniquenessScore'],
        message: 'Product set uniqueness score too low.',
      });
    }

    if (metrics.compatibilityDeltaScore < rules.minCompatibilityDeltaScore) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metrics', 'compatibilityDeltaScore'],
        message: 'Compatibility delta score too low.',
      });
    }

    if (
      metrics.catalogStructureDeltaScore < rules.minCatalogStructureDeltaScore
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metrics', 'catalogStructureDeltaScore'],
        message: 'Catalog structure delta score too low.',
      });
    }

    if (metrics.semanticSimilarityScore > rules.maxSemanticSimilarityScore) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metrics', 'semanticSimilarityScore'],
        message: 'Semantic similarity too high.',
      });
    }

    if (metrics.faqReuseRiskScore > rules.maxFaqReuseRiskScore) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metrics', 'faqReuseRiskScore'],
        message: 'FAQ reuse risk too high.',
      });
    }

    if (
      metrics.fingerprintCollisionRiskScore >
      rules.maxFingerprintCollisionRiskScore
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metrics', 'fingerprintCollisionRiskScore'],
        message: 'Fingerprint collision risk too high.',
      });
    }

    if (
      rules.mustHaveCompatibilitySummary &&
      !pagePlan.orderedBlocks.includes('compatibilitySummary')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pagePlan', 'orderedBlocks'],
        message: 'orderedBlocks must contain compatibilitySummary.',
      });
    }

    if (
      rules.mustHaveSelectionGuide &&
      !pagePlan.orderedBlocks.includes('selectionGuide')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pagePlan', 'orderedBlocks'],
        message: 'orderedBlocks must contain selectionGuide.',
      });
    }
  });

// ── Type exports ─────────────────────────────────────────

export type R2Vehicle = z.infer<typeof R2VehicleSchema>;
export type R2Range = z.infer<typeof R2RangeSchema>;
export type R2Rules = z.infer<typeof R2RulesSchema>;
export type R2HeadingPolicy = z.infer<typeof R2HeadingPolicySchema>;
export type R2PagePlan = z.infer<typeof R2PagePlanSchema>;
export type R2Metrics = z.infer<typeof R2MetricsSchema>;
export type R2Fingerprint = z.infer<typeof R2FingerprintSchema>;
export type R2Status = z.infer<typeof R2StatusSchema>;
export type R2ContentContract = z.infer<typeof R2ContentContractSchema>;
export type R2Audit = z.infer<typeof R2AuditSchema>;
