/**
 * Canonical Role IDs — re-exports from `@repo/seo-roles`.
 *
 * The actual implementation now lives in `packages/seo-roles/` as a shared
 * monorepo package consumed by both backend and frontend (PR-0A foundation).
 *
 * This file is kept for backwards-compat with existing imports
 * (`from './role-ids'` or `from '@modules/config/role-ids'`).
 *
 * Migration path : new code SHOULD import from `@repo/seo-roles` directly.
 */

export {
  RoleId,
  ROLE_ID_LIST,
  LEGACY_ROLE_ALIASES,
  FORBIDDEN_ROLE_IDS,
  normalizeRoleId,
  assertCanonicalRole,
  roleIdToPageType,
  pageTypeToRoleId,
  type WorkerPageType,
} from '@repo/seo-roles';
