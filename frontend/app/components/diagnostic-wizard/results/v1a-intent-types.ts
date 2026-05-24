/**
 * V1A.0 Intent Resolution — Frontend mirror types
 *
 * Mirror canonique du contract backend
 * (`backend/src/modules/diagnostic-engine/types/analyze-response.schema.ts`).
 *
 * Backend = source of truth. Frontend = renderer pur ; ces types décrivent
 * ce que le backend retourne quand `DIAGNOSTIC_PIPELINE_V1_ENABLED=true`.
 *
 * ❌ NE PAS muter / trier / filtrer ces données côté frontend.
 */

export type DiagnosticIntent =
  | 'urgence'
  | 'garage'
  | 'maintenance'
  | 'commerce'
  | 'devis'
  | 'education'
  | 'reassurance';

export type ConfidenceBucket =
  | 'weak'
  | 'ambiguous'
  | 'plausible'
  | 'strong'
  | 'very_strong';

export type ActionType =
  | 'piece'
  | 'devis'
  | 'appel'
  | 'garage'
  | 'guide'
  | 'entretien_pack'
  | 'faq'
  | 'assistant_diagnostic'
  | 'human_resolution';

export type TargetRole = 'R1' | 'R2' | 'R3' | 'human' | 'garage' | 'devis';

export interface IntentLayer {
  value: DiagnosticIntent;
  confidence: number;
  confidence_bucket: ConfidenceBucket;
  reason_codes: string[];
  safety_rail: boolean;
}

export interface RecommendedAction {
  type: ActionType;
  priority: number;
  target: string;
  label_key: string;
  confidence: number;
  rationale_codes: string[];
  target_role: TargetRole;
}

export interface HumanEscalation {
  available: boolean;
  priority_boost: boolean;
  target: string;
  reason_codes: string[];
}

/**
 * V1A.0 enriched fields ajoutés au response /analyze quand flag ON.
 * Tous optionnels côté frontend (fallback : ne pas render si absent).
 */
export interface V1AIntentResolutionFields {
  mode?: 'reactive';
  versions?: { pipeline_version: string };
  intent?: IntentLayer;
  recommended_actions?: RecommendedAction[];
  human_escalation?: HumanEscalation;
}
