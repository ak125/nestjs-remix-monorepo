/**
 * R2 Content Contract — Defaults métier
 */

import type { R2HeadingPolicy, R2Rules } from './r2-content-contract.schema';

export const DEFAULT_R2_HEADING_POLICY: R2HeadingPolicy = {
  h1MaxLength: 75,
  titleMaxLength: 100,
  h1MustContainRangeAndVehicle: true,
  h1MustNotContainCommercialBoilerplate: true,
};

export const DEFAULT_R2_RULES: R2Rules = {
  selfCanonicalRequired: true,
  minSpecificBlocks: 4,
  maxBoilerplateRatio: 0.28,
  mustHaveCompatibilitySummary: true,
  mustHaveSelectionGuide: true,
  mustHaveCatalogSignals: true,
  minProductSetUniquenessScore: 30,
  minCompatibilityDeltaScore: 35,
  minCatalogStructureDeltaScore: 30,
  maxSemanticSimilarityScore: 0.8,
  maxFaqReuseRiskScore: 0.55,
  maxFingerprintCollisionRiskScore: 0.8,
  minOverallSeoScoreForIndex: 68,
};
