/**
 * RagChangeWatcherService — Polls __rag_change_events for pending RAG changes,
 * resolves impacted R* roles, and enqueues merge-only improvement jobs.
 *
 * Principle: NEVER replace content, only improve (append/merge/grow).
 * Every enqueued job carries merge_mode='append_only'.
 *
 * @see __rag_change_events table (outbox pattern)
 * @see ContentMergerService for the merge-only logic
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import { RoleId } from '../../config/role-ids';
import type { PipelineChainJobData } from '../processors/pipeline-chain.processor';

/** Roles that can be improved from RAG changes (gamme-based) */
const IMPROVABLE_ROLES: RoleId[] = [
  RoleId.R1_ROUTER,
  RoleId.R3_CONSEILS,
  RoleId.R4_REFERENCE,
  RoleId.R5_DIAGNOSTIC,
  RoleId.R6_GUIDE_ACHAT,
];

/** Table → { pgIdColumn, pgIdType } for checking which R* have published content */
const ROLE_TABLE_MAP: Record<
  string,
  { table: string; pgIdCol: string; pgIdType: 'text' | 'int' }
> = {
  [RoleId.R1_ROUTER]: {
    table: '__seo_r1_gamme_slots',
    pgIdCol: 'r1s_pg_id',
    pgIdType: 'text',
  },
  [RoleId.R3_CONSEILS]: {
    table: '__seo_gamme_conseil',
    pgIdCol: 'sgc_pg_id',
    pgIdType: 'int',
  },
  [RoleId.R4_REFERENCE]: {
    table: '__seo_reference',
    pgIdCol: 'pg_id',
    pgIdType: 'text',
  },
  [RoleId.R5_DIAGNOSTIC]: {
    table: '__seo_r5_keyword_plan',
    pgIdCol: 'r5kp_pg_id',
    pgIdType: 'int',
  },
  [RoleId.R6_GUIDE_ACHAT]: {
    table: '__seo_gamme_purchase_guide',
    pgIdCol: 'sgpg_pg_id',
    pgIdType: 'text',
  },
};

interface RagChangeEvent {
  rce_id: number;
  rce_rag_source: string;
  rce_gamme_aliases: string[];
  rce_old_hash: string | null;
  rce_new_hash: string;
  rce_status: string;
}

/** Circuit breaker state (in-memory, volatile) */
export interface BreakerState {
  active: boolean;
  lastTrigger: string | null;
  lastReason: string | null;
}

@Injectable()
export class RagChangeWatcherService
  extends SupabaseBaseService
  implements OnModuleInit
{
  protected override readonly logger = new Logger(RagChangeWatcherService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private readonly breakerState: BreakerState = {
    active: false,
    lastTrigger: null,
    lastReason: null,
  };

  constructor(
    configService: ConfigService,
    private readonly flags: FeatureFlagsService,
    @InjectQueue('pipeline-chain')
    private readonly pipelineQueue: Queue<PipelineChainJobData>,
  ) {
    super(configService);
  }

  /** Expose breaker state for dashboard endpoint */
  getBrekerState(): BreakerState {
    return { ...this.breakerState };
  }

  onModuleInit() {
    // INIT_TRACE: diagnostic — remove once perf-gates exit-124 is resolved

    console.warn('INIT_TRACE: rag-change-watcher');
    if (!this.flags.ragChangePipelineEnabled) {
      this.logger.log(
        'RAG Change Pipeline DISABLED (RAG_CHANGE_PIPELINE_ENABLED=false)',
      );
      return;
    }

    const intervalMs = this.flags.ragChangePollIntervalMs;
    this.logger.log(
      `RAG Change Pipeline ENABLED — polling every ${intervalMs / 1000}s`,
    );

    this.intervalHandle = setInterval(() => {
      this.checkCircuitBreaker()
        .then(() => this.pollAndProcess())
        .catch((err) => this.logger.error(`Poll error: ${err.message}`));
    }, intervalMs);
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Main polling loop: read pending events → resolve impacts → enqueue jobs.
   */
  async pollAndProcess(): Promise<number> {
    // 1. Fetch pending events (batch of 10)
    const { data: events, error } = await this.client
      .from('__rag_change_events')
      .select('*')
      .eq('rce_status', 'pending')
      .order('rce_created_at', { ascending: true })
      .limit(10);

    if (error || !events?.length) return 0;

    this.logger.log(`Processing ${events.length} RAG change event(s)`);

    let totalEnqueued = 0;

    for (const event of events as RagChangeEvent[]) {
      try {
        const enqueued = await this.processEvent(event);
        totalEnqueued += enqueued;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Event ${event.rce_id} failed: ${msg}`);
        await this.updateEventStatus(event.rce_id, 'failed', msg);
      }
    }

    return totalEnqueued;
  }

  /**
   * Process a single RAG change event:
   * 1. Resolve which gammes are impacted
   * 2. For each gamme, find which R* have published content
   * 3. Enqueue merge-only improvement jobs
   */
  private async processEvent(event: RagChangeEvent): Promise<number> {
    await this.updateEventStatus(event.rce_id, 'processing');

    const gammeAliases = event.rce_gamme_aliases;

    if (!gammeAliases?.length) {
      this.logger.warn(`Event ${event.rce_id}: no gamme_aliases — skipping`);
      await this.updateEventStatus(event.rce_id, 'skipped');
      return 0;
    }

    // Resolve pg_ids from aliases
    const { data: gammes } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_alias')
      .in('pg_alias', gammeAliases);

    if (!gammes?.length) {
      this.logger.warn(
        `Event ${event.rce_id}: no matching gammes for aliases=${gammeAliases.join(',')}`,
      );
      await this.updateEventStatus(event.rce_id, 'skipped');
      return 0;
    }

    const impactedRoles: string[] = [];
    let jobsEnqueued = 0;

    for (const gamme of gammes) {
      // Find which R* roles have content for this gamme
      const roles = await this.findPublishedRoles(gamme.pg_id);

      // Scope filter: skip roles/gammes not in whitelist
      const allowedRoles = this.flags.ragMergeAllowedRoles;
      const allowedGammes = this.flags.ragMergeAllowedGammes;

      for (const roleId of roles) {
        impactedRoles.push(roleId);

        // Scope filter — skip if not in whitelist (empty = allow all)
        if (allowedRoles.length > 0 && !allowedRoles.includes(roleId)) {
          this.logger.debug(
            `Scope filter: skipping ${roleId} for ${gamme.pg_alias} (not in RAG_MERGE_ALLOWED_ROLES)`,
          );
          continue;
        }
        if (
          allowedGammes.length > 0 &&
          !allowedGammes.includes(gamme.pg_alias)
        ) {
          this.logger.debug(
            `Scope filter: skipping ${roleId} for ${gamme.pg_alias} (not in RAG_MERGE_ALLOWED_GAMMES)`,
          );
          continue;
        }

        if (this.flags.ragChangeAutoEnqueue) {
          // Anti-duplication: skip if same gamme+role job was enqueued within the dedup window (any status)
          const dedupWindowMs = this.flags.ragDedupWindowMinutes * 60_000;
          const { count: existingJobs } = await this.client
            .from('__pipeline_chain_queue')
            .select('pcq_id', { count: 'exact', head: true })
            .eq('pcq_pg_alias', gamme.pg_alias)
            .eq('pcq_page_type', roleId)
            .gte(
              'pcq_created_at',
              new Date(Date.now() - dedupWindowMs).toISOString(),
            );

          if ((existingJobs ?? 0) > 0) {
            this.logger.debug(
              `Anti-dedup: skipping ${roleId} for ${gamme.pg_alias} — ${existingJobs} job(s) within last ${this.flags.ragDedupWindowMinutes}min`,
            );
            continue;
          }

          // Enqueue improvement job
          await this.pipelineQueue.add('execute', {
            roleId,
            targetIds: [String(gamme.pg_id)],
            dryRun: this.flags.ragMergeDryRun,
            source: 'db_trigger',
            mergeMode: 'append_only',
          } satisfies PipelineChainJobData);

          jobsEnqueued++;

          this.logger.log(
            `Enqueued ${roleId} improvement for ${gamme.pg_alias} (pg_id=${gamme.pg_id}) [merge_mode=append_only${this.flags.ragMergeDryRun ? ', DRY_RUN' : ''}]`,
          );
        }
      }
    }

    // Update event with results
    await this.client
      .from('__rag_change_events')
      .update({
        rce_impacted_roles: [...new Set(impactedRoles)],
        rce_jobs_enqueued: jobsEnqueued,
        rce_status: 'done',
        rce_processed_at: new Date().toISOString(),
      })
      .eq('rce_id', event.rce_id);

    return jobsEnqueued;
  }

  /**
   * Find which R* roles have published content for a given pg_id.
   * Only returns roles that actually have data to improve.
   */
  private async findPublishedRoles(pgId: number): Promise<RoleId[]> {
    const roles: RoleId[] = [];

    for (const roleId of IMPROVABLE_ROLES) {
      const mapping = ROLE_TABLE_MAP[roleId];
      if (!mapping) continue;

      const { table, pgIdCol, pgIdType } = mapping;
      // Cast pgId to match column type (some are TEXT, some INT)
      const eqValue = pgIdType === 'text' ? String(pgId) : pgId;

      const { data } = await this.client
        .from(table)
        .select(pgIdCol)
        .eq(pgIdCol, eqValue)
        .limit(1)
        .maybeSingle();

      if (data) {
        roles.push(roleId);
      }
    }

    return roles;
  }

  private async updateEventStatus(
    id: number,
    status: string,
    error?: string,
  ): Promise<void> {
    const update: Record<string, unknown> = { rce_status: status };
    if (status === 'done' || status === 'failed' || status === 'skipped') {
      update.rce_processed_at = new Date().toISOString();
    }
    if (error) {
      update.rce_error = error;
    }
    await this.client
      .from('__rag_change_events')
      .update(update)
      .eq('rce_id', id);
  }

  // ── Circuit Breaker ──

  /**
   * Check pipeline health metrics and trigger breaker if thresholds exceeded.
   * Uses runtime override (volatile) — does NOT modify .env or persisted config.
   */
  private async checkCircuitBreaker(): Promise<void> {
    // Only check when merge is actually active (not dry-run)
    if (this.flags.ragMergeDryRun) return;

    try {
      const reason = await this.evaluateBreakerConditions();
      if (reason) {
        this.triggerBreaker(reason);
      }
    } catch (err) {
      this.logger.warn(
        `Circuit breaker check failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async evaluateBreakerConditions(): Promise<string | null> {
    type BreakerMetrics = {
      total_24h?: number;
      failed_24h?: number;
      failed_ratio?: number | string;
      pending_count?: number;
      hotspot_alias?: string | null;
      hotspot_count?: number;
    };

    const { data, error } = await this.callRpc<BreakerMetrics>(
      'rag_watcher_breaker_metrics',
      {},
      { role: 'rag-change-watcher', source: 'internal' },
    );

    if (error) {
      this.logger.warn(`breaker_metrics_rpc_failed: ${error.message}`);
      return null;
    }

    const m = data ?? ({} as BreakerMetrics);

    const total = m.total_24h ?? 0;
    const failed = m.failed_24h ?? 0;
    const ratio =
      typeof m.failed_ratio === 'string'
        ? parseFloat(m.failed_ratio)
        : (m.failed_ratio ?? 0);
    const pending = m.pending_count ?? 0;
    const hotspotAlias = m.hotspot_alias;
    const hotspotCount = m.hotspot_count ?? 0;

    if (total >= 10 && ratio > 0.02) {
      return `failed_ratio > 2% (${(ratio * 100).toFixed(1)}%, ${failed}/${total} in 24h)`;
    }

    if (pending > 50) {
      return `pending_queue > 50 (${pending} pending)`;
    }

    if (hotspotAlias && hotspotCount > 20) {
      return `hotspot > 20 enqueues/24h (${hotspotAlias}: ${hotspotCount})`;
    }

    return null;
  }

  private triggerBreaker(reason: string): void {
    if (this.breakerState.active) return; // Already triggered

    this.breakerState.active = true;
    this.breakerState.lastTrigger = new Date().toISOString();
    this.breakerState.lastReason = reason;

    // Runtime override — volatile, lost on restart
    this.flags.setOverride('RAG_MERGE_DRY_RUN', 'true');

    this.logger.error(`[CIRCUIT-BREAKER] RAG merge auto-disabled: ${reason}`);

    // Parse threshold info from reason string for structured logging
    const thresholdInfo = this.parseBreakerReason(reason);

    // Log incident to dedicated table (non-blocking)
    this.logBreakerIncident(reason, thresholdInfo).catch((err) =>
      this.logger.warn(`Failed to log breaker incident: ${err}`),
    );
  }

  private parseBreakerReason(reason: string): {
    name: string;
    threshold: number;
    current: number;
  } {
    if (reason.startsWith('failed_ratio')) {
      const match = reason.match(/([\d.]+)%/);
      return {
        name: 'failed_ratio',
        threshold: 0.02,
        current: match ? parseFloat(match[1]) / 100 : 0,
      };
    }
    if (reason.startsWith('pending_queue')) {
      const match = reason.match(/(\d+) pending/);
      return {
        name: 'pending_queue',
        threshold: 50,
        current: match ? parseInt(match[1], 10) : 0,
      };
    }
    if (reason.startsWith('hotspot')) {
      const match = reason.match(/: (\d+)\)/);
      return {
        name: 'hotspot',
        threshold: 20,
        current: match ? parseInt(match[1], 10) : 0,
      };
    }
    return { name: 'unknown', threshold: 0, current: 0 };
  }

  private async logBreakerIncident(
    reason: string,
    thresholdInfo: { name: string; threshold: number; current: number },
  ): Promise<void> {
    // Collect metrics snapshot
    const { count: pending } = await this.client
      .from('__pipeline_chain_queue')
      .select('pcq_id', { count: 'exact', head: true })
      .eq('pcq_status', 'pending');

    const { count: failed24h } = await this.client
      .from('__pipeline_chain_queue')
      .select('pcq_id', { count: 'exact', head: true })
      .eq('pcq_status', 'failed')
      .gte('pcq_created_at', new Date(Date.now() - 86_400_000).toISOString());

    const { count: done24h } = await this.client
      .from('__pipeline_chain_queue')
      .select('pcq_id', { count: 'exact', head: true })
      .eq('pcq_status', 'done')
      .gte('pcq_created_at', new Date(Date.now() - 86_400_000).toISOString());

    await this.client.from('__rag_pipeline_incidents').insert({
      rpi_type: 'BREAKER_TRIGGERED',
      rpi_reason: reason,
      rpi_metrics: {
        pending: pending ?? 0,
        failed_24h: failed24h ?? 0,
        done_24h: done24h ?? 0,
      },
      rpi_phase: 'C',
      rpi_threshold_name: thresholdInfo.name,
      rpi_threshold_value: thresholdInfo.threshold,
      rpi_current_value: thresholdInfo.current,
    });
  }
}
