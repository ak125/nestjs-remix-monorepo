import { Counter, Registry } from 'prom-client';

/**
 * Diagnostic WIKI provenance counter.
 *
 * Emitted by `DiagnosticProvenanceService.rank()` once per analysis while
 * DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED is ON. Under EXPOSE alone it measures,
 * before PRIMARY is switched on, how often PRIMARY would reorder the
 * hypotheses (`rank_changed`) and how documented the leading one is
 * (`top_state`); `status="unavailable"` counts the analyses whose provenance
 * could not be read.
 *
 * Labels are bounded sets (label discipline of the other diagnostic counters):
 *   - `mode` ∈ { expose | primary }
 *   - `status` ∈ { available | unavailable }
 *   - `top_state` ∈ { sourced | partial | unsourced | none }
 *   - `rank_changed` ∈ { true | false | none }
 * `none` = not carried by the event (unavailable, or no hypothesis);
 * `unknown` = a value outside these sets.
 *
 * NEVER labelled with cause, link, fiche or session ids (cardinality explosion).
 */
export const DIAGNOSTIC_PROVENANCE_METRIC_NAME =
  'diagnostic_provenance_evaluated_total';

export interface DiagnosticProvenanceCounter {
  readonly evaluated: Counter<'mode' | 'status' | 'top_state' | 'rank_changed'>;
}

export function buildDiagnosticProvenanceCounter(
  registry: Registry,
): DiagnosticProvenanceCounter {
  return {
    evaluated: new Counter({
      name: DIAGNOSTIC_PROVENANCE_METRIC_NAME,
      help: 'Count of diagnostic analyses evaluated against the WIKI provenance, by mode, status, state of the leading hypothesis and whether PRIMARY reorders the hypotheses.',
      labelNames: ['mode', 'status', 'top_state', 'rank_changed'],
      registers: [registry],
    }),
  };
}
