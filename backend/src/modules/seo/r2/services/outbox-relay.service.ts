/**
 * ADR-072 PR 2D-2 — Transactional Outbox Relay.
 *
 * Drains `__seo_outbox_event` in batches and routes each pending event to its
 * downstream BullMQ queue (canon transactional outbox pattern :
 * Confluent / Microservices.io).
 *
 * Atomic claim is delegated to the RPC `__seo_outbox_claim_batch` which uses
 * `FOR UPDATE SKIP LOCKED` and flips `published_at` in a single transaction.
 * That makes concurrent relay workers safe even though we target concurrency 1.
 *
 * READ_ONLY gate (ADR-028 Option D / MEMORY
 * `feedback_readonly_gate_at_processor_not_scheduler`) is enforced inside the
 * processor that calls `pollOnce()`, not here.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import {
  OUTBOX_EVENT_ROUTING,
  OutboxEventType,
  SEO_OUTBOX_RELAY_BATCH_SIZE,
} from '../queues/r8-enrichment.constants';

export interface OutboxRow {
  id: number;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  trace_id: string | null;
  occurred_at: string;
  attempts: number;
}

export interface OutboxRelayPublisher {
  /**
   * Push an event downstream. Implementations live in the BullMQ processor /
   * controllers — kept as an interface so the service stays testable in unit
   * scope (no @InjectQueue in this layer).
   */
  publish(queueName: string, eventType: string, row: OutboxRow): Promise<void>;
}

export interface OutboxRelayResult {
  claimed: number;
  published: number;
  failed: number;
  durationMs: number;
}

export interface OutboxRelayOptions {
  batchSize?: number;
  publisher: OutboxRelayPublisher;
}

@Injectable()
export class OutboxRelayService extends SupabaseBaseService {
  protected readonly logger = new Logger(OutboxRelayService.name);

  async pollOnce(options: OutboxRelayOptions): Promise<OutboxRelayResult> {
    const startedAt = Date.now();
    const limit = Math.max(1, options.batchSize ?? SEO_OUTBOX_RELAY_BATCH_SIZE);

    // 🛡️ RPC Safety Gate — worker context (no `source: 'api'`).
    const { data, error } = await this.callRpc<OutboxRow[]>(
      '__seo_outbox_claim_batch',
      { p_limit: limit },
    );

    if (error) {
      this.logger.error(`__seo_outbox_claim_batch failed: ${error.message}`);
      return {
        claimed: 0,
        published: 0,
        failed: 0,
        durationMs: Date.now() - startedAt,
      };
    }

    const rows = data ?? [];
    if (rows.length === 0) {
      return {
        claimed: 0,
        published: 0,
        failed: 0,
        durationMs: Date.now() - startedAt,
      };
    }

    let published = 0;
    let failed = 0;

    for (const row of rows) {
      const queueName = this.routeEvent(row.event_type);
      if (!queueName) {
        // Unknown event type — leave attempts counter to grow so the row stays
        // visible. RPC already flipped published_at to NOW(); revert it so the
        // event can be reclaimed once a route is registered.
        await this.requeueUnroutable(row);
        failed += 1;
        continue;
      }

      try {
        await options.publisher.publish(queueName, row.event_type, row);
        published += 1;
      } catch (e) {
        failed += 1;
        await this.markFailed(row.id, (e as Error).message);
      }
    }

    return {
      claimed: rows.length,
      published,
      failed,
      durationMs: Date.now() - startedAt,
    };
  }

  private routeEvent(eventType: string): string | null {
    if (eventType in OUTBOX_EVENT_ROUTING) {
      return OUTBOX_EVENT_ROUTING[eventType as OutboxEventType];
    }
    return null;
  }

  private async requeueUnroutable(row: OutboxRow): Promise<void> {
    const { error } = await this.supabase
      .from('__seo_outbox_event')
      .update({
        published_at: null,
        attempts: row.attempts + 1,
        last_error: `unroutable_event_type:${row.event_type}`,
      })
      .eq('id', row.id);
    if (error) {
      this.logger.error(
        `requeueUnroutable(id=${row.id}) failed: ${error.message}`,
      );
    }
  }

  private async markFailed(id: number, message: string): Promise<void> {
    const { error } = await this.supabase
      .from('__seo_outbox_event')
      .update({
        last_error: message.slice(0, 1000),
      })
      .eq('id', id);
    if (error) {
      this.logger.error(`markFailed(id=${id}) failed: ${error.message}`);
    }
  }
}
