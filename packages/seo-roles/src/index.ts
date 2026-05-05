/**
 * @repo/seo-roles
 *
 * Single source of truth for canonical SEO page roles in the AutoMecanik monorepo.
 *
 * Rule : "Legacy accepté en entrée, canon obligatoire en sortie."
 *
 * - Inputs (DB, API request, worker page_type) tolerated via `normalizeRoleId()`
 * - Outputs MUST be canonical via `assertCanonicalRole()`
 *
 * @see `.spec/00-canon/db-governance/legacy-canon-map.md`
 */

export {
  RoleId,
  ROLE_ID_LIST,
  type WorkerPageType,
} from "./canonical";

export {
  LEGACY_ROLE_ALIASES,
  PAGE_TYPE_TO_ROLE,
  ROLE_TO_PAGE_TYPE,
  FORBIDDEN_ROLE_IDS,
  DEPRECATED_OUTPUT_ROLES,
} from "./legacy";

export {
  normalizeRoleId,
  assertCanonicalRole,
  roleIdToPageType,
  pageTypeToRoleId,
} from "./normalize";

export {
  getRoleDisplayLabel,
  getRoleShortLabel,
} from "./display";

export { ROLE_BADGE_COLORS } from "./colors";
