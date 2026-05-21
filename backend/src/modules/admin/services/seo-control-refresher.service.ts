/**
 * PR-SBD-1 Task 4 — SeoControlRefresherService
 *
 * BullMQ scheduled SWR (stale-while-revalidate) for the 5 dashboard blocks.
 * Each block refreshes at TTL/2 to keep the cache warm without dog-pile
 * (cold cache miss → user waits 800ms — avoided by SWR).
 *
 * Pattern canon backend.md `Non-blocking onModuleInit` :
 *   - onModuleInit sync only
 *   - Schedule jobs via `void this.scheduleAll()` (fire-and-forget)
 *   - BullMQ add() is local-fast (no remote I/O blocking phase init)
 *
 * Refs :
 *   - .claude/plans/verifier-existant-avant-et-ethereal-firefly.md Task 4 Step 4
 *   - .claude/rules/backend.md (Non-blocking onModuleInit)
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  SEO_CONTROL_REFRESH_JOB,
  SEO_CONTROL_REFRESH_QUEUE,
} from '../constants/seo-control.constants';

export interface SeoControlRefreshJobData {
  block: 'traffic' | 'losers' | 'lowctr' | 'alerts' | 'conversion';
  range: '7d' | '28d';
}

/**
 * Refresh cadence per block = TTL/2 :
 *   alerts     :  2min refresh ( 5min TTL)
 *   losers     : 15min refresh (30min TTL)
 *   traffic    : 30min refresh ( 1h TTL)
 *   lowctr     : 30min refresh ( 1h TTL)
 *   conversion : 30min refresh ( 1h TTL)
 *
 * 10 jobs total (5 blocks × 2 ranges) — light BullMQ load.
 */
const REFRESH_SCHEDULE: Array<{
  block: SeoControlRefreshJobData['block'];
  intervalMs: number;
}> = [
  { block: 'traffic', intervalMs: 30 * 60 * 1000 },
  { block: 'losers', intervalMs: 15 * 60 * 1000 },
  { block: 'lowctr', intervalMs: 30 * 60 * 1000 },
  { block: 'alerts', intervalMs: 2 * 60 * 1000 },
  { block: 'conversion', intervalMs: 30 * 60 * 1000 },
];

@Injectable()
export class SeoControlRefresherService implements OnModuleInit {
  private readonly logger = new Logger(SeoControlRefresherService.name);

  constructor(
    @InjectQueue(SEO_CONTROL_REFRESH_QUEUE)
    private readonly queue: Queue<SeoControlRefreshJobData>,
  ) {}

  onModuleInit(): void {
    this.logger.log(
      '🚀 Init SeoControlRefresher — scheduling per-block SWR jobs',
    );
    void this.scheduleAll();
  }

  private async scheduleAll(): Promise<void> {
    try {
      // Purge orphaned repeatables before re-registering (canon pattern, cf.
      // seo-monitor-scheduler.service.ts). Removes stale entries left in Redis
      // by prior code versions — e.g. the old per-block named jobs
      // `refresh-<block>-<range>` that had no matching processor handler.
      const stale = await this.queue.getRepeatableJobs();
      for (const j of stale) {
        await this.queue.removeRepeatableByKey(j.key);
      }

      for (const { block, intervalMs } of REFRESH_SCHEDULE) {
        for (const range of ['7d', '28d'] as const) {
          // Single static job name (matches @Process(SEO_CONTROL_REFRESH_JOB) in
          // the processor) ; block/range carried in data, idempotency via jobId.
          await this.queue.add(
            SEO_CONTROL_REFRESH_JOB,
            { block, range },
            {
              repeat: { every: intervalMs },
              removeOnComplete: 100,
              removeOnFail: 50,
              jobId: `refresh-${block}-${range}`, // 1 repeatable per (block,range), survives restart
            },
          );
        }
      }
      this.logger.log(
        `SWR jobs scheduled : ${REFRESH_SCHEDULE.length * 2} per-block tasks`,
      );
    } catch (err) {
      this.logger.error('SWR schedule failed', err as Error);
    }
  }
}
