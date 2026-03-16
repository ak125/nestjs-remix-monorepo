/**
 * Evidence Pack — Sortie metier pivot
 *
 * Separe rigoureusement :
 * - Faits confirmes vs manquants
 * - Hypotheses candidates avec score + evidence for/against
 * - Liens entretien
 * - Drapeaux risque
 * - Garde-fou catalogue (CatalogGuard)
 * - Claims autorises vs interdits au runtime
 * - Inputs UI par bloc
 *
 * Hierarchie : DiagnosticContract → EvidencePack → DiagnosticResult (UI)
 *
 * Aligne sur le corpus RAG reel :
 * - diagnostic/*.md : probabilites (70%, 15%), urgence (Haute/Moyenne/Basse), verifications
 * - gammes/*.md : pg_id, slug, related_parts, domain.role
 * - canonical/*.md : regles condensees L4
 */
import { z } from 'zod';

// ── Urgency (aligne sur le RAG diagnostic : Haute/Moyenne/Basse) ──

export const UrgencyLevelEnum = z.enum(['haute', 'moyenne', 'basse']);
export type UrgencyLevel = z.infer<typeof UrgencyLevelEnum>;

// ── Candidate Hypothesis ────────────────────────────────

export const CauseTypeEnum = z.enum([
  'maintenance_related',
  'wear_related',
  'component_fault',
  'contextual_factor',
]);
export type CauseType = z.infer<typeof CauseTypeEnum>;

export const CandidateHypothesisSchema = z.object({
  hypothesis_id: z.string().min(1),
  label: z.string().min(1),
  cause_type: CauseTypeEnum,
  // Score relatif 0-100 (aligne sur les probabilites RAG : 70%, 15%, 10%, 5%)
  relative_score: z.number().min(0).max(100),
  // Urgence securite (aligne sur le RAG : Haute - Securite, Moyenne, Basse)
  urgency: UrgencyLevelEnum,
  evidence_for: z.array(z.string()).min(1),
  evidence_against: z.array(z.string()),
  // Verification recommandee (aligne sur le champ "Verification" du RAG)
  verification_method: z.string().optional(),
  requires_verification: z.boolean(),
  // Mapping vers les gammes RAG (slug from gammes/*.md)
  related_gamme_slugs: z.array(z.string()).optional(),
});
export type CandidateHypothesis = z.infer<typeof CandidateHypothesisSchema>;

// ── Catalog Guard ───────────────────────────────────────

export const ConfidenceLevelEnum = z.enum(['low', 'medium', 'high']);

export const CatalogOutputModeEnum = z.enum([
  'none',
  'catalog_family_only',
  'catalog_family_with_caution',
]);

// Mapping vers les vraies gammes du catalogue (pg_id from gammes/*.md)
export const SuggestedGammeSchema = z.object({
  gamme_slug: z.string().min(1), // ex: 'plaquette-de-frein'
  gamme_label: z.string().min(1), // ex: 'Plaquette de frein'
  pg_id: z.number().optional(), // ex: 402 (from gammes/*.md frontmatter)
  confidence: ConfidenceLevelEnum,
});
export type SuggestedGamme = z.infer<typeof SuggestedGammeSchema>;

export const CatalogGuardSchema = z.object({
  ready_for_catalog: z.boolean(),
  confidence_before_purchase: ConfidenceLevelEnum,
  allowed_output_mode: CatalogOutputModeEnum,
  reason: z.string().min(1),
  suggested_gammes: z.array(SuggestedGammeSchema).optional(),
});
export type CatalogGuard = z.infer<typeof CatalogGuardSchema>;

// ── RAG Evidence (typage des faits RAG) ─────────────────

export const RagEvidenceTypeEnum = z.enum([
  'weak_point_evidence',
  'symptom_nuance_evidence',
  'cause_support_evidence',
  'verification_support_evidence',
  'maintenance_support_evidence',
  'pedagogical_support_evidence',
  'repair_tip',
  'cost_evidence',
  'obd_code_evidence',
]);

export const RagFactSchema = z.object({
  evidence_type: RagEvidenceTypeEnum,
  content: z.string().min(1),
  source_file: z.string().optional(), // ex: 'diagnostic/bruits-freinage.md'
  truth_level: z.enum(['L1', 'L2', 'L3', 'L4']).optional(),
});
export type RagFact = z.infer<typeof RagFactSchema>;

// ── Evidence Pack ───────────────────────────────────────

export const EvidencePackSchema = z.object({
  evidence_pack: z.object({
    diagnostic_confidence: z.number().min(0).max(100).optional(),
    factual_inputs_confirmed: z.array(z.string()),
    factual_inputs_missing: z.array(z.string()),
    system_suspects: z.array(z.string()),
    candidate_hypotheses: z.array(CandidateHypothesisSchema),
    maintenance_links: z.array(z.string()),
    risk_flags: z.array(z.string()),
    safety_alert: z.string().optional(),
    risk_level: z.enum(['critical', 'high', 'moderate', 'low']).optional(),
    signal_quality: z.enum(['high', 'medium', 'low']).optional(),
    catalog_guard: CatalogGuardSchema,
    maintenance_recommendations: z.array(z.unknown()).optional(),
    preventive_schedule: z
      .array(
        z.object({
          operation: z.string(),
          next_at_km: z.string(),
          status: z.enum(['overdue', 'approaching', 'ok', 'unknown']),
        }),
      )
      .optional(),
    allowed_claims: z.array(z.string()),
    forbidden_claims_runtime: z.array(z.string()),
    // v1: liste plate. v2: fully typed per block (voir roadmap)
    rag_facts: z.array(RagFactSchema).optional(),
    // v1: permissif. v2: union typee par bloc (VehicleContextCardInput, etc.)
    ui_block_inputs: z.record(z.unknown()),
  }),
});
export type EvidencePack = z.infer<typeof EvidencePackSchema>;

// ── Pipeline Output (full) ──────────────────────────────

export const DiagnosticPipelineOutputSchema = z.object({
  contract_version: z.string().min(1),
  audit: z.object({
    primary_intent: z.string(),
    secondary_intents: z.array(z.string()),
    system_scope: z.string(),
    part_scope: z.string(),
    technical_level: z.string(),
    high_caution_required: z.boolean(),
    must_cover_axes: z.array(z.string()),
    must_not_do: z.array(z.string()),
    notes: z.string(),
  }),
  sections: z.array(
    z.object({
      section_id: z.string(),
      section_label: z.string(),
      section_role: z.string(),
      required: z.boolean(),
      goal: z.string(),
      must_cover_axes: z.array(z.string()),
      caution_level: z.string(),
      ui_blocks: z.array(z.string()),
    }),
  ),
  evidence: EvidencePackSchema,
});
export type DiagnosticPipelineOutput = z.infer<
  typeof DiagnosticPipelineOutputSchema
>;
