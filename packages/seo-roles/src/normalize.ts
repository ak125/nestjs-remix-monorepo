import { RoleId, WorkerPageType } from "./canonical";
import {
  LEGACY_ROLE_ALIASES,
  FORBIDDEN_ROLE_IDS,
  DEPRECATED_OUTPUT_ROLES,
  PAGE_TYPE_TO_ROLE,
  ROLE_TO_PAGE_TYPE,
} from "./legacy";

/**
 * Normalize any role string (canonical, legacy, or worker page_type) to a `RoleId`.
 *
 * Returns `null` if the input is unrecognized OR forbidden (bare `R3`, `R6`, etc.).
 *
 * Legacy accepté en entrée — mapping géré par `LEGACY_ROLE_ALIASES` et `PAGE_TYPE_TO_ROLE`.
 */
export function normalizeRoleId(input: string): RoleId | null {
  // Reject forbidden / ambiguous role IDs first
  if ((FORBIDDEN_ROLE_IDS as readonly string[]).includes(input)) return null;
  // Direct match on enum values
  const asRole = (Object.values(RoleId) as string[]).find((v) => v === input);
  if (asRole) return asRole as RoleId;
  // Legacy alias
  if (input in LEGACY_ROLE_ALIASES) return LEGACY_ROLE_ALIASES[input];
  // Worker page type
  return PAGE_TYPE_TO_ROLE[input as WorkerPageType] ?? null;
}

/**
 * Asserts the role string is a canonical `RoleId`, NOT a legacy alias.
 *
 * Use in OUTPUT paths to enforce "canon obligatoire en sortie".
 * Throws if the string is not a canonical RoleId or is a deprecated output role.
 */
export function assertCanonicalRole(role: string): RoleId {
  const canonical = (Object.values(RoleId) as string[]).find((v) => v === role);
  if (!canonical) {
    throw new Error(
      `Non-canonical role in output: "${role}". Use normalizeRoleId() first.`,
    );
  }
  if (DEPRECATED_OUTPUT_ROLES.has(canonical as RoleId)) {
    throw new Error(
      `Deprecated role in output: "${role}". R9 / R3_GUIDE no longer canonical.`,
    );
  }
  return canonical as RoleId;
}

/** Convert a `RoleId` to the worker `page_type`. Returns null for roles without a worker equivalent. */
export function roleIdToPageType(roleId: RoleId): WorkerPageType | null {
  return ROLE_TO_PAGE_TYPE[roleId] ?? null;
}

/** Convert a worker `page_type` string to `RoleId`. Returns null if unrecognized. */
export function pageTypeToRoleId(pageType: string): RoleId | null {
  return PAGE_TYPE_TO_ROLE[pageType as WorkerPageType] ?? null;
}
