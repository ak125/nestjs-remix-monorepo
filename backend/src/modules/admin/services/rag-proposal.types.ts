/**
 * Types for RagProposalService — ADR-022 R8 RAG Control Plane (Stage 1 L1).
 *
 * A proposal represents a pending/validating change to a RAG vehicle file
 * stored in ak125/automecanik-rag. Instead of writing directly to disk,
 * VehicleRagGeneratorService inserts a proposal row into __rag_proposals.
 * CI validates, approves (low-risk auto or human), then opens a signed PR.
 */

export type RagProposalTargetKind = 'vehicle_model' | 'variations' | 'role_map';

export type RagProposalStatus =
  | 'pending'
  | 'validating'
  | 'approved'
  | 'rejected'
  | 'merged'
  | 'expired'
  | 'superseded';

export type RagProposalRiskLevel = 'low' | 'medium' | 'high';

/**
 * Feature flag values.
 * - off           : legacy direct-write (default, no behavior change)
 * - shadow        : write file AND insert proposal (dual-track validation)
 * - propose-only  : insert proposal only, no disk write
 */
export type RagProposalMode = 'off' | 'shadow' | 'propose-only';

export interface RagProposalCreateInput {
  target_path: string; // ex: 'knowledge/vehicles/renault-clio-3.md'
  target_slug: string; // ex: 'renault-clio-3'
  target_kind: RagProposalTargetKind;
  base_commit_sha: string; // git HEAD of target repo at generation time
  base_content_hash?: string | null; // null if new file
  proposed_content: string; // full file content (not diff)
  input_fingerprint: string; // stable hash of generator inputs (for dedup)
  created_by: string; // 'service@version' or 'user@email'
  risk_level?: RagProposalRiskLevel; // default computed from diff size
  depends_on?: string | null; // parent proposal_uuid
}

export interface RagProposalRow {
  id: number;
  proposal_uuid: string;
  target_path: string;
  target_slug: string;
  target_kind: RagProposalTargetKind;
  base_commit_sha: string;
  base_content_hash: string | null;
  proposed_content: string;
  proposed_content_hash: string;
  diff_unified: string | null;
  input_fingerprint: string;
  status: RagProposalStatus;
  created_at: string;
  created_by: string;
  validated_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  merged_at: string | null;
  merged_commit_sha: string | null;
  expires_at: string;
  risk_level: RagProposalRiskLevel;
  risk_flags: string[];
  diff_lines_added: number;
  diff_lines_removed: number;
  schema_valid: boolean | null;
  forbidden_terms_found: string[] | null;
  placeholders_unresolved: string[] | null;
  validation_report: Record<string, unknown> | null;
  depends_on: string | null;
  superseded_by: string | null;
}

export interface RagProposalResult {
  status:
    | 'created' // new row inserted
    | 'deduped' // existing active proposal for same fingerprint — returned as-is
    | 'skipped' // mode=off, no action
    | 'failed';
  proposal?: RagProposalRow;
  message?: string;
}
