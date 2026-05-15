/**
 * ADR-066 — R2 Eligibility Service (Gate 1 — AVANT compose/LLM/embeddings)
 *
 * The "vrai discriminant" gate. Computes `eligibilityScore` ∈ [0,100] = composite
 * of 4 weighted subscores (motor, compat, commercial, crawl).
 *
 * Decision tree :
 *   - eligibilityScore >= THRESHOLD_V1 (=45) → eligible, continue pipeline
 *   - eligibilityScore < THRESHOLD_V1 + sibling INDEX fiable → SUPPRESSED
 *   - eligibilityScore < THRESHOLD_V1 + no canonical fiable → REJECT
 *   - productCount < 2 → REJECT (legacy noindex rule, preserved)
 *
 * Filters ~30-40% of URLs AVANT LLM call → massive cost savings + quality
 * (cf MEMORY feedback_seo_eligibility_gate_before_generation).
 *
 * Pure orchestration : receives pre-computed inputs from data loader, delegates
 * to motor/commercial/catalog services for sub-computations.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ELIGIBILITY_WEIGHTS,
  THRESHOLD_V1,
} from '../constants/r2-eligibility.constants';
import type { MotorDelta } from '../schemas/r2-composition.schema';
import type {
  R2EligibilitySubscores,
  R2EligibilityVerdict,
} from '../schemas/r2-eligibility.schema';
import {
  R2CommercialDistinctivenessService,
  type CommercialInputs,
} from './r2-commercial-distinctiveness.service';

/**
 * ADR-067 (2026-05-15) : pipeline ne peut émettre que 3 verdicts —
 * eligible | review | reject. SUPPRESSED reste manual-only (admin UI).
 *
 * Plus de `hasCanonicalSiblingIndex` ni `siblingCanonicalTarget` ici :
 * la décision SUPPRESSED humaine se fait dans la review queue après
 * que le pipeline a émis `review`, jamais avant.
 */
export interface EligibilityRunInputs {
  pgId: number;
  typeId: number;
  motorDelta: MotorDelta;
  commercialInputs: CommercialInputs;
  productCount: number;
  searchVolumeFactor: number; // log-normalized 0-100 (V-Level or GSC clicks proxy)
}

@Injectable()
export class R2EligibilityService {
  private readonly logger = new Logger(R2EligibilityService.name);

  constructor(
    private readonly commercialService: R2CommercialDistinctivenessService,
  ) {}

  /**
   * Compute eligibility verdict for a (pg_id, type_id) pair.
   *
   * Pure : receives all inputs pre-loaded. Returns verdict + subscores + reason.
   * Caller (admin controller / future BullMQ processor) is responsible for
   * persisting result in __seo_r2_eligibility_log.
   */
  evaluate(inputs: EligibilityRunInputs): R2EligibilityVerdict {
    // Hard reject : productCount < 2 (legacy noindex rule preserved)
    if (inputs.productCount < 2) {
      return {
        eligible: false,
        eligibilityScore: 0,
        subscores: { motor: 0, compat: 0, commercial: 0, crawl: 0 },
        verdict: 'reject',
        reason: `productCount=${inputs.productCount} < 2 (noindex rule)`,
      };
    }

    const motorScore = this.computeMotorScore(inputs.motorDelta);
    const compatScore = this.computeCompatScore(inputs.motorDelta);
    const commercialResult = this.commercialService.compute(
      inputs.commercialInputs,
    );
    const crawlScore = this.computeCrawlScore(
      inputs.productCount,
      inputs.searchVolumeFactor,
    );

    const subscores: R2EligibilitySubscores = {
      motor: motorScore,
      compat: compatScore,
      commercial: commercialResult.score,
      crawl: crawlScore,
    };

    const eligibilityScore =
      ELIGIBILITY_WEIGHTS.motor * subscores.motor +
      ELIGIBILITY_WEIGHTS.compat * subscores.compat +
      ELIGIBILITY_WEIGHTS.commercial * subscores.commercial +
      ELIGIBILITY_WEIGHTS.crawl * subscores.crawl;

    const roundedScore = Math.round(eligibilityScore * 100) / 100;

    if (roundedScore >= THRESHOLD_V1) {
      return {
        eligible: true,
        eligibilityScore: roundedScore,
        subscores,
        verdict: 'eligible',
        reason: `score=${roundedScore} >= THRESHOLD_V1=${THRESHOLD_V1}`,
      };
    }

    // ADR-067 (2026-05-15) : Below threshold + valid productCount → REVIEW
    // (enrichment queue or human validation). Pipeline never emits SUPPRESSED.
    // The admin can manually flip a REVIEW page to SUPPRESSED via UI later if
    // a real duplicate is confirmed humanly (rare exception path).
    return {
      eligible: false,
      eligibilityScore: roundedScore,
      subscores,
      verdict: 'review',
      reason: `score=${roundedScore} < THRESHOLD_V1=${THRESHOLD_V1} — REVIEW queue (enrichment or human validation, ADR-067)`,
    };
  }

  // ── Sub-score computations (pure, deterministic) ─────────────────────────────

  /**
   * motorDeltaScore : binary deltas weighted + count.
   * 5 binary deltas (power, engine, period, fuel, body) each worth 15 points = 75.
   * + productCount bonus up to 25 points (saturates log scale).
   * Range : 0-100.
   */
  private computeMotorScore(motor: MotorDelta): number {
    let score = 0;
    if (motor.hasPowerDelta) score += 15;
    if (motor.hasEngineDelta) score += 15;
    if (motor.hasPeriodDelta) score += 15;
    if (motor.hasFuelDelta) score += 15;
    if (motor.hasBodyDelta) score += 15;

    // log-based bonus on productCount (saturates at ~150 products = 25 points)
    const productBonus = Math.min(25, Math.log10(motor.productCount + 1) * 12);
    score += productBonus;

    return Math.min(100, Math.round(score));
  }

  /**
   * compatibilityDeltaScore : based on uniqueProductFamilies count.
   * 0 unique → 0 score. 1-3 unique → 30-50 score. 4+ unique → 60-100.
   */
  private computeCompatScore(motor: MotorDelta): number {
    const unique = motor.uniqueProductFamilies.length;
    if (unique === 0) return 0;
    if (unique === 1) return 30;
    if (unique === 2) return 45;
    if (unique === 3) return 60;
    return Math.min(100, 60 + (unique - 3) * 10);
  }

  /**
   * crawlValueScore : log(productCount) × searchVolume.
   * Both inputs already in 0-100 range.
   */
  private computeCrawlScore(
    productCount: number,
    searchVolumeFactor: number,
  ): number {
    const productLogScore = Math.min(100, Math.log10(productCount + 1) * 33); // saturates ~1000 products
    return Math.round((productLogScore + searchVolumeFactor) / 2);
  }
}
