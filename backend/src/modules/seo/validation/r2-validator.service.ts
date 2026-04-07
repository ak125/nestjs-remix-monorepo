import { Injectable } from '@nestjs/common';
import {
  R2ContentContractSchema,
  type R2ContentContract,
  type R2PagePlan,
  type R2Range,
  type R2Rules,
  type R2Vehicle,
} from '../../../config/r2-content-contract.schema';
import {
  DEFAULT_R2_HEADING_POLICY,
  DEFAULT_R2_RULES,
} from '../../../config/r2-content-contract.defaults';
import { validateR2HeadingPolicy } from '../../../config/r2-heading-policy.utils';
import { buildR2Fingerprint } from '../../../config/r2-fingerprint.utils';
import {
  computeCatalogStructureDeltaScore,
  computeCompatibilityDeltaScore,
  computeFaqReuseRiskScore,
  computeFingerprintCollisionRiskScore,
  computeProductSetUniquenessScore,
  computeSemanticSimilarityScore,
} from '../../../config/r2-scoring.utils';

type R2ValidatorKnowledge = {
  productReferenceKeys: string[];
  subgroupKeys: string[];
  repeatedFaqCount: number;
  sharedProductRatioWithNearest: number;
  sharedBrandRatioWithNearest: number;
  sharedOemRatioWithNearest: number;
  hasYearDelta: boolean;
  hasPositionDelta: boolean;
  hasSystemDelta: boolean;
  hasVinOrOemCheck: boolean;
  compatibilityRuleCount: number;
  subgroupCount: number;
  hasMultiplePositions: boolean;
  hasAccessoriesGroup: boolean;
  hasCompactOemGroup: boolean;
  subgroupOverlapRatioWithNearest: number;
  sharedTextBlockRatio: number;
  sharedFaqRatio: number;
  sharedSubgroupRatio: number;
  sharedCompatibilityRatio: number;
  sameContentFingerprintCount: number;
  sameProductSetSignatureCount: number;
  sameCompatibilitySignatureCount: number;
};

@Injectable()
export class R2ValidatorService {
  createContract(input: {
    canonicalUrl: string;
    vehicle: R2Vehicle;
    range: R2Range;
    pagePlan: R2PagePlan;
    knowledge: R2ValidatorKnowledge;
    rules?: Partial<R2Rules>;
  }): R2ContentContract {
    const rules: R2Rules = {
      ...DEFAULT_R2_RULES,
      ...input.rules,
    };

    const headingPolicy = DEFAULT_R2_HEADING_POLICY;

    const headingCheck = validateR2HeadingPolicy({
      h1: input.pagePlan.h1,
      title: input.pagePlan.title,
      vehicle: input.vehicle,
      range: input.range,
      policy: headingPolicy,
    });

    const fingerprint = buildR2Fingerprint({
      orderedBlocks: input.pagePlan.orderedBlocks,
      faqQuestions: input.pagePlan.faqQuestions,
      subgroupKeys: input.knowledge.subgroupKeys,
      productReferenceKeys: input.knowledge.productReferenceKeys,
      compatibilitySummary: input.pagePlan.compatibilitySummary,
    });

    const metrics = this.computeMetrics(input.pagePlan, input.knowledge);
    const status = this.computeStatus(metrics, rules, headingCheck.reasons);

    return R2ContentContractSchema.parse({
      version: '1.0.0',
      pageType: 'R2_RANGE_VEHICLE',
      canonical: {
        mode: 'self',
        url: input.canonicalUrl,
      },
      vehicle: input.vehicle,
      range: input.range,
      headingPolicy,
      rules,
      pagePlan: input.pagePlan,
      metrics,
      fingerprint,
      status,
      audit: {
        computedAt: new Date().toISOString(),
        validatorVersion: 'r2-validator@1.0.0',
        scoringNotes: [
          ...headingCheck.reasons,
          'R2 score driven by product set uniqueness, compatibility delta and catalog structure delta.',
        ],
      },
    });
  }

  private computeMetrics(
    pagePlan: R2PagePlan,
    knowledge: R2ValidatorKnowledge,
  ) {
    const specificBlockCount = pagePlan.specificBlocks.length;

    const hasCompatibilitySummary = pagePlan.compatibilitySummary.length > 0;
    const hasSelectionGuide = pagePlan.selectionGuide.length > 0;
    const hasCatalogSignals = pagePlan.catalogSignals.length > 0;

    const boilerplateRatio = Number(
      Math.max(
        0,
        1 - specificBlockCount / Math.max(pagePlan.orderedBlocks.length, 1),
      ).toFixed(2),
    );

    const productSetUniquenessScore = computeProductSetUniquenessScore({
      sharedProductRatioWithNearest: knowledge.sharedProductRatioWithNearest,
      sharedBrandRatioWithNearest: knowledge.sharedBrandRatioWithNearest,
      sharedOemRatioWithNearest: knowledge.sharedOemRatioWithNearest,
    });

    const compatibilityDeltaScore = computeCompatibilityDeltaScore({
      hasYearDelta: knowledge.hasYearDelta,
      hasPositionDelta: knowledge.hasPositionDelta,
      hasSystemDelta: knowledge.hasSystemDelta,
      hasVinOrOemCheck: knowledge.hasVinOrOemCheck,
      compatibilityRuleCount: knowledge.compatibilityRuleCount,
    });

    const catalogStructureDeltaScore = computeCatalogStructureDeltaScore({
      subgroupCount: knowledge.subgroupCount,
      hasMultiplePositions: knowledge.hasMultiplePositions,
      hasAccessoriesGroup: knowledge.hasAccessoriesGroup,
      hasCompactOemGroup: knowledge.hasCompactOemGroup,
      subgroupOverlapRatioWithNearest:
        knowledge.subgroupOverlapRatioWithNearest,
    });

    const semanticSimilarityScore = computeSemanticSimilarityScore({
      sharedTextBlockRatio: knowledge.sharedTextBlockRatio,
      sharedFaqRatio: knowledge.sharedFaqRatio,
      sharedSubgroupRatio: knowledge.sharedSubgroupRatio,
      sharedCompatibilityRatio: knowledge.sharedCompatibilityRatio,
    });

    const faqReuseRiskScore = computeFaqReuseRiskScore({
      repeatedFaqCount: knowledge.repeatedFaqCount,
      totalFaqCount: pagePlan.faqQuestions.length,
    });

    const fingerprintCollisionRiskScore = computeFingerprintCollisionRiskScore({
      sameContentFingerprintCount: knowledge.sameContentFingerprintCount,
      sameProductSetSignatureCount: knowledge.sameProductSetSignatureCount,
      sameCompatibilitySignatureCount:
        knowledge.sameCompatibilitySignatureCount,
    });

    let overallSeoScore = 0;
    overallSeoScore += Math.round(productSetUniquenessScore * 0.3);
    overallSeoScore += Math.round(compatibilityDeltaScore * 0.25);
    overallSeoScore += Math.round(catalogStructureDeltaScore * 0.2);
    overallSeoScore += hasCompatibilitySummary ? 8 : 0;
    overallSeoScore += hasSelectionGuide ? 7 : 0;
    overallSeoScore += hasCatalogSignals ? 5 : 0;
    overallSeoScore += Math.round((1 - semanticSimilarityScore) * 3);
    overallSeoScore += Math.round((1 - faqReuseRiskScore) * 1);
    overallSeoScore += Math.round((1 - fingerprintCollisionRiskScore) * 1);

    return {
      specificBlockCount,
      boilerplateRatio,
      hasCompatibilitySummary,
      hasSelectionGuide,
      hasCatalogSignals,
      productSetUniquenessScore,
      compatibilityDeltaScore,
      catalogStructureDeltaScore,
      semanticSimilarityScore,
      faqReuseRiskScore,
      fingerprintCollisionRiskScore,
      overallSeoScore: Math.min(100, overallSeoScore),
    };
  }

  private computeStatus(
    metrics: ReturnType<R2ValidatorService['computeMetrics']>,
    rules: R2Rules,
    headingReasons: string[],
  ) {
    const reasons: string[] = [...headingReasons];

    if (metrics.specificBlockCount < rules.minSpecificBlocks) {
      reasons.push('NOT_ENOUGH_SPECIFIC_BLOCKS');
    }

    if (metrics.boilerplateRatio > rules.maxBoilerplateRatio) {
      reasons.push('BOILERPLATE_RATIO_TOO_HIGH');
    }

    if (!metrics.hasCompatibilitySummary) {
      reasons.push('MISSING_COMPATIBILITY_SUMMARY');
    }

    if (!metrics.hasSelectionGuide) {
      reasons.push('MISSING_SELECTION_GUIDE');
    }

    if (!metrics.hasCatalogSignals) {
      reasons.push('MISSING_CATALOG_SIGNALS');
    }

    if (
      metrics.productSetUniquenessScore < rules.minProductSetUniquenessScore
    ) {
      reasons.push('PRODUCT_SET_UNIQUENESS_TOO_LOW');
    }

    if (metrics.compatibilityDeltaScore < rules.minCompatibilityDeltaScore) {
      reasons.push('COMPATIBILITY_DELTA_TOO_LOW');
    }

    if (
      metrics.catalogStructureDeltaScore < rules.minCatalogStructureDeltaScore
    ) {
      reasons.push('CATALOG_STRUCTURE_DELTA_TOO_LOW');
    }

    if (metrics.semanticSimilarityScore > rules.maxSemanticSimilarityScore) {
      reasons.push('SEMANTIC_SIMILARITY_TOO_HIGH');
    }

    if (metrics.faqReuseRiskScore > rules.maxFaqReuseRiskScore) {
      reasons.push('FAQ_REUSE_RISK_TOO_HIGH');
    }

    if (
      metrics.fingerprintCollisionRiskScore >
      rules.maxFingerprintCollisionRiskScore
    ) {
      reasons.push('FINGERPRINT_COLLISION_RISK_TOO_HIGH');
    }

    const seoReady =
      metrics.overallSeoScore >= rules.minOverallSeoScoreForIndex &&
      reasons.length === 0;

    let decision: 'index' | 'noindex_follow' | 'review_required' = 'index';

    if (
      reasons.includes('SEMANTIC_SIMILARITY_TOO_HIGH') ||
      reasons.includes('FINGERPRINT_COLLISION_RISK_TOO_HIGH')
    ) {
      decision = 'review_required';
    } else if (!seoReady) {
      decision = 'noindex_follow';
    }

    return {
      seoReady,
      publishable: reasons.length === 0,
      decision,
      sitemapEligible: decision === 'index',
      reasons,
    };
  }
}
