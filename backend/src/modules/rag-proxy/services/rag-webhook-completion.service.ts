import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import path from 'node:path';
import {
  RAG_INGESTION_COMPLETED,
  type RagIngestionCompletedEvent,
} from '../events/rag-ingestion.events';
import type { WebJob } from '../rag-proxy.service';
import { getErrorMessage } from '../../../common/utils/error.utils';
import { WebhookAuditService } from './webhook-audit.service';
import { RagGammeDetectionService } from './rag-gamme-detection.service';
import { RagRedisJobService } from './rag-redis-job.service';
import { RagCleanupService } from './rag-cleanup.service';

@Injectable()
export class RagWebhookCompletionService {
  private readonly logger = new Logger(RagWebhookCompletionService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly webhookAuditService: WebhookAuditService,
    private readonly ragGammeDetectionService: RagGammeDetectionService,
    private readonly ragRedisJobService: RagRedisJobService,
    private readonly ragCleanupService: RagCleanupService,
  ) {}

  /**
   * Handle webhook callback from RAG Python container after ingestion completes.
   * Resolves affected gammes from files_created and emits rag.ingestion.completed event.
   */
  async handleWebhookCompletion(dto: {
    job_id: string;
    source: 'pdf' | 'web';
    status: 'done' | 'failed';
    files_created?: string[];
  }): Promise<{
    gammes_detected: string[];
    diagnostics_detected: string[];
    event_emitted: boolean;
  }> {
    const startTime = Date.now();
    this.logger.log(
      `Webhook received: jobId=${dto.job_id}, source=${dto.source}, status=${dto.status}, files=${dto.files_created?.length ?? 0}`,
    );

    if (dto.status === 'failed') {
      this.logger.warn(
        `Webhook: ingestion job ${dto.job_id} reported failure — skipping event`,
      );
      // Record failed webhook in audit trail
      this.webhookAuditService
        .recordWebhook({
          job_id: dto.job_id,
          source: dto.source,
          status: dto.status,
          files_created: dto.files_created || [],
          gammes_detected: [],
          diagnostics_detected: [],
          event_emitted: false,
          error_message: 'Ingestion reported failure',
          processing_ms: Date.now() - startTime,
        })
        .catch((err) =>
          this.logger.warn(`Audit trail write failed: ${err.message}`),
        );
      return {
        gammes_detected: [],
        diagnostics_detected: [],
        event_emitted: false,
      };
    }

    // Resolve relative paths to absolute paths
    const knowledgePath =
      this.configService.get<string>('RAG_KNOWLEDGE_PATH') ||
      '/opt/automecanik/rag/knowledge';
    const absolutePaths = (dto.files_created ?? []).map((f) =>
      path.isAbsolute(f) ? f : path.join(knowledgePath, f),
    );

    // Sync files to __rag_knowledge DB
    let webhookDbSyncOk = true;
    if (absolutePaths.length > 0) {
      try {
        const syncResult = await this.ragCleanupService.syncFilesToDb(
          absolutePaths,
          knowledgePath,
        );
        this.logger.log(
          `Webhook DB sync: ${syncResult.synced} synced, ${syncResult.skipped} skipped` +
            (syncResult.errors.length
              ? `, ${syncResult.errors.length} errors`
              : ''),
        );
      } catch (syncErr) {
        webhookDbSyncOk = false;
        this.logger.error(
          `Webhook DB sync failed: ${getErrorMessage(syncErr)}`,
        );
      }
    }

    // Reuse existing resolution logic via RagGammeDetectionService
    const affectedGammesMap =
      absolutePaths.length > 0
        ? await this.ragGammeDetectionService.resolveGammesFromFiles(
            absolutePaths,
          )
        : this.ragGammeDetectionService.detectAffectedGammes();
    const affectedGammes = Array.from(affectedGammesMap.keys());
    const affectedDiagnostics =
      this.ragGammeDetectionService.detectAffectedDiagnostics();

    // Emit the event that ContentRefreshService listens to
    const event: RagIngestionCompletedEvent = {
      jobId: dto.job_id,
      source: dto.source,
      status: 'done',
      completedAt: Math.floor(Date.now() / 1000),
      affectedGammes,
      affectedGammesMap: Object.fromEntries(affectedGammesMap),
      ...(affectedDiagnostics.length > 0 ? { affectedDiagnostics } : {}),
      dbSyncOk: webhookDbSyncOk,
    };

    this.eventEmitter.emit(RAG_INGESTION_COMPLETED, event);
    this.logger.log(
      `Webhook emitted ${RAG_INGESTION_COMPLETED}: jobId=${dto.job_id}, gammes=[${affectedGammes.join(', ')}]` +
        (affectedDiagnostics.length > 0
          ? `, diagnostics=[${affectedDiagnostics.join(', ')}]`
          : ''),
    );

    // Record successful webhook in audit trail (fire-and-forget)
    this.webhookAuditService
      .recordWebhook({
        job_id: dto.job_id,
        source: dto.source,
        status: dto.status,
        files_created: dto.files_created || [],
        gammes_detected: affectedGammes,
        diagnostics_detected: affectedDiagnostics,
        event_emitted: true,
        processing_ms: Date.now() - startTime,
      })
      .catch((err) =>
        this.logger.warn(`Audit trail write failed: ${err.message}`),
      );

    return {
      gammes_detected: affectedGammes,
      diagnostics_detected: affectedDiagnostics,
      event_emitted: true,
    };
  }

  /**
   * List web ingestion jobs persisted in Redis (most recent first).
   */
  async listWebJobs(): Promise<Omit<WebJob, 'logLines'>[]> {
    const jobs = await this.ragRedisJobService.getAllJobs();
    return jobs
      .sort((a, b) => b.startedAt - a.startedAt)
      .map(({ logLines: _logs, ...rest }) => rest);
  }

  /**
   * Get a single web ingestion job by ID from Redis, including logs.
   */
  async getWebJob(jobId: string): Promise<WebJob | null> {
    return this.ragRedisJobService.getJob(jobId);
  }
}
