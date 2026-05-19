import { Counter, Registry } from 'prom-client';

/**
 * Vehicle-context Prometheus counters (PR-C of Diagnostic Control Plane V1).
 *
 * Three counters mirror the events declared in
 * `packages/registry/src/events/event-taxonomy.yaml` (PR-A.3) and emitted by
 * `VehicleContextService` (PR-B.2). The taxonomy's `l1_metric` field already
 * pins the canonical metric names — bumping them here without a bump there
 * would create silent drift, so the names live in a shared constant.
 *
 * Labels are intentionally low-cardinality (canon STOP-at-V1 — never expose
 * type_id / model_slug at metric level ; those are funnel-attribution
 * concerns owned by GA4, not Prom).
 */

export const VEHICLE_CTX_METRIC_NAMES = {
  set: 'vehicle_ctx_set_total',
  invalid: 'vehicle_ctx_invalid_total',
  consumed: 'vehicle_ctx_consumed_total',
} as const;

export interface VehicleContextCounters {
  readonly set: Counter<'source' | 'type_id_present'>;
  readonly invalid: Counter<'reason'>;
  readonly consumed: Counter<'route'>;
}

/**
 * Builds the 3 counters and registers them on the given Prometheus Registry.
 * Pure factory so unit tests can spin up an isolated registry per case.
 */
export function buildVehicleContextCounters(
  registry: Registry,
): VehicleContextCounters {
  return {
    set: new Counter({
      name: VEHICLE_CTX_METRIC_NAMES.set,
      help: 'Count of vehicle_ctx JWS cookies written on response. Funnel acquisition signal.',
      labelNames: ['source', 'type_id_present'],
      registers: [registry],
    }),
    invalid: new Counter({
      name: VEHICLE_CTX_METRIC_NAMES.invalid,
      help: 'Count of present-but-invalid vehicle_ctx cookies dropped silently by the middleware. Spike = secret rotation OR cross-environment leak OR schema drift.',
      labelNames: ['reason'],
      registers: [registry],
    }),
    consumed: new Counter({
      name: VEHICLE_CTX_METRIC_NAMES.consumed,
      help: 'Count of valid vehicle_ctx cookies surfaced to a request consumer. Primary funnel-handoff success signal.',
      labelNames: ['route'],
      registers: [registry],
    }),
  };
}
