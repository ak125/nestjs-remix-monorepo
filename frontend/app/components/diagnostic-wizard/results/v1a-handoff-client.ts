/**
 * V1A.0 — POST /api/diagnostic-engine/handoff helper
 *
 * Émet canonical event `action_clicked` tagué target_role.
 * Fire-and-forget : si l'event échoue, la navigation user n'est pas bloquée.
 */
import type {
  ActionType,
  DiagnosticIntent,
  TargetRole,
} from './v1a-intent-types';

export interface HandoffPayload {
  session_id: string;
  action_type: ActionType;
  target_role: TargetRole;
  intent: DiagnosticIntent;
  confidence: number;
}

export async function emitHandoff(payload: HandoffPayload): Promise<void> {
  try {
    await fetch('/api/diagnostic-engine/handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Fire-and-forget : ne block pas la navigation
      keepalive: true,
    });
  } catch {
    // Silent — log côté backend uniquement
  }
}
