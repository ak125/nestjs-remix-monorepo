/**
 * V1A.0 — POST /api/diagnostic-engine/handoff helper
 *
 * Émet canonical event `action_clicked` tagué target_role.
 * Désigne seulement l'élément cliqué : intent, confidence et codes sont
 * re-dérivés par le backend depuis la session stockée.
 * Fire-and-forget : si l'event échoue, la navigation user n'est pas bloquée.
 */
import  {
  type ActionType,
  type TargetRole,
} from './v1a-intent-types';

export type HandoffPayload =
  | {
      surface: 'recommended_action';
      session_id: string;
      priority: number;
      action_type: ActionType;
      target_role: TargetRole;
    }
  | { surface: 'human_escalation'; session_id: string };

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
