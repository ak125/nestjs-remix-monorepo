import { Counter, Registry } from 'prom-client';

/**
 * Diagnostic KG Shadow counter (PR-E of Diagnostic Control Plane V1).
 *
 * Emitted by `KgShadowService.runShadow()` after the fire-and-forget
 * KG comparison resolves. Feeds the V1.5 graduation gate from the
 * project plan : "≥ 1000+ golden cohort sessions with < 5 % divergence".
 *
 * Labels are intentionally low-cardinality (canon `vehicle-context-option-a-locked`
 * label-discipline pattern carried forward from PR-C) :
 *   - `reason` ∈ { match | top1_diff | set_diff | kg_empty | kg_error }
 *   - `has_divergence` ∈ { true | false }
 *
 * NEVER labelled with cause_id / fault_id / session_id (cardinality explosion).
 */
export const DIAGNOSTIC_KG_SHADOW_METRIC_NAME =
  'diagnostic_kg_shadow_diverged_total';

export interface DiagnosticKgShadowCounter {
  readonly diverged: Counter<'reason' | 'has_divergence'>;
}

export function buildDiagnosticKgShadowCounter(
  registry: Registry,
): DiagnosticKgShadowCounter {
  return {
    diverged: new Counter({
      name: DIAGNOSTIC_KG_SHADOW_METRIC_NAME,
      help: 'Count of KG shadow comparisons by divergence reason. Feeds the V1.5 graduation gate (< 5 % divergence on 1000+ golden sessions).',
      labelNames: ['reason', 'has_divergence'],
      registers: [registry],
    }),
  };
}
