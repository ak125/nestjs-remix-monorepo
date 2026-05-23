/**
 * IntentClassifier — V1A.0 pure rules
 *
 * Pure function : EvidencePack → {value, confidence, confidence_bucket, reason_codes, safety_rail}
 * Aucune I/O, déterministe, testable unitaire.
 *
 * Source de vérité : ADR vault "Intent Resolution V1 doctrine".
 *
 * Pipeline de décision (priority-ordered, first-match) :
 *   1. Safety rail triggers (vehicle absent / confidence insufficient / contradictory)
 *   2. urgence    (risk_level ∈ {critical, high})
 *   3. garage     (catalog non-ready + multi-system OR repair difficulty high)
 *   4. maintenance (maintenance_links present)
 *   5. commerce   (catalog ready + suggested_gammes + vehicle_ctx + confidence ≥ plausible)
 *   6. reassurance (risk_level = low + symptome bénin)
 *   7. education  (fallback — low confidence OR signal_quality low)
 */
import { Injectable } from '@nestjs/common';
import type { EvidencePack } from '../types/evidence-pack.schema';
import type {
  DiagnosticIntent,
  ConfidenceBucket,
} from '../types/diagnostic-intent';
import type { DiagnosticReasonCode } from '../types/diagnostic-reason-code';
import { getConfidenceBucket } from './confidence-policy';

export type IntentResult = {
  value: DiagnosticIntent;
  confidence: number;
  confidence_bucket: ConfidenceBucket;
  reason_codes: DiagnosticReasonCode[];
  safety_rail: boolean;
};

type EvidencePackInner = EvidencePack['evidence_pack'];

@Injectable()
export class IntentClassifierService {
  /**
   * Pure classification. Same input → same output, no I/O.
   *
   * @param pack EvidencePack inner (from orchestrator output)
   * @param vehicleContextPresent true si vehicle_context non-vide à l'input
   */
  classify(
    pack: EvidencePackInner,
    vehicleContextPresent: boolean,
  ): IntentResult {
    const safetyRailCheck = this.checkSafetyRail(pack, vehicleContextPresent);
    if (safetyRailCheck.triggered) {
      const value: DiagnosticIntent = 'education';
      const confidence = 0.4; // ambiguous bucket — drives safety_rail path
      return {
        value,
        confidence,
        confidence_bucket: getConfidenceBucket(confidence),
        reason_codes: safetyRailCheck.reasonCodes,
        safety_rail: true,
      };
    }

    // 2. urgence — risk_level critical/high
    if (pack.risk_level === 'critical' || pack.risk_level === 'high') {
      const code: DiagnosticReasonCode =
        pack.risk_level === 'critical'
          ? 'DR_INTENT_SAFETY_URGENCY_CRITICAL'
          : 'DR_INTENT_SAFETY_URGENCY_IMMINENT';
      const confidence = pack.risk_level === 'critical' ? 1.0 : 0.85;
      return {
        value: 'urgence',
        confidence,
        confidence_bucket: getConfidenceBucket(confidence),
        reason_codes: [code],
        safety_rail: false,
      };
    }

    // 3. garage — catalog non-ready + multi-system OR allowed_output_mode = none
    const multiSystem = pack.system_suspects.length >= 2;
    const catalogClosed =
      pack.catalog_guard.allowed_output_mode === 'none' ||
      !pack.catalog_guard.ready_for_catalog;
    if (catalogClosed && multiSystem) {
      const confidence = Math.min(0.9, 0.5 + 0.1 * pack.system_suspects.length);
      return {
        value: 'garage',
        confidence,
        confidence_bucket: getConfidenceBucket(confidence),
        reason_codes: ['DR_INTENT_REPAIR_DIFFICULTY_HIGH'],
        safety_rail: false,
      };
    }

    // 4. maintenance — maintenance_links populés
    if (pack.maintenance_links.length > 0) {
      const confidence = 0.75;
      return {
        value: 'maintenance',
        confidence,
        confidence_bucket: getConfidenceBucket(confidence),
        reason_codes: ['DR_INTENT_MAINTENANCE_FLAG_TRUE'],
        safety_rail: false,
      };
    }

    // 5. commerce — catalog ready + suggested_gammes + vehicle_ctx + medium/high confidence
    const catalogReady =
      pack.catalog_guard.ready_for_catalog &&
      pack.catalog_guard.confidence_before_purchase !== 'low';
    const hasGamme = (pack.catalog_guard.suggested_gammes?.length ?? 0) > 0;
    if (catalogReady && hasGamme && vehicleContextPresent) {
      const confidenceMap = {
        high: 0.9,
        medium: 0.7,
        low: 0.5,
      } as const;
      const confidence =
        confidenceMap[pack.catalog_guard.confidence_before_purchase];
      return {
        value: 'commerce',
        confidence,
        confidence_bucket: getConfidenceBucket(confidence),
        reason_codes: ['DR_INTENT_HIGH_CONFIDENCE_COMMERCE'],
        safety_rail: false,
      };
    }

    // 6. education — fallback (low confidence OR symptome flou ne matchant aucune autre règle)
    //
    // V1A.0 NOTE : `reassurance` intent (risk_level=low + bénin) défini dans enum
    // mais classifier non-activé V1A.0 — aucun reason_code canonique du cap-14 ne le couvre
    // précisément (DR_INTENT_SAFETY_URGENCY_LOW_BENIGN serait à ajouter, ADR amendment).
    // V1A.1 décidera empirique (volume KPI) si activation utile.
    const confidence = Math.max(
      0.2,
      Math.min(0.5, 1 - (pack.diagnostic_confidence ?? 50) / 100),
    );
    return {
      value: 'education',
      confidence,
      confidence_bucket: getConfidenceBucket(confidence),
      reason_codes: ['DR_INTENT_HYPOTHESIS_CONFIDENCE_LOW'],
      safety_rail: false,
    };
  }

  /**
   * Safety rail check : conditions où l'on doit forcer l'humain en top action.
   * Return triggered=true si l'un des cas critiques s'applique.
   */
  private checkSafetyRail(
    pack: EvidencePackInner,
    vehicleContextPresent: boolean,
  ): { triggered: boolean; reasonCodes: DiagnosticReasonCode[] } {
    const codes: DiagnosticReasonCode[] = [];

    // Vehicle context absent + symptome non-trivial
    if (!vehicleContextPresent) {
      codes.push('DR_SAFETY_VEHICLE_CONTEXT_MISSING');
    }

    // Diagnostic confidence très faible — pas de classification fiable
    const dconf = pack.diagnostic_confidence ?? 0;
    if (dconf < 30) {
      codes.push('DR_SAFETY_HYPOTHESIS_CONFIDENCE_INSUFFICIENT');
    }

    // Signaux contradictoires : hypotheses high-score mais signal_quality = low
    const hasHighScore = pack.candidate_hypotheses.some(
      (h) => h.relative_score >= 70,
    );
    if (hasHighScore && pack.signal_quality === 'low') {
      codes.push('DR_SAFETY_CONTRADICTORY_SIGNALS');
    }

    return { triggered: codes.length > 0, reasonCodes: codes };
  }
}
