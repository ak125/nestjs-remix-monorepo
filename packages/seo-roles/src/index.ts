/**
 * @repo/seo-roles
 *
 * Single source of truth for canonical SEO page roles in the AutoMecanik monorepo.
 *
 * Rule : "Legacy accepté en entrée, canon obligatoire en sortie."
 *
 * - Inputs (DB, API request, worker page_type) tolerated via `normalizeRoleId()`
 *   or `tolerantRoleSchema` (Zod)
 * - Outputs MUST be canonical via `assertCanonicalRole()`, `assertCanonicalRoleStrict()`
 *   (returns branded `CanonicalRoleId`), or `canonicalRoleSchema` (Zod)
 *
 * @see `.spec/00-canon/db-governance/legacy-canon-map.md`
 */

// ── PR-0A surface ──

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

// ── PR-0B surface : branded type + Zod schemas ──

export {
  type CanonicalRoleId,
  assertCanonicalRoleStrict,
  isCanonicalRoleId,
} from "./branded";

export {
  tolerantRoleSchema,
  canonicalRoleSchema,
  roleIdNativeEnum,
} from "./schema";

// ── PR-0C surface : keyword → role classification ──

export {
  SearchIntentSchema,
  classifyKeywordToRole,
  type SearchIntent,
  type KeywordRoleClassification,
} from "./keyword-intent";

// ── PR-0D surface : intent matrix, text normalisation, forbidden overlap ──

export {
  type RoleIntents,
  getRoleIntents,
  isIntentAllowedForRole,
} from "./intents";

export {
  type SupportedLocale,
  normalizeSeoText,
  normalizePhrase,
  modelMatchKey,
  tokenize,
  stem,
  tokenizeAndStem,
} from "./text-normalize";

export { getForbiddenOverlap } from "./forbidden-overlap";

export {
  KeywordClusterSchema,
  type KeywordCluster,
} from "./keyword-cluster.schema";

// ── V-Level invariants (réf : audit/levels-doctrine-cgc-vs-vlevel-2026-06-04.md) ──
// Data-only : énonce les règles V une seule fois (classement marketing FR). N'est PAS un
// moteur. Ne JAMAIS confondre avec cgc_level (maillage public) ni L1–L5 (sizing contenu).
export {
  V_LEVEL_IDS,
  type VLevelId,
  VLEVEL_V2_CAP,
  VLEVEL_RANKING_SIGNALS,
  V_GROUP_KEY,
  vLevelGroupKey,
  compareV3Champions,
  GAMME_PART_TERMS,
  isKeywordEligibleForGamme,
  type VLevelInvariant,
  V_LEVEL_INVARIANTS,
  V_PROPAGATE,
  type VLevelKnownGap,
  V_LEVEL_KNOWN_GAPS,
  VLEVEL_DB_BASELINE_2026_06_05,
} from "./vlevel-invariants";
