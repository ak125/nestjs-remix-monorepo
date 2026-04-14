/**
 * ContentGenProcessor — BullMQ consumer for `content-gen` queue.
 *
 * Delegates job execution to ContentGeneratorService via ModuleRef
 * (cross-module lazy lookup, same pattern as PipelineChainProcessor).
 *
 * Queue config (registered in admin.module.ts):
 *   - name: 'content-gen'
 *   - concurrency: 3
 *   - limiter: 10 jobs per 60s (Anthropic standard tier safe)
 *   - retry: 3 attempts with exponential backoff (30s base)
 *
 * Triggered by:
 *   - HTTP endpoint POST /api/internal/seo/generate/:pgAlias (async mode)
 *   - ContentGenInboxWatcherService (cron 5 min)
 *   - Paperclip agent (future)
 */
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Job } from 'bull';
import {
  ContentGeneratorService,
  ContentRole,
  GenerateResult,
} from '../../modules/admin/services/content-generator.service';

export interface ContentGenJobData {
  role: ContentRole;
  pgAlias: string;
  dryRun?: boolean;
  force?: boolean;
  trigger: 'http' | 'cron_inbox' | 'bullmq' | 'paperclip' | 'manual' | 'test';
}

@Processor('content-gen')
export class ContentGenProcessor {
  private readonly logger = new Logger(ContentGenProcessor.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  @Process('generate')
  async handleGenerate(job: Job<ContentGenJobData>): Promise<GenerateResult> {
    const { role, pgAlias, dryRun, force, trigger } = job.data;

    this.logger.log(
      `[Job ${job.id}] Generate ${role} for ${pgAlias} (trigger=${trigger}, dryRun=${dryRun}, force=${force})`,
    );

    const service = this.moduleRef.get(ContentGeneratorService, {
      strict: false,
    });
    if (!service) {
      throw new Error('ContentGeneratorService not available');
    }

    const result = await service.generate({
      role,
      pgAlias,
      dryRun,
      force,
      trigger,
    });

    this.logger.log(
      `[Job ${job.id}] Result: ${result.status} (length=${result.contentLength}, kw_score=${result.kwScore}, cost=$${result.costUsd.toFixed(4)})`,
    );

    // BullMQ treats returned value as success. Throw to trigger retry if needed.
    if (result.status === 'failed') {
      throw new Error(result.error || 'Content generation failed');
    }

    return result;
  }
}
