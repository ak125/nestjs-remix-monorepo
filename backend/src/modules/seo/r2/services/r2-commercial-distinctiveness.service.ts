/**
 * ADR-066 — R2 Commercial Distinctiveness Service
 *
 * Pure function computing `commercialDistinctivenessScore` (0-100) — the
 * **vrai discriminant SEO transactionnel** (cf user revue 2026-05-15) beyond
 * just mechanical Δhp / Δfuel deltas.
 *
 * Formula (cf r2-eligibility.constants.ts COMMERCIAL_DISTINCTIVENESS_WEIGHTS) :
 *   commercialDistinctivenessScore = 0.30 × Δ familles produits
 *                                  + 0.25 × Δ OEM refs
 *                                  + 0.20 × Δ équipementiers
 *                                  + 0.15 × Δ prix médian (normalisé)
 *                                  + 0.10 × Δ compatibilité (overlap inverse)
 *
 * Each sub-delta is a 0-100 score derived from set/numeric differences vs
 * the cluster median.
 */

import { Injectable } from '@nestjs/common';
import { COMMERCIAL_DISTINCTIVENESS_WEIGHTS } from '../constants/r2-eligibility.constants';

export interface CommercialInputs {
  // Target
  targetFamilies: string[];
  targetOemRefs: string[];
  targetSuppliers: string[];
  targetMedianPriceCents: number | null;
  targetCompatScope: string[]; // normalized compat scope tokens

  // Cluster median (siblings aggregated)
  clusterFamilies: string[]; // union of all siblings' families
  clusterOemRefs: string[];
  clusterSuppliers: string[];
  clusterMedianPriceCents: number | null;
  clusterCompatScope: string[];
}

export interface CommercialDistinctivenessResult {
  score: number; // composite 0-100
  subscores: {
    families: number;
    oem: number;
    suppliers: number;
    medianPrice: number;
    compat: number;
  };
}

@Injectable()
export class R2CommercialDistinctivenessService {
  /**
   * Compute composite score 0-100.
   */
  compute(inputs: CommercialInputs): CommercialDistinctivenessResult {
    const subscores = {
      families: this.setDistinctnessScore(
        inputs.targetFamilies,
        inputs.clusterFamilies,
      ),
      oem: this.setDistinctnessScore(
        inputs.targetOemRefs,
        inputs.clusterOemRefs,
      ),
      suppliers: this.setDistinctnessScore(
        inputs.targetSuppliers,
        inputs.clusterSuppliers,
      ),
      medianPrice: this.priceDeltaScore(
        inputs.targetMedianPriceCents,
        inputs.clusterMedianPriceCents,
      ),
      // Compat distinctness = inverse overlap (low overlap = high distinctness)
      compat:
        100 -
        this.setOverlapScore(
          inputs.targetCompatScope,
          inputs.clusterCompatScope,
        ),
    };

    const score =
      COMMERCIAL_DISTINCTIVENESS_WEIGHTS.families * subscores.families +
      COMMERCIAL_DISTINCTIVENESS_WEIGHTS.oem * subscores.oem +
      COMMERCIAL_DISTINCTIVENESS_WEIGHTS.suppliers * subscores.suppliers +
      COMMERCIAL_DISTINCTIVENESS_WEIGHTS.medianPrice * subscores.medianPrice +
      COMMERCIAL_DISTINCTIVENESS_WEIGHTS.compat * subscores.compat;

    return {
      score: this.clamp(Math.round(score), 0, 100),
      subscores: {
        families: Math.round(subscores.families),
        oem: Math.round(subscores.oem),
        suppliers: Math.round(subscores.suppliers),
        medianPrice: Math.round(subscores.medianPrice),
        compat: Math.round(subscores.compat),
      },
    };
  }

  /**
   * Distinctness score : proportion of target items not present in cluster.
   * Returns 0-100. 100 = target completely unique vs cluster.
   */
  private setDistinctnessScore(target: string[], cluster: string[]): number {
    if (target.length === 0) return 0;
    const clusterSet = new Set(cluster);
    const distinct = target.filter((item) => !clusterSet.has(item));
    return (distinct.length / target.length) * 100;
  }

  /**
   * Set overlap (Jaccard-like). Returns 0-100. 100 = identical sets.
   */
  private setOverlapScore(a: string[], b: string[]): number {
    const setA = new Set(a);
    const setB = new Set(b);
    if (setA.size === 0 && setB.size === 0) return 0;

    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return (intersection.size / union.size) * 100;
  }

  /**
   * Price delta score : normalized |target - cluster| / cluster.
   * Returns 0-100. Clamped at 50% delta = full distinctness (100).
   */
  private priceDeltaScore(
    target: number | null,
    cluster: number | null,
  ): number {
    if (target === null || cluster === null || cluster === 0) return 0;
    const delta = Math.abs(target - cluster) / cluster;
    return this.clamp(delta * 200, 0, 100); // delta=0.5 → 100
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
