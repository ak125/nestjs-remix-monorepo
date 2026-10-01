/**
 * V1A.0 — POST /handoff pure helpers.
 *
 * A click event is derived from the server-side resolution of the stored
 * session, never from values the client claims (intent, confidence, codes).
 * These helpers only identify the clicked element inside that resolution.
 */
import type {
  AnalyzeResponseV1A0,
  HandoffInput,
} from './types/analyze-response.schema';
import type { ActionType, TargetRole } from './types/recommended-action';
import type { DiagnosticReasonCode } from './types/diagnostic-reason-code';
import { VehicleContextInputSchema } from './types/diagnostic-input.schema';

export interface HandoffTarget {
  action_type: ActionType;
  target_role: TargetRole;
  reason_codes: DiagnosticReasonCode[];
}

/**
 * Returns the clicked element of `response`, or null when the resolution
 * does not contain it (the element cannot have been displayed).
 */
export function resolveHandoffTarget(
  response: AnalyzeResponseV1A0,
  input: HandoffInput,
): HandoffTarget | null {
  if (input.surface === 'human_escalation') {
    if (!response.human_escalation.available) return null;
    return {
      action_type: 'human_resolution',
      target_role: 'human',
      reason_codes: response.human_escalation.reason_codes,
    };
  }

  const action = response.recommended_actions.find(
    (a) => a.priority === input.priority,
  );
  if (
    !action ||
    action.type !== input.action_type ||
    action.target_role !== input.target_role
  ) {
    return null;
  }
  return {
    action_type: action.type,
    target_role: action.target_role,
    reason_codes: action.rationale_codes,
  };
}

/**
 * True when a vehicle context carries at least one known field. Applied to
 * the analyze input and to the stored session alike, so both events of a
 * session report the same `vehicle_ctx_present`.
 */
export function hasVehicleContext(value: unknown): boolean {
  const parsed = VehicleContextInputSchema.safeParse(value);
  return (
    parsed.success &&
    Object.values(parsed.data).some((v) => v !== undefined && v !== '')
  );
}
