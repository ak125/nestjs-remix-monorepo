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

import { z } from 'zod';

const R8GateSampleEntrySchema = z.object({
  typeId: z.number().int().positive(),
  hasSnapshot: z.boolean(),
  enrichmentStatus: z
    .enum(['minimal', 'enriched', 'stale', 'failed'])
    .nullable(),
});
export type R8GateSampleEntry = z.infer<typeof R8GateSampleEntrySchema>;

const R8GateStatusSchema = z.object({
  snapshots: z.number().int().nonnegative(),
  autoTypes: z.number().int().nonnegative(),
  pass: z.boolean(),
  lag: z.number().int(),
  lagPercent: z.number(),
  sample: z.array(R8GateSampleEntrySchema).max(10),
  computedAt: z.string().datetime(),
  cacheTtlSeconds: z.number().int().nonnegative(),
  fromCache: z.boolean(),
});
export type R8GateStatus = z.infer<typeof R8GateStatusSchema>;
