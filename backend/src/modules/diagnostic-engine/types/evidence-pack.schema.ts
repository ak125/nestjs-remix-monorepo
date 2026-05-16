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

const UrgencyLevelEnum = z.enum(['haute', 'moyenne', 'basse']);

// ── Candidate Hypothesis ────────────────────────────────

const CauseTypeEnum = z.enum([
  'maintenance_related',
  'wear_related',
  'component_fault',
  'contextual_factor',
]);

const CandidateHypothesisSchema = z.object({
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

// ── Catalog Guard ───────────────────────────────────────

const ConfidenceLevelEnum = z.enum(['low', 'medium', 'high']);

const CatalogOutputModeEnum = z.enum([
  'none',
  'catalog_family_only',
  'catalog_family_with_caution',
]);

// Mapping vers les vraies gammes du catalogue (pg_id from gammes/*.md)
const SuggestedGammeSchema = z.object({
  gamme_slug: z.string().min(1), // ex: 'plaquette-de-frein'
  gamme_label: z.string().min(1), // ex: 'Plaquette de frein'
  pg_id: z.number().optional(), // ex: 402 (from gammes/*.md frontmatter)
  confidence: ConfidenceLevelEnum,
});

const CatalogGuardSchema = z.object({
  ready_for_catalog: z.boolean(),
  confidence_before_purchase: ConfidenceLevelEnum,
  allowed_output_mode: CatalogOutputModeEnum,
  reason: z.string().min(1),
  suggested_gammes: z.array(SuggestedGammeSchema).optional(),
});

// ── RAG Evidence (typage des faits RAG) ─────────────────

const RagEvidenceTypeEnum = z.enum([
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

const RagFactSchema = z.object({
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
