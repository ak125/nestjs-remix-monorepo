/**
 * ADR-029 P1 — RAG v2.1 Control Plane lifecycle types.
 *
 * Source de vérité:
 *   .spec/00-canon/enrichment-report.schema.json
 *   .spec/00-canon/conflict.schema.yaml
 *
 * Toute évolution de ces types DOIT d'abord modifier les schemas canon, puis
 * propager ici. Aucune divergence tolérée — le runtime valide la conformité
 * via Ajv (cf. RagEnrichmentReportEmitterService).
 */

// ── Lifecycle stages (state machine 7 stages) ────────────────────────────────

export const RAG_LIFECYCLE_STAGES = [
  'v5_ssot',
  'v5_audited',
  'v5_enriched',
  'v5_qa_passed',
  'v5_indexed',
  'v5_blocked',
  'v5_pending_review',
] as const;

export type RagLifecycleStage = (typeof RAG_LIFECYCLE_STAGES)[number];

// ── Execution modes ──────────────────────────────────────────────────────────

export const RAG_EXECUTION_MODES = [
  'audit_only',
  'enrich_dry_run',
  'enrich_write',
  'qa_only',
  'qa_write',
  'index_ready_check',
] as const;

export type RagExecutionMode = (typeof RAG_EXECUTION_MODES)[number];

// ── Truth level ──────────────────────────────────────────────────────────────

export type RagTruthLevel = 'L1' | 'L2';

// ── Decision matrix ──────────────────────────────────────────────────────────

export const RAG_DECISIONS = [
  'PROMOTE_L1',
  'KEEP_L2',
  'BLOCKED',
  'PENDING_REVIEW',
] as const;

export type RagDecision = (typeof RAG_DECISIONS)[number];

// ── Validators (R0-R8) ───────────────────────────────────────────────────────

export const RAG_VALIDATORS = [
  'R0',
  'R1',
  'R3',
  'R4',
  'R5',
  'R6',
  'R7',
  'R8',
] as const;

export type RagValidator = (typeof RAG_VALIDATORS)[number];

export type RagValidatorVerdict = 'PASS' | 'PARTIAL' | 'FAIL' | 'SKIPPED';

// ── Block result (per-block enrichment outcome) ──────────────────────────────

export type RagBlockAction = 'unchanged' | 'modified' | 'added' | 'removed';

export interface RagBlockResult {
  action: RagBlockAction;
  /** 0-100. null if action=unchanged or not scored this run. */
  qa_score: number | null;
  /** 0-100. null if not measured this run. */
  evidence_score: number | null;
  /** Whether the block meets D5 minimal schema requirements. */
  structural_complete: boolean | null;
}

export type RagBlockKey =
  | 'domain'
  | 'selection'
  | 'maintenance'
  | 'diagnostic'
  | 'installation';

// ── Conflicts (cf. conflict.schema.yaml) ─────────────────────────────────────

export type RagConflictType =
  /** Formulation différente, même sens métier. Ne bloque PAS L1. */
  | 'minor_variation'
  /** Valeur technique divergente. BLOQUE L1. */
  | 'technical_conflict'
  /** Contradiction sur procédure/sécurité. BLOQUE L1 + priorité revue. */
  | 'safety_conflict';

export type RagConflictResolutionStatus = 'open' | 'resolved' | 'dismissed';

export type RagConflictResolution =
  | 'accept_existing'
  | 'accept_new'
  | 'merge'
  | 'rewrite'
  | null;

/** Source tier (A=constructeur/norme, B=revendeur/guide, C=généraliste). */
export type RagSourceTier = 'A' | 'B' | 'C';

export interface RagSourceRef {
  url: string;
  tier: RagSourceTier;
}

/**
 * Conflict entry as stored in the gamme frontmatter `_conflicts[]`.
 * Cf. conflict.schema.yaml §conflict_entry.
 */
export interface RagConflictEntry {
  block: 'domain' | 'selection' | 'diagnostic' | 'maintenance' | 'installation' | 'rendering';
  /** Dot path: ex `interval.value`, `symptoms[0].label`. */
  field: string;
  conflict_type: RagConflictType;
  /** UUID v4 of the run that detected the conflict. */
  run_id: string;
  existing_value: string;
  new_value: string;
  existing_sources: RagSourceRef[];
  new_sources: RagSourceRef[];
  resolution_status: RagConflictResolutionStatus;
  /** true if technical_conflict or safety_conflict; false only for minor_variation. */
  human_review_required: boolean;
  /** ISO date YYYY-MM-DD. */
  created_at: string;
  resolved_by: string | null;
  resolution: RagConflictResolution;
  resolved_at: string | null;
}

/** Compact summary embedded in the enrichment report. Full detail lives in the .md `_conflicts[]`. */
export interface RagConflictSummary {
  block: string;
  field: string;
  conflict_type: RagConflictType;
}

// ── SEO regression checks (8 checks, cf. enrichment-report.schema.json) ──────

export interface RagSeoRegressionCheckDetail {
  /** 1-8. */
  check_id: number;
  status: 'pass' | 'fail';
  detail?: string;
}

export interface RagSeoRegressionChecks {
  passed: number;
  failed: number;
  details: RagSeoRegressionCheckDetail[];
}

// ── Enrichment report (complete payload) ─────────────────────────────────────

/**
 * Payload validé contre `.spec/00-canon/enrichment-report.schema.json`.
 * Persisté en table `__rag_enrichment_runs.report_json` (jsonb) + dump
 * `/opt/automecanik/rag/logs/runs/{run_id}.json` (audit trail filesystem).
 */
export interface RagEnrichmentReport {
  /** UUID v4, propagated to _archive, _conflicts, QA logs, lifecycle.last_enriched_run_id. */
  run_id: string;
  /** Gamme slug (= pg_alias). */
  alias: string;
  /** ISO date YYYY-MM-DD. */
  run_date: string;
  execution_mode: RagExecutionMode;
  state_before: RagLifecycleStage;
  state_after: RagLifecycleStage;
  truth_level_before: RagTruthLevel;
  truth_level_after: RagTruthLevel;
  /** Per-block results. Keys are RagBlockKey. */
  blocks: Partial<Record<RagBlockKey, RagBlockResult>>;
  conflicts: RagConflictSummary[];
  /** Fields requiring manual Tier A sourcing (format: `block.field`). */
  pending_manual_sources: string[];
  seo_regression_checks: RagSeoRegressionChecks;
  validators_invoked: RagValidator[];
  validator_verdicts: Partial<Record<RagValidator, RagValidatorVerdict>>;
  decision: RagDecision;
  /** Human-readable explanation of the decision. */
  reason: string;
}

// ── Helper: validate decision matrix coherence ───────────────────────────────

/**
 * Returns true if the (decision, conflicts, validator_verdicts) triple is
 * internally coherent per ADR-029 decision matrix.
 *
 * - PROMOTE_L1 forbids any technical_conflict/safety_conflict and requires all
 *   invoked validators PASS.
 * - safety_conflict forces PENDING_REVIEW (or BLOCKED). Never PROMOTE_L1.
 * - technical_conflict open forces BLOCKED or PENDING_REVIEW.
 */
export function isDecisionCoherent(report: RagEnrichmentReport): boolean {
  const hasSafety = report.conflicts.some((c) => c.conflict_type === 'safety_conflict');
  const hasTechnical = report.conflicts.some((c) => c.conflict_type === 'technical_conflict');
  const allValidatorsPass =
    report.validators_invoked.length > 0 &&
    report.validators_invoked.every(
      (v) => report.validator_verdicts[v] === 'PASS',
    );

  if (report.decision === 'PROMOTE_L1') {
    return !hasSafety && !hasTechnical && allValidatorsPass;
  }
  if (hasSafety) {
    return report.decision === 'PENDING_REVIEW' || report.decision === 'BLOCKED';
  }
  if (hasTechnical) {
    return report.decision === 'BLOCKED' || report.decision === 'PENDING_REVIEW';
  }
  return true;
}
