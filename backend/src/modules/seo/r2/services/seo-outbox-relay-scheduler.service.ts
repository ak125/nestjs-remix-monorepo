/**
 * ADR-072 PR 2D-2 — BullMQ scheduler for the outbox relay.
 *
 * Single repeatable job (interval `SEO_OUTBOX_RELAY_INTERVAL_MS`) that pokes
 * the relay processor. SchedulerModule (`@Cron`) is disabled monorepo-wide
 * (MEMORY `feedback_schedulemodule_disabled_use_bullmq`) — BullMQ is the canon.
 *
 * Non-blocking `onModuleInit` per MEMORY backend.md : we enqueue the repeatable
 * job in a fire-and-forget warmer.
 */

import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bull';
import {
  SEO_OUTBOX_QUEUE_NAME,
  SEO_OUTBOX_RELAY_INTERVAL_MS,
  SEO_OUTBOX_RELAY_JOB_NAME,
} from '../queues/r8-enrichment.constants';

@Injectable()
export class SeoOutboxRelaySchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SeoOutboxRelaySchedulerService.name);

  constructor(
    @InjectQueue(SEO_OUTBOX_QUEUE_NAME)
    private readonly queue: Queue,
  ) {}

  onModuleInit(): void {
    this.logger.log(
      `🚀 Init SeoOutboxRelayScheduler — repeatable every ${SEO_OUTBOX_RELAY_INTERVAL_MS}ms (warm-up deferred)`,
    );
    void this.scheduleRepeatableJob();
  }

  private async scheduleRepeatableJob(): Promise<void> {
    try {
      // Idempotent : Bull dedupes repeatable definitions by name + cron/every.
      await this.queue.add(
        SEO_OUTBOX_RELAY_JOB_NAME,
        {},
        {
          repeat: { every: SEO_OUTBOX_RELAY_INTERVAL_MS },
          removeOnComplete: 50,
          removeOnFail: 25,
          jobId: 'seo-outbox-relay-tick',
        },
      );
      this.logger.log(
        `Outbox relay scheduled every ${SEO_OUTBOX_RELAY_INTERVAL_MS}ms`,
      );
    } catch (e) {
      this.logger.error(
        `Failed to schedule outbox relay: ${(e as Error).message}`,
      );
    }
  }
}
