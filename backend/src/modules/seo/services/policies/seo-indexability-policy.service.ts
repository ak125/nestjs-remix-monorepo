import { Injectable } from '@nestjs/common';
import {
  type SurfaceKey,
  type R2IndexabilityConditions,
} from '@repo/seo-role-contracts';
import { SeoSurfaceRegistry } from '../../registries/seo-surface.registry';
import { R2IndexabilityGate } from './r2-indexability-gate.service';

export type RobotsValue =
  | 'index,follow'
  | 'noindex,follow'
  | 'noindex,nofollow';

export interface IndexabilityInput {
  surfaceKey: SurfaceKey;
  requestedUrl: string;
  canonicalUrl: string;
  availableFamilies?: number;
  availableGammes?: number;
  /** Si surfaceKey ∈ R2_*, conditions du gate. */
  r2Conditions?: R2IndexabilityConditions;
  /** Set par PR-9 (fingerprint match). undefined = check pas encore actif. */
  fingerprintMatch?: boolean;
}

export interface IndexabilityVerdict {
  robots: RobotsValue;
  blockingReasons: string[];
}

/**
 * Calcule la directive `robots` selon les seuils legacy + le gate R2.
 *
 * Cascade décisionnelle (cf. plan v9 section 3.6) :
 *   1. URL ≠ canonical (si strict) ⇒ noindex,nofollow
 *   2. Surface R2 et gate fail ⇒ noindex,nofollow
 *   3. availableFamilies < min_families ⇒ noindex,follow
 *   4. availableGammes < min_gammes ⇒ noindex,follow
 *   5. Fingerprint match (PR-9) ⇒ noindex,follow
 *   6. Sinon ⇒ index,follow
 */
@Injectable()
export class SeoIndexabilityPolicyService {
  constructor(
    private readonly surfaces: SeoSurfaceRegistry,
    private readonly r2Gate: R2IndexabilityGate,
  ) {}

  computeIndexability(input: IndexabilityInput): IndexabilityVerdict {
    const reasons: string[] = [];
    const thresholds = this.surfaces.getThresholds(input.surfaceKey);

    // 1. URL ≠ canonical strict
    if (
      thresholds.strict_canonical_match &&
      input.requestedUrl !== input.canonicalUrl
    ) {
      reasons.push(
        `url_mismatch_canonical(${input.requestedUrl} != ${input.canonicalUrl})`,
      );
      return { robots: 'noindex,nofollow', blockingReasons: reasons };
    }

    // 2. R2 gate
    if (this.isR2Surface(input.surfaceKey)) {
      if (!input.r2Conditions) {
        reasons.push('r2_conditions_missing');
        return { robots: 'noindex,nofollow', blockingReasons: reasons };
      }
      const verdict = this.r2Gate.evaluate(input.r2Conditions);
      if (!verdict.indexable) {
        return {
          robots: 'noindex,nofollow',
          blockingReasons: verdict.blockingReasons,
        };
      }
    }

    // 3. min_families
    if (
      thresholds.min_families !== null &&
      input.availableFamilies !== undefined &&
      input.availableFamilies < thresholds.min_families
    ) {
      reasons.push(
        `families_below_threshold(${input.availableFamilies}<${thresholds.min_families})`,
      );
      return { robots: 'noindex,follow', blockingReasons: reasons };
    }

    // 4. min_gammes
    if (
      thresholds.min_gammes !== null &&
      input.availableGammes !== undefined &&
      input.availableGammes < thresholds.min_gammes
    ) {
      reasons.push(
        `gammes_below_threshold(${input.availableGammes}<${thresholds.min_gammes})`,
      );
      return { robots: 'noindex,follow', blockingReasons: reasons };
    }

    // 5. Fingerprint match (PR-9)
    if (input.fingerprintMatch === true) {
      reasons.push('fingerprint_duplicate_match');
      return { robots: 'noindex,follow', blockingReasons: reasons };
    }

    return { robots: 'index,follow', blockingReasons: [] };
  }

  private isR2Surface(key: SurfaceKey): boolean {
    return (
      key === 'R2_PRODUCT' ||
      key === 'R2_PRODUCT_IN_VEHICLE' ||
      key === 'R2_PRODUCT_LIST'
    );
  }
}
