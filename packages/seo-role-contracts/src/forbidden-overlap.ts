/**
 * Per-role forbidden vocabulary — canon SoT for cross-role pollution detection.
 *
 * **PR-G migration** (ADR-046 § L1.5 CONTRACTS + ADR-047 — vault PR #183) :
 * canon **déplacé** depuis `@repo/seo-roles/src/forbidden-overlap.ts` vers
 * `@repo/seo-role-contracts/src/forbidden-overlap.ts`. `@repo/seo-roles` ne
 * garde qu'un re-export shim deprecated pour transition douce
 * (memory `feedback_deprecate_before_rename_before_drop`).
 *
 * Une PR follow-up retirera le shim après migration de tous les consumers
 * (alors bump major `seo-roles` 1.0.0).
 *
 * A term in `getForbiddenOverlap(role)` MUST NOT appear in role-injectable
 * surfaces (page content, H2 headings, micro-phrases, include_terms). It
 * signals that the content has drifted into another role's territory :
 *
 * - `bruit`, `voyant`, `panne` in R3_CONSEILS → diagnostic content (belongs to R5)
 * - `prix`, `acheter`, `livraison` in R4_REFERENCE → transactional (belongs to R2)
 * - `démontage`, `étapes de remplacement` in R6_GUIDE_ACHAT → procedural (belongs to R3)
 *
 * Mirror of historical `FORBIDDEN_OVERLAP` map in
 * `scripts/seo/build-keyword-clusters.ts:377-515`. The script becomes a
 * consumer of this canon. This module is the SoT.
 *
 * Matching strategy is locale-aware and provided by `text-normalize.ts`
 * (re-exported from `@repo/seo-roles`) — single tokens stem-match,
 * multi-word terms phrase-match. See `runCanonGate` in
 * `ConseilEnricherService` and the DB trigger `fn_skp_canon_check`
 * (exported via `scripts/seo/export-canon-forbidden.ts`).
 */

import { RoleId } from "@repo/seo-roles";

const FORBIDDEN_TERMS: Readonly<Record<RoleId, readonly string[]>> = {
  [RoleId.R0_HOME]: Object.freeze([] as string[]),

  [RoleId.R1_ROUTER]: Object.freeze([
    // Diagnostic / R5
    "bruit", "use", "casse", "probleme", "symptome", "panne", "defaillance",
    "vibration", "claquement",
    // Editorial / R3, R4
    "quand", "pourquoi", "comment diagnostiquer",
    "definition", "qu'est-ce que", "compose de", "glossaire",
    "demontage", "remontage", "etapes de remplacement",
    // Buying guide / R6
    "guide d'achat",
    // Transactional / R2
    "prix", "euro", "en stock", "livraison", "ajouter au panier",
  ]),

  [RoleId.R2_PRODUCT]: Object.freeze([] as string[]),

  [RoleId.R3_CONSEILS]: Object.freeze([
    // Routing / R1
    "selectionnez votre vehicule", "filtrer par", "tous les vehicules compatibles",
    // Reference / R4
    "definition", "qu'est-ce que", "compose de", "au sens strict", "glossaire",
    // Diagnostic / R5
    "diagnostiquer", "bruit anormal", "code dtc", "code obd",
    // Buying guide / R6
    "guide d'achat",
    // Transactional / R2
    "commander", "ajouter au panier", "prix", "euro", "en stock", "livraison",
    "promotion",
  ]),

  [RoleId.R4_REFERENCE]: Object.freeze([
    // Transactional / R2
    "prix", "euro", "acheter", "commander", "ajouter au panier", "livraison",
    "en stock", "promotion",
    // Routing / R1
    "selectionnez votre vehicule", "filtrer par", "tous les vehicules compatibles",
    // Procedural / R3
    "demontage", "remontage", "etapes de remplacement",
    // Diagnostic / R5
    "symptome", "bruit anormal", "panne", "diagnostic",
  ]),

  [RoleId.R5_DIAGNOSTIC]: Object.freeze([
    // Transactional / R2
    "prix", "euro", "acheter", "commander", "ajouter au panier", "livraison",
    "en stock", "promotion",
    // Buying guide / R6
    "guide d'achat",
    // Reference / R4
    "definition", "compose de", "glossaire",
    // Routing / R1
    "selectionnez votre vehicule",
  ]),

  [RoleId.R6_GUIDE_ACHAT]: Object.freeze([
    // Routing / R1
    "selectionnez votre vehicule", "filtrer par", "tous les vehicules compatibles",
    // Procedural / R3
    "demontage", "remontage", "etapes de remplacement", "couple de serrage",
    // Diagnostic / R5
    "symptome", "bruit anormal", "panne", "diagnostic", "code dtc", "code obd",
    // Reference / R4
    "definition", "qu'est-ce que", "compose de", "glossaire",
    // Transactional / R2 (R6 is investigation_commerciale, not transactional)
    "ajouter au panier", "commander", "en stock", "livraison", "promotion",
  ]),

  [RoleId.R6_SUPPORT]: Object.freeze([
    "prix", "euro", "acheter", "commander", "ajouter au panier", "promotion",
    "selectionnez votre vehicule", "filtrer par",
  ]),

  [RoleId.R7_BRAND]: Object.freeze([
    "prix", "euro", "acheter", "commander", "ajouter au panier", "promotion",
    "demontage", "remontage", "etapes de remplacement",
    "symptome", "bruit anormal", "panne",
  ]),

  [RoleId.R8_VEHICLE]: Object.freeze([
    "demontage", "remontage", "etapes de remplacement", "couple de serrage",
    "definition", "qu'est-ce que", "compose de", "glossaire",
  ]),

  // Deprecated output roles — empty (no consumer should write to these).
  [RoleId.R3_GUIDE]: Object.freeze([] as string[]),
  [RoleId.R9_GOVERNANCE]: Object.freeze([] as string[]),
  [RoleId.AGENTIC_ENGINE]: Object.freeze([] as string[]),
  [RoleId.FOUNDATION]: Object.freeze([] as string[]),
};

/**
 * Returns the canonical forbidden terms for a role.
 *
 * Each term is normalised to NFD-stripped lowercase form (no accents, lowercase)
 * — call sites compare against `normalizeSeoText(content)` or
 * `tokenizeAndStem(content)` from `@repo/seo-roles` for stem-aware matching.
 */
export function getForbiddenOverlap(role: RoleId): readonly string[] {
  return FORBIDDEN_TERMS[role] ?? [];
}
