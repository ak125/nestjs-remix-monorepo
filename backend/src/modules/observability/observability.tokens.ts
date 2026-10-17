/**
 * DI tokens for the observability module (PR-C).
 *
 * Kept in a dedicated file so the listener spec can import the symbol
 * without dragging the controller / registry-bootstrapping transitive
 * imports into the test compilation unit.
 */
export const VEHICLE_CONTEXT_COUNTERS = Symbol.for(
  'Observability.VehicleContextCounters',
);

export const PROMETHEUS_REGISTRY = Symbol.for(
  'Observability.PrometheusRegistry',
);

// PR-E — Diagnostic KG shadow counter (single counter, kept distinct from
// the VehicleContext bundle so each module's listener can DI just what it needs).
export const DIAGNOSTIC_KG_SHADOW_COUNTER = Symbol.for(
  'Observability.DiagnosticKgShadowCounter',
);

// Diagnostic WIKI provenance counter, distinct for the same reason (flags
// DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED, DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED).
export const DIAGNOSTIC_PROVENANCE_COUNTER = Symbol.for(
  'Observability.DiagnosticProvenanceCounter',
);
