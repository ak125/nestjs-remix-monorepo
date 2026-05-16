/**
 * ADR-072 PR 2D-2 — R8 Enrichment + Outbox Relay queue constants.
 *
 * Two BullMQ queues introduced :
 *   - `r8-enrichment` : event-driven worker that materializes a R8 snapshot
 *     (status `minimal` for PR 2D-2, `enriched` for PR 2H once KG/WIKI lands).
 *   - `seo-outbox-relay` : repeatable poller that drains `__seo_outbox_event`
 *     and dispatches to downstream queues (canon transactional outbox pattern).
 *
 * Concurrency canon :
 *   - r8-enrichment : 5 workers (one per type_id, no cross-type dependency).
 *   - seo-outbox-relay : 1 worker — single-writer claim via RPC
 *     `__seo_outbox_claim_batch` (FOR UPDATE SKIP LOCKED). Multiple instances
 *     stay safe because the RPC is atomic.
 *
 * Canon refs :
 *   - MEMORY feedback_schedulemodule_disabled_use_bullmq : do not use @Cron.
 *   - MEMORY feedback_no_long_polling_until_loops : poll cadence = job repeat,
 *     never tight Bash loops.
 */

export const R8_ENRICHMENT_QUEUE_NAME = 'r8-enrichment';
export const R8_ENRICHMENT_JOB_NAME = 'r8-enrich-type';
export const R8_ENRICHMENT_CONCURRENCY = 5;

export const SEO_OUTBOX_QUEUE_NAME = 'seo-outbox-relay';
export const SEO_OUTBOX_RELAY_JOB_NAME = 'seo-outbox-relay-poll';
export const SEO_OUTBOX_RELAY_INTERVAL_MS = 5_000;
export const SEO_OUTBOX_RELAY_BATCH_SIZE = 100;

/**
 * Outbox event type → downstream BullMQ queue routing.
 *
 * For PR 2D-2 only `R8SnapshotUpdated` is wired (no consumer side-effect yet
 * — the relay marks the event as published, downstream consumers ship in
 * PR 2E / PR 2H). Future events join this table without changing the relay
 * loop.
 */
export const OUTBOX_EVENT_ROUTING = {
  R8SnapshotUpdated: R8_ENRICHMENT_QUEUE_NAME, // self-loop reserved; relay just marks published
} as const;

export type OutboxEventType = keyof typeof OUTBOX_EVENT_ROUTING;

export interface R8EnrichmentJobData {
  typeId: number;
  reason: 'seed' | 'auto_type_changed' | 'manual' | 'event_R8SnapshotUpdated';
}
