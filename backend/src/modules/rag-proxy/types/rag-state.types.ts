/**
 * RAG Pipeline State Machines — Phase 1 Ingestion Foundation.
 *
 * 3 separate state machines to avoid conflating:
 * - job execution lifecycle
 * - document publication lifecycle
 * - post-publish side-effects
 */

// ── Job Status (execution lifecycle) ──────────────────────────

export const RAG_JOB_STATUSES = [
  'queued',
  'processing',
  'extracting',
  'classifying',
  'deduplicating',
  'validating',
  'persisting',
  'completed',
  'noop_completed',
  'failed',
  'cancelled',
] as const;

export type RagJobStatus = (typeof RAG_JOB_STATUSES)[number];

/** Allowed transitions: current → set of valid next states. */
export const JOB_TRANSITIONS: Record<RagJobStatus, readonly RagJobStatus[]> = {
  queued: ['processing', 'cancelled', 'failed'],
  processing: ['extracting', 'failed', 'cancelled'],
  extracting: ['classifying', 'failed', 'cancelled'],
  classifying: ['deduplicating', 'failed', 'cancelled'],
  deduplicating: ['validating', 'noop_completed', 'failed'],
  validating: ['persisting', 'failed'],
  persisting: ['completed', 'failed'],
  completed: [],
  noop_completed: [],
  failed: ['queued'], // allow retry
  cancelled: [],
};

// ── Document Lifecycle (publication state) ────────────────────

export const DOCUMENT_LIFECYCLE_STATUSES = [
  'ingested',
  'staged',
  'reviewed',
  'published',
  'activated',
  'archived',
  'rejected',
  'tombstoned',
] as const;

export type DocumentLifecycleStatus =
  (typeof DOCUMENT_LIFECYCLE_STATUSES)[number];

export const DOCUMENT_TRANSITIONS: Record<
  DocumentLifecycleStatus,
  readonly DocumentLifecycleStatus[]
> = {
  ingested: ['staged', 'rejected'],
  staged: ['reviewed', 'published', 'rejected', 'archived'],
  reviewed: ['published', 'rejected', 'archived'],
  published: ['activated', 'archived', 'tombstoned'],
  activated: ['archived', 'tombstoned', 'published'], // allow deactivation
  archived: ['staged'], // allow re-staging
  rejected: ['staged'], // allow re-try after fix
  tombstoned: [], // terminal
};

// ── Post-Publish Actions (side-effects lifecycle) ─────────────

export const POST_PUBLISH_STATUSES = [
  'not_requested',
  'queued',
  'running',
  'skipped',
  'completed',
  'failed',
] as const;

export type PostPublishStatus = (typeof POST_PUBLISH_STATUSES)[number];

// ── State Transition Record ───────────────────────────────────

export interface StateTransitionRecord {
  from: string;
  to: string;
  timestamp: string;
  actor: 'system' | 'admin' | 'pipeline' | 'webhook';
  errorCode?: string;
  errorStep?: string;
  reason?: string;
}

// ── Transition validator ──────────────────────────────────────

export function isValidJobTransition(
  from: RagJobStatus,
  to: RagJobStatus,
): boolean {
  return JOB_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isValidDocumentTransition(
  from: DocumentLifecycleStatus,
  to: DocumentLifecycleStatus,
): boolean {
  return DOCUMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Phase 1 Mutation Guards (R3) ─────────────────────────────

/** Mutations explicitly allowed during Phase 1 (Ingestion Foundation). */
export const PHASE1_ALLOWED_MUTATIONS = [
  'write_raw', // Write to _raw/ staging area
  'write_zone', // Write to determined zone (gammes/, web/, vehicles/, etc.)
  'db_upsert_cadree', // Create/update DB via applyIngest (controlled upsert)
  'add_technical_metadata', // Attach minimal provenance metadata
  'quarantine', // Move document to quarantine
  'create_version', // Create new technical version in rag_document_versions
] as const;

export type Phase1AllowedMutation = (typeof PHASE1_ALLOWED_MUTATIONS)[number];

/** Mutations explicitly forbidden during Phase 1 — enforced at review time. */
export const PHASE1_FORBIDDEN_MUTATIONS = [
  'editorial_rewrite', // Free editorial rewriting of content
  'business_reclassification', // Changing kb_type / category / domain post-ingest
  'unaudited_semantic_merge', // Merging documents without dedup audit trail
  'overwrite_validated_without_rule', // Overwriting published/activated doc without write safety
  'implicit_seo_enrichment', // Adding SEO metadata during ingestion
  'silent_frontmatter_mutation', // Changing frontmatter business fields silently
] as const;

export type Phase1ForbiddenMutation =
  (typeof PHASE1_FORBIDDEN_MUTATIONS)[number];

// ── Phase 1 Status (R4 — Phase Barrier) ─────────────────────

export const PHASE1_STATUSES = ['passed', 'failed', 'quarantined'] as const;
export type Phase1Status = (typeof PHASE1_STATUSES)[number];

// ── Phase 1.5 Status (Normalization Barrier) ────────────────

export const PHASE15_STATUSES = [
  'normalized',
  'normalized_with_warnings',
  'blocked',
  'quarantined',
  'review_required',
] as const;

export type Phase15Status = (typeof PHASE15_STATUSES)[number];

/** Mutations explicitly allowed during Phase 1.5 (Normalization). */
export const PHASE15_ALLOWED_MUTATIONS = [
  'set_canonical_identity', // Assign canonical_doc_id + canonical_source_key
  'normalize_provenance', // Normalize source_url, validate truth_level
  'classify_doc_family', // Assign doc_family from source_type + inference
  'assign_target_surface', // Route to canonical surface (gammes/, diagnostic/, etc.)
  'detect_collisions', // Scan for source URL, content, target, trust collisions
  'resolve_collision', // Decide canonical_primary, secondary, quarantine, etc.
  'set_phase15_status', // Set normalization gate output
  'add_gamme_aliases', // Persist detected gamme aliases
] as const;

export type Phase15AllowedMutation = (typeof PHASE15_ALLOWED_MUTATIONS)[number];

/** Mutations explicitly forbidden during Phase 1.5 — no editorial transformation. */
export const PHASE15_FORBIDDEN_MUTATIONS = [
  'rewrite_editorial', // Free editorial rewriting
  'generate_sections', // Generate R0-R8 sections (G* = governance, not a role)
  'enrich_seo', // Inject SEO clusters, keywords, meta
  'inject_faq_cta', // Add FAQ, CTA, headings
  'publish', // Promote to published surface
  'merge_semantic_unsupervised', // Merge docs without strict audit
  'promote_to_surface_without_identity', // Push to surface while identity ambiguous
  'overwrite_canonical_without_rule', // Overwrite canonical doc without precedence rule
] as const;

export type Phase15ForbiddenMutation =
  (typeof PHASE15_FORBIDDEN_MUTATIONS)[number];

// ── Phase 1.6 Status (Admissibility Gate) ──────────────

export const PHASE16_STATUSES = [
  'admissible',
  'admissible_with_limits',
  'enrichment_required',
  'blocked',
] as const;

export type Phase16Status = (typeof PHASE16_STATUSES)[number];

/** Mutations explicitly allowed during Phase 1.6 (Admissibility Gate). */
export const PHASE16_ALLOWED_MUTATIONS = [
  'evaluate_evidence_policy', // Resolve truth_level → usage policy
  'compute_role_sufficiency', // Score sufficiency per role
  'map_block_admissibility', // Map block → role admissibility
  'detect_contamination', // Scan for vocabulary leaks
  'assess_freshness', // Check staleness risk
  'set_phase16_status', // Set admissibility gate output
  'set_publication_target_ready', // Flip publicationTargetReady to true
] as const;

export type Phase16AllowedMutation = (typeof PHASE16_ALLOWED_MUTATIONS)[number];

/** Mutations explicitly forbidden during Phase 1.6 — no generation. */
export const PHASE16_FORBIDDEN_MUTATIONS = [
  'rewrite_editorial', // Free editorial rewriting
  'generate_sections', // Generate R0-R8 sections (G* = governance, not a role)
  'enrich_seo', // Inject SEO clusters, keywords, meta
  'publish', // Promote to published surface
] as const;

export type Phase16ForbiddenMutation =
  (typeof PHASE16_FORBIDDEN_MUTATIONS)[number];

// ── Phase 2 Status (Exploitation Gate) ──────────────────

export const PHASE2_STATUSES = [
  'draft_generated',
  'partial',
  'qa_required',
  'ready_for_publish',
  'blocked',
] as const;

export type Phase2Status = (typeof PHASE2_STATUSES)[number];

/** Mutations explicitly allowed during Phase 2 (Exploitation). */
export const PHASE2_ALLOWED_MUTATIONS = [
  'plan_by_role', // Create enrichment plan per admissible role
  'generate_section', // Generate a content section for a role
  'assemble_draft', // Assemble sections into role draft
  'apply_role_contract', // Validate draft against role contract
  'score_draft', // Score draft quality
  'flag_qa_required', // Mark draft as needing QA review
  'set_phase2_status', // Set exploitation gate output
  'record_enrichment_applied', // Track which enrichments were applied
] as const;

export type Phase2AllowedMutation = (typeof PHASE2_ALLOWED_MUTATIONS)[number];

/** Mutations explicitly forbidden during Phase 2 — respect upstream gates. */
export const PHASE2_FORBIDDEN_MUTATIONS = [
  'overwrite_raw_source', // Cannot mutate Phase 1 raw content
  'bypass_admissibility', // Cannot use a blocked resource
  'expand_role_unauthorized', // Cannot generate for non-admissible role
  'promote_weak_to_strong', // Cannot upgrade truth level without decision
  'publish_without_qa', // Cannot publish if qa_required
  'silent_content_correction', // Must trace all corrections (invariant F)
  'rewrite_canonical_identity', // Cannot change Phase 1.5 canonical fields
] as const;

export type Phase2ForbiddenMutation =
  (typeof PHASE2_FORBIDDEN_MUTATIONS)[number];

/** Phase 2 valid state transitions. */
export const PHASE2_TRANSITIONS: Record<Phase2Status, readonly Phase2Status[]> =
  {
    draft_generated: ['partial', 'qa_required', 'ready_for_publish', 'blocked'],
    partial: ['draft_generated', 'qa_required', 'blocked'],
    qa_required: ['ready_for_publish', 'blocked', 'partial'],
    ready_for_publish: ['blocked'], // only block can demote from ready
    blocked: ['draft_generated'], // allow retry
  };

export function isValidPhase2Transition(
  from: Phase2Status,
  to: Phase2Status,
): boolean {
  return PHASE2_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Terminal states — no further transitions allowed. */
export function isTerminalJobStatus(status: RagJobStatus): boolean {
  return (
    status === 'completed' ||
    status === 'noop_completed' ||
    status === 'cancelled'
  );
}
