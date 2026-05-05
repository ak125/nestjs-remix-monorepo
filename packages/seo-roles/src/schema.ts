import { z } from "zod";
import { RoleId } from "./canonical";
import { CanonicalRoleId, assertCanonicalRoleStrict } from "./branded";
import { normalizeRoleId } from "./normalize";

/**
 * Zod schema accepting BOTH canonical and legacy values, transforming to
 * `CanonicalRoleId`. Use in **input** schemas (request bodies, DB row parsing).
 *
 * - Canonical input (e.g. `"R3_CONSEILS"`) → `R3_CONSEILS`
 * - Legacy alias (e.g. `"R3_BLOG"`, `"R6_BUYING_GUIDE"`) → mapped canonical
 * - Forbidden bare (`"R3"`, `"R6"`, `"R9"`, `"R3_GUIDE"`) → validation error
 * - Unknown string → validation error
 *
 * @example Tolerant DB row parsing
 *   const RowSchema = z.object({
 *     role: tolerantRoleSchema,
 *     name: z.string(),
 *   });
 *   const row = RowSchema.parse(rawDbRow);
 *   row.role; // typed as CanonicalRoleId
 */
export const tolerantRoleSchema: z.ZodType<CanonicalRoleId, z.ZodTypeDef, unknown> =
  z
    .string({ required_error: "Role is required" })
    .transform((val, ctx) => {
      const normalized = normalizeRoleId(val);
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown or forbidden role: "${val}". Bare R3/R6/R9 are ambiguous; use canonical RoleId or a known legacy alias.`,
        });
        return z.NEVER;
      }
      return assertCanonicalRoleStrict(normalized);
    });

/**
 * Zod schema accepting **only canonical** RoleId values (strict).
 * Rejects legacy aliases, deprecated roles, and forbidden bare values.
 * Use in **output** schemas to enforce the "canon obligatoire en sortie" rule.
 *
 * @example Strict response validation
 *   const ResponseSchema = z.object({
 *     role: canonicalRoleSchema,
 *     metadata: z.record(z.unknown()),
 *   });
 *   ResponseSchema.parse(payload); // throws if payload.role is legacy
 */
export const canonicalRoleSchema: z.ZodType<CanonicalRoleId, z.ZodTypeDef, unknown> =
  z
    .string({ required_error: "Role is required" })
    .transform((val, ctx) => {
      try {
        return assertCanonicalRoleStrict(val);
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            e instanceof Error
              ? e.message
              : `Non-canonical role in output: "${val}".`,
        });
        return z.NEVER;
      }
    });

/**
 * Native Zod enum mirroring the `RoleId` enum, useful for documentation
 * generation (OpenAPI / Swagger). Allows ALL enum members including
 * deprecated ones — prefer `canonicalRoleSchema` for runtime output validation.
 */
export const roleIdNativeEnum = z.nativeEnum(RoleId);
