/**
 * RobotsVerdict — types canon UIDP V1 (Unified Indexability Decision Plane).
 *
 * Source of truth typée pour les décisions d'indexabilité SEO :
 *   - `RobotsVerdictKind` enum (texte HTTP émis uniquement par `emit-robots.ts`)
 *   - `ReasonCode` enum (cascade structurelle, pas événement métier — cf. ADR
 *     anti-explosion : critère d'admission = branche de cascade distincte)
 *   - `IndexabilityVerdict` interface (kind + reasonCodes ≤ 1 + context audit)
 *   - `IndexabilityInput` interface (compose entrée pure)
 *
 * Discipline V1 (cf. plan UIDP v5/C2) : `reasonCodes.length ∈ {0, 1}` —
 * la cascade short-circuit au premier blocking. Secondaires = V1.5 evidence-gated.
 *
 * @see compose-indexability.ts (pure function consumer)
 * @see emit-robots.ts (single text emitter)
 * @see ADR-NN UIDP V1 (governance-vault)
 */
import { z } from "zod";
import { SurfaceKeySchema, type SurfaceKey } from "./surface-keys";
import {
  R2IndexabilityConditionsSchema,
  type R2IndexabilityConditions,
} from "./r2-indexability-conditions";

/**
 * Verdict de directive robots — kind canonique, mappé en texte HTTP
 * uniquement par `emitRobotsForVerdict()` (single emission point).
 */
export enum RobotsVerdictKind {
  INDEX_FOLLOW = "INDEX_FOLLOW",
  NOINDEX_FOLLOW = "NOINDEX_FOLLOW",
  NOINDEX_NOFOLLOW = "NOINDEX_NOFOLLOW",
}

export const RobotsVerdictKindSchema = z.nativeEnum(RobotsVerdictKind);

/**
 * Reason code — invariant **structurel** de la cascade décisionnelle.
 *
 * Discipline (cf. ADR UIDP V1 § anti-explosion) :
 *   - Ajout d'une nouvelle valeur = ouverture d'une nouvelle **branche** de
 *     cascade (étape qui produit un `kind` distinct)
 *   - PAS un sous-cas métier d'une branche existante (ex. `R2_GATE_FAIL_NO_IMAGE`
 *     serait du bruit ; les sub-reasons R2 restent internes au R2 verdict
 *     et ne remontent pas au ReasonCode[] de niveau supérieur)
 *   - Tout ajout requiert un test d'invariant dédié
 */
export enum ReasonCode {
  /** URL ≠ canonical (strict_canonical_match) — exclusif, court-circuit. */
  CANONICAL_MISMATCH = "CANONICAL_MISMATCH",
  /** Surface R2 et gate fail (≥1 condition cumulative manquante). */
  R2_GATE_FAIL = "R2_GATE_FAIL",
  /** Surface R2 sans payload `r2Conditions` (fail-safe, exclusif). */
  R2_CONDITIONS_MISSING = "R2_CONDITIONS_MISSING",
  /** availableFamilies < threshold (R1/R6/R7). */
  FAMILIES_BELOW_THRESHOLD = "FAMILIES_BELOW_THRESHOLD",
  /** availableGammes < threshold (R1/R8). */
  GAMMES_BELOW_THRESHOLD = "GAMMES_BELOW_THRESHOLD",
  /** Fingerprint match (PR-9 SEO) — page duplicate variant. */
  FINGERPRINT_DUPLICATE = "FINGERPRINT_DUPLICATE",
  /** TecDoc release gate ouverte ([60000, 83456]) — noindex jusqu'à validation. */
  TECDOC_RELEASE_GATE = "TECDOC_RELEASE_GATE",
}

export const ReasonCodeSchema = z.nativeEnum(ReasonCode);

/**
 * Context audit attaché à chaque verdict — utile pour replay, debug, logs.
 * V1 : champs minimaux. V1.5+ : peut accueillir snapshot_hash, surface_payload_hash.
 */
export const IndexabilityVerdictContextSchema = z.object({
  surfaceKey: SurfaceKeySchema,
  requestedUrl: z.string().min(1),
  canonicalUrl: z.string().min(1),
  computedAt: z.string().min(1), // ISO-8601
});
export type IndexabilityVerdictContext = z.infer<
  typeof IndexabilityVerdictContextSchema
>;

/**
 * Verdict canonique d'indexabilité — sortie de `computeIndexabilityVerdict()`.
 *
 * Invariants V1 (cf. plan UIDP v5/C2) :
 *   - `reasonCodes.length === 0` ↔ `kind === INDEX_FOLLOW`
 *   - `reasonCodes.length === 1` ↔ `kind ∈ {NOINDEX_FOLLOW, NOINDEX_NOFOLLOW}`
 *   - `reasonCodes.length ≤ 1` (limite stricte V1, behaviour-preserving)
 */
export const IndexabilityVerdictSchema = z.object({
  kind: RobotsVerdictKindSchema,
  reasonCodes: z.array(ReasonCodeSchema).max(1),
  context: IndexabilityVerdictContextSchema,
});
export type IndexabilityVerdict = z.infer<typeof IndexabilityVerdictSchema>;

/**
 * Input pur du composer — toutes les données nécessaires à la décision.
 * Pas de référence Nest / runtime / DB : pure function input.
 *
 * Note : `tecdocReleaseGateOpen` est calculé côté caller (loader R8) — c'est
 * un flag, pas une règle métier dans le composer. Si l'ADR future ouvre la
 * gate, le caller change la valeur du flag sans toucher au composer.
 */
export const IndexabilityInputSchema = z.object({
  surfaceKey: SurfaceKeySchema,
  requestedUrl: z.string().min(1),
  canonicalUrl: z.string().min(1),
  availableFamilies: z.number().int().nonnegative().optional(),
  availableGammes: z.number().int().nonnegative().optional(),
  r2Conditions: R2IndexabilityConditionsSchema.optional(),
  /** PR-9 fingerprint match — undefined = check inactif sur cette surface. */
  fingerprintMatch: z.boolean().optional(),
  /** Caller-computed (ex. R8 : `type_id >= 60000 && type_id <= 83456`). */
  tecdocReleaseGateOpen: z.boolean().optional(),
});
export type IndexabilityInput = z.infer<typeof IndexabilityInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Backward compat (C4) — déprécié, retrait V1.5.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @deprecated PR-UIDP-1 (v5/C4) — utiliser `RobotsVerdictKind` enum.
 * Retrait prévu V1.5 quand tous les consommateurs auront migré.
 *
 * Ré-export du type legacy string union pour préserver la signature publique
 * de `SeoIndexabilityPolicyService.computeIndexability()` pendant la transition.
 */
export type RobotsValue =
  | "index,follow"
  | "noindex,follow"
  | "noindex,nofollow";

/**
 * @deprecated PR-UIDP-1 (v5/C4) — utiliser `emitRobotsForVerdict()`.
 * Helper interne pour la couche backward-compat du service NestJS.
 */
export function legacyStringFromKind(kind: RobotsVerdictKind): RobotsValue {
  switch (kind) {
    case RobotsVerdictKind.INDEX_FOLLOW:
      return "index,follow";
    case RobotsVerdictKind.NOINDEX_FOLLOW:
      return "noindex,follow";
    case RobotsVerdictKind.NOINDEX_NOFOLLOW:
      return "noindex,nofollow";
  }
}
