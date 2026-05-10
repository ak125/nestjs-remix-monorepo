import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import {
  RagProposalCreateInput,
  RagProposalMode,
  RagProposalResult,
  RagProposalRiskLevel,
  RagProposalRow,
} from './rag-proposal.types';

const RAG_REPO_PATH = '/opt/automecanik/rag';
const LEGACY_MODE_DEFAULT: RagProposalMode = 'off';

/**
 * RagProposalService — ADR-022 R8 RAG Control Plane (L1).
 *
 * Writes RAG file change proposals to `__rag_proposals` instead of direct
 * disk writes. CI validates, approves (low-risk auto or human), then opens
 * a signed PR against the RAG repo.
 *
 * Feature flag `RAG_PROPOSAL_MODE` controls the behavior of upstream callers
 * (VehicleRagGeneratorService) :
 *   - off           : legacy direct-write (default)
 *   - shadow        : write file AND insert proposal (dual-track)
 *   - propose-only  : insert proposal only, no disk write
 *
 * This service is idempotent via `input_fingerprint` — re-proposing the
 * exact same input returns the existing active proposal instead of inserting
 * a duplicate (PostgreSQL unique partial index enforces this).
 */
@Injectable()
export class RagProposalService extends SupabaseBaseService {
  protected readonly logger = new Logger(RagProposalService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Returns the current feature flag value from env.
   * Defaults to 'off' if unset or unknown.
   */
  getMode(): RagProposalMode {
    const raw = this.configService?.get<string>('RAG_PROPOSAL_MODE');
    if (raw === 'shadow' || raw === 'propose-only' || raw === 'off') {
      return raw;
    }
    return LEGACY_MODE_DEFAULT;
  }

  /**
   * Insert a new proposal or return existing active one for same fingerprint.
   *
   * Idempotence guarantee : unique partial index on
   * `(input_fingerprint) WHERE status IN ('pending','validating','approved')`
   * prevents duplicates. We query first and short-circuit to return the
   * existing row without an INSERT attempt — cleaner than catching 23505.
   */
  async propose(input: RagProposalCreateInput): Promise<RagProposalResult> {
    try {
      // 1. Dedup check : return existing active proposal if fingerprint already used
      const existing = await this.findByFingerprint(input.input_fingerprint);
      if (existing) {
        this.logger.log(
          `Proposal deduped for fingerprint ${input.input_fingerprint} → existing ${existing.proposal_uuid} (status=${existing.status})`,
        );
        return { status: 'deduped', proposal: existing };
      }

      // 2. Resolve base_commit_sha of RAG repo (what HEAD looked like at propose time)
      const baseCommitSha = input.base_commit_sha || this.getRagRepoHead();

      // 3. Compute content hash
      const proposedContentHash = this.sha256(input.proposed_content);

      // 4. Classify risk level (if not explicitly provided)
      const riskLevel = input.risk_level ?? this.classifyRisk(input);

      // 5. INSERT
      const { data, error } = await this.supabase
        .from('__rag_proposals')
        .insert({
          target_path: input.target_path,
          target_slug: input.target_slug,
          target_kind: input.target_kind,
          base_commit_sha: baseCommitSha,
          base_content_hash: input.base_content_hash ?? null,
          proposed_content: input.proposed_content,
          proposed_content_hash: proposedContentHash,
          input_fingerprint: input.input_fingerprint,
          created_by: input.created_by,
          risk_level: riskLevel,
          depends_on: input.depends_on ?? null,
        })
        .select('*')
        .single();

      if (error) {
        this.logger.error(
          `Propose failed for ${input.target_slug} (${input.target_kind}): ${error.message}`,
        );
        return { status: 'failed', message: error.message };
      }

      this.logger.log(
        `Proposal created ${data.proposal_uuid} target=${input.target_path} risk=${riskLevel}`,
      );
      return { status: 'created', proposal: data as RagProposalRow };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Propose threw: ${msg}`);
      return { status: 'failed', message: msg };
    }
  }

  async findByFingerprint(fingerprint: string): Promise<RagProposalRow | null> {
    const { data, error } = await this.supabase
      .from('__rag_proposals')
      .select('*')
      .eq('input_fingerprint', fingerprint)
      .in('status', ['pending', 'validating', 'approved'])
      .maybeSingle();

    if (error) {
      this.logger.warn(`findByFingerprint error: ${error.message}`);
      return null;
    }
    return (data as RagProposalRow | null) ?? null;
  }

  async findByUuid(uuid: string): Promise<RagProposalRow | null> {
    const { data, error } = await this.supabase
      .from('__rag_proposals')
      .select('*')
      .eq('proposal_uuid', uuid)
      .maybeSingle();

    if (error) {
      this.logger.warn(`findByUuid error: ${error.message}`);
      return null;
    }
    return (data as RagProposalRow | null) ?? null;
  }

  /**
   * Classifies risk level based on input characteristics.
   *
   * Rules (from design spec § 5.2) :
   *   - new file (base_content_hash null)                     → medium
   *   - proposed_content > 8KB                                → medium
   *   - proposed_content > 40KB                               → high
   *   - otherwise                                             → low
   *
   * NOTE : diff-lines based classification happens in CI validation step
   * when CI computes the actual unified diff. At propose time, we give a
   * conservative estimate — CI can bump later.
   */
  private classifyRisk(input: RagProposalCreateInput): RagProposalRiskLevel {
    const size = input.proposed_content.length;
    if (!input.base_content_hash) {
      return 'medium'; // new file is never low-risk (needs editorial eye)
    }
    if (size > 40000) return 'high';
    if (size > 8000) return 'medium';
    return 'low';
  }

  private sha256(s: string): string {
    return 'sha256:' + createHash('sha256').update(s).digest('hex');
  }

  /**
   * Returns current HEAD of the RAG repo (ak125/automecanik-rag). Used as
   * base_commit_sha to detect upstream drift between propose time and merge
   * time (if HEAD moves, proposal should be superseded and re-computed).
   *
   * Falls back to 'unknown' if repo not accessible (CI may not have it).
   */
  private getRagRepoHead(): string {
    try {
      return execSync('git rev-parse HEAD', {
        cwd: RAG_REPO_PATH,
        encoding: 'utf-8',
      })
        .trim()
        .slice(0, 40);
    } catch {
      return 'unknown';
    }
  }

  /**
   * Compute a stable fingerprint for generator inputs.
   * Regen with same inputs → same fingerprint → dedup hit → no-op.
   */
  static computeInputFingerprint(
    parts: Record<string, string | number>,
  ): string {
    const sorted = Object.keys(parts)
      .sort()
      .map((k) => `${k}=${parts[k]}`)
      .join('|');
    return createHash('sha256').update(sorted).digest('hex').slice(0, 32);
  }
}
