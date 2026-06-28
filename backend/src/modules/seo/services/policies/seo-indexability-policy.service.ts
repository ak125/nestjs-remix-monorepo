import { Injectable } from '@nestjs/common';
import {
  type SurfaceKey,
  type R2IndexabilityConditions,
  type IndexabilityInput as ComposerInput,
  type IndexabilityVerdict as ComposerVerdict,
  type RobotsValue,
  ReasonCode,
  computeIndexabilityVerdict,
  legacyStringFromKind,
} from '@repo/seo-role-contracts';
import { SeoSurfaceRegistry } from '../../registries/seo-surface.registry';
import { R2IndexabilityGate } from './r2-indexability-gate.service';

// Backward compat (cf. plan UIDP v5/C4) — exposé legacy. Retrait V1.5.
// Les nouveaux callers doivent consommer directement `computeIndexabilityVerdict`
// du package `@repo/seo-role-contracts`.
export type { RobotsValue };

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
 * Thin wrapper Injectable sur `computeIndexabilityVerdict()` du package
 * `@repo/seo-role-contracts` (PR-UIDP-1).
 *
 * Préserve la signature legacy `{ robots, blockingReasons }` pour les
 * callers existants. **Déprécié** — les nouveaux callers (loaders Remix
 * R2/R8 PR-UIDP-2) doivent consommer directement le composer pure du
 * package et `emitRobotsForVerdict()` pour l'émission texte. Retrait V1.5.
 *
 * Cascade décisionnelle déléguée au package (cf. compose-indexability.ts) :
 *   1. URL ≠ canonical (si strict) ⇒ noindex,nofollow + CANONICAL_MISMATCH
 *   2. R2 conditions missing ⇒ noindex,nofollow + R2_CONDITIONS_MISSING
 *   3. R2 gate fail ⇒ noindex,nofollow + R2_GATE_FAIL
 *   4. availableFamilies < min_families ⇒ noindex,follow + FAMILIES_BELOW_THRESHOLD
 *   5. availableGammes < min_gammes ⇒ noindex,follow + GAMMES_BELOW_THRESHOLD
 *   5b. Soft-404 (ADR-095 §1) ⇒ noindex,follow + SOFT_404_EMPTY_CONTENT
 *      (exposé uniquement aux loaders via composer direct, comme tecdoc)
 *   6. Fingerprint match (PR-9) ⇒ noindex,follow + FINGERPRINT_DUPLICATE
 *   7. TecDoc release gate ⇒ noindex,nofollow + TECDOC_RELEASE_GATE
 *      (exposé uniquement aux loaders R8 via composer direct)
 *   8. Sinon ⇒ index,follow
 *
 * Behaviour-preserving 100% vs. version pré-UIDP : les `blockingReasons`
 * legacy strings sont reconstruites depuis le `reasonCode` canonique pour
 * compat de log/test.
 */
@Injectable()
export class SeoIndexabilityPolicyService {
  constructor(
    private readonly surfaces: SeoSurfaceRegistry,
    private readonly r2Gate: R2IndexabilityGate,
  ) {}

  computeIndexability(input: IndexabilityInput): IndexabilityVerdict {
    const composerInput: ComposerInput = {
      surfaceKey: input.surfaceKey,
      requestedUrl: input.requestedUrl,
      canonicalUrl: input.canonicalUrl,
      availableFamilies: input.availableFamilies,
      availableGammes: input.availableGammes,
      r2Conditions: input.r2Conditions,
      fingerprintMatch: input.fingerprintMatch,
      // tecdocReleaseGateOpen non exposé via legacy input — les callers
      // qui en ont besoin (loaders Remix R8) utilisent le composer directement.
    };
    const verdict: ComposerVerdict = computeIndexabilityVerdict(composerInput);
    return {
      robots: legacyStringFromKind(verdict.kind),
      blockingReasons: this.legacyReasonsFromCode(verdict, input),
    };
  }

  /**
   * Reconstruit les strings `blockingReasons` legacy pour préserver
   * l'API publique (tests + log). Retrait V1.5 — les consommateurs
   * migrent vers `verdict.reasonCodes` enum canonique.
   */
  private legacyReasonsFromCode(
    verdict: ComposerVerdict,
    input: IndexabilityInput,
  ): string[] {
    if (verdict.reasonCodes.length === 0) return [];
    const code = verdict.reasonCodes[0];
    switch (code) {
      case ReasonCode.CANONICAL_MISMATCH:
        return [
          `url_mismatch_canonical(${input.requestedUrl} != ${input.canonicalUrl})`,
        ];
      case ReasonCode.R2_CONDITIONS_MISSING:
        return ['r2_conditions_missing'];
      case ReasonCode.R2_GATE_FAIL: {
        // Reconstruit la liste R2 sub-reasons depuis le gate (préserve
        // l'ancien shape "blockingReasons" qui exposait les R2 details).
        if (input.r2Conditions) {
          const r2Verdict = this.r2Gate.evaluate(input.r2Conditions);
          if (!r2Verdict.indexable) return r2Verdict.blockingReasons;
        }
        return ['r2_gate_fail'];
      }
      case ReasonCode.FAMILIES_BELOW_THRESHOLD: {
        const thresholds = this.surfaces.getThresholds(input.surfaceKey);
        return [
          `families_below_threshold(${input.availableFamilies}<${thresholds.min_families})`,
        ];
      }
      case ReasonCode.GAMMES_BELOW_THRESHOLD: {
        const thresholds = this.surfaces.getThresholds(input.surfaceKey);
        return [
          `gammes_below_threshold(${input.availableGammes}<${thresholds.min_gammes})`,
        ];
      }
      case ReasonCode.SOFT_404_EMPTY_CONTENT:
        return ['soft_404_empty_content'];
      case ReasonCode.FINGERPRINT_DUPLICATE:
        return ['fingerprint_duplicate_match'];
      case ReasonCode.TECDOC_RELEASE_GATE:
        return ['tecdoc_release_gate'];
    }
  }
}
