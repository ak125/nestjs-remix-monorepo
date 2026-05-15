/**
 * PR-E — H1 Recovery Apply Orchestrator
 *
 * Reads `proposed` events from the event store, gates each through
 * `SeoRolloutGateService`, and submits accepted ones to the gateway
 * `SeoContentWriteService.applyH1(...)`.
 *
 * STRICT orchestration role (per plan + user constraint) :
 *   - NEVER picks a "best value" itself — only consumes proposed events
 *     produced upstream by the propose pipeline (scripts/seo/recovery/).
 *   - NEVER recalculates the policy — the gateway evaluates OPA on every call.
 *   - NEVER bypasses the gateway — every applied event comes from
 *     SeoContentWriteService.applyH1 → atomic UPDATE + INSERT event.
 *   - NEVER rewrites without lineage — every applied event references its
 *     evaluation_id (FK guaranteed by RPC PR-D) and carries the source
 *     proposed event id in source_metadata.
 *
 * State transitions :
 *
 *   proposed
 *      ↓  (rollout gate eligible)
 *   gateway.applyH1
 *      ↓  (atomic)
 *   applied
 *      ↓  (later, multi-source validator)
 *   validated | reverted | quarantined
 *
 * Plan : §8 Phase E
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import {
  SeoContentWriteService,
  PolicyDeniedException,
} from '../governance/seo-content-write.service';
import { SeoRolloutGateService } from './seo-rollout-gate.service';

interface ProposedEventRow {
  event_id: string;
  asset_id: string;
  field_path: string;
  value_text: string | null;
  source_metadata: {
    evidence_tier?: string;
    proposed_target_kind?: 'mta_alias' | 'r1_pg' | 'r6_pg' | 'legacy_gamme';
    proposed_target_value?: string | number;
    [k: string]: unknown;
  };
  created_at: string;
}

export interface ApplyRunReport {
  total_proposed_scanned: number;
  skipped_not_eligible: number;
  skipped_missing_target: number;
  applied_ok: number;
  denied_by_policy: number;
  errors: Array<{ event_id: string; reason: string }>;
}

@Injectable()
export class H1RecoveryApplyService {
  private readonly logger = new Logger(H1RecoveryApplyService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly gateway: SeoContentWriteService,
    private readonly rollout: SeoRolloutGateService,
  ) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        '[H1RecoveryApplyService] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required',
      );
    }
    this.supabase = createClient(url, key, { auth: { persistSession: false } });
  }

  /**
   * Process up to `batchSize` proposed events. Returns a report ; intended
   * to be invoked by a BullMQ repeatable job (every ~5 min) or admin
   * controller.
   */
  async processProposedBatch(options: {
    batchSize?: number;
    sinceMinutes?: number;
    triggeredBy: string;
  }): Promise<ApplyRunReport> {
    const batchSize = options.batchSize ?? 10;
    const sinceMinutes = options.sinceMinutes ?? 7 * 24 * 60; // 7 days default
    const report: ApplyRunReport = {
      total_proposed_scanned: 0,
      skipped_not_eligible: 0,
      skipped_missing_target: 0,
      applied_ok: 0,
      denied_by_policy: 0,
      errors: [],
    };

    if (!this.rollout.isRecoveryEnabled()) {
      this.logger.warn(
        '[H1RecoveryApply] SEO_H1_RECOVERY_ENABLED=false → no proposed event processed.',
      );
      return report;
    }

    const sinceIso = new Date(
      Date.now() - sinceMinutes * 60 * 1000,
    ).toISOString();

    // Load proposed events for h1 that don't already have an applied event
    // following them. Limit to the rollout window via created_at.
    const { data, error } = await this.supabase
      .from('__seo_content_events')
      .select(
        'event_id, asset_id, field_path, value_text, source_metadata, created_at',
      )
      .eq('event_kind', 'proposed')
      .eq('field_path', 'h1')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (error) {
      throw new Error(
        `[H1RecoveryApply] failed to load proposed events: ${error.message}`,
      );
    }
    const rows = (data ?? []) as ProposedEventRow[];
    report.total_proposed_scanned = rows.length;

    for (const ev of rows) {
      // Skip if already applied (no double-apply).
      if (await this.alreadyApplied(ev)) {
        continue;
      }

      // Rollout gate check (deterministic hash bucket).
      if (!this.rollout.isAssetEligible(ev.asset_id)) {
        report.skipped_not_eligible++;
        continue;
      }

      // Validate proposed event has a target descriptor + value.
      const target = this.resolveTarget(ev);
      if (!target || !ev.value_text) {
        report.skipped_missing_target++;
        this.logger.warn(
          `[H1RecoveryApply] proposed event ${ev.event_id} skipped : missing target or value_text`,
        );
        continue;
      }

      // Submit to gateway with source.kind='legacy_recovery' + carry the
      // proposed event id (for lineage) + evidence_tier (for policy gate).
      try {
        const result = await this.gateway.applyH1({
          target,
          value: ev.value_text,
          source: {
            kind: 'legacy_recovery',
            actor: `worker:h1-recovery (${options.triggeredBy})`,
            evidenceTier: ev.source_metadata.evidence_tier,
            proposedEvent: {
              eventId: ev.event_id,
              parentEventKind: 'proposed',
            },
            flagState: 'enabled', // worker only got here because rollout enabled
          },
        });
        report.applied_ok++;
        this.logger.log(
          `[H1RecoveryApply] applied ${ev.asset_id} → eventId=${result.eventId} eval=${result.evaluationId}`,
        );
      } catch (err) {
        if (err instanceof PolicyDeniedException) {
          report.denied_by_policy++;
          this.logger.warn(
            `[H1RecoveryApply] policy denied for ${ev.asset_id} : ${err.decision.reasons.join(' | ')}`,
          );
        } else {
          report.errors.push({
            event_id: ev.event_id,
            reason: err instanceof Error ? err.message : String(err),
          });
          this.logger.error(
            `[H1RecoveryApply] error applying ${ev.asset_id} : ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    return report;
  }

  /**
   * Has the proposed event already been applied ? Look for an applied event
   * referencing the proposed_event_id in source_metadata.
   */
  private async alreadyApplied(ev: ProposedEventRow): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('__seo_content_events')
      .select('event_id')
      .eq('event_kind', 'applied')
      .eq('asset_id', ev.asset_id)
      .eq('field_path', ev.field_path)
      .contains('source_metadata', { proposed_event_id: ev.event_id })
      .limit(1);
    if (error) {
      this.logger.warn(
        `[H1RecoveryApply] alreadyApplied check failed for ${ev.event_id}: ${error.message}`,
      );
      return false;
    }
    return (data ?? []).length > 0;
  }

  /**
   * Resolve the H1Target from the proposed event's source_metadata. Returns
   * null if the descriptor is incomplete (event will be skipped).
   */
  private resolveTarget(ev: ProposedEventRow): null | {
    kind: 'mta_alias' | 'r1_pg' | 'r6_pg' | 'legacy_gamme';
    mtaAlias?: string;
    pgId?: number;
  } {
    const kind = ev.source_metadata.proposed_target_kind;
    const value = ev.source_metadata.proposed_target_value;
    if (!kind || value === undefined || value === null) return null;
    if (kind === 'mta_alias') {
      return typeof value === 'string'
        ? { kind: 'mta_alias', mtaAlias: value }
        : null;
    }
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) return null;
    if (kind === 'r1_pg') return { kind: 'r1_pg', pgId: numeric };
    if (kind === 'r6_pg') return { kind: 'r6_pg', pgId: numeric };
    if (kind === 'legacy_gamme') return { kind: 'legacy_gamme', pgId: numeric };
    return null;
  }
}
