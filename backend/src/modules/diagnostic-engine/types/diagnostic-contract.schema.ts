/**
 * DiagnosticContract — Contrat Maitre
 *
 * Gouverne tout le pipeline diagnostic :
 * moteur NestJS, RAG, UI Remix, gouvernance metier, orientation catalogue.
 *
 * Hierarchie :
 *   DiagnosticContract (contrat maitre)
 *     → EvidencePack (sortie metier pivot)
 *       → DiagnosticResult (projection UI derivee)
 */
import { z } from 'zod';

// ── Enums ───────────────────────────────────────────────

export const DiagnosticIntentEnum = z.enum([
  'diagnostic_symptom',
  'warning_light_analysis',
  'dtc_analysis',
  'maintenance_check',
  'revision_check',
  'preventive_check',
]);
export type DiagnosticIntent = z.infer<typeof DiagnosticIntentEnum>;

export const DiagnosticSectionRoleEnum = z.enum([
  'vehicle_context',
  'usage_context',
  'signal_summary',
  'system_suspects',
  'hypothesis_ranking',
  'verification_steps',
  'maintenance_link',
  'replacement_logic',
  'risk_assessment',
  'catalog_orientation',
  'uncertainty_guard',
  'faq',
  'further_reading',
]);
export type DiagnosticSectionRole = z.infer<typeof DiagnosticSectionRoleEnum>;

export const DiagnosticBlockEnum = z.enum([
  'VehicleContextCard',
  'UsageProfileCard',
  'SignalSummary',
  'SystemSuspects',
  'HypothesisCards',
  'HypothesisCompareTable',
  'VerificationChecklist',
  'RiskPanel',
  'MaintenanceTimeline',
  'ReplacementLogic',
  'CatalogOrientationBox',
  'UncertaintyNotice',
  'FAQ',
  'FurtherReading',
  'InternalLinks',
]);
export type DiagnosticBlock = z.infer<typeof DiagnosticBlockEnum>;

export const CoverageAxisEnum = z.enum([
  'vehicle_context',
  'usage_context',
  'signal_capture',
  'mechanical_function',
  'symptoms',
  'causes',
  'verification',
  'maintenance',
  'revision',
  'interval_logic',
  'wear_logic',
  'risk',
  'related_parts',
  'uncertainty',
  'catalog_guard',
]);
export type CoverageAxis = z.infer<typeof CoverageAxisEnum>;

export const MustNotDoEnum = z.enum([
  'seo_reasoning',
  'marketing_language',
  'direct_repair_steps',
  'absolute_interval_claims_without_vehicle_context',
  'premature_conclusion',
  'catalog_push_without_verification',
  'vague_terms',
]);
export type MustNotDo = z.infer<typeof MustNotDoEnum>;

export const VehicleFieldEnum = z.enum([
  'type_id',
  'brand',
  'model',
  'engine',
  'fuel',
  'year',
  'mileage_km',
]);

export const UsageFieldEnum = z.enum([
  'usage_profile',
  'last_service_km',
  'last_service_date',
  'immobilized_days',
]);

export const SignalModeEnum = z.enum([
  'symptom_slugs',
  'warning_light',
  'dtc_code',
  'free_text', // MVP: normalise vers symptom_slugs avant le moteur
]);
export type SignalMode = z.infer<typeof SignalModeEnum>;

export const KBEnum = z.enum([
  'KB_SYMPTOMS',
  'KB_CAUSES',
  'KB_VERIFICATIONS',
  'KB_MAINTENANCE',
  'KB_INTERVALS',
  'KB_WEAK_POINTS',
  'KB_RISK',
  'KB_RELATED_PARTS',
  'KB_EDUCATIONAL',
]);

// Alignes sur le RAG reel (/opt/automecanik/rag/knowledge/)
// Les fichiers RAG utilisent truth_level L1-L4, doc_family, verification_status
export const RagTruthLevelEnum = z.enum(['L1', 'L2', 'L3', 'L4']);
export const RagDocFamilyEnum = z.enum([
  'diagnostic', // /knowledge/diagnostic/*.md
  'catalog', // /knowledge/gammes/*.md (source_type: gamme)
  'knowledge', // /knowledge/canonical/*.md (is_canonical: true)
  'guide', // /knowledge/guides/*.md
  'reference', // /knowledge/reference/*.md
]);
export const RagVerificationStatusEnum = z.enum([
  'verified',
  'draft',
  'unverified',
]);

export const TechnicalLevelEnum = z.enum([
  'consumer',
  'intermediate',
  'technical',
]);
export type TechnicalLevel = z.infer<typeof TechnicalLevelEnum>;

export const CautionLevelEnum = z.enum(['low', 'medium', 'high']);
export type CautionLevel = z.infer<typeof CautionLevelEnum>;

// ── Section Definition ──────────────────────────────────

export const SectionDefinitionSchema = z.object({
  section_id: z.string().min(1),
  section_role: DiagnosticSectionRoleEnum,
  required: z.boolean(),
  goal: z.string().min(1),
  must_cover_axes: z.array(CoverageAxisEnum),
  caution_level: CautionLevelEnum,
  ui_blocks: z.array(DiagnosticBlockEnum),
});
export type SectionDefinition = z.infer<typeof SectionDefinitionSchema>;

// ── DiagnosticContract ──────────────────────────────────

export const DiagnosticContractSchema = z.object({
  contract_version: z.string().min(1),
  intent_type: DiagnosticIntentEnum,
  system_scope: z.string().min(1),
  part_scope: z.string().min(1),

  vehicle_context_policy: z.object({
    required_fields: z.array(VehicleFieldEnum),
    minimum_confidence: CautionLevelEnum,
  }),

  usage_context_policy: z.object({
    required_fields: z.array(UsageFieldEnum),
  }),

  signal_input_policy: z.object({
    accepted_modes: z.array(SignalModeEnum),
    allow_multiple_signals: z.boolean(),
  }),

  required_sections: z.array(SectionDefinitionSchema),
  required_blocks: z.array(DiagnosticBlockEnum),

  governance: z.object({
    forbidden_claims: z.array(z.string()),
    forbidden_shortcuts: z.array(z.string()),
    numbers_policy: z.enum([
      'vehicle_specific_only',
      'generic_ranges_only',
      'no_unsourced_numbers',
    ]),
    catalog_policy: z.enum([
      'no_catalog_without_verification',
      'catalog_family_only',
      'catalog_allowed_if_confidence_high',
    ]),
    safety_policy: z.enum([
      'show_risk_if_uncertain',
      'always_surface_red_flags',
      'block_overconfident_output',
    ]),
    html_policy: z.enum(['sanitized_blocks_only', 'no_free_html']),
  }),

  rag_binding: z.object({
    kb_priority: z.array(KBEnum),
    // Aligne sur les vrais champs du RAG corpus
    minimum_truth_level: RagTruthLevelEnum, // L1=concept, L2=practical, L3=expert, L4=canonical
    accepted_doc_families: z.array(RagDocFamilyEnum),
    minimum_verification_status: RagVerificationStatusEnum,
    deferred_blocks: z.array(
      z.enum(['FAQ', 'FurtherReading', 'InternalLinks']),
    ),
  }),

  analytics: z.object({
    events: z.array(z.string()),
  }),

  ui_policy: z.object({
    layout_mode: z.enum(['two_columns_desktop', 'single_column_mobile']),
    sticky_aside: z.boolean(),
    toc_enabled: z.boolean(),
  }),
});

export type DiagnosticContract = z.infer<typeof DiagnosticContractSchema>;

// ── P0 Audit Output ─────────────────────────────────────

export const P0AuditOutputSchema = z.object({
  primary_intent: DiagnosticIntentEnum,
  secondary_intents: z.array(DiagnosticIntentEnum).max(4),
  system_scope: z.string().min(1),
  part_scope: z.string().default(''),
  technical_level: TechnicalLevelEnum,
  high_caution_required: z.boolean(),
  must_cover_axes: z.array(CoverageAxisEnum),
  must_not_do: z.array(MustNotDoEnum),
  notes: z.string(),
});
export type P0AuditOutput = z.infer<typeof P0AuditOutputSchema>;

// ── P1 Section Planner Output ───────────────────────────

export const PlannedSectionSchema = z.object({
  section_id: z.string().min(1),
  section_label: z.string().min(1),
  section_role: DiagnosticSectionRoleEnum,
  required: z.boolean(),
  goal: z.string().min(1),
  must_cover_axes: z.array(CoverageAxisEnum),
  caution_level: CautionLevelEnum,
  ui_blocks: z.array(DiagnosticBlockEnum),
});
export type PlannedSection = z.infer<typeof PlannedSectionSchema>;

export const P1SectionPlannerOutputSchema = z.object({
  sections: z.array(PlannedSectionSchema).min(1),
});
export type P1SectionPlannerOutput = z.infer<
  typeof P1SectionPlannerOutputSchema
>;
