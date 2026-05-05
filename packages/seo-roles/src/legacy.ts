import { RoleId, WorkerPageType } from "./canonical";

/**
 * Legacy role aliases → canonical RoleId.
 *
 * Only NON-AMBIGUOUS legacy values are mapped here. `'R3'` and `'R6'` (bare)
 * are intentionally absent — they are ambiguous and must be resolved via URL
 * context (see `RoleDisambiguationService` in backend, not in this pure package).
 *
 * See `.spec/00-canon/db-governance/legacy-canon-map.md` v1.1.0+
 */
export const LEGACY_ROLE_ALIASES: Record<string, RoleId> = {
  R3_guide: RoleId.R6_GUIDE_ACHAT,
  R3_guide_achat: RoleId.R6_GUIDE_ACHAT,
  R3_BLOG: RoleId.R3_CONSEILS,
  R1_pieces: RoleId.R1_ROUTER,
  R4_reference: RoleId.R4_REFERENCE,
  R4_GLOSSARY: RoleId.R4_REFERENCE,
  R5_diagnostic: RoleId.R5_DIAGNOSTIC,
  R6_BUYING_GUIDE: RoleId.R6_GUIDE_ACHAT,
};

/**
 * Worker page_type → canonical RoleId.
 *
 * Mirrors the worker vocabulary (lowercase variants used in
 * `__rag_content_refresh_log.page_type` etc.).
 */
export const PAGE_TYPE_TO_ROLE: Record<WorkerPageType, RoleId> = {
  R1_pieces: RoleId.R1_ROUTER,
  R2_product: RoleId.R2_PRODUCT,
  R3_conseils: RoleId.R3_CONSEILS,
  R3_guide_howto: RoleId.R3_CONSEILS, // historical alias — bridge to canonical
  R4_reference: RoleId.R4_REFERENCE,
  R5_diagnostic: RoleId.R5_DIAGNOSTIC,
  R6_guide_achat: RoleId.R6_GUIDE_ACHAT,
  R7_brand: RoleId.R7_BRAND,
  R8_vehicle: RoleId.R8_VEHICLE,
};

/**
 * Canonical RoleId → worker page_type.
 *
 * Some canonical roles have no worker equivalent (R0_HOME, R6_SUPPORT, etc.) —
 * those return `null` from `roleIdToPageType()`.
 */
export const ROLE_TO_PAGE_TYPE: Partial<Record<RoleId, WorkerPageType>> = {
  [RoleId.R1_ROUTER]: "R1_pieces",
  [RoleId.R2_PRODUCT]: "R2_product",
  [RoleId.R3_GUIDE]: "R3_guide_howto",
  [RoleId.R3_CONSEILS]: "R3_conseils",
  [RoleId.R4_REFERENCE]: "R4_reference",
  [RoleId.R5_DIAGNOSTIC]: "R5_diagnostic",
  [RoleId.R6_GUIDE_ACHAT]: "R6_guide_achat",
  [RoleId.R7_BRAND]: "R7_brand",
  [RoleId.R8_VEHICLE]: "R8_vehicle",
};

/**
 * Role IDs forbidden in new code — ambiguous without suffix or deprecated.
 *
 * - `R3` / `R6` : bare short forms, ambiguous (multiple canonical descendants)
 * - `R9` : governance moved to G* series
 * - `R3_GUIDE` : orphan deprecated role
 */
export const FORBIDDEN_ROLE_IDS = ["R3", "R6", "R9", "R3_GUIDE"] as const;

/**
 * O(1) lookup set of all canonical RoleId values. Used by hot-path
 * assertions (`assertCanonicalRole`, `assertCanonicalRoleStrict`) to
 * avoid the linear scan of `ROLE_ID_LIST.find()` on every Zod transform.
 */
export const CANONICAL_ROLE_SET: ReadonlySet<string> = new Set<string>(
  Object.values(RoleId),
);

/** Canonical roles that should not appear in new output (deprecated). */
export const DEPRECATED_OUTPUT_ROLES: ReadonlySet<RoleId> = new Set<RoleId>([
  RoleId.R9_GOVERNANCE,
  RoleId.R3_GUIDE,
]);
