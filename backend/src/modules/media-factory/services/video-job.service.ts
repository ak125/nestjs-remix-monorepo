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
  renderErrorCode: string | null;
}

export interface ExecutionStats {
  total: number;
  byStatus: Record<string, number>;
  avgDurationMs: number | null;
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
      attempts: 2,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: 200,
      removeOnFail: 500,
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
      attempts: 2,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: 200,
      removeOnFail: 500,
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
   * Dashboard stats for executions.
   */
  async getExecutionStats(): Promise<ExecutionStats> {
    const { data, error } = await this.client
      .from('__video_execution_log')
      .select('status, duration_ms');

    if (error) {
      this.logger.error(`getExecutionStats error: ${error.message}`);
      return { total: 0, byStatus: {}, avgDurationMs: null };
    }

    const rows = data ?? [];
    const byStatus: Record<string, number> = {};
    let totalDuration = 0;
    let durationCount = 0;

    for (const row of rows) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      if (row.duration_ms != null) {
        totalDuration += row.duration_ms;
        durationCount++;
      }
    }

    return {
      total: rows.length,
      byStatus,
      avgDurationMs:
        durationCount > 0 ? Math.round(totalDuration / durationCount) : null,
    };
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
    renderErrorCode: (row.render_error_code as string) ?? null,
  });
}
