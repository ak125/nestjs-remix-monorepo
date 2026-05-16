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
  'breakdown', // ADR-032 D-intents : urgence routière (panne immobilisante)
]);

const DiagnosticSectionRoleEnum = z.enum([
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

const DiagnosticBlockEnum = z.enum([
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

const CoverageAxisEnum = z.enum([
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

const VehicleFieldEnum = z.enum([
  'type_id',
  'brand',
  'model',
  'engine',
  'fuel',
  'year',
  'mileage_km',
]);

const UsageFieldEnum = z.enum([
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

const KBEnum = z.enum([
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
const RagTruthLevelEnum = z.enum(['L1', 'L2', 'L3', 'L4']);
const RagDocFamilyEnum = z.enum([
  'diagnostic', // /knowledge/diagnostic/*.md
  'catalog', // /knowledge/gammes/*.md (source_type: gamme)
  'knowledge', // /knowledge/canonical/*.md (is_canonical: true)
  'guide', // /knowledge/guides/*.md
  'reference', // /knowledge/reference/*.md
]);
const RagVerificationStatusEnum = z.enum(['verified', 'draft', 'unverified']);

const CautionLevelEnum = z.enum(['low', 'medium', 'high']);

// ── Section Definition ──────────────────────────────────

const SectionDefinitionSchema = z.object({
  section_id: z.string().min(1),
  section_role: DiagnosticSectionRoleEnum,
  required: z.boolean(),
  goal: z.string().min(1),
  must_cover_axes: z.array(CoverageAxisEnum),
  caution_level: CautionLevelEnum,
  ui_blocks: z.array(DiagnosticBlockEnum),
});

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
