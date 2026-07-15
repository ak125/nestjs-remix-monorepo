/**
 * SeoProjectionWriteProcessor — consumer BullMQ de `projection-write-queue` (ADR-059 §Découplage).
 *
 * Délègue au writer (2-gate + INSERT-new-version + wouldRegress), puis enqueue UN refresh débounce-é
 * (jobId singleton → coalescing : N writes pendant la fenêtre = 1 seul refresh, ADR-059). READ_ONLY géré
 * dans le writer (skip observable). Transaction d'écriture courte (< 100ms cible).
 */
import { InjectQueue, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { SeoProjectionWriterService } from './seo-projection-writer.service';
import {
  PROJECTION_REFRESH_JOB,
  PROJECTION_REFRESH_QUEUE,
  PROJECTION_WRITE_JOB,
  PROJECTION_WRITE_QUEUE,
  REFRESH_DEBOUNCE_MS,
  type ProjectionRunResult,
  type ProjectionWriteJobData,
} from './seo-projection.types';

@Processor(PROJECTION_WRITE_QUEUE)
export class SeoProjectionWriteProcessor {
  private readonly logger = new Logger(SeoProjectionWriteProcessor.name);

  constructor(
    private readonly writer: SeoProjectionWriterService,
    @InjectQueue(PROJECTION_REFRESH_QUEUE) private readonly refreshQueue: Queue,
  ) {}

  @Process(PROJECTION_WRITE_JOB)
  async handle(job: Job<ProjectionWriteJobData>): Promise<ProjectionRunResult> {
    const {
      exportPaths = [],
      triggeredBy = 'manual',
      runMeta = {},
      projectionRole,
    } = job.data ?? ({} as ProjectionWriteJobData);
    const result = await this.writer.projectExports(
      exportPaths,
      triggeredBy,
      runMeta,
      projectionRole,
    );

    // Refresh dès qu'une version active a été flippée : facts OU blocs de rôle. Un facts no-op qui
    // écrit de nouveaux blocs de rôle DOIT aussi rafraîchir les MV (sinon la projection reste stale).
    if (
      !result.readOnlySkipped &&
      (result.entitiesWritten > 0 || result.rolesWritten > 0)
    ) {
      // Coalescing : jobId fixe → un seul refresh en attente à la fois (single-flight, debounce 5s).
      await this.refreshQueue.add(
        PROJECTION_REFRESH_JOB,
        { triggeredBy, runId: result.runId },
        {
          jobId: 'projection-refresh-singleton',
          delay: REFRESH_DEBOUNCE_MS,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
      result.refreshEnqueued = true;
    }
    this.logger.log(
      `projection write run=${result.runId ?? 'none'} facts=${result.entitiesWritten} ` +
        `roles(w/n/b/r)=${result.rolesWritten}/${result.rolesNoop}/${result.rolesBlocked}/${result.rolesRegressed} ` +
        `snapshot=${result.snapshot?.hash ?? 'none'} refresh=${result.refreshEnqueued}` +
        (result.readOnlySkipped ? ' [READ_ONLY skipped]' : ''),
    );
    return result;
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error): void {
    this.logger.error(
      `projection-write job ${job?.id} failed: ${err?.message}`,
    );
  }
}
