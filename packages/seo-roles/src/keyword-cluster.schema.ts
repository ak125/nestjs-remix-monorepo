/**
 * Zod schema for keyword clusters produced by SEO scripts and consumed by
 * downstream pipelines (DB writers, RAG enrich, R3 keyword plan generation).
 *
 * Refinement enforces the canon : the cluster's declared `intent` MUST be
 * in the role's primary / secondary / allowedLeakage set
 * (see {@link isIntentAllowedForRole}). Forbidden output roles
 * (`R3_GUIDE`, `R9_GOVERNANCE`) are rejected outright via
 * {@link canonicalRoleSchema} reuse.
 */

import { z } from "zod";

import { canonicalRoleSchema } from "./schema";
import { SearchIntentSchema } from "./keyword-intent";
import { isIntentAllowedForRole } from "./intents";

const RawCluster = z.object({
  role: canonicalRoleSchema,
  primary: z.string().min(2, "primary keyword must be ≥ 2 chars"),
  primary_volume: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("0 marks a synthetic keyword (no real KP volume)"),
  secondary: z.array(z.string().min(2)).max(5),
  intent: SearchIntentSchema,
  forbidden_overlap: z.array(z.string()).optional(),
});

/**
 * Validated keyword cluster shape — passes only if `intent` is canonically
 * permitted for `role` and no orphan terms slip through.
 */
export const KeywordClusterSchema = RawCluster.refine(
  (c) => isIntentAllowedForRole(c.role, c.intent),
  ({
    message:
      "Intent not in canonical primary/secondary/allowedLeakage set for role",
    path: ["intent"],
  } as const),
);

export type KeywordCluster = z.infer<typeof KeywordClusterSchema>;
