/**
 * V-Level invariants — single, machine-readable reference for the `__seo_keywords.v_level`
 * classification rules (the MARKETING ranking of vehicles by FR Google demand).
 *
 * This module is **data, not an engine**. It does NOT compute v_level — it states the
 * invariants ONCE so the two existing calculators (`gamme-vlevel.service.ts` admin recalc,
 * `scripts/insert-missing-keywords.ts` CLI import) + the conformance tests can reference a
 * single authority instead of each encoding its own (divergent) reading. Convergence of the
 * calculators onto these invariants is a separate, owner-gated step (plan G2).
 *
 * ⚠️ NE PAS CONFONDRE avec deux autres systèmes « level » :
 *   - `__cross_gamme_car_new.cgc_level` (1/2/3/5) = maillage/placement page PUBLIC (legacy).
 *   - `seo-generator` `L1–L5` = budget tokens de génération de contenu.
 *   Interdiction canonique : ne jamais mapper `CGC_LEVEL n → Vn`.
 *
 * @see audit/levels-doctrine-cgc-vs-vlevel-2026-06-04.md (doctrine de référence)
 * @see .spec/features/g-v-classification.md (spec v5.0, à aligner sur l'union V5 — owner)
 * @see governance-vault/ledger/rules/rules-seo-vlevel.md (canon — actuellement stale v3.0)
 */

/** Les 6 niveaux V + l'absence de niveau (NULL). */
export const V_LEVEL_IDS = ["V1", "V2", "V3", "V4", "V5", "V6"] as const;
export type VLevelId = (typeof V_LEVEL_IDS)[number];

/**
 * Cap nommé du nombre de V2 par gamme (tue la magic constant « 10 » dupliquée dans les
 * deux calculateurs). Toute lecture du cap DOIT passer par cette constante.
 */
export const VLEVEL_V2_CAP = 10 as const;

/**
 * Clé de groupement des keywords véhicule pour l'élection V3/V4.
 * `[modèle + énergie]` — l'énergie est IGNORÉE si la gamme est universelle.
 * Les deux côtés (groupe V3 et dedup V2) DOIVENT utiliser la même casse (lowercase).
 */
export const V_GROUP_KEY = {
  fields: ["model", "energy"] as const,
  ignoreEnergyWhenGammeUniverselle: true,
  caseInsensitive: true,
} as const;

/**
 * Clé de groupe/dedup canonique `[modèle(+énergie)]` — lowercase, fallbacks `_no_model` /
 * `unknown`, énergie ignorée si gamme universelle. À utiliser pour le groupement V3 ET la
 * dedup V2 d'un MÊME calculateur, afin qu'ils ne puissent plus diverger en casse.
 *
 * ⚠️ Sémantique `energy || 'unknown'` (null == 'unknown'). Le calculateur d'import CLI
 * (`scripts/insert-missing-keywords.ts`) utilise l'énergie BRUTE (null ≠ 'unknown') et la
 * donnée live contient les deux → le brancher ici serait DATA-AFFECTING (fusion de groupes,
 * change l'élection V3/V4). C'est donc différé à G3 (dry-run before/after). En G2 ce helper
 * n'est câblé QUE dans le service admin (`gamme-vlevel.service.ts`), où il est neutre.
 */
export function vLevelGroupKey(
  model: string | null | undefined,
  energy: string | null | undefined,
  opts?: { gammeUniverselle?: boolean },
): string {
  const m = (model ?? "").toLowerCase() || "_no_model";
  if (opts?.gammeUniverselle) return m;
  const e = (energy ?? "").toLowerCase() || "unknown";
  return `${m}|${e}`;
}

/**
 * Définition de chaque niveau (intention owner figée 2026-06-05).
 * `persisted` = présent en DB aujourd'hui ; `built` = produit par le pipeline aujourd'hui.
 */
export interface VLevelInvariant {
  readonly id: VLevelId | "NULL";
  readonly meaning: string;
  readonly built: boolean;
}

export const V_LEVEL_INVARIANTS: readonly VLevelInvariant[] = [
  {
    id: "V1",
    meaning:
      "Star multi-gammes : véhicule (type_id) qui est V2 dans beaucoup de gammes. À CONSTRUIRE (0 aujourd'hui).",
    built: false,
  },
  {
    id: "V2",
    meaning: `Top ${VLEVEL_V2_CAP} des champions V3 de la gamme (dedup [modèle+énergie]). Les stars marketing.`,
    built: true,
  },
  {
    id: "V3",
    meaning:
      "Champion #1 du groupe [modèle+énergie] (volume DESC, tie = keyword le plus court). Volume 0 autorisé.",
    built: true,
  },
  {
    id: "V4",
    meaning: "Reste du groupe (non-champion). Volume 0 autorisé.",
    built: true,
  },
  {
    id: "V5",
    meaning:
      "Famille NON cherchée du véhicule = SIBLINGS + ENFANTS (union, owner 2026-06-05). Précédence : niveau cherché > V5 ; 1 type_id = 1 seul niveau.",
    built: true,
  },
  {
    id: "V6",
    meaning:
      "Orphelin : type_id absent des recherches Google (aucune gamme). À CONSTRUIRE (0 aujourd'hui).",
    built: false,
  },
  {
    id: "NULL",
    meaning:
      "Pas un véhicule précis : marque, générique, ou véhicule sans motorisation. Reste en base sans niveau.",
    built: true,
  },
] as const;

/**
 * Règle de propagation `propagate_vlevel_per_typeid` (fonction DB, versionnée
 * 2026-06-05) : pour chaque type_id, REMPLIT uniquement les v_level NULL avec le meilleur
 * niveau du véhicule (V2>V3>V4>V5) et PRÉSERVE tout niveau déjà assigné. Non destructif.
 */
export const V_PROPAGATE = {
  fillsOnlyNull: true,
  preservesAssigned: true,
  priorityOrder: ["V2", "V3", "V4", "V5"] as const,
} as const;

/**
 * Écarts CONNUS entre l'intention owner (ci-dessus) et l'état actuel du code/DB.
 * Chacun est exposé comme test `todo` nommé (voir __tests__/vlevel-invariants.test.ts) :
 * visible et traçable, sans casser la CI. Résolution = owner-gated (plan G0–G4).
 */
export interface VLevelKnownGap {
  readonly id: string;
  readonly description: string;
  readonly gate: "G0" | "G1" | "G2" | "G3" | "G4";
}

export const V_LEVEL_KNOWN_GAPS: readonly VLevelKnownGap[] = [
  {
    id: "v5-union-not-implemented",
    description:
      "V5 doit être l'UNION siblings+enfants ; le script ne fait que les frères, le service que les enfants. À converger.",
    gate: "G2",
  },
  {
    id: "v5-data-incomplete-and-root",
    description:
      "Données V5 incomplètes (manque les déclinations de l'union) + 268/513 type_ids V5 sur modèles root (modele_parent=0). Recalc owner-gated, before/after.",
    gate: "G3",
  },
  {
    id: "eligibility-gate-divergent",
    description:
      "Gate d'éligibilité divergent : service=MOTOR_PATTERN regex vs script=type==='vehicle'. Unifier (décision owner).",
    gate: "G1",
  },
  {
    id: "v2-dedup-case-mismatch-and-script-energy-normalization",
    description:
      "Service side is neutralized via shared lowercase helper (vLevelGroupKey). CLI script still uses raw energy; live data has NULL and 'unknown', so switching it to the canonical helper is data-affecting and deferred to G3 with before/after proof.",
    gate: "G3",
  },
  {
    id: "count-vehicles-no-gamme-absent",
    description:
      "RPC count_vehicles_no_gamme (V6) appelée par le script mais ABSENTE de la DB → fallback. Créer la fn ou retirer l'appel mort.",
    gate: "G1",
  },
  {
    id: "score-seo-half-migrated",
    description:
      "score_seo : formule v3 abandonnée mais colonne conservée (peuplée au volume brut). Figer-déprécié ou rebrancher — jamais DROP.",
    gate: "G1",
  },
] as const;

/**
 * Snapshot DB de référence (forcing function — voir le test associé).
 * Capturé sur `cxpojprgwgubzjyqzmoq` le 2026-06-05. À METTRE À JOUR après tout recalc
 * (avec preuve before/after), comme le pattern `canon-fixture.test.ts`.
 */
export const VLEVEL_DB_BASELINE_2026_06_05 = {
  capturedAt: "2026-06-05",
  distribution: { V1: 0, V2: 93, V3: 330, V4: 7372, V5: 1201, V6: 0, NULL: 1348 },
  v5: { distinctTypeIds: 513, onRootModels: 268, joinableRows: 1046 },
} as const;
