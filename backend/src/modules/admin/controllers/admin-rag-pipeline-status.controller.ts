/**
 * AdminRagPipelineStatusController — Dashboard endpoint for RAG merge pipeline.
 *
 * GET /api/admin/rag-pipeline/status
 *
 * Returns: phaseEffective, flags (persisted + effective), overrides,
 * queue stats, event stats, circuit breaker state.
 */

import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RagChangeWatcherService } from '../../../workers/services/rag-change-watcher.service';

type Phase = 'DISABLED' | 'A' | 'B' | 'C' | 'C_BREAKER';

@Controller('api/admin/rag-pipeline')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminRagPipelineStatusController extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    AdminRagPipelineStatusController.name,
  );

  constructor(
    configService: ConfigService,
    private readonly flags: FeatureFlagsService,
    private readonly watcher: RagChangeWatcherService,
  ) {
    super(configService);
  }

  @Get('status')
  async getStatus() {
    // Persisted flags (env values only, without overrides)
    const allFlags = this.flags.listFlags();
    const persistedFlags = {
      pipelineEnabled: this.toBool(
        allFlags['RAG_CHANGE_PIPELINE_ENABLED']?.envValue ?? undefined,
        false,
      ),
      autoEnqueue: this.toBool(
        allFlags['RAG_CHANGE_AUTO_ENQUEUE']?.envValue ?? undefined,
        false,
      ),
      dryRun: this.toBool(
        allFlags['RAG_MERGE_DRY_RUN']?.envValue ?? undefined,
        true,
      ),
    };

    // Effective flags (persisted + overrides)
    const effectiveFlags = {
      pipelineEnabled: this.flags.ragChangePipelineEnabled,
      autoEnqueue: this.flags.ragChangeAutoEnqueue,
      dryRun: this.flags.ragMergeDryRun,
      allowedRoles: this.flags.ragMergeAllowedRoles,
      allowedGammes: this.flags.ragMergeAllowedGammes,
    };

    // Deduce phase from effective flags
    const phasePersisted = this.deducePhase(persistedFlags);
    const phaseEffective = this.deducePhase(effectiveFlags);

    // Breaker state
    const breakerState = this.watcher.getBrekerState();

    // Adjust phase if breaker is active
    const finalPhase: Phase =
      breakerState.active && phaseEffective !== phasePersisted
        ? 'C_BREAKER'
        : phaseEffective;

    // Queue stats (24h)
    const cutoff24h = new Date(Date.now() - 86_400_000).toISOString();

    const [pendingRes, done24hRes, failed24hRes] = await Promise.all([
      this.client
        .from('__pipeline_chain_queue')
        .select('pcq_id', { count: 'exact', head: true })
        .eq('pcq_status', 'pending'),
      this.client
        .from('__pipeline_chain_queue')
        .select('pcq_id', { count: 'exact', head: true })
        .eq('pcq_status', 'done')
        .gte('pcq_created_at', cutoff24h),
      this.client
        .from('__pipeline_chain_queue')
        .select('pcq_id', { count: 'exact', head: true })
        .eq('pcq_status', 'failed')
        .gte('pcq_created_at', cutoff24h),
    ]);

    const pending = pendingRes.count ?? 0;
    const done24h = done24hRes.count ?? 0;
    const failed24h = failed24hRes.count ?? 0;
    const total24h = done24h + failed24h;
    const failedRatio24h =
      total24h > 0 ? Math.round((failed24h / total24h) * 1000) / 1000 : 0;

    // Event stats (24h)
    const [eventPendingRes, eventDone24hRes, eventSkipped24hRes] =
      await Promise.all([
        this.client
          .from('__rag_change_events')
          .select('rce_id', { count: 'exact', head: true })
          .eq('rce_status', 'pending'),
        this.client
          .from('__rag_change_events')
          .select('rce_id', { count: 'exact', head: true })
          .eq('rce_status', 'done')
          .gte('rce_created_at', cutoff24h),
        this.client
          .from('__rag_change_events')
          .select('rce_id', { count: 'exact', head: true })
          .eq('rce_status', 'skipped')
          .gte('rce_created_at', cutoff24h),
      ]);

    return {
      phaseEffective: finalPhase,
      phasePersisted,
      effectiveFlags,
      persistedFlags,
      overrides: this.getActiveOverrides(),
      queue: {
        pending,
        done_24h: done24h,
        failed_24h: failed24h,
        failed_ratio_24h: failedRatio24h,
      },
      events: {
        pending: eventPendingRes.count ?? 0,
        done_24h: eventDone24hRes.count ?? 0,
        skipped_24h: eventSkipped24hRes.count ?? 0,
      },
      circuitBreaker: breakerState,
    };
  }

  private deducePhase(flags: {
    pipelineEnabled: boolean;
    autoEnqueue: boolean;
    dryRun: boolean;
  }): Phase {
    if (!flags.pipelineEnabled) return 'DISABLED';
    if (!flags.autoEnqueue) return 'A';
    if (flags.dryRun) return 'B';
    return 'C';
  }

  private getActiveOverrides(): Record<string, string | null> {
    const allFlags = this.flags.listFlags();
    const overrides: Record<string, string | null> = {};
    for (const [key, val] of Object.entries(allFlags)) {
      if (key.startsWith('RAG_') && val.override !== null) {
        overrides[key] = val.override;
      }
    }
    return Object.keys(overrides).length > 0
      ? overrides
      : { ragMergeDryRun: null };
  }

  private toBool(val: string | undefined, defaultValue: boolean): boolean {
    if (val === undefined || val === null || val === '') return defaultValue;
    return val === 'true';
  }
}
