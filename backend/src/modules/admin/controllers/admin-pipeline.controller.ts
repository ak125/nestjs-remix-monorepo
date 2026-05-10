/**
 * AdminPipelineController — Unified pipeline execution endpoint.
 *
 * Single entry point for all enricher pipelines (R1-R8).
 * Routes to the correct service via ExecutionRouterService + ExecutionRegistry.
 *
 * POST /api/admin/pipeline/execute   — execute enrichment synchronously
 * POST /api/admin/pipeline/enqueue   — enqueue for async BullMQ processing
 * GET  /api/admin/pipeline/roles     — list available roles + status
 */

import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
  Optional,
  Param,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { z } from 'zod';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  ExecutionRouterService,
  type ExecutionResult,
} from '../services/execution-router.service';
import type { PipelineChainJobData } from '../../../workers/processors/pipeline-chain.processor';
import { RagChangeWatcherService } from '../../../workers/services/rag-change-watcher.service';
import {
  RateLimitModerate,
  RateLimitStrict,
} from '../../../common/decorators/rate-limit.decorator';

// ── Request validation ──

const ExecuteRequestSchema = z.object({
  roleId: z.string().min(1, 'roleId is required'),
  targetIds: z.array(z.string().min(1)).min(1).max(50),
  dryRun: z.boolean().optional().default(true),
  vehicleKey: z.string().optional(),
});

@Controller('api/admin/pipeline')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminPipelineController {
  private readonly logger = new Logger(AdminPipelineController.name);

  constructor(
    private readonly router: ExecutionRouterService,
    @Optional()
    @InjectQueue('pipeline-chain')
    private readonly pipelineQueue?: Queue<PipelineChainJobData>,
    @Optional()
    private readonly ragChangeWatcher?: RagChangeWatcherService,
  ) {}

  /**
   * POST /api/admin/pipeline/execute
   *
   * Execute enrichment synchronously for any registered role.
   * Defaults to dryRun=true for safety.
   *
   * @example
   * { "roleId": "R3_CONSEILS", "targetIds": ["1303", "415"], "dryRun": true }
   * { "roleId": "R8_VEHICLE", "targetIds": ["12345"] }
   * { "roleId": "R2_PRODUCT", "targetIds": ["4"], "vehicleKey": "renault-clio-iii" }
   */
  @Post('execute')
  @RateLimitModerate()
  async execute(
    @Body() body: unknown,
  ): Promise<{ success: boolean; data: ExecutionResult }> {
    const parsed = ExecuteRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const { roleId, targetIds, dryRun, vehicleKey } = parsed.data;

    this.logger.log(
      `Pipeline execute: roleId=${roleId} targets=${targetIds.length} dryRun=${dryRun}`,
    );

    const result = await this.router.execute({
      roleId,
      targetIds,
      dryRun,
      vehicleKey,
    });

    this.logger.log(
      `Pipeline done: roleId=${roleId} duration=${result.duration}ms ` +
        `success=${result.results.filter((r) => r.status === 'success').length}/${result.totalTargets}`,
    );

    return { success: true, data: result };
  }

  /**
   * POST /api/admin/pipeline/enqueue
   *
   * Enqueue an enrichment job for async BullMQ processing.
   * Use this for long-running enrichments (R3 batch, R8 vehicle).
   * Jobs are processed by PipelineChainProcessor in WorkerModule.
   *
   * @example
   * { "roleId": "R3_CONSEILS", "targetIds": ["1303", "415"] }
   */
  @Post('enqueue')
  @RateLimitStrict()
  async enqueue(@Body() body: unknown) {
    if (!this.pipelineQueue) {
      throw new BadRequestException(
        'BullMQ pipeline-chain queue not available. Ensure WorkerModule is configured.',
      );
    }

    const parsed = ExecuteRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const { roleId, targetIds, dryRun, vehicleKey } = parsed.data;

    const job = await this.pipelineQueue.add('execute', {
      roleId,
      targetIds,
      dryRun: dryRun ?? false,
      vehicleKey,
      source: 'api',
    });

    this.logger.log(
      `Pipeline enqueued: jobId=${job.id} roleId=${roleId} targets=${targetIds.length}`,
    );

    return {
      success: true,
      data: {
        jobId: job.id,
        roleId,
        targetCount: targetIds.length,
        dryRun: dryRun ?? false,
        status: 'queued',
      },
    };
  }

  /**
   * GET /api/admin/pipeline/status/:jobId
   *
   * Query BullMQ job status by ID (returned by /enqueue).
   */
  @Get('status/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    if (!this.pipelineQueue) {
      throw new BadRequestException(
        'BullMQ pipeline-chain queue not available.',
      );
    }

    const job = await this.pipelineQueue.getJob(jobId);
    if (!job) {
      return { success: false, data: { jobId, state: 'not_found' } };
    }

    const state = await job.getState();
    return {
      success: true,
      data: {
        jobId: job.id,
        state,
        attemptsMade: job.attemptsMade,
        data: job.data,
        result: job.returnvalue,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      },
    };
  }

  /**
   * POST /api/admin/pipeline/rag-change/poll
   *
   * Manually trigger RAG change watcher polling.
   * Useful for E2E testing: insert a fake event, then call this endpoint.
   */
  @Post('rag-change/poll')
  @RateLimitStrict()
  async pollRagChanges() {
    if (!this.ragChangeWatcher) {
      throw new BadRequestException(
        'RagChangeWatcherService not available. Ensure WorkerModule is configured.',
      );
    }

    const eventsProcessed = await this.ragChangeWatcher.pollAndProcess();

    return {
      success: true,
      data: {
        eventsProcessed,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * GET /api/admin/pipeline/roles
   *
   * List all registered roles with availability status.
   * Useful for admin dashboard to show which enrichers are active.
   */
  @Get('roles')
  async listRoles() {
    const roles = this.router.listRoles();
    return {
      success: true,
      data: {
        total: roles.length,
        available: roles.filter((r) => r.available).length,
        roles,
      },
    };
  }
}
