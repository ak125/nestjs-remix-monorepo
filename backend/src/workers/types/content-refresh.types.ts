import { RoleId } from '../../config/role-ids';

export type PageType =
  | 'R1_pieces'
  | 'R2_product'
  | 'R3_conseils'
  | 'R3_guide_howto'
  | 'R4_reference'
  | 'R5_diagnostic'
  | 'R6_guide_achat'
  | 'R8_vehicle';

// ── Canonical Role Mapping ──
// See .spec/00-canon/db-governance/legacy-canon-map.md v1.1.0
// PageType strings are legacy worker labels; CanonicalRole is the R0-R8 truth.

/** Maps worker PageType → canonical RoleId. Kept in sync with role-ids.ts */
export const PAGE_TYPE_TO_CANONICAL_ROLE: Record<PageType, RoleId> = {
  R1_pieces: RoleId.R1_ROUTER,
  R2_product: RoleId.R2_PRODUCT,
  R3_conseils: RoleId.R3_CONSEILS,
  R3_guide_howto: RoleId.R6_GUIDE_ACHAT, // @deprecated legacy — bridge to canonical R6
  R4_reference: RoleId.R4_REFERENCE,
  R5_diagnostic: RoleId.R5_DIAGNOSTIC,
  R6_guide_achat: RoleId.R6_GUIDE_ACHAT,
  R8_vehicle: RoleId.R8_VEHICLE,
};

/** Job data for gamme-based refresh (R1, R3, R4) */
export interface ContentRefreshJobData {
  refreshLogId: number;
  pgId: number;
  pgAlias: string;
  pageType: Exclude<PageType, 'R5_diagnostic'>;
  /** Canonical role identifier (Phase 0 normalization) */
  roleId?: RoleId;
  /** Absolute paths of supplementary RAG files that triggered this refresh */
  supplementaryFiles?: string[];
  /** Force re-enrichment even when all sections are already substantial */
  force?: boolean;
  /** Correlation ID for end-to-end tracing across logs and DB */
  correlationId?: string;
}

/** Job data for diagnostic refresh (R5) — keyed by diagnosticSlug, NOT pgAlias */
export interface ContentRefreshJobDataR5 {
  refreshLogId: number;
  diagnosticSlug: string;
  pageType: 'R5_diagnostic';
  /** Canonical role identifier (Phase 0 normalization) */
  roleId?: RoleId;
  /** Correlation ID for end-to-end tracing across logs and DB */
  correlationId?: string;
}

/** Job data for vehicle page refresh (R8) — keyed by typeId, NOT pgAlias */
export interface ContentRefreshJobDataR8 {
  refreshLogId?: number;
  typeId: number;
  pageType: 'R8_vehicle';
  correlationId?: string;
}

/** Union of all job data types */
export type AnyContentRefreshJobData =
  | ContentRefreshJobData
  | ContentRefreshJobDataR5
  | ContentRefreshJobDataR8;

export interface ContentRefreshResult {
  status: 'draft' | 'failed' | 'skipped' | 'auto_published';
  qualityScore: number | null;
  qualityFlags: string[];
  errorMessage?: string;
}

// ── RAG Overlay Contract ──

/** Outcome of attempting to load RAG data for an enrichment job */
export type RagPatchStatus =
  | 'SUCCESS' // RAG file found, parsed, valid data extracted
  | 'SKIPPED_NO_RAG' // No RAG file exists for this gamme (NORMAL)
  | 'SKIPPED_INVALID_RAG' // RAG file exists but content is unparseable/too short
  | 'ERROR'; // Unexpected error during RAG loading

export interface RagPatchResult {
  status: RagPatchStatus;
  /** Raw content if status=SUCCESS */
  content?: string;
  /** Human-readable reason for non-SUCCESS statuses */
  reason?: string;
  /** Source path for provenance tracking */
  sourcePath?: string;
}

// ── Claim Ledger MVP (4 types) ──

export type ClaimKind = 'mileage' | 'dimension' | 'percentage' | 'norm';

export interface ClaimEntry {
  /** Stable hash of kind+rawText+sectionKey */
  id: string;
  kind: ClaimKind;
  /** Original text as found in content, e.g. "120 000 - 150 000 km" */
  rawText: string;
  /** Normalized value, e.g. "120000-150000" */
  value: string;
  /** Unit, e.g. "km", "mm", "%" */
  unit: string;
  /** Which section this claim appears in */
  sectionKey: string;
  /** Source reference, e.g. "rag:gammes/embrayage.md#timing" */
  sourceRef: string | null;
  /** Link to evidence pack entry */
  evidenceId: string | null;
  /** verified = backed by source, unverified = no source found, blocked = stripped */
  status: 'verified' | 'unverified' | 'blocked';
}

// ── Section Metadata ──

export interface SectionMeta {
  /** Abstract section key */
  sectionKey: string;
  /** Word count after compilation */
  wordCount: number;
  /** Content source that produced this section */
  sourceType: 'db' | 'rag' | 'ai' | 'static' | 'empty';
  /** Mode applied by SectionCompiler */
  appliedMode: 'full' | 'summary' | 'link_only' | 'forbidden' | 'empty';
  /** Whether the section was truncated */
  wasTruncated: boolean;
  /** Whether the section was stripped (forbidden) */
  wasStripped: boolean;
}

// ── Auto-Repair Types ──

export type HardGateName =
  | 'attribution'
  | 'no_guess'
  | 'scope_leakage'
  | 'contradiction'
  | 'seo_integrity'
  | 'missing_og_image'
  | 'missing_hero_policy_match'
  | 'missing_alt_text'
  // RAG-specific gates (Chantier 3)
  | 'rag_citation_integrity'
  | 'rag_role_compliance'
  | 'rag_number_sourced'
  // Source-tag leak detection (zero-tolerance)
  | 'anti_source';

export interface ExtendedGateResult {
  gate: HardGateName;
  verdict: 'PASS' | 'WARN' | 'FAIL';
  details: string[];
  /** Measured value (ratio, count, etc.) */
  measured: number;
  warnThreshold: number;
  failThreshold: number;
  triggerItems?: Array<{
    location: string;
    issue: string;
    evidenceRef?: string;
  }>;
}

export type RepairStrategy =
  // Pass 1: Retrieval tightening
  | 'retrieval_tighten_scope'
  | 'retrieval_conservative_reenrich'
  | 'keep_evidenced_claim'
  | 'restore_protected_fields'
  // Pass 2: Conservative rewrite
  | 'strip_source_tags'
  | 'strip_unsourced_numbers'
  | 'remove_unsourced_sentences'
  | 'strip_novel_terms'
  | 'remove_leaking_sentences'
  | 'remove_both_contradictions'
  | 'revert_to_pre_repair';

export interface RepairAction {
  gate: HardGateName;
  strategy: RepairStrategy;
  description: string;
  passLevel: 1 | 2;
  targets?: string[];
}

export interface RepairActionResult {
  action: RepairAction;
  applied: boolean;
  itemsAffected: number;
  detail: string;
}

export interface AutoRepairAttempt {
  pass: number;
  startedAt: string;
  completedAt: string;
  failingGatesBefore: HardGateName[];
  failingGatesAfter: HardGateName[];
  actions: RepairActionResult[];
  contentHashBefore: string;
  contentHashAfter: string;
  contentChanged: boolean;
}

export interface RepairResult {
  allGatesPassed: boolean;
  totalPasses: number;
  maxPasses: number;
  attempts: AutoRepairAttempt[];
  fallbackApplied: boolean;
  reasonCode:
    | 'GATES_CLEAN'
    | 'REPAIRED'
    | 'FALLBACK_APPLIED'
    | 'REPAIR_EXHAUSTED'
    | 'REPAIR_NO_PROGRESS'
    | 'REPAIR_DISABLED';
  durationMs: number;
}

export interface SafeFallbackDraft {
  content: string;
  templateId: 'safe_R1' | 'safe_R3_guide' | 'safe_R3_conseils' | 'safe_R4';
  gammeName: string;
  familyLabel: string;
  generatedAt: string;
}

/** Evidence entry from RAG knowledge base */
export interface EvidenceEntry {
  docId: string;
  heading: string;
  charRange: [number, number];
  rawExcerpt: string;
  confidence: number;
  sourceHash?: string;
}

// ── RAG Safe Distill Pack (Chantier 2) ──

export interface RagSafeItem {
  /** Distilled neutral sentence/bullet */
  text: string;
  /** Weaviate chunk_id for provenance tracking */
  source_id: string;
}

export interface RagSafePack {
  roleId?: string; // role cible du pack
  definitions: RagSafeItem[];
  selection_checks: RagSafeItem[];
  trust_proofs: RagSafeItem[];
  support_notes: RagSafeItem[];
  faq_pairs: RagSafeItem[]; // chunk_kind=faq
  procedures: RagSafeItem[]; // chunk_kind=procedure
  spec_refs: RagSafeItem[]; // chunk_kind=table_rows
  confusions: RagSafeItem[]; // futur classifier
  anti_claims: RagSafeItem[]; // futur classifier
  /** All retained items for provenance audit */
  citations_used: RagSafeItem[];
}

// ── R1 Content Pipeline (4-prompt sequence) ──

export interface R1ContentContract {
  total_words_target: [number, number];
  micro_seo_words_target: [number, number];
  faq_answer_words_target: [number, number];
  max_gamme_mentions: number;
  max_compatible_mentions: number;
}

export interface R1HardRules {
  ban_howto_markers: string[];
  ban_absolute_claims: string[];
  ban_price_push: string[];
}

export interface R1VisualPlan {
  hero_primary_cta?: { label: string; action?: string };
  cross_sell_rules?: { max_items: number; same_family_only?: boolean };
  compatibilities_label_rule?: string;
}

export interface R1IntentLockOutput {
  primary_intent: string;
  forbidden_lexicon: string[];
  allowed_lexicon: string[];
  confusion_pairs: Array<{
    term: string;
    confused_with: string;
    distinction: string;
  }>;
  writing_constraints: {
    max_words: number;
    min_words: number;
    tone: string;
    person: string;
    zero_diagnostic: boolean;
    zero_howto: boolean;
  };
  interest_nuggets: Array<{
    angle: string;
    hook: string;
    rag_source: string;
  }>;
  content_contract?: R1ContentContract;
  hard_rules?: R1HardRules;
  /** @deprecated Use forbidden_lexicon */
  forbidden_overlap?: string[];
  /** @deprecated Subsumed by allowed_lexicon */
  termes_techniques?: string[];
  /** @deprecated Subsumed by interest_nuggets.rag_source */
  preuves?: string[];
}

export interface R1SerpPackOutput {
  title_main: string;
  title_variants: string[];
  meta_main: string;
  meta_variants: string[];
  h1: string;
  h2: string[];
  /** @deprecated Use h2 */
  h2s?: string[];
}

export interface R1SectionCopyOutput {
  hero_subtitle: string;
  proof_badges: string[];
  selector_microcopy: string[];
  micro_seo_block: string;
  compatibilities_intro: string;
  equipementiers_line: string;
  faq_selector: Array<{ question: string; answer: string }>;
  family_cross_sell_intro: string;
  visual_plan?: R1VisualPlan;
  /** Runtime only — not persisted */
  safe_table_rows?: Array<Record<string, unknown>>;
  /** Runtime only — not persisted */
  word_count?: Record<string, number>;
}

export interface R1GatekeeperOutput {
  gate_score: number;
  gate_status: 'PASS' | 'WARN' | 'FAIL';
  checks: Record<string, unknown>;
  fixes_applied: Array<{ field: string; before: string; after: string }>;
  version_clean: string;
  /** @deprecated Use gate_score */
  score?: number;
  /** @deprecated Use checks */
  flags?: string[];
  /** @deprecated */
  corrections?: Record<string, string>;
}

export interface R1PipelineResult {
  intentLock: R1IntentLockOutput;
  serpPack: R1SerpPackOutput;
  sectionCopy: R1SectionCopyOutput;
  gatekeeper: R1GatekeeperOutput;
}

export interface PublishDecision {
  action: 'auto_publish' | 'draft' | 'block' | 'skip';
  reasonCode: string;
  qualityScore: number | null;
  softGates: import('../../modules/admin/services/brief-gates.service').GateResult[];
  hardGates: ExtendedGateResult[] | null;
  hardGatesObserveOnly: boolean;
  repairResult: RepairResult | null;
  isCanary: boolean;
  qaGuardPassed: boolean | null;
}

// ── Phase 2 Evidence Grading (P2.4) ──

export const EVIDENCE_GRADES = [
  'strong',
  'support-only',
  'weak-support',
  'forbidden-for-claim',
] as const;
export type EvidenceGrade = (typeof EVIDENCE_GRADES)[number];

export interface GradedEvidence extends RagSafeItem {
  /** Quality grade based on truth_level + purity_score */
  grade: EvidenceGrade;
  /** Section keys this evidence maps to */
  targetSections: string[];
}

export interface EvidenceGradeMap {
  [evidenceSourceId: string]: EvidenceGrade;
}

export interface RagSufficiencyReport {
  overall: 'PASS' | 'PARTIAL' | 'FAIL';
  perSection: Record<
    string,
    { evidenceCount: number; minRequired: number; sufficient: boolean }
  >;
  conflictCount: number;
}

// ── Phase 2 Section Eligibility (P2.2) ──

export const SECTION_ELIGIBILITIES = [
  'ELIGIBLE',
  'ELIGIBLE_WITH_LIMITS',
  'BLOCKED',
  'MISSING_EVIDENCE',
  'OUT_OF_ROLE',
] as const;
export type SectionEligibility = (typeof SECTION_ELIGIBILITIES)[number];

export interface SectionEligibilityEntry {
  sectionKey: string;
  eligibility: SectionEligibility;
  reason: string;
  claimLimit: number;
  evidenceCount: number;
}

// ── Phase 2 Version Comparison (P2.5) ──

export const REFRESH_DECISIONS = [
  'skip',
  'refresh_partial',
  'refresh_full',
  'repair',
  'hold',
] as const;
export type RefreshDecision = (typeof REFRESH_DECISIONS)[number];

export interface VersionSnapshot {
  contentHash: string;
  qualityScore: number;
  subscores: Record<string, number>;
  generatedAt: string;
  executionMode: string;
  roleId: string;
}

export interface VersionComparisonResult {
  previousVersion: VersionSnapshot | null;
  candidateVersion: VersionSnapshot;
  scoreDelta: number;
  bestVersionProtected: boolean;
  refreshDecision: RefreshDecision;
}

// ── Phase 2 QA Decision (P2.7) ──

export const QA_DECISIONS = ['PASS', 'HOLD', 'BLOCK', 'ESCALATE'] as const;
export type QaDecision = (typeof QA_DECISIONS)[number];

export const PUBLICATION_DECISIONS = [
  'HOLD',
  'BLOCK',
  'APPROVED',
  'REVIEW',
] as const;
export type PublicationDecision = (typeof PUBLICATION_DECISIONS)[number];

export interface QaReport {
  qaScore: number;
  qaDecision: QaDecision;
  genericityScore: number;
  claimRiskFlags: string[];
  blockingFlags: string[];
  warningFlags: string[];
  publicationCandidate: boolean;
  publicationDecision: PublicationDecision;
  escalationReason: string | null;
  dimensions: {
    rolePurity: number;
    contractCompliance: number;
    evidenceDepth: number;
    antiCannibalization: number;
  };
}
