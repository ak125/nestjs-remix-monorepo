/**
 * PR-E+1 — BullMQ repeatable processor for H1 recovery apply
 *
 * Schedules `H1RecoveryApplyService.processProposedBatch(...)` every 5 minutes
 * on the dedicated queue `seo-h1-recovery`. The processor delegates entirely
 * to the orchestrator service — no logic here beyond queue plumbing.
 *
 * Safety properties (per plan §8) :
 *   - The orchestrator already short-circuits when SEO_H1_RECOVERY_ENABLED=
 *     false (or GrowthBook flag off). Activating the scheduler in CI/preprod
 *     is therefore safe by default — nothing happens until the flag is on.
 *   - The CI invariant `audit:seo-events-lineage` stays green by construction :
 *     every applied event comes from the gateway RPC which sets evaluation_id
 *     atomically.
 *
 * Memory : feedback_schedulemodule_disabled_use_bullmq (@nestjs/schedule
 *          is disabled in this monorepo ; BullMQ repeatable is the canon).
 */

import { OnModuleInit, Injectable, Logger } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { H1RecoveryApplyService } from './h1-recovery-apply.service';

export const SEO_H1_RECOVERY_QUEUE = 'seo-h1-recovery';
export const SEO_H1_RECOVERY_JOB_NAME = 'process-proposed-batch';

interface H1RecoveryJobData {
  triggeredBy: string;
  batchSize?: number;
  sinceMinutes?: number;
}

/**
 * Schedules the repeatable job once at module init. Idempotent : adding the
 * same repeat key twice is a no-op in BullMQ.
 */
@Injectable()
export class H1RecoveryScheduler implements OnModuleInit {
  private readonly logger = new Logger(H1RecoveryScheduler.name);

  constructor(
    @InjectQueue(SEO_H1_RECOVERY_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Read schedule config from env (default : every 5 minutes).
    const cron = process.env.SEO_H1_RECOVERY_CRON ?? '*/5 * * * *';
    const enabled = process.env.SEO_H1_RECOVERY_SCHEDULER_ENABLED ?? 'true';

    if (enabled.toLowerCase() !== 'true') {
      this.logger.warn(
        `[H1RecoveryScheduler] SEO_H1_RECOVERY_SCHEDULER_ENABLED=${enabled} — repeatable job NOT scheduled.`,
      );
      return;
    }

    try {
      await this.queue.upsertJobScheduler(
        'seo-h1-recovery-default',
        { pattern: cron },
        {
          name: SEO_H1_RECOVERY_JOB_NAME,
          data: {
            triggeredBy: 'cron:seo-h1-recovery-default',
            batchSize: Number(process.env.SEO_H1_RECOVERY_BATCH_SIZE ?? 10),
            sinceMinutes: Number(
              process.env.SEO_H1_RECOVERY_SINCE_MINUTES ?? 7 * 24 * 60,
            ),
          } satisfies H1RecoveryJobData,
          opts: {
            removeOnComplete: { age: 86_400, count: 100 },
            removeOnFail: { age: 7 * 86_400 },
          },
        },
      );
      this.logger.log(
        `✓ Scheduled seo-h1-recovery repeatable (cron='${cron}'). Worker is no-op until SEO_H1_RECOVERY_ENABLED=true.`,
      );
    } catch (err) {
      this.logger.error(
        `[H1RecoveryScheduler] failed to schedule repeatable : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

@Processor(SEO_H1_RECOVERY_QUEUE)
export class H1RecoveryProcessor extends WorkerHost {
  private readonly logger = new Logger(H1RecoveryProcessor.name);

  constructor(private readonly apply: H1RecoveryApplyService) {
    super();
  }

  async process(job: Job<H1RecoveryJobData>): Promise<{
    applied_ok: number;
    total_proposed_scanned: number;
    skipped_not_eligible: number;
    denied_by_policy: number;
    errors: number;
  }> {
    const data = job.data;
    const report = await this.apply.processProposedBatch({
      batchSize: data.batchSize,
      sinceMinutes: data.sinceMinutes,
      triggeredBy: data.triggeredBy,
    });
    this.logger.log(
      `[H1RecoveryProcessor] job=${job.id} ` +
        `scanned=${report.total_proposed_scanned} applied=${report.applied_ok} ` +
        `skipped=${report.skipped_not_eligible} denied=${report.denied_by_policy} ` +
        `errors=${report.errors.length}`,
    );
    return {
      applied_ok: report.applied_ok,
      total_proposed_scanned: report.total_proposed_scanned,
      skipped_not_eligible: report.skipped_not_eligible,
      denied_by_policy: report.denied_by_policy,
      errors: report.errors.length,
    };
  }
}
