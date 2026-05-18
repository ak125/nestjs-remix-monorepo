/**
 * ADR-072 PR 2D-3 — R8 readiness gate response schema.
 *
 * Consumed by the admin endpoint `GET /api/admin/seo/r2/r8-gate-status` and
 * the CI workflow `pr-2e-readiness-gate.yml`. Pass criterion mirrors
 * MEMORY project-r2-v2-canon-sequence-202605 : snapshots >= auto_types.
 *
 * Schemas are internal — only the inferred `R8GateStatus` type is exported.
 * Keeps knip's unused-exports baseline tight.
 */

// Type-only contracts — emitted by the admin endpoint, consumed by the CI
// gate (`scripts/ci/pr-2e-readiness-gate.mjs` declares its own JS shape).
// No Zod schema is parsed at runtime, so we declare TS interfaces directly
// to satisfy `@typescript-eslint/no-unused-vars` + keep knip's
// unused-exports baseline clean.

export type R8GateSampleEnrichmentStatus =
  | 'minimal'
  | 'enriched'
  | 'stale'
  | 'failed';

export interface R8GateSampleEntry {
  typeId: number;
  hasSnapshot: boolean;
  enrichmentStatus: R8GateSampleEnrichmentStatus | null;
}

export interface R8GateStatus {
  snapshots: number;
  autoTypes: number;
  pass: boolean;
  lag: number;
  lagPercent: number;
  sample: R8GateSampleEntry[];
  computedAt: string;
  cacheTtlSeconds: number;
  fromCache: boolean;
}
