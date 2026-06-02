import { Injectable, Logger } from '@nestjs/common';
import type { EventSink } from './supplier-sync.processor';

/**
 * Production EventSink for the supplier-availability sentinel.
 *
 * WHY this exists: the worker wiring previously constructed the processor/runner
 * with the implicit `noopSink` default — a noop in prod = a MUTE sentinel: the
 * `supplier.ref.unresolved`, `supplier.truth.degraded` and
 * `supplier.sync.connector_failed` signals the engine emits would be silently
 * dropped, which violates the `[CRITICAL]` "no silent fallback — observable" rule.
 *
 * Destination: the canonical NestJS `Logger` (existing internal observability per
 * the runtime-awareness rule) — structured + grep-able + alertable via the platform
 * log pipeline. `*failed*` events log at ERROR, everything else at WARN.
 *
 * Deliberately NOT `__seo_event_log`: its `event_type` is a strict Postgres ENUM
 * (`seo_event_type`, SEO/funnel/sitemap domain) — emitting D11 supplier ops events
 * there would require a cross-domain `ALTER TYPE` migration (scope creep + domain
 * pollution). A richer DB-queryable supplier-ops event store is a fast-follow.
 *
 * `noopSink` stays available for unit tests only — never as the implicit prod default.
 */
@Injectable()
export class SupplierTruthEventSink {
  private readonly logger = new Logger('SupplierTruthEvents');

  /** Bound EventSink, passed by reference to the processor + runner. */
  readonly emit: EventSink = (name, payload) => {
    const line = `${name} ${JSON.stringify(payload)}`;
    if (name.includes('failed')) {
      this.logger.error(line);
    } else {
      this.logger.warn(line);
    }
  };
}
