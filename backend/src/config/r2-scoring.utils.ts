/**
 * R2 Content Contract — Scoring helpers (6 métriques)
 * Score dominé par productSet, compatibilityDelta et catalogStructureDelta.
 */

export function computeProductSetUniquenessScore(input: {
  sharedProductRatioWithNearest: number;
  sharedBrandRatioWithNearest: number;
  sharedOemRatioWithNearest: number;
}): number {
  const penalty =
    input.sharedProductRatioWithNearest * 50 +
    input.sharedBrandRatioWithNearest * 25 +
    input.sharedOemRatioWithNearest * 25;

  return Math.max(0, Math.round(100 - penalty));
}

export function computeCompatibilityDeltaScore(input: {
  hasYearDelta: boolean;
  hasPositionDelta: boolean;
  hasSystemDelta: boolean;
  hasVinOrOemCheck: boolean;
  compatibilityRuleCount: number;
}): number {
  let score = 0;
  if (input.hasYearDelta) score += 20;
  if (input.hasPositionDelta) score += 20;
  if (input.hasSystemDelta) score += 25;
  if (input.hasVinOrOemCheck) score += 15;
  score += Math.min(20, input.compatibilityRuleCount * 5);
  return Math.min(100, score);
}

export function computeCatalogStructureDeltaScore(input: {
  subgroupCount: number;
  hasMultiplePositions: boolean;
  hasAccessoriesGroup: boolean;
  hasCompactOemGroup: boolean;
  subgroupOverlapRatioWithNearest: number;
}): number {
  let score = 0;
  score += Math.min(25, input.subgroupCount * 6);
  if (input.hasMultiplePositions) score += 20;
  if (input.hasAccessoriesGroup) score += 15;
  if (input.hasCompactOemGroup) score += 15;
  score += Math.max(
    0,
    Math.round((1 - input.subgroupOverlapRatioWithNearest) * 25),
  );
  return Math.min(100, score);
}

export function computeSemanticSimilarityScore(input: {
  sharedTextBlockRatio: number;
  sharedFaqRatio: number;
  sharedSubgroupRatio: number;
  sharedCompatibilityRatio: number;
}): number {
  const score =
    input.sharedTextBlockRatio * 0.35 +
    input.sharedFaqRatio * 0.2 +
    input.sharedSubgroupRatio * 0.25 +
    input.sharedCompatibilityRatio * 0.2;

  return Number(Math.min(1, score).toFixed(2));
}

export function computeFaqReuseRiskScore(input: {
  repeatedFaqCount: number;
  totalFaqCount: number;
}): number {
  if (input.totalFaqCount <= 0) return 1;
  return Number(
    Math.min(1, input.repeatedFaqCount / input.totalFaqCount).toFixed(2),
  );
}

export function computeFingerprintCollisionRiskScore(input: {
  sameContentFingerprintCount: number;
  sameProductSetSignatureCount: number;
  sameCompatibilitySignatureCount: number;
}): number {
  const score =
    Math.min(1, input.sameContentFingerprintCount * 0.5) +
    Math.min(1, input.sameProductSetSignatureCount * 0.25) +
    Math.min(1, input.sameCompatibilitySignatureCount * 0.25);

  return Number(Math.min(1, score).toFixed(2));
}
