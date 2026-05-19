import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { VehicleContextCounters } from './vehicle-context.metrics';
import { VEHICLE_CONTEXT_COUNTERS } from './observability.tokens';

/**
 * VehicleContextMetricsListener — wires the NestJS EventEmitter2 events
 * emitted by PR-B.2 (`vehicle_ctx_set / _invalid / _consumed`) into the
 * Prometheus counters registered by PR-C.1.
 *
 * Decoupling rationale (canon ddd-bounded-contexts) :
 *   - D4 (Vehicle) emits events, no metrics dep.
 *   - D10 (Observability) subscribes here, no D4 dep.
 *   - GrowthBook kill-switch on D4 stops emission ; D10 counters stay zero.
 *
 * Listener is silent on schema drift : if a payload misses an expected
 * label key, falls back to the safe 'unknown' bucket rather than throwing
 * (canon : observability NEVER breaks the funnel it observes).
 */
@Injectable()
export class VehicleContextMetricsListener {
  private readonly logger = new Logger(VehicleContextMetricsListener.name);

  constructor(
    @Inject(VEHICLE_CONTEXT_COUNTERS)
    private readonly counters: VehicleContextCounters,
  ) {}

  @OnEvent('vehicle_ctx_set')
  onSet(payload: unknown): void {
    const p = (payload ?? {}) as {
      source?: string;
      type_id_present?: boolean;
    };
    this.counters.set
      .labels({
        source: stringLabel(p.source),
        type_id_present: boolLabel(p.type_id_present),
      })
      .inc();
  }

  @OnEvent('vehicle_ctx_invalid')
  onInvalid(payload: unknown): void {
    const p = (payload ?? {}) as { reason?: string };
    this.counters.invalid.labels({ reason: stringLabel(p.reason) }).inc();
  }

  @OnEvent('vehicle_ctx_consumed')
  onConsumed(payload: unknown): void {
    const p = (payload ?? {}) as { route?: string };
    this.counters.consumed.labels({ route: stringLabel(p.route) }).inc();
  }
}

function stringLabel(v: unknown): string {
  return typeof v === 'string' && v.length > 0 ? v : 'unknown';
}

function boolLabel(v: unknown): string {
  return v === true ? 'true' : v === false ? 'false' : 'unknown';
}
