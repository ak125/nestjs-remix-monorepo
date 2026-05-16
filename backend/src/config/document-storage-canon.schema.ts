/**
 * Document Storage Canon — Zod schemas for RAG document classification.
 *
 * Models the canonical document storage matrix with 33 source types,
 * storage zones, truth levels, verification statuses, and business rules.
 *
 * @see .spec/00-canon/rag-document-classification-matrix.md
 */
import { z } from 'zod';

// ── Enums canoniques ──

const SourceTypeSchema = z.enum([
  'internal_validated',
  'canonical_validated',
  'oem_primary',
  'supplier_structured',
  'gamme_reference',
  'vehicle_reference',
  'brand_reference',
  'diagnostic_reference',
  'guide_validated',
  'faq_validated',
  'policy_rule',
  'brief_validated',
  'evidence_pack',
  'raw_web_capture',
  'raw_pdf',
  'raw_db_import',
  'legacy_unresolved',
  'quarantine_document',
  'foundation_failed_document',
  'partial_document',
  'staging_document',
  'press_article',
  'external_blog_post',
  'forum_thread',
  'community_post',
  'editorial_external',
  'exploratory_web_source',
  'research_note',
  'audit_report',
  'shadow_projection',
  'media_prompt',
  'media_asset',
  'support_document',
  'app_document',
]);

const StorageZoneSchema = z.enum([
  'knowledge/internal',
  'knowledge/canonical',
  'knowledge/gammes',
  'knowledge/vehicles',
  'knowledge/brands',
  'knowledge/references',
  'knowledge/diagnostics',
  'knowledge/guides',
  'knowledge/faqs',
  'knowledge/policies',
  'knowledge/briefs',
  'knowledge/evidence',
  'knowledge/web/news',
  'knowledge/web/blogs',
  'knowledge/web/forums',
  'knowledge/web/community',
  'knowledge/web/editorial',
  'knowledge/web/exploratory',
  'knowledge/research',
  'knowledge/audit',
  'knowledge/shadow',
  'knowledge/support',
  'knowledge/app',
  'knowledge/media/prompts',
  'knowledge/media/assets',
  'knowledge/_raw/web',
  'knowledge/_raw/pdf',
  'knowledge/_raw/db',
  'knowledge/_raw/legacy',
  'knowledge/_staging',
  'knowledge/_staging/partial',
  'knowledge/_quarantine',
  'knowledge/_quarantine/foundation',
]);

const TruthLevelSchema = z.enum([
  'high',
  'medium',
  'low',
  'derived',
  'unknown',
  'variable',
]);

const VerificationStatusSchema = z.enum([
  'verified',
  'primary_source',
  'validated',
  'validated_secondary',
  'secondary_source',
  'secondary_source_reviewed',
  'derived_validated',
  'unverified',
  'legacy_unresolved',
  'partial',
  'pending_validation',
  'foundation_failed',
  'rejected_or_pending_review',
  'internally_reviewed',
  'audit_record',
  'shadow_projection',
  'draft',
  'asset_verified',
  'asset_unverified',
]);

const NextPhaseTargetSchema = z.enum([
  'phase_1_5',
  'phase_1_6',
  'phase_2',
  'phase_2A',
  'review',
  'reprocess',
  'control_only',
  'research_only',
  'media_workflow',
  'support_workflow',
  'app_workflow',
  'none',
]);

const AllowedUsageSchema = z.enum([
  'storage',
  'audit',
  'scoring',
  'comparison',
  'reprocessing',
  'diagnostic_internal',
  'observability',
  'research',
  'retrieval_business',
  'synthesis_business',
  'enrichment',
  'refresh',
  'generation',
  'assembly',
  'business_write',
  'qa_control',
  'publication_candidate',
  'media_generation',
  'support_usage',
  'app_usage',
]);

// ── Policy schema (models the matrix itself as config) ──

const FoundationGateExpectationSchema = z.enum(['pass', 'conditional', 'fail']);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _DocumentStoragePolicySchema = z.object({
  source_type: SourceTypeSchema,
  default_storage_zone: StorageZoneSchema,
  default_truth_level: TruthLevelSchema,
  default_verification_status: VerificationStatusSchema,
  default_business_pool_admissible: z.boolean(),
  expected_foundation_gate: FoundationGateExpectationSchema,
  default_next_phase_target: NextPhaseTargetSchema,
  allowed_usages: z.array(AllowedUsageSchema).min(1),
  notes: z.string().optional(),
});

export type DocumentStoragePolicy = z.infer<
  typeof _DocumentStoragePolicySchema
>;
