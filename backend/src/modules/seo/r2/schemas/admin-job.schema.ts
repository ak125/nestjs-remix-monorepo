/**
 * ADR-072 PR 2D-3 — Admin job DTO + Zod schemas.
 *
 * Mirrors the `__seo_admin_job` table (migration `20260518_seo_admin_job_table.sql`).
 * Single source of truth for controller payloads and the orchestrator service.
 *
 * Export discipline : only the schemas actually parsed at the boundary
 * (Request → controller, RPC → service) are exported. Other Zod nodes stay
 * internal so knip's unused-exports baseline doesn't drift.
 */

import { z } from 'zod';

const AdminJobStatusEnum = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);
export type AdminJobStatus = z.infer<typeof AdminJobStatusEnum>;

const AdminJobTypeEnum = z.enum(['r8_seed_run']);

// RFC-7240 / Stripe idempotency keys : alphanumeric, dashes, underscores.
// 8-64 chars to allow UUIDs (36) and short slugs while bounding storage.
const IdempotencyKeySchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'idempotency_key must be [A-Za-z0-9_-]{8,64}');

export const R8SeedRunRequestSchema = z.object({
  idempotencyKey: IdempotencyKeySchema,
  dryRun: z.boolean().default(false),
  batchSize: z.number().int().min(1).max(2000).optional(),
  sinceTypeId: z.number().int().nonnegative().optional(),
  maxBatches: z.number().int().min(1).max(10_000).optional(),
});
export type R8SeedRunRequest = z.infer<typeof R8SeedRunRequestSchema>;

// Type-only — never validated at the boundary (controllers emit it, no
// downstream Zod parse). Hand-written to keep ESLint happy + knip clean.
export interface R8SeedRunAcceptResponse {
  runId: string;
  status: AdminJobStatus;
  idempotentHit: boolean;
  acceptedAt: string;
  dryRun: boolean;
}

export const AdminJobRowSchema = z.object({
  jobId: z.string().uuid(),
  jobType: AdminJobTypeEnum,
  idempotencyKey: IdempotencyKeySchema,
  status: AdminJobStatusEnum,
  input: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
  actor: z.string(),
  traceId: z.string().nullable(),
  acceptedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
});
export type AdminJobRow = z.infer<typeof AdminJobRowSchema>;
