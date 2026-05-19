import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from '../../../config/feature-flags.service';

/**
 * KG Shadow Service — PR-E (Diagnostic Control Plane V1).
 *
 * Calls the orphan RPC `kg_diagnose_vehicle_aware` in parallel with the
 * canonical orchestrator engines and emits a divergence event. NEVER
 * affects the user-visible diagnostic — fire-and-forget by construction.
 *
 * V1 scope (canon STOP-at-V1) :
 *   - Call RPC, parse top-N fault_ids
 *   - Compare set-equality vs canonical hypotheses' top-N cause IDs
 *   - Emit `diagnostic_kg_shadow_diverged` event with reason label
 *   - Feature-flagged by `diagnostic_kg_shadow_enabled` (default true) and
 *     `diagnostic_kg_primary_enabled` (default FALSE — V1.5 only)
 *
 * V1.5 deferred (named, not implemented here) :
 *   - Persistent `__diag_kg_divergence_log` table for replay
 *   - Replay CLI to bulk-rerun historical sessions
 *   - Golden 200 anti-survivorship cohort
 *   - Admin read-only UI surfacing divergence trends
 *
 * Why fire-and-forget : KG RPC latency is unbounded (graph traversal). The
 * canonical path stays SLO-fast ; shadow lives best-effort on the side.
 */

/** What we look at in the KG result for the V1 comparison. */
interface KgFault {
  fault_id: string;
  score: number;
  confidence: number;
}

/** What we extract from the canonical engine's hypotheses for comparison. */
export interface CanonicalCauseRef {
  cause_id: string;
  confidence: number;
}

/** Divergence verdict emitted as event payload. */
export interface KgDivergence {
  has_divergence: boolean;
  reason: 'match' | 'top1_diff' | 'set_diff' | 'kg_empty' | 'kg_error';
  canonical_top_id: string | null;
  kg_top_id: string | null;
  jaccard_overlap: number; // 0..1
  compared_n: number; // size of top-N window used
}

export const TOP_N_DEFAULT = 5;

@Injectable()
export class KgShadowService extends SupabaseBaseService {
  protected readonly logger = new Logger(KgShadowService.name);

  constructor(
    configService: ConfigService,
    private readonly flags: FeatureFlagsService,
    @Optional() private readonly events?: EventEmitter2,
  ) {
    super(configService);
  }

  /**
   * Fire-and-forget shadow comparison. Returns immediately ; the RPC
   * call and the event emission resolve in the background. Failures are
   * swallowed (emitted as `kg_error` reason, never thrown).
   */
  shadowCompare(args: {
    observable_ids: readonly string[];
    vehicle_id?: string;
    canonical_hypotheses: readonly CanonicalCauseRef[];
    top_n?: number;
  }): void {
    if (!this.flags.diagnosticKgShadowEnabled) return;
    if (args.observable_ids.length === 0) return;

    // Fire-and-forget : never blocks orchestrator, never surfaces errors.
    void this.runShadow(args).catch((err: unknown) => {
      this.logger.warn(
        `KG shadow swallowed error: ${(err as Error)?.message ?? String(err)}`,
      );
    });
  }

  /**
   * Synchronous variant exposed for unit testing. Returns the divergence
   * verdict and emits the event. Production callers should use
   * `shadowCompare` (fire-and-forget).
   */
  async runShadow(args: {
    observable_ids: readonly string[];
    vehicle_id?: string;
    canonical_hypotheses: readonly CanonicalCauseRef[];
    top_n?: number;
  }): Promise<KgDivergence> {
    const topN = args.top_n ?? TOP_N_DEFAULT;
    let kgResult: readonly KgFault[];

    try {
      kgResult = await this.queryKg(args.observable_ids, args.vehicle_id, topN);
    } catch (err) {
      const verdict: KgDivergence = {
        has_divergence: true,
        reason: 'kg_error',
        canonical_top_id: args.canonical_hypotheses[0]?.cause_id ?? null,
        kg_top_id: null,
        jaccard_overlap: 0,
        compared_n: topN,
      };
      this.events?.emit('diagnostic_kg_shadow_diverged', {
        reason: verdict.reason,
        error: (err as Error)?.message ?? String(err),
      });
      return verdict;
    }

    const verdict = compareTopN(args.canonical_hypotheses, kgResult, topN);
    this.events?.emit('diagnostic_kg_shadow_diverged', {
      reason: verdict.reason,
      has_divergence: verdict.has_divergence,
      jaccard_overlap: verdict.jaccard_overlap,
    });
    return verdict;
  }

  private async queryKg(
    observable_ids: readonly string[],
    vehicle_id: string | undefined,
    top_n: number,
  ): Promise<readonly KgFault[]> {
    // Canon : route via `callRpc()` (RPC Safety Gate) — never the raw
    // Supabase client method directly (see `🛡️ RPC Safety Gate` workflow +
    // ADR-058 contract canon). The static grep gate matches the literal
    // substring, so comments must avoid the bare method-call form too.
    const { data, error } = await this.callRpc<Array<Record<string, unknown>>>(
      'kg_diagnose_vehicle_aware',
      {
        p_observable_ids: [...observable_ids],
        p_vehicle_id: vehicle_id,
        p_limit: top_n,
      },
    );
    if (error) throw error;
    if (!data || !Array.isArray(data)) return [];
    return data
      .filter((row) => typeof row.fault_id === 'string')
      .map((row) => ({
        fault_id: row.fault_id as string,
        score: typeof row.score === 'number' ? row.score : 0,
        confidence: typeof row.confidence === 'number' ? row.confidence : 0,
      }));
  }
}

/**
 * Pure comparison helper (exported for unit tests). Returns a verdict that
 * captures :
 *  - whether canonical's top-1 matches KG's top-1
 *  - jaccard overlap on the top-N sets
 *  - a categorical reason label safe for low-cardinality metrics
 */
export function compareTopN(
  canonical: readonly CanonicalCauseRef[],
  kg: readonly KgFault[],
  topN: number,
): KgDivergence {
  if (kg.length === 0) {
    return {
      has_divergence: canonical.length > 0,
      reason: 'kg_empty',
      canonical_top_id: canonical[0]?.cause_id ?? null,
      kg_top_id: null,
      jaccard_overlap: 0,
      compared_n: topN,
    };
  }

  const canonicalIds = canonical.slice(0, topN).map((c) => c.cause_id);
  const kgIds = kg.slice(0, topN).map((k) => k.fault_id);

  const canonicalSet = new Set(canonicalIds);
  const kgSet = new Set(kgIds);

  const intersection = new Set([...canonicalSet].filter((id) => kgSet.has(id)))
    .size;
  const union = new Set([...canonicalSet, ...kgSet]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  const canonicalTop = canonicalIds[0] ?? null;
  const kgTop = kgIds[0] ?? null;
  const top1Match = canonicalTop !== null && canonicalTop === kgTop;
  const setMatch = canonicalSet.size === kgSet.size && intersection === union;

  let reason: KgDivergence['reason'];
  if (setMatch) reason = 'match';
  else if (!top1Match) reason = 'top1_diff';
  else reason = 'set_diff';

  return {
    has_divergence: !setMatch,
    reason,
    canonical_top_id: canonicalTop,
    kg_top_id: kgTop,
    jaccard_overlap: jaccard,
    compared_n: topN,
  };
}
