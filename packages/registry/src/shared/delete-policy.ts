import { z } from "zod";

/**
 * Deletion policy for an entry.
 *
 * - `FREE`           : deletion allowed (default)
 * - `ADR_REQUIRED`   : deletion requires a vault ADR documenting the rationale
 * - `LOCKED`         : deletion forbidden (typically infrastructure / safety-critical)
 *
 * V1.5 will introduce an invariant `LOCKED ⇒ risk: critical`.
 */
export const DeletePolicySchema = z.enum(["FREE", "ADR_REQUIRED", "LOCKED"]);

export type DeletePolicy = z.infer<typeof DeletePolicySchema>;
