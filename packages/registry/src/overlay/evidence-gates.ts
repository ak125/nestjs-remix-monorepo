import { z } from "zod";
import { SchemaVersionSchema } from "../shared/schema-version";
import { DomainIdSchema } from "../shared/domain";

/**
 * Layer 2 — Evidence Gates overlay (Diagnostic Control Plane V1 deferral lock).
 *
 * Lives in `.spec/00-canon/repository-registry/evidence-gates.yaml`. Source of
 * truth = ADR-077 in `governance-vault`
 * (`ledger/decisions/adr/ADR-077-diagnostic-cp-v1-evidence-gates.md`). This
 * overlay is the machine-readable projection of that canon, consumed by :
 *
 *   - `scripts/audit/sync-codeowners-from-gates.ts` → projects `blocked_paths`
 *     into `.github/CODEOWNERS` (GitHub-native blocking)
 *   - `scripts/audit/evidence-gates-status.ts`     → on-demand status CLI
 *     (queries metrics endpoint live; emits stdout JSON; zero persistent state)
 *   - `scripts/audit/build-deep-inventory.js`      → projects entries into
 *     `audit/registry/canonical.json` (canonical projection)
 *
 * Each gate represents a V1.5+ item explicitly deferred by Diagnostic CP V1
 * (PRs #606, #622, #625, #628). Trigger condition determines when re-evaluation
 * is allowed. Promotion path is uniform : trigger fires → new ADR L4 vault →
 * plan → PR. No shortcuts.
 *
 * Meta-discipline (CRITICAL) : this overlay must NOT itself violate any of the
 * gates it documents. Status queries must remain stateless (no persistent
 * file/table → would violate G6). No dashboard (G4). No admin UI (G8). No
 * OTel spans (G3). No engine extraction (G1). The auto-check CI step
 * `audit-evidence-gates-meta-discipline` enforces this mechanically.
 */

const AutoTriggerSchema = z.object({
  type: z.literal("auto"),
  metric: z.string().min(1),
  source: z.enum([
    "/api/observability/metrics",
    "supabase_rpc",
    "__seo_event_log",
  ]),
  condition: z.string().min(1),
  window_days: z.number().int().positive(),
});

const ReactiveTriggerSchema = z.object({
  type: z.literal("reactive"),
  signal: z.string().min(1),
  threshold: z.string().optional(),
  requested_by: z.string().nullable().default(null),
  requested_at: z.string().nullable().default(null),
});

const DerivedTriggerSchema = z.object({
  type: z.literal("derived"),
  depends_on: z.array(z.string().regex(/^G\d+$/)).min(1),
  condition: z.string().min(1),
});

const HybridTriggerSchema = z.object({
  type: z.literal("hybrid"),
  auto_conditions: z
    .array(AutoTriggerSchema.omit({ type: true }))
    .min(1),
  reactive_conditions: z
    .array(ReactiveTriggerSchema.omit({ type: true }))
    .min(1),
});

export const GateTriggerSchema = z.discriminatedUnion("type", [
  AutoTriggerSchema,
  ReactiveTriggerSchema,
  DerivedTriggerSchema,
  HybridTriggerSchema,
]);

export const EvidenceGateEntrySchema = z.object({
  id: z.string().regex(/^G\d+$/, "Gate ID must match /^G\\d+$/"),
  item: z.string().min(1),
  description: z.string().min(1),
  domain: DomainIdSchema,
  trigger: GateTriggerSchema,
  blocked_paths: z.array(z.string()).default([]),
  blocked_globs: z.array(z.string()).default([]),
  promotion_path: z.string().min(1),
  source_adr: z.literal("ADR-077"),
  canon_lock_reason: z.string().optional(),
  notes: z.string().optional(),
});

export const EvidenceGatesRegistrySchema = z.object({
  schemaVersion: SchemaVersionSchema,
  source_adr_url: z.string().url(),
  canon_freeze_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  parent_plan: z
    .string()
    .default("project_diagnostic_control_plane_v1_plan"),
  entries: z.array(EvidenceGateEntrySchema).length(10, {
    message: "Diagnostic CP V1 canon-freezes exactly 10 gates G1..G10",
  }),
});

export type EvidenceGateEntry = z.infer<typeof EvidenceGateEntrySchema>;
export type EvidenceGatesRegistry = z.infer<typeof EvidenceGatesRegistrySchema>;
export type GateTrigger = z.infer<typeof GateTriggerSchema>;
export type GateStatus = "GATED" | "FIRED" | "REQUESTED" | "ERROR";
