import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Registry, collectDefaultMetrics } from 'prom-client';
import {
  PROMETHEUS_REGISTRY,
  VEHICLE_CONTEXT_COUNTERS,
} from './observability.tokens';
import { buildVehicleContextCounters } from './vehicle-context.metrics';
import { VehicleContextMetricsListener } from './vehicle-context-metrics.listener';
import { PrometheusController } from './prometheus.controller';

/**
 * ObservabilityModule (PR-C of Diagnostic Control Plane V1).
 *
 * One Prometheus Registry per process. Default node.js metrics
 * (`process_cpu_seconds_total`, `nodejs_heap_size_used_bytes`, etc.) are
 * collected on the same registry so a single scrape covers them all.
 *
 * V1 scope (canon STOP-at-V1) :
 *   - VehicleContext counters wired here.
 *   - Diagnostic / commerce funnel counters → PR-C.next when events are
 *     actually emitted from those domains (today the taxonomy lists them
 *     but no @OnEvent handler exists ; wiring an empty counter would be
 *     noise).
 *   - OTel spans / Grafana JSON / GA4 mirror → explicit out-of-scope.
 */
@Module({
  imports: [EventEmitterModule],
  controllers: [PrometheusController],
  providers: [
    {
      provide: PROMETHEUS_REGISTRY,
      useFactory: (): Registry => {
        const registry = new Registry();
        // Pull node_modules-version + container default metrics onto our registry.
        collectDefaultMetrics({ register: registry });
        return registry;
      },
    },
    {
      provide: VEHICLE_CONTEXT_COUNTERS,
      useFactory: (registry: Registry) => buildVehicleContextCounters(registry),
      inject: [PROMETHEUS_REGISTRY],
    },
    VehicleContextMetricsListener,
  ],
  exports: [PROMETHEUS_REGISTRY, VEHICLE_CONTEXT_COUNTERS],
})
export class ObservabilityModule {}
