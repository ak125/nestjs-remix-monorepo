/**
 * compose-indexability — pure function canonique de la cascade d'indexabilité SEO.
 *
 * Extraction (PR-UIDP-1) de la logique de `SeoIndexabilityPolicyService.computeIndexability()`
 * en pure function réutilisable côté backend NestJS ET frontend Remix SSR.
 *
 * Cascade décisionnelle (cf. plan seo-v9 section 3.6 + plan UIDP V1) :
 *   1. URL ≠ canonical (si strict_canonical_match=true)
 *      ⇒ NOINDEX_NOFOLLOW + reasonCodes:[CANONICAL_MISMATCH]
 *   2. Surface R2 sans payload r2Conditions
 *      ⇒ NOINDEX_NOFOLLOW + reasonCodes:[R2_CONDITIONS_MISSING] (fail-safe)
 *   3. Surface R2 + gate fail (≥1 condition manquante)
 *      ⇒ NOINDEX_NOFOLLOW + reasonCodes:[R2_GATE_FAIL]
 *   4. availableFamilies < min_families
 *      ⇒ NOINDEX_FOLLOW + reasonCodes:[FAMILIES_BELOW_THRESHOLD]
 *   5. availableGammes < min_gammes
 *      ⇒ NOINDEX_FOLLOW + reasonCodes:[GAMMES_BELOW_THRESHOLD]
 *   6. Fingerprint match (PR-9)
 *      ⇒ NOINDEX_FOLLOW + reasonCodes:[FINGERPRINT_DUPLICATE]
 *   7. TecDoc release gate ouverte (caller flag)
 *      ⇒ NOINDEX_NOFOLLOW + reasonCodes:[TECDOC_RELEASE_GATE]
 *   8. Default ⇒ INDEX_FOLLOW + reasonCodes:[]
 *
 * Invariants V1 (cf. plan UIDP v5/C2) :
 *   - Short-circuit au premier blocking → `reasonCodes.length ∈ {0, 1}`
 *   - Behaviour-preserving strict vs. `SeoIndexabilityPolicyService` v0
 *   - Secondaires `reasonCodes[1..N]` = V1.5 evidence-gated (mode audit séparé)
 *
 * @see robots-verdict.ts (types canon)
 * @see emit-robots.ts (single text emitter)
 * @see backend/.../seo-indexability-policy.service.ts (thin wrapper Injectable)
 */
import { getThresholds } from "./noindex-thresholds";
import { evaluateR2Indexability } from "./r2-indexability-conditions";
import type { SurfaceKey } from "./surface-keys";
import {
  ReasonCode,
  RobotsVerdictKind,
  type IndexabilityInput,
  type IndexabilityVerdict,
} from "./robots-verdict";

/**
 * Calcule le verdict d'indexabilité canonique pour une input pure.
 *
 * Pure function : même input → même output, pas d'I/O, pas d'horodatage non
 * déterministe (sauf `context.computedAt` qui est une trace, pas une décision).
 *
 * Le caller (backend service, loader Remix) consomme `verdict.kind` directement
 * ou passe le verdict à `emitRobotsForVerdict()` pour obtenir
 * `metaContent` (HTML) et `headerValue` (X-Robots-Tag), garantis identiques
 * par construction.
 */
export function computeIndexabilityVerdict(
  input: IndexabilityInput,
): IndexabilityVerdict {
  const thresholds = getThresholds(input.surfaceKey);
  const baseContext = {
    surfaceKey: input.surfaceKey,
    requestedUrl: input.requestedUrl,
    canonicalUrl: input.canonicalUrl,
    computedAt: new Date().toISOString(),
  };

  // 1. URL ≠ canonical strict — exclusif court-circuit.
  if (
    thresholds.strict_canonical_match &&
    input.requestedUrl !== input.canonicalUrl
  ) {
    return {
      kind: RobotsVerdictKind.NOINDEX_NOFOLLOW,
      reasonCodes: [ReasonCode.CANONICAL_MISMATCH],
      context: baseContext,
    };
  }

  // 2. + 3. R2 gate
  if (isR2Surface(input.surfaceKey)) {
    if (!input.r2Conditions) {
      return {
        kind: RobotsVerdictKind.NOINDEX_NOFOLLOW,
        reasonCodes: [ReasonCode.R2_CONDITIONS_MISSING],
        context: baseContext,
      };
    }
    const r2Verdict = evaluateR2Indexability(input.r2Conditions);
    if (!r2Verdict.indexable) {
      return {
        kind: RobotsVerdictKind.NOINDEX_NOFOLLOW,
        reasonCodes: [ReasonCode.R2_GATE_FAIL],
        context: baseContext,
      };
    }
  }

  // 4. families threshold (R1/R6/R7).
  if (
    thresholds.min_families !== null &&
    input.availableFamilies !== undefined &&
    input.availableFamilies < thresholds.min_families
  ) {
    return {
      kind: RobotsVerdictKind.NOINDEX_FOLLOW,
      reasonCodes: [ReasonCode.FAMILIES_BELOW_THRESHOLD],
      context: baseContext,
    };
  }

  // 5. gammes threshold (R1/R8).
  if (
    thresholds.min_gammes !== null &&
    input.availableGammes !== undefined &&
    input.availableGammes < thresholds.min_gammes
  ) {
    return {
      kind: RobotsVerdictKind.NOINDEX_FOLLOW,
      reasonCodes: [ReasonCode.GAMMES_BELOW_THRESHOLD],
      context: baseContext,
    };
  }

  // 6. fingerprint match (PR-9).
  if (input.fingerprintMatch === true) {
    return {
      kind: RobotsVerdictKind.NOINDEX_FOLLOW,
      reasonCodes: [ReasonCode.FINGERPRINT_DUPLICATE],
      context: baseContext,
    };
  }

  // 7. tecdoc release gate (R8 hardcoded range — caller flag).
  if (input.tecdocReleaseGateOpen === true) {
    return {
      kind: RobotsVerdictKind.NOINDEX_NOFOLLOW,
      reasonCodes: [ReasonCode.TECDOC_RELEASE_GATE],
      context: baseContext,
    };
  }

  // 8. default — page indexable.
  return {
    kind: RobotsVerdictKind.INDEX_FOLLOW,
    reasonCodes: [],
    context: baseContext,
  };
}

function isR2Surface(key: SurfaceKey): boolean {
  return (
    key === "R2_PRODUCT" ||
    key === "R2_PRODUCT_IN_VEHICLE" ||
    key === "R2_PRODUCT_LIST"
  );
}
