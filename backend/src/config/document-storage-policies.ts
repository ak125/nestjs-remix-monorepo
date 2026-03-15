/**
 * Document Storage Policies — canonical classification matrix as config.
 *
 * 33 source types with default truth_level, verification_status,
 * foundation_gate expectation, business admissibility, and allowed usages.
 *
 * @see .spec/00-canon/rag-document-classification-matrix.md
 */
import type { DocumentStoragePolicy } from './document-storage-canon.schema';

const BUSINESS_USAGES_FULL = [
  'storage',
  'audit',
  'comparison',
  'retrieval_business',
  'synthesis_business',
  'enrichment',
  'refresh',
  'generation',
  'assembly',
  'business_write',
  'qa_control',
] as const;

const AUDIT_ONLY_USAGES = [
  'storage',
  'audit',
  'scoring',
  'comparison',
  'reprocessing',
  'observability',
] as const;

const RESEARCH_USAGES = [
  'storage',
  'audit',
  'scoring',
  'comparison',
  'diagnostic_internal',
  'observability',
  'research',
] as const;

export const DOCUMENT_STORAGE_POLICIES: DocumentStoragePolicy[] = [
  // ── Sources internes validees ──
  {
    source_type: 'internal_validated',
    default_storage_zone: 'knowledge/internal',
    default_truth_level: 'high',
    default_verification_status: 'verified',
    default_business_pool_admissible: true,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'phase_1_5',
    allowed_usages: [...BUSINESS_USAGES_FULL],
  },
  {
    source_type: 'canonical_validated',
    default_storage_zone: 'knowledge/canonical',
    default_truth_level: 'high',
    default_verification_status: 'verified',
    default_business_pool_admissible: true,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'phase_1_5',
    allowed_usages: [...BUSINESS_USAGES_FULL, 'publication_candidate'],
  },
  {
    source_type: 'oem_primary',
    default_storage_zone: 'knowledge/references',
    default_truth_level: 'high',
    default_verification_status: 'primary_source',
    default_business_pool_admissible: true,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'phase_1_5',
    allowed_usages: [...BUSINESS_USAGES_FULL],
    notes: 'Source primaire technique forte.',
  },
  {
    source_type: 'supplier_structured',
    default_storage_zone: 'knowledge/references',
    default_truth_level: 'medium',
    default_verification_status: 'validated_secondary',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'phase_1_5',
    allowed_usages: ['storage', 'audit', 'comparison', 'enrichment', 'refresh'],
    notes: 'Conditional → yes apres validation.',
  },

  // ── Referentiels metier ──
  {
    source_type: 'gamme_reference',
    default_storage_zone: 'knowledge/gammes',
    default_truth_level: 'medium',
    default_verification_status: 'validated',
    default_business_pool_admissible: true,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'phase_1_5',
    allowed_usages: [...BUSINESS_USAGES_FULL],
  },
  {
    source_type: 'vehicle_reference',
    default_storage_zone: 'knowledge/vehicles',
    default_truth_level: 'medium',
    default_verification_status: 'validated',
    default_business_pool_admissible: true,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'phase_1_5',
    allowed_usages: [...BUSINESS_USAGES_FULL],
  },
  {
    source_type: 'brand_reference',
    default_storage_zone: 'knowledge/brands',
    default_truth_level: 'medium',
    default_verification_status: 'validated',
    default_business_pool_admissible: true,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'phase_1_5',
    allowed_usages: [...BUSINESS_USAGES_FULL],
  },
  {
    source_type: 'diagnostic_reference',
    default_storage_zone: 'knowledge/diagnostics',
    default_truth_level: 'medium',
    default_verification_status: 'validated',
    default_business_pool_admissible: true,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'phase_1_5',
    allowed_usages: [...BUSINESS_USAGES_FULL],
  },
  {
    source_type: 'guide_validated',
    default_storage_zone: 'knowledge/guides',
    default_truth_level: 'high',
    default_verification_status: 'verified',
    default_business_pool_admissible: true,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'phase_1_5',
    allowed_usages: [...BUSINESS_USAGES_FULL],
  },
  {
    source_type: 'faq_validated',
    default_storage_zone: 'knowledge/faqs',
    default_truth_level: 'medium',
    default_verification_status: 'validated',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'phase_1_5',
    allowed_usages: ['storage', 'audit', 'enrichment', 'support_usage'],
    notes: 'Conditional — depends on FAQ quality.',
  },
  {
    source_type: 'policy_rule',
    default_storage_zone: 'knowledge/policies',
    default_truth_level: 'high',
    default_verification_status: 'verified',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'control_only',
    allowed_usages: ['storage', 'audit', 'qa_control'],
    notes: 'Admissible pour controle, jamais pour generation brute.',
  },

  // ── Documents de travail ──
  {
    source_type: 'brief_validated',
    default_storage_zone: 'knowledge/briefs',
    default_truth_level: 'medium',
    default_verification_status: 'validated',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'phase_1_6',
    allowed_usages: ['storage', 'audit', 'generation'],
    notes: 'Conditional admissibility.',
  },
  {
    source_type: 'evidence_pack',
    default_storage_zone: 'knowledge/evidence',
    default_truth_level: 'derived',
    default_verification_status: 'derived_validated',
    default_business_pool_admissible: true,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'phase_2',
    allowed_usages: [
      'storage',
      'audit',
      'retrieval_business',
      'generation',
      'assembly',
      'qa_control',
    ],
  },

  // ── Sources web ──
  {
    source_type: 'raw_web_capture',
    default_storage_zone: 'knowledge/_raw/web',
    default_truth_level: 'low',
    default_verification_status: 'unverified',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'conditional',
    default_next_phase_target: 'phase_1_5',
    allowed_usages: [...AUDIT_ONLY_USAGES],
  },
  {
    source_type: 'press_article',
    default_storage_zone: 'knowledge/web/news',
    default_truth_level: 'medium',
    default_verification_status: 'secondary_source',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'research_only',
    allowed_usages: [...RESEARCH_USAGES],
  },
  {
    source_type: 'external_blog_post',
    default_storage_zone: 'knowledge/web/blogs',
    default_truth_level: 'low',
    default_verification_status: 'secondary_source',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'research_only',
    allowed_usages: [...RESEARCH_USAGES],
  },
  {
    source_type: 'forum_thread',
    default_storage_zone: 'knowledge/web/forums',
    default_truth_level: 'low',
    default_verification_status: 'unverified',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'research_only',
    allowed_usages: [...RESEARCH_USAGES],
    notes: 'Signal faible, jamais preuve metier forte par defaut.',
  },
  {
    source_type: 'community_post',
    default_storage_zone: 'knowledge/web/community',
    default_truth_level: 'low',
    default_verification_status: 'unverified',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'research_only',
    allowed_usages: [...RESEARCH_USAGES],
  },
  {
    source_type: 'editorial_external',
    default_storage_zone: 'knowledge/web/editorial',
    default_truth_level: 'medium',
    default_verification_status: 'secondary_source_reviewed',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'review',
    allowed_usages: [
      'storage',
      'audit',
      'comparison',
      'research',
      'enrichment',
    ],
    notes: 'Conditional — peut etre promu apres review.',
  },
  {
    source_type: 'exploratory_web_source',
    default_storage_zone: 'knowledge/web/exploratory',
    default_truth_level: 'low',
    default_verification_status: 'unverified',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'research_only',
    allowed_usages: [...RESEARCH_USAGES],
  },

  // ── Documents bruts ──
  {
    source_type: 'raw_pdf',
    default_storage_zone: 'knowledge/_raw/pdf',
    default_truth_level: 'low',
    default_verification_status: 'unverified',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'conditional',
    default_next_phase_target: 'phase_1_5',
    allowed_usages: [...AUDIT_ONLY_USAGES],
  },
  {
    source_type: 'raw_db_import',
    default_storage_zone: 'knowledge/_raw/db',
    default_truth_level: 'variable',
    default_verification_status: 'unverified',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'conditional',
    default_next_phase_target: 'phase_1_5',
    allowed_usages: [...AUDIT_ONLY_USAGES],
  },
  {
    source_type: 'legacy_unresolved',
    default_storage_zone: 'knowledge/_raw/legacy',
    default_truth_level: 'low',
    default_verification_status: 'legacy_unresolved',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'conditional',
    default_next_phase_target: 'phase_1_5',
    allowed_usages: [...AUDIT_ONLY_USAGES, 'research'],
    notes: 'Doit etre normalise avant toute exploitation metier.',
  },
  {
    source_type: 'partial_document',
    default_storage_zone: 'knowledge/_staging/partial',
    default_truth_level: 'low',
    default_verification_status: 'partial',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'conditional',
    default_next_phase_target: 'phase_1_5',
    allowed_usages: [...AUDIT_ONLY_USAGES],
  },
  {
    source_type: 'staging_document',
    default_storage_zone: 'knowledge/_staging',
    default_truth_level: 'variable',
    default_verification_status: 'pending_validation',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'conditional',
    default_next_phase_target: 'phase_1_6',
    allowed_usages: ['storage', 'audit', 'assembly', 'qa_control'],
  },

  // ── Quarantaine ──
  {
    source_type: 'quarantine_document',
    default_storage_zone: 'knowledge/_quarantine',
    default_truth_level: 'unknown',
    default_verification_status: 'rejected_or_pending_review',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'fail',
    default_next_phase_target: 'review',
    allowed_usages: [...AUDIT_ONLY_USAGES],
  },
  {
    source_type: 'foundation_failed_document',
    default_storage_zone: 'knowledge/_quarantine/foundation',
    default_truth_level: 'low',
    default_verification_status: 'foundation_failed',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'fail',
    default_next_phase_target: 'review',
    allowed_usages: [...AUDIT_ONLY_USAGES],
    notes: 'Lisible et auditable, jamais exploitable metier direct.',
  },

  // ── Media ──
  {
    source_type: 'media_prompt',
    default_storage_zone: 'knowledge/media/prompts',
    default_truth_level: 'low',
    default_verification_status: 'draft',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'media_workflow',
    allowed_usages: ['storage', 'audit', 'media_generation'],
  },
  {
    source_type: 'media_asset',
    default_storage_zone: 'knowledge/media/assets',
    default_truth_level: 'variable',
    default_verification_status: 'asset_unverified',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'media_workflow',
    allowed_usages: ['storage', 'audit', 'media_generation'],
    notes: 'Conditional admissibility after asset verification.',
  },

  // ── Support/Ops ──
  {
    source_type: 'research_note',
    default_storage_zone: 'knowledge/research',
    default_truth_level: 'medium',
    default_verification_status: 'internally_reviewed',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'review',
    allowed_usages: ['storage', 'audit', 'comparison', 'research'],
  },
  {
    source_type: 'audit_report',
    default_storage_zone: 'knowledge/audit',
    default_truth_level: 'medium',
    default_verification_status: 'audit_record',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'review',
    allowed_usages: ['storage', 'audit', 'observability'],
  },
  {
    source_type: 'shadow_projection',
    default_storage_zone: 'knowledge/shadow',
    default_truth_level: 'derived',
    default_verification_status: 'shadow_projection',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'phase_2A',
    allowed_usages: ['storage', 'audit', 'comparison', 'research'],
  },
  {
    source_type: 'support_document',
    default_storage_zone: 'knowledge/support',
    default_truth_level: 'medium',
    default_verification_status: 'validated',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'support_workflow',
    allowed_usages: ['storage', 'audit', 'support_usage'],
    notes: 'Hors roles editoriaux coeur.',
  },
  {
    source_type: 'app_document',
    default_storage_zone: 'knowledge/app',
    default_truth_level: 'medium',
    default_verification_status: 'validated',
    default_business_pool_admissible: false,
    expected_foundation_gate: 'pass',
    default_next_phase_target: 'app_workflow',
    allowed_usages: ['storage', 'audit', 'app_usage'],
    notes: 'Hors matrice editoriale coeur.',
  },
];

// ── Lookup helpers ──

const POLICY_MAP = new Map<string, DocumentStoragePolicy>(
  DOCUMENT_STORAGE_POLICIES.map((p) => [p.source_type, p]),
);

export function getPolicyForSourceType(
  sourceType: string,
): DocumentStoragePolicy | undefined {
  return POLICY_MAP.get(sourceType);
}

export function getDefaultStorageZone(sourceType: string): string | undefined {
  return POLICY_MAP.get(sourceType)?.default_storage_zone;
}

export function isSourceTypeBusinessAdmissible(sourceType: string): boolean {
  return POLICY_MAP.get(sourceType)?.default_business_pool_admissible ?? false;
}
