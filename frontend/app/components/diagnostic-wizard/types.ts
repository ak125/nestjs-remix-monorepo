import {
  type IntentLayer,
  type RecommendedAction,
  type HumanEscalation,
} from "./results/v1a-intent-types";
import { type MaintenanceRecord } from "./steps/StepMaintenance";
/**
 * Types shared by all wizard components
 * Aligned on backend EvidencePack output (Slice 2)
 */

export interface WizardState {
  step: number;
  analysisMode?: "diagnostic" | "maintenance";
  maintenanceRecords?: MaintenanceRecord[];
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
  | { type: "SET_MODE"; payload: "diagnostic" | "maintenance" }
  | { type: "SET_MAINTENANCE_RECORDS"; payload: MaintenanceRecord[] }
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

/**
 * What the WIKI documents behind a hypothesis: sourced = every symptom → cause
 * link has a validated fiche, partial = some, unsourced = none. The pack also
 * lists the links and fiches; the results page shows the state only.
 */
export type ProvenanceState = "sourced" | "partial" | "unsourced";

export interface HypothesisProvenance {
  state: ProvenanceState;
}

/** unavailable = the provenance could not be read: no state is shown. */
export type ProvenanceSummary =
  | { status: "available"; counts: Record<ProvenanceState, number> }
  | { status: "unavailable" };

export interface Hypothesis {
  hypothesis_id: string;
  label: string;
  cause_type: string;
  relative_score: number;
  urgency: "critique" | "haute" | "moyenne" | "basse";
  evidence_for: string[];
  evidence_against: string[];
  verification_method?: string;
  requires_verification: boolean;
  related_gamme_slugs?: string[];
  /** Absent when the provenance is not exposed or could not be read. */
  provenance?: HypothesisProvenance;
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
  relevance: "primary" | "related" | "selected";
  applicability?: "unverified";
  interval_source?: string;
  last_service_km?: number;
  last_service_date?: string;
  next_at_km?: string;
  next_at_date?: string;
  interval_km: string;
  interval_months: string;
  severity_if_overdue: string;
  overdue_status?: "overdue" | "approaching" | "ok" | "unknown";
  related_gamme_slug?: string;
  related_pg_id?: number;
}

export interface EvidencePack {
  analysis_kind?: "diagnostic" | "maintenance";
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
  allowed_claims: string[];
  signal_quality?: string;
  ui_block_inputs: Record<string, unknown>;
  /** Absent when the provenance is not exposed (flag OFF) or on older sessions. */
  provenance_summary?: ProvenanceSummary;
}

export interface DiagnosticApiResponse {
  success: boolean;
  session_id?: string | null;
  evidence_pack?: EvidencePack;
  error?: string;
  // V1A.0 Intent Resolution fields (present when DIAGNOSTIC_PIPELINE_V1_ENABLED=true)
  mode?: "reactive";
  versions?: { pipeline_version: string };
  intent?: IntentLayer;
  recommended_actions?: RecommendedAction[];
  human_escalation?: HumanEscalation;
}

export interface SymptomOption {
  slug: string;
  label: string;
  description: string;
  urgency: string;
}
