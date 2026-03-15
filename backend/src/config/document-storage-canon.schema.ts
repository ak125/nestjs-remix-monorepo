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

export const SourceTypeSchema = z.enum([
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

export const StorageZoneSchema = z.enum([
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

export const TruthLevelSchema = z.enum([
  'high',
  'medium',
  'low',
  'derived',
  'unknown',
  'variable',
]);

export const VerificationStatusSchema = z.enum([
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

export const DocFamilySchema = z.enum([
  'canonical',
  'internal',
  'gamme',
  'vehicle',
  'brand',
  'reference',
  'diagnostic',
  'guide',
  'faq',
  'policy',
  'brief',
  'evidence',
  'raw',
  'legacy',
  'quarantine',
  'news',
  'blog',
  'forum',
  'community',
  'editorial',
  'research',
  'audit',
  'shadow',
  'media',
  'support',
  'app',
]);

export const NextPhaseTargetSchema = z.enum([
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

export const AllowedUsageSchema = z.enum([
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

// ── Document schema with business rules ──

export const DocumentStorageCanonSchema = z
  .object({
    document_id: z.string().min(1),
    title: z.string().optional(),
    source_type: SourceTypeSchema,
    storage_zone: StorageZoneSchema,
    truth_level: TruthLevelSchema,
    verification_status: VerificationStatusSchema,
    foundation_gate_passed: z.boolean(),
    business_pool_admissible: z.boolean(),
    doc_family: DocFamilySchema,
    next_phase_target: NextPhaseTargetSchema,
    allowed_usages: z.array(AllowedUsageSchema).min(1),
    canonical_storage_key: z.string().min(1),
    source_url: z.string().optional(),
    source_domain: z.string().optional(),
    source_language: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    notes: z.string().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .superRefine((doc, ctx) => {
    // R1: foundation_gate=false → business_pool must be false
    if (!doc.foundation_gate_passed && doc.business_pool_admissible) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['business_pool_admissible'],
        message:
          'business_pool_admissible doit etre false si foundation_gate_passed = false',
      });
    }

    // R2: business_pool=true → must include retrieval_business
    if (
      doc.business_pool_admissible &&
      !doc.allowed_usages.includes('retrieval_business')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['allowed_usages'],
        message:
          'retrieval_business doit etre present si business_pool_admissible = true',
      });
    }

    // R3: secondary sources never business-admissible by default
    const secondarySources: string[] = [
      'forum_thread',
      'community_post',
      'press_article',
      'external_blog_post',
      'exploratory_web_source',
    ];
    if (
      secondarySources.includes(doc.source_type) &&
      doc.business_pool_admissible
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['business_pool_admissible'],
        message:
          'les sources secondaires/exploratoires ne doivent pas etre admissibles metier par defaut',
      });
    }
  });

export type DocumentStorageCanon = z.infer<typeof DocumentStorageCanonSchema>;

// ── Policy schema (models the matrix itself as config) ──

export const FoundationGateExpectationSchema = z.enum([
  'pass',
  'conditional',
  'fail',
]);

export const DocumentStoragePolicySchema = z.object({
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

export type DocumentStoragePolicy = z.infer<typeof DocumentStoragePolicySchema>;

// ── Helpers ──

export function isBusinessUsable(doc: DocumentStorageCanon): boolean {
  return (
    doc.foundation_gate_passed &&
    doc.business_pool_admissible &&
    doc.allowed_usages.includes('retrieval_business')
  );
}

export function isAuditOnly(doc: DocumentStorageCanon): boolean {
  return (
    !doc.business_pool_admissible &&
    (doc.allowed_usages.includes('audit') ||
      doc.allowed_usages.includes('comparison'))
  );
}
