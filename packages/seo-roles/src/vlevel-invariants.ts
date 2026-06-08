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
 * Comparateur déterministe canonique des keywords/champions pour l'élection V-Level.
 * Ordre TOTAL : volume DESC → longueur keyword ASC → keyword ASC (lexicographique).
 *
 * Tue le non-déterminisme du tri par volume seul : aux paliers de volume ex-aequo (fréquents —
 * beaucoup de keywords partagent le même volume), un tri par volume seul est INSTABLE, donc la
 * composition du tier V2 (top-{@link VLEVEL_V2_CAP}) et le choix du champion in-group ne sont
 * plus reproductibles d'un recalc à l'autre. Le 3ᵉ critère (keyword ASC) garantit un ordre total
 * stable. À utiliser À LA FOIS pour :
 *   - l'élection du champion IN-GROUP (V3) : le keyword le plus court (puis ASC) du groupe ;
 *   - le cut V2 = top-N des champions : même tie-break, donc composition V2 reproductible.
 *
 * Les deux calculateurs (`gamme-vlevel.service` admin recalc + `scripts/seo/vlevel-v3-pipeline`
 * reelection-pack) DOIVENT référencer ce comparateur pour rester des miroirs l'un de l'autre.
 * Changement de comportement = uniquement aux ex-aequo (avant : ordre d'insertion arbitraire) ;
 * il NE déplace AUCUN champion entre volumes distincts. Owner-gated côté DATA (un recalc reste
 * une action explicite ; ce comparateur seul ne mute rien).
 */
export function compareV3Champions(
  a: { volume?: number | null; keyword?: string | null },
  b: { volume?: number | null; keyword?: string | null },
): number {
  const va = a.volume || 0;
  const vb = b.volume || 0;
  if (vb !== va) return vb - va; // volume DESC
  const ka = a.keyword || "";
  const kb = b.keyword || "";
  if (ka.length !== kb.length) return ka.length - kb.length; // longueur ASC (keyword le plus court)
  return ka < kb ? -1 : ka > kb ? 1 : 0; // keyword ASC → ordre total déterministe
}

/**
 * Termes de gamme (pièce) pour l'ÉLIGIBILITÉ d'élection V-Level, par `pg_id`.
 *
 * Un keyword n'est éligible à l'élection V2/V3/V4 d'une gamme QUE s'il mentionne le terme de SA
 * gamme. C'est la garde anti **re-contamination** cross-gamme : sans elle, l'élection groupe par
 * [modèle+énergie] sans regarder la pièce, donc un keyword « disque de frein clio 3 » présent dans
 * la gamme plaquette (pollution) pouvait être élu champion plaquette (et inversement).
 *
 * Source = mêmes termes que le pipeline de décision (`scripts/seo/vlevel-v3-pipeline.ts` GAMME_PARTS),
 * hoistés ici comme **SoT partagée unique** (le service admin `gamme-vlevel.service` ET le pipeline
 * référencent cette map — plus de duplication ni de dérive).
 *
 * Le couple frein (disque/plaquette/cable) partage « de frein » → seul le 1er terme
 * (disque / plaquette / cable) discrimine. `câble` géré accent-insensible.
 *
 * EXTENSIBLE & SÛR : une gamme NON mappée ⇒ {@link isKeywordEligibleForGamme} renvoie `true`
 * (aucun filtre = comportement actuel strictement préservé). Ajouter une entrée = activer la garde.
 */
export const GAMME_PART_TERMS: Readonly<Record<number, RegExp>> = {
  82: /disque/i, // disque-de-frein
  402: /plaquette/i, // plaquette-de-frein
  124: /cable|câble/i, // cable-de-frein-a-main
};

/**
 * Un keyword est-il éligible à l'élection V-Level de la gamme `pgId` ?
 *  - gamme non mappée (pas de terme) ⇒ `true` (aucun filtre, comportement actuel).
 *  - gamme mappée ⇒ `true` ssi le keyword mentionne le terme de la gamme.
 *
 * Pure & déterministe. NE CALCULE PAS v_level — décide seulement de l'éligibilité (anti
 * re-contamination). Utilisée par `gamme-vlevel.service` (élection) et le pipeline de décision.
 */
export function isKeywordEligibleForGamme(keyword: string, pgId: number): boolean {
  const term = GAMME_PART_TERMS[pgId];
  if (!term) return true;
  return term.test(keyword || "");
}

/**
 * Promotion V2 (figé 2026-06-08, owner « on commence toujours par V3 »).
 *
 * INVARIANT DUR `V2 ⟹ V3` : on ne peut être promu V2 que si on est DÉJÀ un champion V3
 * (champion #1 de son groupe [modèle+énergie]). Impossible d'être V2 sans être champion —
 * V2 est un SUR-CLASSEMENT du socle V3, jamais une entrée directe.
 *
 * `cap` = PLAFOND ({@link VLEVEL_V2_CAP}), PAS un quota à remplir. « Meilleurs champions »
 * ≠ « top-N par volume brut » : sans affinage, le cap se remplit avec des entrées sans véhicule
 * (type_id NULL), à énergie incohérente (mot-clé « gasoil » → véhicule essence) ou à volume-plancher.
 * Défaut observé sur filtre-à-carburant le 2026-06-08 (Duster essence 2025 promu V2). Les 2 premiers
 * garde-fous sont OBJECTIFS (enforced par {@link validateV2Promotion}) ; `demand_floor`/`real_parc`
 * sont des préférences à seuils OWNER-TUNABLES appliquées au recalc (before/after) — volontairement
 * PAS codées en dur ici (pas de magic constant, pas de seuil inventé).
 */
export const VLEVEL_V2_PROMOTION = {
  requires: "V3_champion",
  cap: VLEVEL_V2_CAP,
  affinageGuards: ["resolved_vehicle", "energy_coherent", "demand_floor", "real_parc"],
} as const;

/** Classe d'énergie normalisée (diesel / essence / other) pour la cohérence mot-clé ↔ véhicule. */
function energyClass(s: string): "diesel" | "essence" | "other" {
  const t = s.toLowerCase();
  if (/diesel|gasoil|\bhdi\b|\bdci\b|\btdi\b|\bcrdi\b|bluehdi|\bcdti\b|\btdci\b/.test(t)) return "diesel";
  if (/essence|petrol|\btce\b|\bvti\b|\bthp\b|gpl|ethanol|éthanol|flex|gnc|cng|hybrid|electr/.test(t))
    return "essence";
  return "other";
}

/** Énergie mot-clé et véhicule compatibles ? `other`/inconnu ⇒ true (aucun faux rejet). */
function energyCompatible(keywordEnergy: string, vehicleEnergy: string): boolean {
  const a = energyClass(keywordEnergy);
  const b = energyClass(vehicleEnergy);
  if (a === "other" || b === "other") return true;
  return a === b;
}

/** Candidat à la promotion V2 (champs minimaux pour valider les invariants objectifs). */
export interface V2PromotionCandidate {
  /** Champion #1 de son groupe [modèle+énergie] (donc V3-éligible) ? */
  readonly isChampion: boolean;
  /** Véhicule résolu : type_id non NULL. */
  readonly typeId?: string | number | null;
  /** Énergie portée par le mot-clé (ex. « gasoil » ⇒ diesel). */
  readonly keywordEnergy?: string | null;
  /** Énergie réelle du véhicule (`auto_type.type_fuel`). */
  readonly vehicleEnergy?: string | null;
}

export type V2Violation = "not_a_champion" | "unresolved_vehicle" | "energy_mismatch";

/**
 * Valide qu'un candidat PEUT être promu V2. Pure & déterministe. N'enforce QUE les invariants
 * OBJECTIFS (sans seuil de jugement) :
 *   - `not_a_champion`     : viole `V2 ⟹ V3` (pas champion).
 *   - `unresolved_vehicle` : type_id NULL → pas un véhicule complet.
 *   - `energy_mismatch`    : énergies connues incohérentes (mot-clé gasoil ↔ véhicule essence).
 * Les garde-fous `demand_floor`/`real_parc` ({@link VLEVEL_V2_PROMOTION}) restent owner-tunables
 * (appliqués au recalc), donc hors de cette fonction. NE MUTE RIEN.
 */
export function validateV2Promotion(c: V2PromotionCandidate): {
  ok: boolean;
  violations: V2Violation[];
} {
  const violations: V2Violation[] = [];
  if (!c.isChampion) violations.push("not_a_champion");
  if (c.typeId == null || String(c.typeId).trim() === "") violations.push("unresolved_vehicle");
  const ke = (c.keywordEnergy ?? "").trim();
  const ve = (c.vehicleEnergy ?? "").trim();
  if (ke && ve && !energyCompatible(ke, ve)) violations.push("energy_mismatch");
  return { ok: violations.length === 0, violations };
}

/**
 * Classement V-Level (figé 2026-06-08, owner-validé).
 *
 * OBJECTIF = **top-vente** : classer les véhicules qui RAPPORTENT (valeur commerciale).
 * MESURE = **demande de recherche** (KW + Google Trends + web search), utilisée comme PROXY du
 * top-vente PARCE QUE les tables de vente ne sont pas exploitables (commandes par-pièce
 * `___xtr_order_line.orl_art_ref`, pas par-véhicule, + ~1,7k = trop minces → aucune attribution
 * vente→véhicule). Corroboré par le parc roulant FR (web search 2026-06 : Clio III/207/206 en tête).
 *   - `kw_search_volume` = vivier + 1er tri (`__seo_keywords.volume`, via {@link compareV3Champions}).
 *   - `google_trends` + `web_search` = AFFINAGE : départagent les ex-aequo KW (ex. 206 vs 207,
 *     tous deux vol=500, mais 207 > 206 au parc réel), détectent le déclin, corroborent la réalité.
 */
export const VLEVEL_RANKING_SIGNALS = {
  goal: "top_vente",
  measurePrimary: "kw_search_volume",
  measureRefine: ["google_trends", "web_search"],
  notUsable: "sales_tables",
} as const;

/**
 * Dispatch des niveaux V-Level sur les pages publiques (figé 2026-06-08, owner-validé).
 * Les véhicules V apparaissent sur les pages **constructeur** (`/constructeurs/...`) + produit.
 */
export const VLEVEL_PAGE_DISPATCH = {
  V3: "fiche véhicule R8 /constructeurs/{marque}-{id}/{modele}-{id}/{type_id}.html + produit R2 /pieces/{gamme}/{marque}/{modele}/{type}.html",
  V2: "top-10 véhicules de la gamme — mis en avant sur la page gamme (R1)",
  V1: "modèle star — en tête de la page marque /constructeurs/{marque}-{id}.html + cible marketing",
} as const;

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
      "Star multi-gammes au niveau MODÈLE : un modèle qui est V2 dans beaucoup de gammes (chaque gamme " +
      "résout sa PROPRE variante-véhicule, donc V1 vit au niveau modèle, pas type_id). Classé TOP-VENTE " +
      "mesuré via la recherche ({@link VLEVEL_RANKING_SIGNALS}). Dispatché en tête de la page marque " +
      "/constructeurs/{marque}.html + marketing ({@link VLEVEL_PAGE_DISPATCH}). Projection cross-gammes " +
      "(pas un v_level stocké par ligne). À CONSTRUIRE (0 aujourd'hui).",
    built: false,
  },
  {
    id: "V2",
    meaning: `Promotion ÉLITE des champions V3 de la gamme — V2 ⟹ V3 : impossible d'être V2 sans être champion (validateV2Promotion). Plafonné à ${VLEVEL_V2_CAP} (PLAFOND, pas quota). Sélection = meilleurs champions par DEMANDE DE RECHERCHE (VLEVEL_RANKING_SIGNALS) + affinage top-vente (VLEVEL_V2_PROMOTION : véhicule résolu, énergie cohérente, parc réel) — PAS un top-N volume brut.`,
    built: true,
  },
  {
    id: "V3",
    meaning:
      "SOCLE de l'élection — on commence TOUJOURS par V3. Champion #1 du groupe [modèle+énergie] = 1 VÉHICULE COMPLET (marque+modèle+motorisation+ch+années). " +
      "Dispatché sur sa fiche véhicule R8 /constructeurs/{marque}/{modele}/{type}.html + ses pages produit " +
      "R2 /pieces/{gamme}/{marque}/{modele}/{type}.html ({@link VLEVEL_PAGE_DISPATCH}). Tri canonique " +
      "compareV3Champions (volume DESC → longueur keyword ASC → keyword ASC). Volume 0 autorisé.",
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
  {
    id: "v2-promotion-not-affined",
    description:
      "Le cut V2 = top-N volume brut, sans les garde-fous d'affinage (validateV2Promotion) : il remplit le cap avec des entrées type_id NULL, à énergie incohérente (mot-clé gasoil → véhicule essence) ou à volume-plancher. Observé sur filtre-à-carburant 2026-06-08 (Duster essence 2025 en V2). Câbler validateV2Promotion dans l'élection + recalc owner-gated before/after.",
    gate: "G3",
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
