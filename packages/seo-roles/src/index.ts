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

// ── V-Level : décision 192 (définition des V1 à V6) ──
// Les huit lignes mot pour mot et une fonction pure par ligne ; les données d'entrée sont des
// paramètres. Ne JAMAIS confondre avec cgc_level (maillage public) ni L1–L5 (sizing contenu).
export {
  V_LEVEL_IDS,
  type VLevelId,
  VLEVEL_STATE_TO_VERIFY,
  VLEVEL_STATE_LICENCE_FREE,
  V_LEVEL_STATES,
  type VLevelState,
  type VLevelDecision192Line,
  VLEVEL_DECISION_192_LINES,
  VLevelInputError,
  VLEVEL_DEMAND_SOURCES,
  type VLevelDemandSource,
  type VLevelFormulation,
  type VLevelObservation,
  type VLevelSearchedVersion,
  type VLevelToVerifyFormulation,
  type VLevelLicenceFreeFormulation,
  type VLevelDemandSorting,
  sortDemandObservations,
  V3_SOURCE_TIERS,
  type V3SourceTier,
  v3SourceTier,
  type V3Candidate,
  type V3Election,
  type V3ElectionInput,
  electV3,
  type VLevelGroupFiche,
  type VLevelGroupInput,
  type VLevelGroupClassification,
  classifyDemandGroup,
  type VLevelCatalogueFiche,
  type V5Input,
  type V5Selection,
  selectV5,
  type V2Vote,
  type V2TallyLine,
  type V2Election,
  type V2ElectionInput,
  electV2,
  type V6Input,
  type V6Decision,
  decideV6,
  type V1OwnerDecision,
  carryV1,
  type VLevelInvariant,
  V_LEVEL_INVARIANTS,
  type VLevelKnownGap,
  V_LEVEL_KNOWN_GAPS,
  VLEVEL_DB_BASELINE_2026_06_05,
} from "./vlevel-invariants";

// ── V-Level : remplacé par la décision 192 ──
// Ancienne règle, exportée seulement pour les calculateurs non raccordés qui l'appellent encore.
export {
  VLEVEL_V2_CAP,
  type V2PromotionCandidate,
  type V2Violation,
  validateV2Promotion,
  type V2TierSelection,
  selectV2Tier,
  vLevelGroupKey,
  compareV3Champions,
  GAMME_PART_TERMS,
  isKeywordEligibleForGamme,
  VLEVEL_MOTOR_PATTERN,
  type VLevelVehicleCandidate,
  isVLevelEligibleVehicle,
} from "./vlevel-invariants";
