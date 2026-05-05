import { RoleId, ROLE_ID_LIST } from "./canonical";
import { DEPRECATED_OUTPUT_ROLES } from "./legacy";

/**
 * Branded type for canonical SEO role IDs.
 *
 * Uses TypeScript's "unique symbol" branding pattern. A `CanonicalRoleId`
 * cannot be assigned from a raw `string` — only via `assertCanonicalRoleStrict()`
 * (or by re-using an existing `CanonicalRoleId`). This forces every output
 * site to go through the validation pipeline `normalize → assert → return`,
 * eliminating accidental raw legacy returns at compile time.
 *
 * Runtime equivalent : `assertCanonicalRoleStrict(role)` (this module) or
 * `assertCanonicalRole(role)` (./normalize, returns plain RoleId for backwards
 * compat with existing call sites).
 *
 * @example
 * function getReferenceRole(): CanonicalRoleId {
 *   const raw = await db.query("...");
 *   return assertCanonicalRoleStrict(raw); // ✅ branded
 * }
 *
 * function bad(): CanonicalRoleId {
 *   return "R3_BLOG"; // ❌ TS2322 : Type 'string' is not assignable to type 'CanonicalRoleId'
 * }
 */
declare const __canonicalRoleBrand: unique symbol;

export type CanonicalRoleId = RoleId & {
  readonly [__canonicalRoleBrand]: "CanonicalRoleId";
};

/**
 * Strict canonical assertion that returns a branded `CanonicalRoleId`.
 *
 * Throws on legacy aliases (e.g. `"R3_guide"`), forbidden bare roles
 * (`"R3"`, `"R6"`), and deprecated roles (`"R9_GOVERNANCE"`, `"R3_GUIDE"`).
 *
 * Use in OUTPUT paths where you want compile-time guarantee that callers
 * cannot bypass canonicalization.
 *
 * @throws Error if the input is not a canonical, non-deprecated `RoleId`.
 */
export function assertCanonicalRoleStrict(role: string): CanonicalRoleId {
  const canonical = ROLE_ID_LIST.find((v) => v === role);
  if (!canonical) {
    throw new Error(
      `Non-canonical role in output: "${role}". Use normalizeRoleId() first.`,
    );
  }
  if (DEPRECATED_OUTPUT_ROLES.has(canonical)) {
    throw new Error(
      `Deprecated role in output: "${role}". R9 / R3_GUIDE no longer canonical.`,
    );
  }
  return canonical as CanonicalRoleId;
}

/** Type guard — returns true when `role` is a non-deprecated canonical RoleId. */
export function isCanonicalRoleId(role: unknown): role is CanonicalRoleId {
  if (typeof role !== "string") return false;
  const canonical = ROLE_ID_LIST.find((v) => v === role);
  if (!canonical) return false;
  return !DEPRECATED_OUTPUT_ROLES.has(canonical);
}
