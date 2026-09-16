/**
 * SeoProjectionWriteProcessor — consumer Bull de `projection-write-queue` (ADR-059 §Découplage).
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
  PROJECTION_REFRESH_JOB_ID,
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

    // The existing writer run also recovers committed outbox events whose enqueue
    // was lost. This is an opportunity for recovery, not a crash-independent relay.
    // Refresh dès qu'une version active a été flippée : facts OU blocs de rôle. Un facts no-op qui
    // écrit de nouveaux blocs de rôle DOIT aussi rafraîchir les MV (sinon la projection reste stale).
    if (
      !result.readOnlySkipped &&
      (result.entitiesWritten > 0 ||
        result.rolesWritten > 0 ||
        result.outcomes.some((outcome) => (outcome.blocksWritten ?? 0) > 0) ||
        (await this.writer.hasPendingProjectionRefresh()))
    ) {
      // Coalescing : jobId fixe → un seul refresh en attente à la fois (single-flight, debounce 5s).
      await this.refreshQueue.add(
        PROJECTION_REFRESH_JOB,
        { triggeredBy, runId: result.runId },
        {
          jobId: PROJECTION_REFRESH_JOB_ID,
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
    // Enqueue refresh for confirmed partial effects BEFORE reporting failure.
    // Keep roleOutcome partitioning: a partially written role remains blocked.
    if (
      !result.readOnlySkipped &&
      (result.rolesBlocked > 0 ||
        (exportPaths.length > 0 && (!result.runId || !result.snapshot)))
    ) {
      throw new Error(
        `projection write run=${result.runId ?? 'none'} blocked=${result.rolesBlocked} ` +
          `facts=${result.entitiesWritten} blocks=${result.outcomes.reduce((sum, outcome) => sum + (outcome.blocksWritten ?? 0), 0)} ` +
          `snapshot=${result.snapshot?.hash ?? 'none'}; ` +
          result.outcomes
            .flatMap((outcome) => outcome.reasons ?? [])
            .join('; '),
      );
    }
    return result;
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error): void {
    this.logger.error(
      `projection-write job ${job?.id} failed: ${err?.message}`,
    );
  }
}
