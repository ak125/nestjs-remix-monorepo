/**
 * HumanEscalationBuilder — V1A.0 first-class citizen
 *
 * Doctrine : `human_escalation.available = true` TOUJOURS V1A.0.
 * `priority_boost` contrôle visibilité visuelle PRIMAIRE :
 *   - true si intent ∈ {urgence, garage}
 *   - true si safety_rail = true
 *   - false sinon (HumanEscalationCard rendue en secondaire)
 *
 * Moat futur V1.5+ : intelligent dispatch (specialist matching, SLA tiering).
 */
import { Injectable } from '@nestjs/common';
import type { HumanEscalation } from '../types/human-escalation';
import type { DiagnosticReasonCode } from '../types/diagnostic-reason-code';
import type { IntentResult } from './intent-classifier.service';

@Injectable()
export class HumanEscalationBuilderService {
  /**
   * Pure builder — toujours présent dans payload, jamais optionnel.
   */
  build(intent: IntentResult): HumanEscalation {
    const priority_boost =
      intent.safety_rail ||
      intent.value === 'urgence' ||
      intent.value === 'garage';

    const reason_codes: DiagnosticReasonCode[] = priority_boost
      ? this.buildBoostReasonCodes(intent)
      : ['DR_HANDOFF_TO_HUMAN'];

    return {
      available: true,
      priority_boost,
      target: '/devis-humain',
      reason_codes,
    };
  }

  private buildBoostReasonCodes(intent: IntentResult): DiagnosticReasonCode[] {
    const codes: DiagnosticReasonCode[] = [];

    if (intent.value === 'urgence') {
      codes.push('DR_OVERRIDE_URGENCY_PROMOTE_HUMAN');
    }
    if (intent.value === 'garage') {
      codes.push('DR_OVERRIDE_DIFFICULTY_HIGH_PROMOTE_GARAGE');
    }
    if (intent.safety_rail) {
      // Add the most specific safety code from intent.reason_codes
      const safetyCode = intent.reason_codes.find((c) =>
        c.startsWith('DR_SAFETY_'),
      );
      if (safetyCode) codes.push(safetyCode);
    }
    codes.push('DR_HANDOFF_TO_HUMAN');

    return [...new Set(codes)];
  }
}
