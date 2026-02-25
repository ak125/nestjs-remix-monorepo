/**
 * VideoJobService — Orchestrates video execution jobs (P2).
 *
 * Submit, status check, retry, stats for BullMQ video-render queue.
 * Pattern: content-refresh service + @InjectQueue
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { VideoDataService } from './video-data.service';
import { RenderAdapterService } from '../render/render-adapter.service';
import type { VideoExecutionJobData } from '../../../workers/types/video-execution.types';

// ─────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────

export interface ExecutionLogRow {
  id: number;
  briefId: string;
  videoType: string;
  vertical: string;
  status: string;
  bullmqJobId: string | null;
  triggerSource: string;
  triggerJobId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  artefactCheck: unknown | null;
  gateResults: unknown | null;
  canPublish: boolean | null;
  qualityScore: number | null;
  qualityFlags: unknown | null;
  errorMessage: string | null;
  durationMs: number | null;
  attemptNumber: number;
  featureFlags: unknown | null;
  // P3-Lite + P4.0 render columns
  engineName: string | null;
  engineVersion: string | null;
  renderStatus: string | null;
  renderOutputPath: string | null;
  renderMetadata: unknown | null;
  renderDurationMs: number | null;
  renderErrorCode: string | null;
  engineResolution: string | null;
  retryable: boolean;
  // P11a: carry gamme context on retry
  gammeAlias: string | null;
  pgId: number | null;
  // P5: canary tracking
  isCanary: boolean;
  canaryFallback: boolean;
  canaryErrorMessage: string | null;
  canaryErrorCode: string | null;
}

export interface ExecutionStats {
  total: number;
  byStatus: Record<string, number>;
  avgDurationMs: number | null;
  // P5.4: canary observability
  engineDistribution: Record<string, number>;
  canary: {
    totalCanary: number;
    totalFallback: number;
    successRate: number | null;
    fallbackRate: number | null;
    topErrorCodes: Record<string, number>;
  };
  renderPerformance: {
    p50RenderDurationMs: number | null;
    p95RenderDurationMs: number | null;
    byEngine: Record<
      string,
      { avg: number; p50: number; p95: number; count: number }
    >;
  };
  timeWindow: '24h' | '7d' | 'all';
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

@Injectable()
export class VideoJobService extends SupabaseBaseService {
  protected override readonly logger = new Logger(VideoJobService.name);

  constructor(
    configService: ConfigService,
    @InjectQueue('video-render') private readonly videoQueue: Queue,
    private readonly dataService: VideoDataService,
    private readonly renderAdapter: RenderAdapterService,
  ) {
    super(configService);
  }

  /**
   * Submit a new video execution job.
   * Guards: feature flag check + no active job for same briefId.
   */
  async submitExecution(
    briefId: string,
    triggerSource: 'manual' | 'api',
  ): Promise<{ executionLogId: number; bullmqJobId: string }> {
    // Feature flag guard
    if (process.env.VIDEO_PIPELINE_ENABLED !== 'true') {
      throw new BadRequestException(
        'Video pipeline is disabled (VIDEO_PIPELINE_ENABLED=false)',
      );
    }

    // Verify production exists
    const production = await this.dataService.getProduction(briefId);

    // Guard: no active job for this briefId
    const { data: activeJobs } = await this.client
      .from('__video_execution_log')
      .select('id')
      .eq('brief_id', briefId)
      .in('status', ['pending', 'processing'])
      .limit(1);

    if (activeJobs && activeJobs.length > 0) {
      throw new ConflictException(
        `Active execution already exists for brief ${briefId} (id=${activeJobs[0].id})`,
      );
    }

    // Insert execution log entry
    const { data: logEntry, error: insertError } = await this.client
      .from('__video_execution_log')
      .insert({
        brief_id: briefId,
        video_type: production.videoType,
        vertical: production.vertical,
        gamme_alias: production.gammeAlias ?? null,
        pg_id: production.pgId ?? null,
        status: 'pending',
        trigger_source: triggerSource,
      })
      .select('id')
      .single();

    if (insertError || !logEntry) {
      this.logger.error(
        `submitExecution insert error: ${insertError?.message}`,
      );
      throw insertError;
    }

    const executionLogId = logEntry.id as number;

    // Queue BullMQ job
    const jobData: VideoExecutionJobData = {
      executionLogId,
      briefId,
      triggerSource,
    };

    const bullJob = await this.videoQueue.add('video-execute', jobData, {
      jobId: `video-exec-${executionLogId}`,
      attempts: 2,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: 50,
      removeOnFail: 50,
    });

    // Update log with BullMQ job ID
    await this.client
      .from('__video_execution_log')
      .update({ bullmq_job_id: String(bullJob.id) })
      .eq('id', executionLogId);

    this.logger.log(
      `[VJS] Submitted execution #${executionLogId} for ${briefId}, bullmq=${bullJob.id}`,
    );

    return { executionLogId, bullmqJobId: String(bullJob.id) };
  }

  /**
   * Get execution status by log ID.
   */
  async getExecutionStatus(executionLogId: number): Promise<ExecutionLogRow> {
    const { data, error } = await this.client
      .from('__video_execution_log')
      .select('*')
      .eq('id', executionLogId)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Execution log not found: ${executionLogId}`);
    }

    return this.mapLogRow(data);
  }

  /**
   * List executions for a production (most recent first).
   */
  async listExecutions(
    briefId: string,
    limit = 20,
  ): Promise<ExecutionLogRow[]> {
    const { data, error } = await this.client
      .from('__video_execution_log')
      .select('*')
      .eq('brief_id', briefId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error(`listExecutions error: ${error.message}`);
      return [];
    }

    return (data ?? []).map(this.mapLogRow);
  }

  /**
   * Retry a failed execution.
   */
  async retryExecution(
    executionLogId: number,
  ): Promise<{ newExecutionLogId: number; bullmqJobId: string }> {
    // Load original
    const original = await this.getExecutionStatus(executionLogId);

    if (original.status !== 'failed') {
      throw new BadRequestException(
        `Cannot retry execution #${executionLogId} — status is '${original.status}', expected 'failed'`,
      );
    }

    // P7d: Guard non-retryable errors
    if (original.retryable === false) {
      throw new BadRequestException(
        `Execution #${executionLogId} is not retryable (${original.renderErrorCode})`,
      );
    }

    // P14a: Guard against concurrent active jobs for same briefId
    const { data: activeJobs } = await this.client
      .from('__video_execution_log')
      .select('id')
      .eq('brief_id', original.briefId)
      .in('status', ['pending', 'processing'])
      .limit(1);

    if (activeJobs && activeJobs.length > 0) {
      throw new ConflictException(
        `Active execution already exists for brief ${original.briefId} (id=${activeJobs[0].id})`,
      );
    }

    // Feature flag guard
    if (process.env.VIDEO_PIPELINE_ENABLED !== 'true') {
      throw new BadRequestException(
        'Video pipeline is disabled (VIDEO_PIPELINE_ENABLED=false)',
      );
    }

    // Insert new execution log entry
    const { data: logEntry, error: insertError } = await this.client
      .from('__video_execution_log')
      .insert({
        brief_id: original.briefId,
        video_type: original.videoType,
        vertical: original.vertical,
        gamme_alias: original.gammeAlias ?? null,
        pg_id: original.pgId ?? null,
        status: 'pending',
        trigger_source: 'retry',
        trigger_job_id: original.bullmqJobId,
        attempt_number: original.attemptNumber + 1,
      })
      .select('id')
      .single();

    if (insertError || !logEntry) {
      this.logger.error(`retryExecution insert error: ${insertError?.message}`);
      throw insertError;
    }

    const newLogId = logEntry.id as number;

    // Queue BullMQ job
    const jobData: VideoExecutionJobData = {
      executionLogId: newLogId,
      briefId: original.briefId,
      triggerSource: 'retry',
      triggerJobId: original.bullmqJobId ?? undefined,
    };

    const bullJob = await this.videoQueue.add('video-execute', jobData, {
      jobId: `video-exec-${newLogId}`,
      attempts: 2,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: 50,
      removeOnFail: 50,
    });

    await this.client
      .from('__video_execution_log')
      .update({ bullmq_job_id: String(bullJob.id) })
      .eq('id', newLogId);

    this.logger.log(
      `[VJS] Retried execution #${executionLogId} → new #${newLogId}, bullmq=${bullJob.id}`,
    );

    return { newExecutionLogId: newLogId, bullmqJobId: String(bullJob.id) };
  }

  /**
   * Dashboard stats for executions (P6.2: time-windowed + p50 + canary observability).
   */
  async getExecutionStats(
    timeWindow: '24h' | '7d' | 'all' = 'all',
  ): Promise<ExecutionStats> {
    let query = this.client
      .from('__video_execution_log')
      .select(
        'status, duration_ms, engine_name, render_duration_ms, is_canary, canary_fallback, canary_error_code',
      );

    // P6.2: Time window filter
    if (timeWindow === '24h') {
      query = query.gte(
        'created_at',
        new Date(Date.now() - 86_400_000).toISOString(),
      );
    } else if (timeWindow === '7d') {
      query = query.gte(
        'created_at',
        new Date(Date.now() - 604_800_000).toISOString(),
      );
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`getExecutionStats error: ${error.message}`);
      return {
        total: 0,
        byStatus: {},
        avgDurationMs: null,
        engineDistribution: {},
        canary: {
          totalCanary: 0,
          totalFallback: 0,
          successRate: null,
          fallbackRate: null,
          topErrorCodes: {},
        },
        renderPerformance: {
          p50RenderDurationMs: null,
          p95RenderDurationMs: null,
          byEngine: {},
        },
        timeWindow,
      };
    }

    const rows = data ?? [];
    const byStatus: Record<string, number> = {};
    let totalDuration = 0;
    let durationCount = 0;

    const engineDistribution: Record<string, number> = {};
    let totalCanary = 0;
    let totalFallback = 0;
    const canaryErrorCodes: Record<string, number> = {};
    const byEngine: Record<string, number[]> = {};

    for (const row of rows) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      if (row.duration_ms != null) {
        totalDuration += row.duration_ms;
        durationCount++;
      }

      const engine = (row.engine_name as string) || 'unknown';
      engineDistribution[engine] = (engineDistribution[engine] ?? 0) + 1;

      if (row.is_canary) {
        totalCanary++;
        if (row.canary_fallback) {
          totalFallback++;
          const errCode = (row.canary_error_code as string) || 'UNKNOWN';
          canaryErrorCodes[errCode] = (canaryErrorCodes[errCode] ?? 0) + 1;
        }
      }

      if (row.render_duration_ms != null) {
        if (!byEngine[engine]) byEngine[engine] = [];
        byEngine[engine].push(row.render_duration_ms as number);
      }
    }

    // P50 + P95 render duration (all engines)
    const allRenderDurations = Object.values(byEngine)
      .flat()
      .sort((a, b) => a - b);
    const p50Index = Math.floor(allRenderDurations.length * 0.5);
    const p95Index = Math.floor(allRenderDurations.length * 0.95);
    const p50RenderDurationMs =
      allRenderDurations.length > 0 ? allRenderDurations[p50Index] : null;
    const p95RenderDurationMs =
      allRenderDurations.length > 0 ? allRenderDurations[p95Index] : null;

    // Per-engine performance (with p50)
    const enginePerf: Record<
      string,
      { avg: number; p50: number; p95: number; count: number }
    > = {};
    for (const [eng, durations] of Object.entries(byEngine)) {
      const sorted = [...durations].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      const ep50 = Math.floor(sorted.length * 0.5);
      const ep95 = Math.floor(sorted.length * 0.95);
      enginePerf[eng] = {
        avg: Math.round(sum / sorted.length),
        p50: sorted[ep50] ?? sorted[sorted.length - 1],
        p95: sorted[ep95] ?? sorted[sorted.length - 1],
        count: sorted.length,
      };
    }

    return {
      total: rows.length,
      byStatus,
      avgDurationMs:
        durationCount > 0 ? Math.round(totalDuration / durationCount) : null,
      engineDistribution,
      canary: {
        totalCanary,
        totalFallback,
        successRate:
          totalCanary > 0
            ? Math.round(((totalCanary - totalFallback) / totalCanary) * 100)
            : null,
        fallbackRate:
          totalCanary > 0
            ? Math.round((totalFallback / totalCanary) * 100)
            : null,
        topErrorCodes: canaryErrorCodes,
      },
      renderPerformance: {
        p50RenderDurationMs,
        p95RenderDurationMs,
        byEngine: enginePerf,
      },
      timeWindow,
    };
  }

  /**
   * P5.4: Delegate canary stats to render adapter.
   */
  async getCanaryStats() {
    return this.renderAdapter.getCanaryStats();
  }

  // ── Mapper (snake_case → camelCase) ──

  private mapLogRow = (row: Record<string, unknown>): ExecutionLogRow => ({
    id: row.id as number,
    briefId: row.brief_id as string,
    videoType: row.video_type as string,
    vertical: row.vertical as string,
    status: row.status as string,
    bullmqJobId: row.bullmq_job_id as string | null,
    triggerSource: row.trigger_source as string,
    triggerJobId: row.trigger_job_id as string | null,
    createdAt: row.created_at as string,
    startedAt: row.started_at as string | null,
    completedAt: row.completed_at as string | null,
    artefactCheck: row.artefact_check,
    gateResults: row.gate_results,
    canPublish: row.can_publish as boolean | null,
    qualityScore: row.quality_score as number | null,
    qualityFlags: row.quality_flags,
    errorMessage: row.error_message as string | null,
    durationMs: row.duration_ms as number | null,
    attemptNumber: (row.attempt_number as number) ?? 1,
    featureFlags: row.feature_flags,
    engineName: (row.engine_name as string) ?? null,
    engineVersion: (row.engine_version as string) ?? null,
    renderStatus: (row.render_status as string) ?? null,
    renderOutputPath: (row.render_output_path as string) ?? null,
    renderMetadata: row.render_metadata ?? null,
    renderDurationMs: (row.render_duration_ms as number) ?? null,
    renderErrorCode: (row.render_error_code as string) ?? null,
    engineResolution: (row.engine_resolution as string) ?? null,
    retryable: (row.retryable as boolean) ?? false,
    // P5: canary tracking
    isCanary: (row.is_canary as boolean) ?? false,
    canaryFallback: (row.canary_fallback as boolean) ?? false,
    canaryErrorMessage: (row.canary_error_message as string) ?? null,
    canaryErrorCode: (row.canary_error_code as string) ?? null,
    // P11a: gamme context
    gammeAlias: (row.gamme_alias as string) ?? null,
    pgId: (row.pg_id as number) ?? null,
  });
}
