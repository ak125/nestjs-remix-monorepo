/**
 * Internal pipeline endpoint for automated enrichment (cron, scripts, Claude agents).
 * Protected by X-Internal-Key header instead of session auth.
 * NOT exposed through Caddy in prod (localhost only).
 *
 * POST /api/internal/pipeline/execute  — execute enrichment for any role
 * GET  /api/internal/pipeline/roles    — list available roles + status
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Logger,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { z } from 'zod';
import { InternalApiKeyGuard } from '../../../auth/internal-api-key.guard';
import {
  ExecutionRouterService,
  type ExecutionResult,
} from '../services/execution-router.service';
import type { PipelineChainJobData } from '../../../workers/processors/pipeline-chain.processor';

const ExecuteRequestSchema = z.object({
  roleId: z.string().min(1, 'roleId is required'),
  targetIds: z.array(z.string().min(1)).min(1).max(50),
  dryRun: z.boolean().optional().default(true),
  vehicleKey: z.string().optional(),
});

@Controller('api/internal/pipeline')
@UseGuards(InternalApiKeyGuard)
export class InternalPipelineController {
  private readonly logger = new Logger(InternalPipelineController.name);

  constructor(
    private readonly router: ExecutionRouterService,
    @Optional()
    @InjectQueue('pipeline-chain')
    private readonly pipelineQueue?: Queue<PipelineChainJobData>,
  ) {}

  @Post('execute')
  async execute(
    @Body() body: unknown,
  ): Promise<{ success: boolean; data: ExecutionResult }> {
    const parsed = ExecuteRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const { roleId, targetIds, dryRun, vehicleKey } = parsed.data;

    this.logger.log(
      `[Internal] Pipeline execute: roleId=${roleId} targets=${targetIds.length} dryRun=${dryRun}`,
    );

    const result = await this.router.execute({
      roleId,
      targetIds,
      dryRun,
      vehicleKey,
    });

    this.logger.log(
      `[Internal] Pipeline done: duration=${result.duration}ms success=${result.results.filter((r) => r.status === 'success').length}/${result.totalTargets}`,
    );

    return { success: true, data: result };
  }

  /**
   * POST /api/internal/pipeline/enqueue
   * Enqueue for async BullMQ processing.
   */
  @Post('enqueue')
  async enqueue(@Body() body: unknown) {
    if (!this.pipelineQueue) {
      throw new BadRequestException(
        'BullMQ pipeline-chain queue not available.',
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
      `[Internal] Pipeline enqueued: jobId=${job.id} roleId=${roleId} targets=${targetIds.length}`,
    );

    return {
      success: true,
      data: {
        jobId: job.id,
        roleId,
        targetCount: targetIds.length,
        status: 'queued',
      },
    };
  }

  /**
   * GET /api/internal/pipeline/status/:jobId
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
      },
    };
  }

  @Get('roles')
  async listRoles() {
    return { success: true, data: this.router.listRoles() };
  }
}
