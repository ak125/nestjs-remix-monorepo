import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DiagnosticKgShadowCounter } from './diagnostic-kg-shadow.metrics';
import { DIAGNOSTIC_KG_SHADOW_COUNTER } from './observability.tokens';

/**
 * DiagnosticKgShadowMetricsListener — wires the `diagnostic_kg_shadow_diverged`
 * event emitted by `KgShadowService` (PR-E) into the Prometheus counter
 * registered by this module. Mirror of the VehicleContext listener
 * pattern shipped in PR-C.
 */
@Injectable()
export class DiagnosticKgShadowMetricsListener {
  private readonly logger = new Logger(DiagnosticKgShadowMetricsListener.name);

  constructor(
    @Inject(DIAGNOSTIC_KG_SHADOW_COUNTER)
    private readonly counter: DiagnosticKgShadowCounter,
  ) {}

  @OnEvent('diagnostic_kg_shadow_diverged')
  onDiverged(payload: unknown): void {
    const p = (payload ?? {}) as {
      reason?: string;
      has_divergence?: boolean;
    };
    this.counter.diverged
      .labels({
        reason: stringLabel(p.reason),
        has_divergence: boolLabel(p.has_divergence),
      })
      .inc();
  }
}

function stringLabel(v: unknown): string {
  return typeof v === 'string' && v.length > 0 ? v : 'unknown';
}

function boolLabel(v: unknown): string {
  return v === true ? 'true' : v === false ? 'false' : 'unknown';
}
