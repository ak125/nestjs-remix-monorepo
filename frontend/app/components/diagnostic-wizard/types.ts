/**
 * Types shared by all wizard components
 * Aligned on backend EvidencePack output (Slice 2)
 */

export interface WizardState {
  step: number;
  vehicle: {
    brand: string;
    brandId?: number;
    model: string;
    modelId?: number;
    year?: number;
    mileage_km?: number;
    fuel?: string;
  };
  usageProfile?: string;
  lastServiceKm?: number;
  systemScope: string;
  symptomSlugs: string[];
  result: DiagnosticApiResponse | null;
  loading: boolean;
  error: string | null;
}

export type WizardAction =
  | { type: "SET_VEHICLE"; payload: WizardState["vehicle"] }
  | { type: "SET_USAGE"; payload: { profile?: string; lastServiceKm?: number } }
  | { type: "SET_SYSTEM"; payload: string }
  | { type: "SET_SYMPTOMS"; payload: string[] }
  | { type: "ADD_SYMPTOM"; payload: string }
  | { type: "REMOVE_SYMPTOM"; payload: string }
  | { type: "SET_STEP"; payload: number }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_RESULT"; payload: DiagnosticApiResponse }
  | { type: "SET_ERROR"; payload: string }
  | { type: "RESET" };

// ── API Response types (from backend EvidencePack) ──

export interface ScoringBreakdown {
  signal_match: number;
  vehicle_fit: number;
  lifecycle_fit: number;
  maintenance_history: number;
  plausibility: number;
  context: number;
}

export interface Hypothesis {
  hypothesis_id: string;
  label: string;
  cause_type: string;
  relative_score: number;
  urgency: "haute" | "moyenne" | "basse";
  evidence_for: string[];
  evidence_against: string[];
  verification_method?: string;
  requires_verification: boolean;
  related_gamme_slugs?: string[];
  scoring_breakdown?: ScoringBreakdown;
}

export interface SuggestedGamme {
  gamme_slug: string;
  gamme_label: string;
  pg_id: number;
  confidence: "high" | "medium" | "low";
  from_hypothesis?: string;
}

export interface MaintenanceRecommendation {
  operation_slug: string;
  operation_label: string;
  description: string;
  relevance: "primary" | "related";
  interval_km: string;
  interval_months: string;
  severity_if_overdue: string;
  overdue_status?: "overdue" | "approaching" | "ok" | "unknown";
  related_gamme_slug?: string;
  related_pg_id?: number;
}

export interface RagFact {
  evidence_type: string;
  content: string;
  source_file?: string;
  truth_level?: "L1" | "L2" | "L3" | "L4";
}

export interface EvidencePack {
  factual_inputs_confirmed: string[];
  factual_inputs_missing: string[];
  system_suspects: string[];
  candidate_hypotheses: Hypothesis[];
  maintenance_links: string[];
  risk_flags: string[];
  safety_alert?: string;
  risk_level?: "critical" | "high" | "moderate" | "low";
  catalog_guard: {
    ready_for_catalog: boolean;
    confidence_before_purchase: string;
    allowed_output_mode: string;
    reason: string;
    suggested_gammes: SuggestedGamme[];
  };
  maintenance_recommendations?: MaintenanceRecommendation[];
  rag_facts?: RagFact[];
  allowed_claims: string[];
  forbidden_claims_runtime: string[];
  signal_quality?: string;
  ui_block_inputs: Record<string, unknown>;
}

export interface DiagnosticApiResponse {
  success: boolean;
  session_id?: string;
  evidence_pack?: EvidencePack;
  error?: string;
}

export interface SymptomOption {
  slug: string;
  label: string;
  description: string;
  urgency: string;
}
