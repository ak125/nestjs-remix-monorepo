/**
 * PR-E — SEO Revert Selector (safe revert target picking)
 *
 * When an applied event fails multi-source validation (J+1/J+3/J+7) or is
 * flagged for auto-revert, this service decides WHAT value to revert to.
 *
 * STRICT eligibility rule (memory + plan §8) — a revert target is acceptable
 * ONLY if the historical applied event has :
 *   - source_kind = 'human_curated', OR
 *   - source_kind = 'human_validated_llm', OR
 *   - source_kind = 'legacy_recovery'      AND  source_metadata.evidence_tier
 *                                                ∈ {exact_match_snapshot,
 *                                                   exact_match_event_log,
 *                                                   exact_match_blog_advice,
 *                                                   exact_match_builder_template}
 *
 * If NO valid candidate exists in the asset's lineage → quarantine
 * (`event_kind='quarantined'`). NEVER revert to `unknown` or
 * `heuristic_recent_change` — that would restore a state that's already
 * corrupt.
 *
 * Pure decision service : selects a target event, does NOT write. Callers
 * (the recovery worker or validation script) consume the target and route
 * through `SeoContentWriteService.applyH1` to perform the actual revert
 * atomically (UPDATE + INSERT event 'reverted').
 *
 * Plan : §8 Phase E (revert règle stricte)
 * Memory : feedback_deterministic_evidence_tiers_over_bayesian
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

const EXACT_MATCH_TIERS = new Set([
  'exact_match_snapshot',
  'exact_match_event_log',
  'exact_match_blog_advice',
  'exact_match_builder_template',
]);

const HUMAN_TRUSTED_SOURCES = new Set(['human_curated', 'human_validated_llm']);

export interface RevertCandidate {
  eventId: string;
  valueText: string;
  valueHash: string;
  sourceKind: string;
  evidenceTier: string | null;
  createdAt: string;
}

export type RevertDecision =
  | { kind: 'revert_to'; candidate: RevertCandidate }
  | { kind: 'quarantine'; reason: string; inspectedEventCount: number };

@Injectable()
export class SeoRevertSelectorService {
  private readonly logger = new Logger(SeoRevertSelectorService.name);
  private readonly supabase: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        '[SeoRevertSelectorService] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required',
      );
    }
    this.supabase = createClient(url, key, { auth: { persistSession: false } });
  }

  /**
   * Walks the applied-event history for (asset_id, field_path) from most
   * recent to oldest, returning the FIRST event that matches the strict
   * eligibility rule. Stops at the current applied event (excluded — we don't
   * revert to the current state).
   */
  async selectRevertTarget(
    assetId: string,
    fieldPath: 'h1',
  ): Promise<RevertDecision> {
    const { data, error } = await this.supabase
      .from('__seo_content_events')
      .select(
        'event_id, value_text, value_hash, source_kind, source_metadata, created_at',
      )
      .eq('asset_id', assetId)
      .eq('field_path', fieldPath)
      .eq('event_kind', 'applied')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(
        `[SeoRevertSelector] history lookup failed for ${assetId}: ${error.message}`,
      );
    }
    const rows = (data ?? []) as Array<{
      event_id: string;
      value_text: string;
      value_hash: string;
      source_kind: string;
      source_metadata: Record<string, unknown>;
      created_at: string;
    }>;

    if (rows.length === 0) {
      return {
        kind: 'quarantine',
        reason: 'No applied event in lineage to revert to',
        inspectedEventCount: 0,
      };
    }

    // Skip [0] (current value) — we want to revert to a PREVIOUS state.
    const candidates = rows.slice(1);

    for (const row of candidates) {
      if (HUMAN_TRUSTED_SOURCES.has(row.source_kind)) {
        return {
          kind: 'revert_to',
          candidate: this.buildCandidate(row),
        };
      }
      if (row.source_kind === 'legacy_recovery') {
        const tier = this.extractEvidenceTier(row.source_metadata);
        if (tier && EXACT_MATCH_TIERS.has(tier)) {
          return {
            kind: 'revert_to',
            candidate: this.buildCandidate(row, tier),
          };
        }
      }
      // 'audit_bootstrap', 'unknown', 'heuristic_recent_change',
      // 'deterministic_builder', 'llm_generated_direct' → not eligible.
    }

    return {
      kind: 'quarantine',
      reason:
        'No revert candidate in lineage matches strict rule ' +
        '(human_curated | human_validated_llm | legacy_recovery + exact_match_*)',
      inspectedEventCount: rows.length,
    };
  }

  private buildCandidate(
    row: {
      event_id: string;
      value_text: string;
      value_hash: string;
      source_kind: string;
      source_metadata: Record<string, unknown>;
      created_at: string;
    },
    tierOverride?: string,
  ): RevertCandidate {
    return {
      eventId: row.event_id,
      valueText: row.value_text ?? '',
      valueHash: row.value_hash,
      sourceKind: row.source_kind,
      evidenceTier:
        tierOverride ?? this.extractEvidenceTier(row.source_metadata),
      createdAt: row.created_at,
    };
  }

  private extractEvidenceTier(meta: Record<string, unknown>): string | null {
    const t = meta?.['evidence_tier'];
    return typeof t === 'string' && t.length > 0 ? t : null;
  }

  /**
   * Log a revert decision into __seo_revert_candidates_log (created in
   * migration 20260524_seo_revert_candidates_log.sql). Auditable per attempt.
   */
  async logDecision(args: {
    assetId: string;
    fieldPath: 'h1';
    decision: RevertDecision;
    triggeredBy: string;
  }): Promise<void> {
    const isRevert = args.decision.kind === 'revert_to';
    const { error } = await this.supabase
      .from('__seo_revert_candidates_log')
      .insert({
        asset_id: args.assetId,
        field_path: args.fieldPath,
        decision: args.decision.kind,
        target_event_id: isRevert ? args.decision.candidate.eventId : null,
        target_source_kind: isRevert
          ? args.decision.candidate.sourceKind
          : null,
        target_evidence_tier: isRevert
          ? args.decision.candidate.evidenceTier
          : null,
        rejection_reason: isRevert ? null : args.decision.reason,
        inspected_event_count: isRevert ? 1 : args.decision.inspectedEventCount,
        triggered_by: args.triggeredBy,
      });
    if (error) {
      this.logger.error(
        `[SeoRevertSelector] failed to log decision for ${args.assetId}: ${error.message}`,
      );
    }
  }
}
