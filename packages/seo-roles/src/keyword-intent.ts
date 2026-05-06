/**
 * Keyword → SEO role classification — canonical SoT.
 *
 * Single entry point : `classifyKeywordToRole(keyword)` returns a branded
 * `CanonicalRoleId` plus a `matched` indicator. All consumers (scripts, agents,
 * services) MUST go through this function — drift impossible by construction.
 *
 * Design choices :
 * - **Priority order** : R2_PRODUCT evaluated first → transactional intent
 *   (acheter / prix / livraison) cannot fall into R1 even when the keyword
 *   contains "voiture" / "compatible". Eliminates the historical R1 drift.
 * - **Default = R1_ROUTER** for generic gamme keywords ("filtre a huile") —
 *   on this site, bare gamme queries are navigational. Replaces the previous
 *   default `informationnelle` which left them orphaned.
 * - **Triggers private to module** : `ROLE_KEYWORD_TRIGGERS` is `const` (not
 *   `export const`). Tests validate via `classifyKeywordToRole` indirection,
 *   not by reaching into the regex map.
 *
 * @see `.spec/00-canon/role-matrix.md` for canonical role intents
 * @see `.spec/00-canon/db-governance/legacy-canon-map.md` for alias mapping
 */

import { z } from "zod";

import { type CanonicalRoleId, assertCanonicalRoleStrict } from "./branded";
import { RoleId } from "./canonical";

// ── Search intent (label only — does NOT decide role on its own) ──────────────

/**
 * Canonical search intents. Used for documentation and as a label type
 * downstream (JSON output annotation). The role classifier does NOT consume
 * intent — role is decided by the regex priority order in
 * `classifyKeywordToRole`. Intent ↔ role mapping (informational only) :
 *
 *   transactionnelle           → R2_PRODUCT
 *   investigation_commerciale  → R6_GUIDE_ACHAT
 *   diagnostique               → R5_DIAGNOSTIC
 *   navigationnelle            → R1_ROUTER / R7_BRAND / R8_VEHICLE
 *   informationnelle           → R3_CONSEILS / R4_REFERENCE / default
 */
export const SearchIntentSchema = z.enum([
  "transactionnelle",
  "informationnelle",
  "navigationnelle",
  "diagnostique",
  "investigation_commerciale",
]);
export type SearchIntent = z.infer<typeof SearchIntentSchema>;

// ── Triggers (PRIVATE — do not export from index.ts) ─────────────────────────

/**
 * Per-role keyword trigger regex.
 *
 * Coverage : web-routable roles only (a user keyword can land here).
 *
 * Excluded by design :
 * - `AGENTIC_ENGINE` / `FOUNDATION` (non-writing per ADR-037)
 * - `R3_GUIDE` (deprecated orphan — see canonical.ts:12)
 * - `R9_GOVERNANCE` (deprecated, G* series)
 *
 * Evaluation order : see `orderedRoles` in `classifyKeywordToRole`.
 *
 * **R6_GUIDE_ACHAT brand list** : the OEM/aftermarket brand alternation
 * (purflux | mann-filter | bosch | …) is replicated from the historical inline
 * pattern at `scripts/seo/build-keyword-clusters.ts` l171 (snapshot 2026-05-05)
 * — conservative migration to preserve "filtre huile bosch" → R6 capture. To
 * externalise into `__seo_r6_brand_dictionary` table in a follow-up PR ; see
 * `feedback_deprecate_before_rename_before_drop.md`.
 */
const ROLE_KEYWORD_TRIGGERS: Readonly<Partial<Record<RoleId, RegExp>>> = {
  [RoleId.R0_HOME]: /(?:^|\s)(accueil|home|automecanik)/i,
  [RoleId.R1_ROUTER]:
    /(?:^|\s)(compatibilite|compatible|gamme|vehicule|voiture|auto|modele|pour\s+(?:ma|mon|une|un|le|la)?\s*(?:voiture|vehicule)|selon\s+(?:modele|vehicule)|par\s+(?:modele|vehicule))/i,
  [RoleId.R2_PRODUCT]:
    /(?:^|\s)(acheter|achat|prix|tarif|pas\s*cher|commander|livraison|en\s*stock)/i,
  [RoleId.R3_CONSEILS]:
    /(?:^|\s)(quand\s+changer|quand\s+remplacer|entretien|remplacement|duree\s+de\s+vie|frequence|comment\s+remplacer|comment\s+changer|epaisseur\s+mini|usure)/i,
  [RoleId.R4_REFERENCE]:
    /(?:^|\s)(definition|c'est\s+quoi|qu'est|role\s|fonction\s|compose|glossaire)/i,
  [RoleId.R5_DIAGNOSTIC]:
    /(?:^|\s)(symptome|bruit|vibration|voyant|panne|probleme|claquement|sifflement|diagnostic)/i,
  [RoleId.R6_GUIDE_ACHAT]:
    /(?:^|\s)(versus|(?<!\w)vs(?!\w)|avis|review|reviews|teste|tests?\b|oem|adaptable|equivalen|alternatif|top\s*\d+|classement|ranking|rapport\s+qualite|prix.?performance|comment\s+choisir|guide|meilleur|comparatif|quel\s|quelle\s|critere|qualite|budget|purflux|mann[\s-]?filter|bosch|mahle|hengst|knecht|filtron|champion|wix|donaldson|fleetguard|meyle|febi[\s-]?bilstein|brembo|trw|ate\b|valeo|luk\b|sachs|nk\b|blue\s*print|japanparts|ashika|nipparts|herth|topran|swag|mapco|ridex|stark|metzger|optimal|skf\b|snr\b|ina\b|fag\b|gates\b|dayco|contitech|corteco|elring|ajusa|glaser|goetze|kolbenschmidt|nural|glyco)/i,
  [RoleId.R6_SUPPORT]:
    /(?:^|\s)(sav|service\s+apres\s*vente|garantie|retour|remboursement|reclamation)/i,
  [RoleId.R7_BRAND]: /(?:^|\s)(marque|constructeur)/i,
  [RoleId.R8_VEHICLE]: /(?:^|\s)(fiche\s+vehicule|generation|motorisation)/i,
};

// ── Public surface ───────────────────────────────────────────────────────────

/**
 * Classification result returned by `classifyKeywordToRole`.
 *
 * - `role`     : branded canonical role (compile-time guarantee of validity)
 * - `matched`  : `"regex"` when a trigger fired, `"default-router"` when the
 *                keyword fell through to the R1_ROUTER default
 */
export type KeywordRoleClassification = {
  role: CanonicalRoleId;
  matched: "regex" | "default-router";
};

/**
 * Single canonical entry point — keyword → role classification.
 *
 * Normalisation : NFD decomposition then strips combining diacritics
 * (`[\u0300-\u036f]`) so "frêin" / "frein" / "FREIN" all classify identically.
 *
 * Priority order (canon explicit) :
 *   1. R2_PRODUCT       — transactional intent overrides EVERYTHING
 *   2. R5 / R3 / R6_*   — exclusive semantic specificity
 *   3. R4               — encyclopedic
 *   4. R1 / R7 / R8 / R0 — navigational / hub
 *
 * Default : R1_ROUTER for generic gamme keywords (e.g. "filtre a huile").
 */
export function classifyKeywordToRole(
  rawKeyword: string,
): KeywordRoleClassification {
  const normalized = rawKeyword
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const orderedRoles = [
    RoleId.R2_PRODUCT,
    RoleId.R5_DIAGNOSTIC,
    RoleId.R3_CONSEILS,
    RoleId.R6_SUPPORT,
    RoleId.R6_GUIDE_ACHAT,
    RoleId.R4_REFERENCE,
    RoleId.R1_ROUTER,
    RoleId.R7_BRAND,
    RoleId.R8_VEHICLE,
    RoleId.R0_HOME,
  ] as const;

  for (const role of orderedRoles) {
    const trigger = ROLE_KEYWORD_TRIGGERS[role];
    if (trigger && trigger.test(normalized)) {
      return { role: assertCanonicalRoleStrict(role), matched: "regex" };
    }
  }

  return {
    role: assertCanonicalRoleStrict(RoleId.R1_ROUTER),
    matched: "default-router",
  };
}
