/**
 * Consumer Bull de `projection-refresh-queue` (ADR-059).
 * La RPC rafraîchit les deux MV dans sa transaction, sans CONCURRENTLY.
 * Une confirmation incomplète ou une panne est transmise à Bull comme échec :
 * les retries/backoff de WorkerModule restent responsables de la reprise.
 * READ_ONLY est un skip observable ; il ne doit pas provoquer de retry d'écriture.
 */
import {
  InjectQueue,
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { SeoProjectionWriterService } from './seo-projection-writer.service';
import {
  PROJECTION_REFRESH_JOB,
  PROJECTION_REFRESH_JOB_ID,
  REFRESH_DEBOUNCE_MS,
  PROJECTION_REFRESH_QUEUE,
  type ProjectionRefreshJobData,
} from './seo-projection.types';

@Processor(PROJECTION_REFRESH_QUEUE)
export class SeoProjectionRefreshProcessor implements OnModuleInit {
  private readonly logger = new Logger(SeoProjectionRefreshProcessor.name);

  constructor(
    private readonly writer: SeoProjectionWriterService,
    @InjectQueue(PROJECTION_REFRESH_QUEUE) private readonly refreshQueue: Queue,
  ) {}

  /** Non-blocking boot reconciliation of commits whose notification was lost. */
  onModuleInit(): void {
    void this.recoverPendingRefresh('startup');
  }

  /** Bull emits completed AFTER its atomic removal of removeOnComplete jobs.
   * Checking inside handle would still race with a producer adding the active ID.
   */
  @OnQueueCompleted()
  async onCompleted(
    job: Job<ProjectionRefreshJobData>,
    result: { refreshed: boolean; error?: string },
  ): Promise<void> {
    if (job.name !== PROJECTION_REFRESH_JOB || !result?.refreshed) return;
    await this.recoverPendingRefresh('completed', job.data);
  }

  private async recoverPendingRefresh(
    reason: 'startup' | 'completed',
    previous?: ProjectionRefreshJobData,
  ): Promise<void> {
    try {
      // The writer's READ_ONLY guard also prevents this lookup and enqueue.
      if (!(await this.writer.hasPendingProjectionRefresh())) return;
      await this.refreshQueue.add(
        PROJECTION_REFRESH_JOB,
        {
          triggeredBy: previous?.triggeredBy ?? 'replay',
          runId: previous?.runId,
        },
        {
          jobId: PROJECTION_REFRESH_JOB_ID,
          delay: REFRESH_DEBOUNCE_MS,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
      this.logger.log(
        `projection recovery (${reason}): pending refresh requested`,
      );
    } catch (error) {
      // Queue hooks are EventEmitter listeners: their rejected promises are not
      // awaited by Bull. Preserve the DB backlog and surface failure explicitly.
      // Do not bypass native bounded retries by rescheduling failed jobs forever.
      this.logger.error(
        `projection recovery (${reason}) failed; outbox remains pending: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  @Process(PROJECTION_REFRESH_JOB)
  async handle(
    job: Job<ProjectionRefreshJobData>,
  ): Promise<{ refreshed: boolean; error?: string }> {
    const res = await this.writer.refreshViews();
    this.logger.log(
      `projection refresh (run=${job?.data?.runId ?? 'n/a'}) → refreshed=${res.refreshed}` +
        (res.error ? ` (${res.error})` : ''),
    );
    if (!res.refreshed && res.error !== 'READ_ONLY') {
      throw new Error(res.error ?? 'projection refresh not confirmed');
    }
    return res;
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error): void {
    this.logger.error(
      `projection-refresh job ${job?.id} failed: ${err?.message}`,
    );
  }
}
