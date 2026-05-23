/**
 * OutcomeEmitter — V1A.0 canonical event writer
 *
 * Émet **1 seul event type** `diagnostic_resolution_outcome` (anti-cardinality
 * explosion). 3 outcome_types V1A.0 discriminés par payload :
 *   - `intent_resolved`        (safety_rail = false)
 *   - `safety_rail_triggered`  (safety_rail = true)
 *   - `action_clicked`         (depuis POST /handoff, payload tagué target_role)
 *
 * Dérivations runtime via SQL (anti double-truth) :
 *   - `to_commerce` = `action_clicked WHERE payload->>'target_role' IN ('R1','R2')`
 *   - `to_human`    = `action_clicked WHERE payload->>'target_role' = 'human'`
 *
 * Différé V1A.1 : `recommendation_rejected` outcome + commerce_outcome_signal column
 * Différé V1.1  : `issue_resolved_approx` outcome
 *
 * Writes vers `__seo_event_log` (entity_url=null, severity='info').
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';
import type { AnalyzeResponseV1A0 } from '../types/analyze-response.schema';
import type {
  ActionType,
  TargetRole,
} from '../types/recommended-action';
import type { DiagnosticIntent } from '../types/diagnostic-intent';
import type { DiagnosticReasonCode } from '../types/diagnostic-reason-code';

export type OutcomeType =
  | 'intent_resolved'
  | 'safety_rail_triggered'
  | 'action_clicked';

export interface BasePayload {
  outcome_type: OutcomeType;
  session_id: string | null;
  symptom_slug?: string;
  intent: DiagnosticIntent;
  confidence: number;
  confidence_bucket: string;
  reason_codes: DiagnosticReasonCode[];
  safety_rail: boolean;
  vehicle_ctx_present: boolean;
  human_escalation_priority_boost: boolean;
  pipeline_version: string;
  mode: 'reactive';
}

export interface ActionClickedPayload extends BasePayload {
  outcome_type: 'action_clicked';
  action_type: ActionType;
  target_role: TargetRole;
}

@Injectable()
export class OutcomeEmitterService extends SupabaseBaseService {
  private readonly outcomeLogger = new Logger(OutcomeEmitterService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Émet event lors de la résolution intent (pipeline.resolve).
   * Discriminant : `intent_resolved` ou `safety_rail_triggered`.
   *
   * Fire-and-forget : log warning si échec, ne block jamais le response.
   */
  async emitResolution(
    response: AnalyzeResponseV1A0,
    vehicleContextPresent: boolean,
    symptomSlug?: string,
  ): Promise<void> {
    const outcome_type: OutcomeType = response.intent.safety_rail
      ? 'safety_rail_triggered'
      : 'intent_resolved';

    const payload: BasePayload = {
      outcome_type,
      session_id: response.session_id,
      symptom_slug: symptomSlug,
      intent: response.intent.value,
      confidence: response.intent.confidence,
      confidence_bucket: response.intent.confidence_bucket,
      reason_codes: response.intent.reason_codes,
      safety_rail: response.intent.safety_rail,
      vehicle_ctx_present: vehicleContextPresent,
      human_escalation_priority_boost:
        response.human_escalation.priority_boost,
      pipeline_version: response.versions.pipeline_version,
      mode: response.mode,
    };

    await this.write(payload);
  }

  /**
   * Émet event lorsque user clique une action (POST /handoff).
   * `target_role` discrimine pour dérivations to_commerce / to_human.
   */
  async emitActionClicked(params: {
    sessionId: string;
    actionType: ActionType;
    targetRole: TargetRole;
    intent: DiagnosticIntent;
    confidence: number;
    confidenceBucket: string;
    pipelineVersion: string;
  }): Promise<void> {
    const payload: ActionClickedPayload = {
      outcome_type: 'action_clicked',
      session_id: params.sessionId,
      intent: params.intent,
      confidence: params.confidence,
      confidence_bucket: params.confidenceBucket,
      reason_codes: ['DR_HANDOFF_TO_COMMERCE'], // top-level handoff marker; refined V1A.1
      safety_rail: false,
      vehicle_ctx_present: true, // handoff implies session context exists
      human_escalation_priority_boost:
        params.targetRole === 'human',
      pipeline_version: params.pipelineVersion,
      mode: 'reactive',
      action_type: params.actionType,
      target_role: params.targetRole,
    };

    await this.write(payload);
  }

  private async write(payload: BasePayload): Promise<void> {
    try {
      const { error } = await this.supabase.from('__seo_event_log').insert({
        event_type: 'diagnostic_resolution_outcome',
        entity_url: null,
        severity: 'info',
        payload,
      });
      if (error) {
        this.outcomeLogger.warn(
          `Failed to write outcome event: ${error.message}`,
        );
      }
    } catch (err) {
      // Fire-and-forget : never block response path
      this.outcomeLogger.warn(
        `Outcome event write threw: ${(err as Error).message}`,
      );
    }
  }
}
