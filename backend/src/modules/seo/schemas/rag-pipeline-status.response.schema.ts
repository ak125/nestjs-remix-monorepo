/**
 * Zod response schema for GET /api/admin/rag-pipeline/status.
 *
 * Migrated to Zod boundary (PR-2). The `recentErrors[].role` field used to
 * expose `__pipeline_chain_queue.pcq_page_type` raw, which can contain
 * legacy worker page_type values (`R1_pieces`, `R3_guide_howto`, etc.).
 *
 * `tolerantRoleSchema` from @repo/seo-roles transforms those to canonical
 * `RoleId` values at the response boundary.
 */

import { z } from 'zod';
import { tolerantRoleSchema } from '@repo/seo-roles';

const phaseSchema = z.enum(['DISABLED', 'A', 'B', 'C', 'C_BREAKER']);

const flagsSchema = z.object({
  pipelineEnabled: z.boolean(),
  autoEnqueue: z.boolean(),
  dryRun: z.boolean(),
  allowedRoles: z.array(z.string()).optional(),
  allowedGammes: z.array(z.string()).optional(),
});

const queueStatsSchema = z.object({
  pending: z.number().int().nonnegative(),
  done_24h: z.number().int().nonnegative(),
  failed_24h: z.number().int().nonnegative(),
  failed_ratio_24h: z.number(),
});

const eventStatsSchema = z.object({
  pending: z.number().int().nonnegative(),
  done_24h: z.number().int().nonnegative(),
  skipped_24h: z.number().int().nonnegative(),
});

const breakerStateSchema = z
  .object({
    active: z.boolean(),
    // Other fields are passed through — keep tolerant to avoid unrelated breakage
  })
  .passthrough();

const topGammeSchema = z.object({
  alias: z.string(),
  total: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

/**
 * Recent error entry — `role` is normalized via tolerantRoleSchema.
 *
 * Legacy values like `R1_pieces`, `R3_guide_howto` are accepted from DB
 * (`pcq_page_type` column) and transformed to canonical `R1_ROUTER`, `R3_CONSEILS`.
 *
 * `null` accepted because `pcq_page_type` is nullable in some legacy rows.
 */
const recentErrorSchema = z.object({
  id: z.union([z.number(), z.string()]),
  gamme: z.string().nullable(),
  role: z.union([tolerantRoleSchema, z.null()]),
  error: z.string().nullable(),
  at: z.string().nullable(),
});

const openIncidentSchema = z
  .object({
    rpi_id: z.union([z.number(), z.string()]),
    rpi_type: z.string().nullable().optional(),
    rpi_reason: z.string().nullable().optional(),
    rpi_created_at: z.string().nullable().optional(),
    rpi_threshold_name: z.string().nullable().optional(),
    rpi_current_value: z.union([z.number(), z.string(), z.null()]).optional(),
  })
  .passthrough();

export const ragPipelineStatusResponseSchema = z.object({
  phaseEffective: phaseSchema,
  phasePersisted: phaseSchema,
  effectiveFlags: flagsSchema,
  persistedFlags: flagsSchema,
  overrides: z.record(z.union([z.string(), z.null()])),
  queue: queueStatsSchema,
  events: eventStatsSchema,
  circuitBreaker: breakerStateSchema,
  topGammes_24h: z.array(topGammeSchema),
  recentErrors: z.array(recentErrorSchema),
  openIncidents: z.array(openIncidentSchema),
});

export type RagPipelineStatusResponse = z.infer<
  typeof ragPipelineStatusResponseSchema
>;
