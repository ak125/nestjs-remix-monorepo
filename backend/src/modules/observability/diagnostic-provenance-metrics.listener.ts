import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DiagnosticProvenanceCounter } from './diagnostic-provenance.metrics';
import { DIAGNOSTIC_PROVENANCE_COUNTER } from './observability.tokens';

const MODES = ['expose', 'primary'];
const STATUSES = ['available', 'unavailable'];
const STATES = ['sourced', 'partial', 'unsourced'];
const BOOLEANS = [true, false];

/**
 * DiagnosticProvenanceMetricsListener — wires the
 * `diagnostic_provenance_evaluated` event emitted by
 * `DiagnosticProvenanceService` into the Prometheus counter registered by
 * this module. Mirror of the KG shadow listener: no dependency on the
 * diagnostic domain, and a malformed payload is counted, never thrown.
 */
@Injectable()
export class DiagnosticProvenanceMetricsListener {
  constructor(
    @Inject(DIAGNOSTIC_PROVENANCE_COUNTER)
    private readonly counter: DiagnosticProvenanceCounter,
  ) {}

  @OnEvent('diagnostic_provenance_evaluated')
  onEvaluated(payload: unknown): void {
    const p = (payload ?? {}) as Record<string, unknown>;
    this.counter.evaluated
      .labels({
        mode: label(p.mode, MODES),
        status: label(p.status, STATUSES),
        top_state: optionalLabel(p.top_state, STATES),
        rank_changed: optionalLabel(p.rank_changed, BOOLEANS),
      })
      .inc();
  }
}

/** The value when it belongs to its set, else `unknown`. */
function label(v: unknown, allowed: readonly unknown[]): string {
  return allowed.includes(v) ? String(v) : 'unknown';
}

/** As `label`, with `none` for a field the event does not carry. */
function optionalLabel(v: unknown, allowed: readonly unknown[]): string {
  return v === undefined ? 'none' : label(v, allowed);
}
