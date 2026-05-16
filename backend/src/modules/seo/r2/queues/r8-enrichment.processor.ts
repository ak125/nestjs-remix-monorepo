/**
 * ADR-072 PR 2D-2 — BullMQ processors for `r8-enrichment` and
 * `seo-outbox-relay`.
 *
 * READ_ONLY gate (ADR-028 Option D, MEMORY
 * `feedback_readonly_gate_at_processor_not_scheduler`) lives on each
 * handler — the scheduler stays registered so the BullMQ wiring is observable
 * even when no write is allowed.
 */

import { OnQueueError, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { getAppConfig } from '../../../../config/app.config';
import {
  OutboxRelayService,
  OutboxRelayPublisher,
  OutboxRow,
} from '../services/outbox-relay.service';
import { R8ParentEnrichmentService } from '../services/r8-parent-enrichment.service';
import {
  R8_ENRICHMENT_JOB_NAME,
  R8_ENRICHMENT_QUEUE_NAME,
  R8EnrichmentJobData,
  SEO_OUTBOX_QUEUE_NAME,
  SEO_OUTBOX_RELAY_JOB_NAME,
} from './r8-enrichment.constants';

interface R8EnrichmentJobResult {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  typeId: number;
  skipped?: 'read_only' | 'invalid_payload';
  versionSha?: string;
  inserted?: boolean;
  pagesPointerUpdated?: boolean;
}

@Processor(R8_ENRICHMENT_QUEUE_NAME)
@Injectable()
export class R8EnrichmentProcessor {
  private readonly logger = new Logger(R8EnrichmentProcessor.name);
  private readonly readOnly: boolean;

  constructor(private readonly enrichment: R8ParentEnrichmentService) {
    this.readOnly = getAppConfig().supabase.readOnly;
  }

  @Process({ name: R8_ENRICHMENT_JOB_NAME, concurrency: 5 })
  async handleEnrichment(
    job: Job<R8EnrichmentJobData>,
  ): Promise<R8EnrichmentJobResult> {
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const payload = job.data;

    if (!payload || !Number.isInteger(payload.typeId) || payload.typeId <= 0) {
      this.logger.warn(
        `r8-enrichment job ${job.id} dropped — invalid payload: ${JSON.stringify(payload)}`,
      );
      return {
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAtMs,
        typeId: payload?.typeId ?? 0,
        skipped: 'invalid_payload',
      };
    }

    if (this.readOnly) {
      this.logger.log(
        `[READ_ONLY] r8-enrichment job ${job.id} typeId=${payload.typeId} — skipped`,
      );
      return {
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAtMs,
        typeId: payload.typeId,
        skipped: 'read_only',
      };
    }

    const outcome = await this.enrichment.enrichTypeId(
      payload.typeId,
      payload.reason ?? 'manual',
    );

    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      typeId: payload.typeId,
      versionSha: outcome?.versionSha,
      inserted: outcome?.inserted,
      pagesPointerUpdated: outcome?.pagesPointerUpdated,
    };
  }

  @OnQueueError()
  onError(error: Error): void {
    this.logger.error(`r8-enrichment queue error: ${error.message}`);
  }

  @OnQueueFailed()
  onFailed(job: Job<R8EnrichmentJobData>, err: Error): void {
    this.logger.error(
      `r8-enrichment job ${job.id} typeId=${job.data?.typeId} failed: ${err.message}`,
    );
  }
}

/**
 * Outbox relay processor — single repeatable job that drains pending events.
 *
 * Concurrency stays at 1 (BullMQ default for one job per worker). Atomic claim
 * via RPC protects against the rare case where two backend instances run the
 * scheduler in parallel.
 */
@Processor(SEO_OUTBOX_QUEUE_NAME)
@Injectable()
export class OutboxRelayProcessor implements OutboxRelayPublisher {
  private readonly logger = new Logger(OutboxRelayProcessor.name);
  private readonly readOnly: boolean;

  constructor(
    private readonly relay: OutboxRelayService,
    @InjectQueue(R8_ENRICHMENT_QUEUE_NAME)
    private readonly r8EnrichmentQueue: Queue<R8EnrichmentJobData>,
  ) {
    this.readOnly = getAppConfig().supabase.readOnly;
  }

  @Process({ name: SEO_OUTBOX_RELAY_JOB_NAME, concurrency: 1 })
  async handleRelay(): Promise<{
    skipped?: 'read_only';
    claimed: number;
    published: number;
    failed: number;
    durationMs: number;
  }> {
    if (this.readOnly) {
      return {
        skipped: 'read_only',
        claimed: 0,
        published: 0,
        failed: 0,
        durationMs: 0,
      };
    }

    const result = await this.relay.pollOnce({ publisher: this });
    if (result.claimed > 0) {
      this.logger.log(
        `outbox relay tick — claimed=${result.claimed} published=${result.published} failed=${result.failed} duration=${result.durationMs}ms`,
      );
    }
    return result;
  }

  async publish(
    queueName: string,
    eventType: string,
    row: OutboxRow,
  ): Promise<void> {
    if (queueName === R8_ENRICHMENT_QUEUE_NAME) {
      const typeId = this.extractTypeIdFromAggregateId(row.aggregate_id);
      if (typeId === null) {
        throw new Error(
          `r8-enrichment publish skipped — aggregate_id "${row.aggregate_id}" not numeric`,
        );
      }
      await this.r8EnrichmentQueue.add(
        R8_ENRICHMENT_JOB_NAME,
        { typeId, reason: 'event_R8SnapshotUpdated' },
        {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          jobId: `r8-${typeId}-${row.id}`, // idempotent enqueue
        },
      );
      return;
    }
    throw new Error(`unrouted_queue:${queueName} for event_type=${eventType}`);
  }

  private extractTypeIdFromAggregateId(aggregateId: string): number | null {
    const parsed = Number.parseInt(aggregateId, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    if (String(parsed) !== aggregateId.trim()) {
      return null;
    }
    return parsed;
  }

  @OnQueueError()
  onError(error: Error): void {
    this.logger.error(`outbox relay queue error: ${error.message}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error): void {
    this.logger.error(`outbox relay job ${job.id} failed: ${err.message}`);
  }
}
