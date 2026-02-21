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
  /** Absolute paths of supplementary RAG files that triggered this refresh */
  supplementaryFiles?: string[];
}

/** Job data for diagnostic refresh (R5) — keyed by diagnosticSlug, NOT pgAlias */
export interface ContentRefreshJobDataR5 {
  refreshLogId: number;
  diagnosticSlug: string;
  pageType: 'R5_diagnostic';
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

// ── Auto-Repair Types ──

export type HardGateName =
  | 'attribution'
  | 'no_guess'
  | 'scope_leakage'
  | 'contradiction'
  | 'seo_integrity';

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
