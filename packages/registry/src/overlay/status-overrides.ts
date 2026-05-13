import { z } from "zod";
import { SchemaVersionSchema } from "../shared/schema-version";
import { StatusSchema } from "../shared/status";

/**
 * Layer 2 — Status overrides overlay (manuel).
 *
 * Lives in `.spec/00-canon/repository-registry/status-overrides.yaml`.
 *
 * Initially mostly empty — only known legacy paths (e.g. `backend/src/rm/**`
 * = LEGACY per ADR-004 rm-module-scope) are pinned here. Auto-detection by
 * Layer 1 builders covers the rest.
 *
 * Each override forces a status on matched paths, bypassing builder
 * classification (use sparingly — override only when builders cannot infer).
 */
export const StatusOverrideEntrySchema = z.object({
  glob: z.string().min(1),
  status: StatusSchema,
  reason: z.string().min(1), // why this override exists (mandatory for auditability)
  setAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO date YYYY-MM-DD
  setBy: z.string().min(1), // who introduced this override
});

export const StatusOverridesSchema = z.object({
  schemaVersion: SchemaVersionSchema,
  entries: z.array(StatusOverrideEntrySchema).default([]),
});

export type StatusOverrideEntry = z.infer<typeof StatusOverrideEntrySchema>;
export type StatusOverrides = z.infer<typeof StatusOverridesSchema>;
