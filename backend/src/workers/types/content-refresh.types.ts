import type { RoleId } from '../../config/role-ids';

export type PageType =
  | 'R1_pieces'
  | 'R3_conseils'
  | 'R3_guide_achat'
  | 'R4_reference'
  | 'R5_diagnostic';

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

/** Union of all job data types */
export type AnyContentRefreshJobData =
  | ContentRefreshJobData
  | ContentRefreshJobDataR5;

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
  | 'missing_alt_text';

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
