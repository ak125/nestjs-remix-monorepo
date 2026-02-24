import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';
import { getErrorMessage } from '../../../common/utils/error.utils';
import type { WebJob } from '../rag-proxy.service';

export { type WebJob } from '../rag-proxy.service';

const WEB_JOB_KEY_PREFIX = 'rag:web-jobs:';
const WEB_JOB_TTL_SECONDS = 3_600; // 1 hour — matches former JOB_RETENTION_MS

@Injectable()
export class RagRedisJobService implements OnModuleDestroy {
  private readonly logger = new Logger(RagRedisJobService.name);

  private static readonly RUNNING_JOB_TIMEOUT_MS = 1_800_000; // 30min

  /** Periodic cleanup interval for orphaned running jobs */
  private jobCleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly cacheService: CacheService) {
    // Timeout orphaned running web jobs every 10 minutes (TTL handles expiry)
    this.jobCleanupInterval = setInterval(
      () => void this.cleanupOrphanedJobs(),
      600_000,
    );
  }

  onModuleDestroy() {
    if (this.jobCleanupInterval) {
      clearInterval(this.jobCleanupInterval);
      this.jobCleanupInterval = null;
    }
    this.logger.log('RagRedisJobService destroyed (jobs persist in Redis)');
  }

  /** Persist a web job to Redis with TTL auto-expiry. */
  async setJob(job: WebJob): Promise<void> {
    try {
      await this.cacheService.set(
        `${WEB_JOB_KEY_PREFIX}${job.jobId}`,
        job,
        WEB_JOB_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to persist web job ${job.jobId} to Redis: ${getErrorMessage(err)}`,
      );
    }
  }

  /** Read a single web job from Redis. Returns null if missing or on error. */
  async getJob(jobId: string): Promise<WebJob | null> {
    try {
      return await this.cacheService.get<WebJob>(
        `${WEB_JOB_KEY_PREFIX}${jobId}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to read web job ${jobId} from Redis: ${getErrorMessage(err)}`,
      );
      return null;
    }
  }

  /** Read all web jobs from Redis using key pattern scan. */
  async getAllJobs(): Promise<WebJob[]> {
    try {
      // CacheService.clearByPattern returns count — we need the keys.
      // Access the underlying Redis client via getOrSet trick is not ideal.
      // Instead, we use a known-keys approach: store an index set of active job IDs.
      const index = await this.cacheService.get<string[]>(
        `${WEB_JOB_KEY_PREFIX}_index`,
      );
      if (!index || index.length === 0) return [];

      const jobs: WebJob[] = [];
      const validIds: string[] = [];
      for (const jobId of index) {
        const job = await this.getJob(jobId);
        if (job) {
          jobs.push(job);
          validIds.push(jobId);
        }
      }
      // Prune stale IDs from index (keys expired by TTL)
      if (validIds.length !== index.length) {
        await this.cacheService.set(
          `${WEB_JOB_KEY_PREFIX}_index`,
          validIds,
          WEB_JOB_TTL_SECONDS * 2, // index lives longer than individual jobs
        );
      }
      return jobs;
    } catch (err) {
      this.logger.warn(
        `Failed to list web jobs from Redis: ${getErrorMessage(err)}`,
      );
      return [];
    }
  }

  /** Add a job ID to the Redis index set. */
  async addToIndex(jobId: string): Promise<void> {
    try {
      const index =
        (await this.cacheService.get<string[]>(
          `${WEB_JOB_KEY_PREFIX}_index`,
        )) || [];
      if (!index.includes(jobId)) {
        index.push(jobId);
      }
      await this.cacheService.set(
        `${WEB_JOB_KEY_PREFIX}_index`,
        index,
        WEB_JOB_TTL_SECONDS * 2,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to update web jobs index in Redis: ${getErrorMessage(err)}`,
      );
    }
  }

  /** Timeout orphaned running jobs (>30min). TTL handles normal expiry. */
  async cleanupOrphanedJobs(): Promise<void> {
    const runningCutoff =
      Date.now() - RagRedisJobService.RUNNING_JOB_TIMEOUT_MS;
    let timedOut = 0;

    const jobs = await this.getAllJobs();
    for (const job of jobs) {
      if (job.status === 'running' && job.startedAt * 1000 < runningCutoff) {
        job.status = 'failed';
        job.returnCode = -1;
        job.logLines.push(
          `[cleanup] Job timed out after ${RagRedisJobService.RUNNING_JOB_TIMEOUT_MS / 60_000}min — marked as failed`,
        );
        await this.setJob(job);
        timedOut++;
        this.logger.warn(
          `Job ${job.jobId} timed out after ${RagRedisJobService.RUNNING_JOB_TIMEOUT_MS / 60_000}min, marked as failed`,
        );
      }
    }
    if (timedOut > 0) {
      this.logger.debug(`Timed out ${timedOut} orphaned running web jobs`);
    }
  }
}
