/**
 * PipelineChainProcessor — BullMQ consumer for the pipeline-chain queue.
 *
 * Replaces the deleted PipelineChainPollerService (DB polling approach).
 * Consumes jobs from the `pipeline-chain` BullMQ queue and dispatches
 * them to the ExecutionRouterService via ModuleRef (cross-module lookup).
 *
 * @see execution-registry.constants.ts
 * @see __pipeline_chain_queue table
 */

import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import {
  ExecutionRouterService,
  type ExecutionResult,
} from '../../modules/admin/services/execution-router.service';

export interface PipelineChainJobData {
  /** Row ID from __pipeline_chain_queue */
  pcqId?: number;
  /** Canonical role ID (e.g. R3_CONSEILS, R8_VEHICLE) */
  roleId: string;
  /** Target IDs (pgId strings or typeId for R8) */
  targetIds: string[];
  /** Dry run mode */
  dryRun?: boolean;
  /** Optional vehicle key for R2 */
  vehicleKey?: string;
  /** Source that triggered this job */
  source?: 'db_trigger' | 'api' | 'manual' | 'keyword_plan';
  /** Merge mode: append_only = never replace, only improve (RAG change pipeline) */
  mergeMode?: 'append_only';
}

@Processor('pipeline-chain')
export class PipelineChainProcessor extends SupabaseBaseService {
  protected override readonly logger = new Logger(PipelineChainProcessor.name);

  constructor(
    configService: ConfigService,
    private readonly moduleRef: ModuleRef,
    private readonly flags: FeatureFlagsService,
  ) {
    super(configService);
  }

  @Process('execute')
  async handleExecute(job: Job<PipelineChainJobData>): Promise<unknown> {
    const { pcqId, roleId, targetIds, dryRun, vehicleKey, source } = job.data;

    this.logger.log(
      `[pipeline-chain] Processing job ${job.id}: role=${roleId} targets=${targetIds.length} source=${source ?? 'unknown'}`,
    );

    // Defense-in-depth: scope filter before execution (catches jobs enqueued before scope change)
    if (source === 'db_trigger') {
      const allowedRoles = this.flags.ragMergeAllowedRoles;
      if (allowedRoles.length > 0 && !allowedRoles.includes(roleId)) {
        this.logger.log(
          `[pipeline-chain] Scope filter (processor): skipping job ${job.id} — role ${roleId} not in RAG_MERGE_ALLOWED_ROLES`,
        );
        if (pcqId) {
          await this.updateQueueStatus(pcqId, 'skipped', 'scope_filtered_role');
        }
        return { skipped: true, reason: 'scope_filtered_role' };
      }
    }

    // Update __pipeline_chain_queue status if we have a pcqId
    if (pcqId) {
      await this.updateQueueStatus(pcqId, 'processing');
    }

    try {
      // Resolve ExecutionRouterService via ModuleRef (cross-module, non-strict)
      const router = this.moduleRef.get(ExecutionRouterService, {
        strict: false,
      });

      const result: ExecutionResult = await router.execute({
        roleId,
        targetIds,
        dryRun: dryRun ?? false,
        vehicleKey,
      });

      // Update queue status
      if (pcqId) {
        const allSuccess = result.results.every((r) => r.status === 'success');
        // Store detailed error from first failed target (not just count)
        const firstFailed = result.results.find((r) => r.status === 'failed');
        const errorDetail = firstFailed?.error
          ? `${firstFailed.error}`.substring(0, 500)
          : undefined;
        await this.updateQueueStatus(
          pcqId,
          allSuccess ? 'done' : 'failed',
          allSuccess
            ? undefined
            : (errorDetail ?? 'Some targets failed — check execution result'),
        );
      }

      this.logger.log(
        `[pipeline-chain] Job ${job.id} done: ${result.results.filter((r) => r.status === 'success').length}/${result.totalTargets} success in ${result.duration}ms`,
      );

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[pipeline-chain] Job ${job.id} failed: ${msg}`);

      if (pcqId) {
        await this.updateQueueStatus(pcqId, 'failed', msg);
      }

      throw err;
    }
  }

  // ── Private helpers ──

  private async updateQueueStatus(
    pcqId: number,
    status: string,
    error?: string,
  ): Promise<void> {
    try {
      const update: Record<string, unknown> = {
        pcq_status: status,
      };
      if (status === 'done' || status === 'failed') {
        update.pcq_processed_at = new Date().toISOString();
      }
      if (error) {
        update.pcq_error = error;
      }

      await this.client
        .from('__pipeline_chain_queue')
        .update(update)
        .eq('pcq_id', pcqId);
    } catch (err) {
      this.logger.warn(
        `Failed to update queue status for pcqId=${pcqId}: ${err}`,
      );
    }
  }
}
