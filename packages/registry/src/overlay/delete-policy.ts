import { z } from "zod";
import { SchemaVersionSchema } from "../shared/schema-version";
import { DeletePolicySchema as DeletePolicyEnumSchema } from "../shared/delete-policy";

/**
 * Layer 2 — Delete policy overlay (manuel).
 *
 * Lives in `.spec/00-canon/repository-registry/delete-policy.yaml`.
 *
 * Canon V1 (per plan PR-D) :
 *   - `audit/registry/**` → ADR_REQUIRED (registry artifacts are SoT / projection)
 *   - `__seo_*`, `__diag_*`, `kg_*` → ADR_REQUIRED (governance + safety-critical DB)
 *   - Infrastructure-critical files (deployment, secrets, signing keys) → LOCKED
 */
export const DeletePolicyEntrySchema = z.object({
  glob: z.string().min(1),
  policy: DeletePolicyEnumSchema,
  reason: z.string().min(1),
});

export const DeletePolicyOverlaySchema = z.object({
  schemaVersion: SchemaVersionSchema,
  entries: z.array(DeletePolicyEntrySchema).default([]),
});

export type DeletePolicyEntry = z.infer<typeof DeletePolicyEntrySchema>;
export type DeletePolicyOverlay = z.infer<typeof DeletePolicyOverlaySchema>;
