/**
 * V-Level — règle écrite unique : la décision 192 (25 novembre 2026), définition des V1 à V6.
 *
 * Le V-Level classe les fiches véhicule (type_id) d'une gamme selon la demande observée.
 * Ce module porte la règle une seule fois :
 *
 *   PARTIE A — la décision 192 : ses huit lignes mot pour mot, puis une fonction pure par ligne.
 *     Chaque donnée d'entrée est un PARAMÈTRE fourni par l'appelant. Aucune fonction ne lit la
 *     base, n'écrit, ni ne remplace une donnée absente par un substitut (volume, rang, longueur
 *     du texte). Une entrée manquante ou contradictoire lève VLevelInputError ; un cas que la
 *     décision ne tranche pas ressort comme résultat explicite (undecided, human_arbitration),
 *     jamais comme un choix du code.
 *   PARTIE B — remplacé par la décision 192 : l'ancienne règle (champion par volume, plafond de
 *     10 V2 par gamme), réduite à ce que les calculateurs non raccordés appellent encore.
 *
 * État : aucun calculateur n'est raccordé à la partie A, faute de données d'entrée
 * (voir V_LEVEL_KNOWN_GAPS). La décision 192 précise la décision 46 ; la décision 159 reste
 * au-dessus (une fiche se vérifie face au constructeur ; la base n'est pas une source de vérité).
 *
 * Ne pas confondre avec __cross_gamme_car_new.cgc_level (maillage des pages publiques) ni avec
 * les niveaux L1–L5 du générateur de contenu. Ne jamais faire correspondre cgc_level n et Vn.
 *
 * @see .spec/features/g-v-classification.md (mêmes huit lignes, mot pour mot)
 */

// ═════════════════════════════════════════════════════════════════════════════════════════════
// PARTIE A — RÈGLE EN VIGUEUR : DÉCISION 192
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Les six niveaux. */
export const V_LEVEL_IDS = ["V1", "V2", "V3", "V4", "V5", "V6"] as const;
export type VLevelId = (typeof V_LEVEL_IDS)[number];

/** État de la ligne 22 — un état, pas un niveau. */
export const VLEVEL_STATE_TO_VERIFY = "À vérifier" as const;
/** État de la ligne 26 — un état, pas un niveau. */
export const VLEVEL_STATE_LICENCE_FREE = "Hors V-Level • voiture sans permis" as const;
/** Les deux états hors niveaux. */
export const V_LEVEL_STATES = [VLEVEL_STATE_TO_VERIFY, VLEVEL_STATE_LICENCE_FREE] as const;
export type VLevelState = (typeof V_LEVEL_STATES)[number];

/** Une ligne de la décision 192, telle qu'elle est écrite. */
export interface VLevelDecision192Line {
  /** Numéro de ligne dans le classeur de la décision. */
  readonly line: number;
  readonly id: VLevelId | "A_VERIFIER" | "SANS_PERMIS";
  readonly label: string;
  /** Périmètre de la ligne. */
  readonly scope: string;
  /** Règle, mot pour mot. Ne pas reformuler : toute modification passe par une nouvelle décision. */
  readonly rule: string;
}

/** Les huit lignes de la décision 192, mot pour mot. */
export const VLEVEL_DECISION_192_LINES: readonly VLevelDecision192Line[] = [
  {
    line: 16,
    id: "V3",
    label: "V3 · premier choix",
    scope: "Une gamme × un modèle × une génération × une énergie",
    rule: "Retenir une seule fiche vérifiée. Priorité à une version identifiée avec la gamme. À précision égale avec la gamme, préférer la version vue dans les deux sources, puis Ads seul, puis Google.fr seul.",
  },
  {
    line: 17,
    id: "V4",
    label: "V4 · autres demandes",
    scope: "Même groupe et même gamme que le V3",
    rule: "Classer chaque autre version recherchée et identifiée par son moteur, sa puissance, son année ou sa période, et son type_id. Plusieurs graphies de la même version renvoient à une seule fiche.",
  },
  {
    line: 18,
    id: "V5",
    label: "V5 · variantes restantes",
    scope: "Une gamme × un modèle × une génération",
    rule: "Dès le premier V3 vérifié, prendre toutes les fiches catalogue affichables et compatibles de cette génération. Retirer les V3 et V4 de la gamme. Le reste reçoit V5, toutes énergies et carrosseries comprises.",
  },
  {
    line: 19,
    id: "V2",
    label: "V2 · choix entre gammes",
    scope: "Un modèle × une génération × une énergie",
    rule: "Chaque gamme ayant validé un V3 donne une voix à son type_id. Le seul type_id en tête devient V2. À égalité, garder le V2 validé s’il est parmi les premiers. Sinon consigner un arbitrage humain.",
  },
  {
    line: 20,
    id: "V6",
    label: "V6 · véhicule sans demande observée",
    scope: "Une fiche catalogue exacte, toutes gammes contrôlées",
    rule: "Attribuer V6 après vérification de toutes les gammes, si aucune demande ni aucun V3, V4 ou V5 ne concerne la fiche. Un V5 dans une seule gamme suffit à l’exclure du V6.",
  },
  {
    line: 21,
    id: "V1",
    label: "V1 · choix marketing",
    scope: "Un modèle et sa génération",
    rule: "L’agent étudie l’intérêt du modèle pour le public et la campagne, documente les indices et remet son avis. Marwane décide du V1.",
  },
  {
    line: 22,
    id: "A_VERIFIER",
    label: "À vérifier",
    scope: "Formulation ambiguë ou recherche incomplète",
    rule: "Garder la formulation, son origine, les fiches possibles et la précision manquante. Reprendre la recherche avant toute élection.",
  },
  {
    line: 26,
    id: "SANS_PERMIS",
    label: "Périmètre · voitures sans permis",
    scope: "Toutes les gammes · agents, simulation et recalcul",
    rule: "Conserver la formulation Ads exacte et sa ligne source. Dès que la version est identifiée comme voiture sans permis, la marquer « Hors V-Level • voiture sans permis », y compris avec une fiche catalogue compatible.",
  },
] as const;

/** Entrée absente, vide ou contradictoire : la fonction refuse de calculer plutôt que de deviner. */
export class VLevelInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VLevelInputError";
  }
}

function requireText(value: string, what: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new VLevelInputError(what + " : valeur absente ou vide");
  }
  return value;
}

function requireUnique(values: readonly string[], what: string): void {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) throw new VLevelInputError(what + " : doublon " + v);
    seen.add(v);
  }
}

// ── Demande observée ─────────────────────────────────────────────────────────────────────────

/** Les deux sources de la demande nommées par la ligne 16. */
export const VLEVEL_DEMAND_SOURCES = ["ads", "google_fr"] as const;
export type VLevelDemandSource = (typeof VLEVEL_DEMAND_SOURCES)[number];

/** Une graphie recherchée, avec son origine. */
export interface VLevelFormulation {
  /** Formulation exacte, telle qu'elle a été relevée. */
  readonly formulation: string;
  readonly source: VLevelDemandSource;
  /** Ligne source du relevé (lignes 22 et 26 : l'origine se conserve). */
  readonly sourceLine: string;
}

/** Une formulation relevée pour une gamme, qualifiée par la recherche en amont. */
export interface VLevelObservation extends VLevelFormulation {
  /** La version est identifiée comme voiture sans permis (ligne 26). */
  readonly licenceFree: boolean;
  /** Fiche catalogue à laquelle la version est identifiée ; null = non identifiée. */
  readonly typeId: string | null;
  /** Fiches possibles quand la formulation est ambiguë (ligne 22). */
  readonly possibleTypeIds: readonly string[];
  /** Précision manquante (ligne 22) ; null quand rien ne manque. */
  readonly missingPrecision: string | null;
}

/** Une version recherchée : une seule fiche, toutes ses graphies (ligne 17, seconde phrase). */
export interface VLevelSearchedVersion {
  readonly typeId: string;
  readonly formulations: readonly VLevelFormulation[];
}

/** Ligne 22 — ce qui est gardé d'une formulation « À vérifier ». */
export interface VLevelToVerifyFormulation extends VLevelFormulation {
  readonly state: typeof VLEVEL_STATE_TO_VERIFY;
  readonly possibleTypeIds: readonly string[];
  readonly missingPrecision: string;
}

/** Ligne 26 — ce qui est gardé d'une formulation de voiture sans permis. */
export interface VLevelLicenceFreeFormulation extends VLevelFormulation {
  readonly state: typeof VLEVEL_STATE_LICENCE_FREE;
  /** Fiche catalogue compatible, si elle existe : elle ne change pas l'état. */
  readonly typeId: string | null;
}

export interface VLevelDemandSorting {
  /** Versions identifiées, une fiche par type_id. */
  readonly versions: readonly VLevelSearchedVersion[];
  readonly toVerify: readonly VLevelToVerifyFormulation[];
  readonly outOfScope: readonly VLevelLicenceFreeFormulation[];
}

/**
 * Trie les formulations relevées d'une gamme (lignes 17, 22 et 26).
 *
 *  - voiture sans permis ⇒ « Hors V-Level • voiture sans permis », formulation et ligne source
 *    conservées, y compris quand une fiche catalogue existe (ligne 26) ;
 *  - non identifiée, ou précision manquante ⇒ « À vérifier », avec la formulation, son origine,
 *    les fiches possibles et la précision manquante (ligne 22) ;
 *  - sinon, plusieurs graphies de la même version renvoient à une seule fiche (ligne 17).
 *
 * La fonction ne détecte ni l'ambiguïté ni le « sans permis » : ce sont des entrées.
 */
export function sortDemandObservations(
  observations: readonly VLevelObservation[],
): VLevelDemandSorting {
  const byTypeId = new Map<string, VLevelFormulation[]>();
  const toVerify: VLevelToVerifyFormulation[] = [];
  const outOfScope: VLevelLicenceFreeFormulation[] = [];
  for (const o of observations) {
    const kept: VLevelFormulation = {
      formulation: requireText(o.formulation, "formulation"),
      source: o.source,
      sourceLine: requireText(o.sourceLine, "ligne source de « " + o.formulation + " »"),
    };
    if (!VLEVEL_DEMAND_SOURCES.includes(o.source)) {
      throw new VLevelInputError("source inconnue pour « " + o.formulation + " »");
    }
    const typeId = o.typeId === null ? null : requireText(o.typeId, "type_id");
    if (o.licenceFree) {
      outOfScope.push({ ...kept, state: VLEVEL_STATE_LICENCE_FREE, typeId });
      continue;
    }
    const missing = (o.missingPrecision ?? "").trim();
    const others = o.possibleTypeIds.filter((p) => p !== typeId);
    if (typeId === null || missing !== "") {
      if (missing === "") {
        throw new VLevelInputError(
          "« " + o.formulation + " » n'est pas identifiée : la précision manquante doit être gardée",
        );
      }
      const possibleTypeIds = [...new Set([...(typeId === null ? [] : [typeId]), ...others])];
      toVerify.push({ ...kept, state: VLEVEL_STATE_TO_VERIFY, possibleTypeIds, missingPrecision: missing });
      continue;
    }
    if (others.length > 0) {
      throw new VLevelInputError(
        "« " + o.formulation + " » a plusieurs fiches possibles : elle est ambiguë, la précision manquante doit être gardée",
      );
    }
    const list = byTypeId.get(typeId);
    if (list) list.push(kept);
    else byTypeId.set(typeId, [kept]);
  }
  const versions = [...byTypeId.entries()].map(([typeId, formulations]) => ({ typeId, formulations }));
  return { versions, toVerify, outOfScope };
}

// ── Ligne 16 — V3 · premier choix ────────────────────────────────────────────────────────────

/** Rang de la source dans la ligne 16 : les deux sources, puis Ads seul, puis Google.fr seul. */
export const V3_SOURCE_TIERS = ["both", "ads_only", "google_fr_only"] as const;
export type V3SourceTier = (typeof V3_SOURCE_TIERS)[number];

export function v3SourceTier(sources: readonly VLevelDemandSource[]): V3SourceTier {
  const ads = sources.includes("ads");
  const googleFr = sources.includes("google_fr");
  if (ads && googleFr) return "both";
  if (ads) return "ads_only";
  if (googleFr) return "google_fr_only";
  throw new VLevelInputError("version sans source de demande");
}

/** Une fiche candidate au V3 d'un groupe gamme × modèle × génération × énergie. */
export interface V3Candidate {
  readonly typeId: string;
  /** Fiche vérifiée (décision 159) — donnée fournie. */
  readonly verified: boolean;
  /** Version identifiée avec la gamme — donnée fournie. */
  readonly identifiedWithGamme: boolean;
  /** Sources où la version a été vue, toutes graphies confondues. */
  readonly sources: readonly VLevelDemandSource[];
}

export type V3Election =
  | {
      readonly outcome: "elected";
      readonly typeId: string;
      readonly identifiedWithGamme: boolean;
      readonly sourceTier: V3SourceTier;
    }
  /** Ligne 22 : la recherche reprend avant toute élection. */
  | { readonly outcome: "suspended"; readonly reason: "research_incomplete" }
  | { readonly outcome: "none"; readonly reason: "no_verified_fiche" }
  /** Égalité que la ligne 16 ne départage pas : aucun critère n'est ajouté par le code. */
  | {
      readonly outcome: "undecided";
      readonly reason: "tie_not_settled_by_decision_192";
      readonly tiedTypeIds: readonly string[];
    };

export interface V3ElectionInput {
  /** Les fiches recherchées d'UN groupe gamme × modèle × génération × énergie. */
  readonly candidates: readonly V3Candidate[];
  /**
   * La recherche est complète pour ce groupe : rien d'« À vérifier » ne le concerne.
   * Quelles formulations « À vérifier » suspendent quelle élection n'est pas précisé par la
   * décision 192 : l'appelant le fournit.
   */
  readonly researchComplete: boolean;
}

/**
 * Ligne 16 — retient au plus une fiche pour le groupe.
 *
 * Seules les fiches vérifiées concourent. Ordre : version identifiée avec la gamme d'abord ;
 * à précision égale avec la gamme, les deux sources, puis Ads seul, puis Google.fr seul.
 * Si plusieurs fiches restent à égalité, le résultat est « undecided » : ni volume, ni rang,
 * ni longueur de texte ne départagent.
 */
export function electV3(input: V3ElectionInput): V3Election {
  requireUnique(
    input.candidates.map((c) => requireText(c.typeId, "type_id")),
    "candidats V3",
  );
  if (!input.researchComplete) return { outcome: "suspended", reason: "research_incomplete" };
  const ranked = input.candidates
    .filter((c) => c.verified)
    .map((c) => {
      const sourceTier = v3SourceTier(c.sources);
      const rank = (c.identifiedWithGamme ? 0 : V3_SOURCE_TIERS.length) + V3_SOURCE_TIERS.indexOf(sourceTier);
      return { candidate: c, sourceTier, rank };
    });
  if (ranked.length === 0) return { outcome: "none", reason: "no_verified_fiche" };
  const best = Math.min(...ranked.map((r) => r.rank));
  const first = ranked.filter((r) => r.rank === best);
  if (first.length > 1) {
    return {
      outcome: "undecided",
      reason: "tie_not_settled_by_decision_192",
      tiedTypeIds: first.map((r) => r.candidate.typeId),
    };
  }
  const winner = first[0];
  return {
    outcome: "elected",
    typeId: winner.candidate.typeId,
    identifiedWithGamme: winner.candidate.identifiedWithGamme,
    sourceTier: winner.sourceTier,
  };
}

// ── Ligne 17 — V4 · autres demandes ──────────────────────────────────────────────────────────

/** Une fiche recherchée d'un groupe, avec les données que les lignes 16, 17 et 26 demandent. */
export interface VLevelGroupFiche extends VLevelSearchedVersion {
  readonly verified: boolean;
  readonly identifiedWithGamme: boolean;
  /** Ligne 17 : moteur de la version ; null = non établi. */
  readonly engine: string | null;
  /** Ligne 17 : puissance ; null = non établie. */
  readonly power: string | null;
  /** Ligne 17 : année ou période ; null = non établie. */
  readonly yearOrPeriod: string | null;
  /** Ligne 26 : la version est identifiée comme voiture sans permis. */
  readonly licenceFree: boolean;
}

export interface VLevelGroupInput {
  /** Les fiches recherchées d'UN groupe gamme × modèle × génération × énergie. */
  readonly fiches: readonly VLevelGroupFiche[];
  /** Voir V3ElectionInput.researchComplete. */
  readonly researchComplete: boolean;
}

export interface VLevelGroupClassification {
  readonly v3: V3Election;
  /** Fiches classées V4 : les autres versions recherchées et identifiées du groupe. */
  readonly v4: readonly string[];
  /** Fiches identifiées mais non classées, parce que le groupe n'a pas de V3 retenu. */
  readonly awaitingV3: readonly string[];
  readonly toVerify: ReadonlyArray<
    VLevelSearchedVersion & {
      readonly state: typeof VLEVEL_STATE_TO_VERIFY;
      readonly missingPrecision: string;
    }
  >;
  readonly outOfScope: ReadonlyArray<
    VLevelSearchedVersion & { readonly state: typeof VLEVEL_STATE_LICENCE_FREE }
  >;
}

/**
 * Lignes 16 et 17 pour un groupe : un V3 au plus, puis chaque autre version recherchée et
 * identifiée par son moteur, sa puissance, son année ou sa période, et son type_id reçoit V4.
 *
 *  - une fiche = un type_id, toutes ses graphies (les doublons de type_id sont refusés) ;
 *  - une voiture sans permis sort du classement avec son état (ligne 26) ;
 *  - une autre version à laquelle il manque le moteur, la puissance ou la période n'est pas
 *    classée V4 : elle est « À vérifier », la précision manquante est nommée (ligne 22) ;
 *  - sans V3 retenu, aucune fiche ne reçoit V4 (le V4 est « même groupe et même gamme que le V3 »).
 */
export function classifyDemandGroup(input: VLevelGroupInput): VLevelGroupClassification {
  requireUnique(
    input.fiches.map((f) => requireText(f.typeId, "type_id")),
    "fiches du groupe",
  );
  const outOfScope: Array<VLevelSearchedVersion & { state: typeof VLEVEL_STATE_LICENCE_FREE }> = [];
  const inScope: VLevelGroupFiche[] = [];
  for (const f of input.fiches) {
    if (f.formulations.length === 0) {
      throw new VLevelInputError("fiche " + f.typeId + " sans formulation recherchée");
    }
    if (f.licenceFree) {
      outOfScope.push({ typeId: f.typeId, formulations: f.formulations, state: VLEVEL_STATE_LICENCE_FREE });
    } else {
      inScope.push(f);
    }
  }
  const v3 = electV3({
    researchComplete: input.researchComplete,
    candidates: inScope.map((f) => ({
      typeId: f.typeId,
      verified: f.verified,
      identifiedWithGamme: f.identifiedWithGamme,
      sources: [...new Set(f.formulations.map((x) => x.source))],
    })),
  });
  const v4: string[] = [];
  const awaitingV3: string[] = [];
  const toVerify: Array<
    VLevelSearchedVersion & { state: typeof VLEVEL_STATE_TO_VERIFY; missingPrecision: string }
  > = [];
  for (const f of inScope) {
    if (v3.outcome === "elected" && v3.typeId === f.typeId) continue;
    const missing: string[] = [];
    if (f.engine === null || f.engine.trim() === "") missing.push("moteur");
    if (f.power === null || f.power.trim() === "") missing.push("puissance");
    if (f.yearOrPeriod === null || f.yearOrPeriod.trim() === "") missing.push("année ou période");
    if (missing.length > 0) {
      toVerify.push({
        typeId: f.typeId,
        formulations: f.formulations,
        state: VLEVEL_STATE_TO_VERIFY,
        missingPrecision: missing.join(", "),
      });
    } else if (v3.outcome === "elected") {
      v4.push(f.typeId);
    } else {
      awaitingV3.push(f.typeId);
    }
  }
  return { v3, v4, awaitingV3, toVerify, outOfScope };
}

// ── Ligne 18 — V5 · variantes restantes ──────────────────────────────────────────────────────

/** Une fiche du catalogue, avec les données que la ligne 18 demande. */
export interface VLevelCatalogueFiche {
  readonly typeId: string;
  /** Clé « un modèle × une génération » — donnée fournie, jamais déduite du nom du modèle. */
  readonly modelGenerationKey: string;
  /** Fiche affichable — donnée fournie. */
  readonly displayable: boolean;
  /** Fiche compatible avec la gamme — donnée fournie. */
  readonly compatibleWithGamme: boolean;
  /** Ligne 26 : voiture sans permis. */
  readonly licenceFree: boolean;
}

export interface V5Input {
  /** La génération traitée (une gamme × un modèle × une génération). */
  readonly modelGenerationKey: string;
  /** Les V3 vérifiés de la gamme dans cette génération, toutes énergies. */
  readonly verifiedV3TypeIds: readonly string[];
  /** Les V4 de la gamme. */
  readonly v4TypeIds: readonly string[];
  /** Les fiches du catalogue. Seules celles de la génération traitée sont prises. */
  readonly catalogue: readonly VLevelCatalogueFiche[];
}

export interface V5Selection {
  /** Faux tant que la gamme n'a aucun V3 vérifié dans cette génération : aucun V5. */
  readonly triggered: boolean;
  readonly v5: readonly string[];
  /** Fiches de la génération retirées parce qu'elles sont V3 ou V4 de la gamme. */
  readonly removedAsV3OrV4: readonly string[];
  readonly notRetained: ReadonlyArray<{
    readonly typeId: string;
    readonly reason: "not_displayable" | "not_compatible";
  }>;
  /** Voitures sans permis de la génération : « Hors V-Level • voiture sans permis ». */
  readonly outOfScope: readonly string[];
}

/**
 * Ligne 18 — dès le premier V3 vérifié, toutes les fiches catalogue affichables et compatibles
 * de la génération, moins les V3 et V4 de la gamme, reçoivent V5.
 *
 * Aucune entrée ne porte l'énergie ni la carrosserie : la fonction ne peut pas filtrer dessus
 * (« toutes énergies et carrosseries comprises »).
 */
export function selectV5(input: V5Input): V5Selection {
  requireText(input.modelGenerationKey, "clé modèle × génération");
  const generation = input.catalogue.filter((f) => f.modelGenerationKey === input.modelGenerationKey);
  requireUnique(
    generation.map((f) => requireText(f.typeId, "type_id")),
    "fiches catalogue de la génération",
  );
  const empty: V5Selection = { triggered: false, v5: [], removedAsV3OrV4: [], notRetained: [], outOfScope: [] };
  if (input.verifiedV3TypeIds.length === 0) return empty;
  const ranked = new Set<string>([...input.verifiedV3TypeIds, ...input.v4TypeIds]);
  const v5: string[] = [];
  const removedAsV3OrV4: string[] = [];
  const notRetained: Array<{ typeId: string; reason: "not_displayable" | "not_compatible" }> = [];
  const outOfScope: string[] = [];
  for (const f of generation) {
    if (f.licenceFree) outOfScope.push(f.typeId);
    else if (!f.displayable) notRetained.push({ typeId: f.typeId, reason: "not_displayable" });
    else if (!f.compatibleWithGamme) notRetained.push({ typeId: f.typeId, reason: "not_compatible" });
    else if (ranked.has(f.typeId)) removedAsV3OrV4.push(f.typeId);
    else v5.push(f.typeId);
  }
  return { triggered: true, v5, removedAsV3OrV4, notRetained, outOfScope };
}

// ── Ligne 19 — V2 · choix entre gammes ───────────────────────────────────────────────────────

/** La voix d'une gamme : le type_id de son V3 validé pour le groupe modèle × génération × énergie. */
export interface V2Vote {
  readonly pgId: number;
  readonly typeId: string;
}

export interface V2TallyLine {
  readonly typeId: string;
  readonly votes: number;
  readonly pgIds: readonly number[];
}

export type V2Election =
  | { readonly outcome: "elected"; readonly typeId: string; readonly tally: readonly V2TallyLine[] }
  /** Égalité, et le V2 validé est parmi les premiers : il est gardé. */
  | {
      readonly outcome: "kept_validated";
      readonly typeId: string;
      readonly tiedTypeIds: readonly string[];
      readonly tally: readonly V2TallyLine[];
    }
  /** Égalité sans V2 validé parmi les premiers : un arbitrage humain est à consigner. */
  | {
      readonly outcome: "human_arbitration";
      readonly tiedTypeIds: readonly string[];
      readonly tally: readonly V2TallyLine[];
    }
  | { readonly outcome: "none"; readonly reason: "no_vote" };

export interface V2ElectionInput {
  /** Une voix par gamme ayant validé un V3 dans le groupe modèle × génération × énergie. */
  readonly votes: readonly V2Vote[];
  /** Le V2 déjà validé du groupe, s'il existe — donnée fournie. */
  readonly validatedV2TypeId: string | null;
}

/**
 * Ligne 19 — le V2 se choisit ENTRE gammes, jamais dans le recalcul d'une seule gamme.
 *
 * Chaque gamme donne une voix (une seconde voix de la même gamme est refusée). Le seul type_id
 * en tête devient V2. À égalité, le V2 validé est gardé s'il est parmi les premiers ; sinon le
 * résultat est « human_arbitration » et le code ne choisit pas. Sans aucune voix, la fonction
 * n'élit rien et ne retire rien.
 */
export function electV2(input: V2ElectionInput): V2Election {
  requireUnique(
    input.votes.map((v) => String(v.pgId)),
    "voix par gamme",
  );
  if (input.votes.length === 0) return { outcome: "none", reason: "no_vote" };
  const byTypeId = new Map<string, number[]>();
  for (const v of input.votes) {
    const typeId = requireText(v.typeId, "type_id de la voix de la gamme " + v.pgId);
    const list = byTypeId.get(typeId);
    if (list) list.push(v.pgId);
    else byTypeId.set(typeId, [v.pgId]);
  }
  // L'ordre du décompte est un ordre d'affichage (voix, puis type_id), pas un départage.
  const tally: V2TallyLine[] = [...byTypeId.entries()]
    .map(([typeId, pgIds]) => ({ typeId, votes: pgIds.length, pgIds }))
    .sort((a, b) => b.votes - a.votes || (a.typeId < b.typeId ? -1 : a.typeId > b.typeId ? 1 : 0));
  const first = tally.filter((t) => t.votes === tally[0].votes).map((t) => t.typeId);
  if (first.length === 1) return { outcome: "elected", typeId: first[0], tally };
  if (input.validatedV2TypeId !== null && first.includes(input.validatedV2TypeId)) {
    return { outcome: "kept_validated", typeId: input.validatedV2TypeId, tiedTypeIds: first, tally };
  }
  return { outcome: "human_arbitration", tiedTypeIds: first, tally };
}

// ── Ligne 20 — V6 · véhicule sans demande observée ───────────────────────────────────────────

export interface V6Input {
  /** Une fiche catalogue exacte. */
  readonly typeId: string;
  /** Toutes les gammes ont été vérifiées pour cette fiche — donnée fournie. */
  readonly allGammesChecked: boolean;
  /** Une demande concerne la fiche, dans une gamme au moins — donnée fournie. */
  readonly demandObserved: boolean;
  /** Les niveaux V3, V4 ou V5 de la fiche, gamme par gamme. */
  readonly levels: ReadonlyArray<{ readonly pgId: number; readonly level: "V3" | "V4" | "V5" }>;
  /** Ligne 26 : voiture sans permis. */
  readonly licenceFree: boolean;
}

export type V6Decision =
  | { readonly outcome: "V6" }
  | { readonly outcome: "out_of_scope"; readonly state: typeof VLEVEL_STATE_LICENCE_FREE }
  | { readonly outcome: "not_v6"; readonly reason: "gammes_not_all_checked" | "demand_observed" }
  | {
      readonly outcome: "not_v6";
      readonly reason: "has_level";
      readonly levels: ReadonlyArray<{ readonly pgId: number; readonly level: "V3" | "V4" | "V5" }>;
    };

/**
 * Ligne 20 — V6 seulement après vérification de toutes les gammes, si aucune demande ni aucun
 * V3, V4 ou V5 ne concerne la fiche. Un V5 dans une seule gamme suffit à l'exclure.
 */
export function decideV6(input: V6Input): V6Decision {
  requireText(input.typeId, "type_id");
  if (input.licenceFree) return { outcome: "out_of_scope", state: VLEVEL_STATE_LICENCE_FREE };
  if (input.levels.length > 0) return { outcome: "not_v6", reason: "has_level", levels: input.levels };
  if (input.demandObserved) return { outcome: "not_v6", reason: "demand_observed" };
  if (!input.allGammesChecked) return { outcome: "not_v6", reason: "gammes_not_all_checked" };
  return { outcome: "V6" };
}

// ── Ligne 21 — V1 · choix marketing ──────────────────────────────────────────────────────────

/** La décision de Marwane pour un modèle et sa génération. Le code la porte, il ne la produit pas. */
export interface V1OwnerDecision {
  readonly modelGenerationKey: string;
  readonly decidedBy: "Marwane";
  /** Date de la décision (AAAA-MM-JJ). */
  readonly decidedOn: string;
}

/**
 * Ligne 21 — un modèle et sa génération sont V1 si, et seulement si, Marwane l'a décidé.
 * Aucune fonction de ce module ne calcule un V1 : l'avis de l'agent n'est pas une entrée.
 */
export function carryV1(
  modelGenerationKey: string,
  ownerDecisions: readonly V1OwnerDecision[],
): boolean {
  requireText(modelGenerationKey, "clé modèle × génération");
  return ownerDecisions.some((d) => d.modelGenerationKey === modelGenerationKey);
}

// ── Les six niveaux, dérivés des lignes ──────────────────────────────────────────────────────

export interface VLevelInvariant {
  readonly id: VLevelId;
  /** Ligne de la décision 192 qui définit le niveau. */
  readonly decisionLine: number;
  readonly label: string;
  readonly scope: string;
  /** Règle, mot pour mot. */
  readonly rule: string;
  /** Qui attribue le niveau : le calcul, ou Marwane (V1). */
  readonly assignedBy: "calcul" | "Marwane";
  /** Fonction pure de ce module qui porte la ligne. */
  readonly pureFunction: string;
}

const PURE_FUNCTION_OF: Readonly<Record<VLevelId, string>> = {
  V1: "carryV1",
  V2: "electV2",
  V3: "electV3",
  V4: "classifyDemandGroup",
  V5: "selectV5",
  V6: "decideV6",
};

/** Définition de chaque niveau = sa ligne de la décision 192, sans reformulation. */
export const V_LEVEL_INVARIANTS: readonly VLevelInvariant[] = V_LEVEL_IDS.map((id) => {
  const line = VLEVEL_DECISION_192_LINES.find((l) => l.id === id);
  if (!line) throw new VLevelInputError("ligne de la décision 192 introuvable pour " + id);
  return {
    id,
    decisionLine: line.line,
    label: line.label,
    scope: line.scope,
    rule: line.rule,
    assignedBy: id === "V1" ? "Marwane" : "calcul",
    pureFunction: PURE_FUNCTION_OF[id],
  };
});

// ── Écarts connus ────────────────────────────────────────────────────────────────────────────

/**
 * Écart entre la décision 192 et l'état du code ou de la base.
 *
 *  - donnee_absente : une entrée de la décision n'existe pas ; rien ne la remplace ;
 *  - calculateur_non_raccorde : le calculateur applique encore la règle remplacée, laissé tel quel ;
 *  - base : un objet en base applique l'ancienne règle ; toute modification est une migration ;
 *  - historique : écart antérieur à la décision 192, entre calculateurs non raccordés.
 *
 * proposedOnly décrit ce qu'il faudrait : rien n'est créé, la décision revient à Marwane.
 */
export interface VLevelKnownGap {
  readonly id: string;
  readonly kind: "donnee_absente" | "calculateur_non_raccorde" | "base" | "historique";
  readonly description: string;
  readonly proposedOnly?: string;
  /** Fichier du calculateur (kind = calculateur_non_raccorde). */
  readonly calculator?: string;
  /** Écarts de donnée qui empêchent le raccordement (kind = calculateur_non_raccorde). */
  readonly blockedBy?: readonly string[];
  /** Jalon de l'ancien plan (kind = historique). */
  readonly gate?: "G0" | "G1" | "G2" | "G3" | "G4";
}

/** Relevé des données d'entrée : lecture seule du 26 novembre 2026. Une absence n'est pas un zéro. */
export const V_LEVEL_KNOWN_GAPS: readonly VLevelKnownGap[] = [
  {
    id: "d192-fiche-verifiee",
    kind: "donnee_absente",
    description:
      "« Fiche vérifiée » (lignes 16 et 18) : aucune colonne ni table ne porte la vérification d'une fiche véhicule (type_id) face au constructeur (décision 159).",
    proposedOnly:
      "Un enregistrement de vérification par type_id (date, source constructeur, auteur) ; colonne ou table à décider.",
  },
  {
    id: "d192-identifiee-avec-la-gamme",
    kind: "donnee_absente",
    description:
      "« Version identifiée avec la gamme » (ligne 16) : aucune donnée. GAMME_PART_TERMS est un motif de texte pour trois gammes, ce n'est pas cette donnée.",
    proposedOnly:
      "Un marqueur par gamme et par version, avec sa définition (oui/non ou degré de précision : question ouverte).",
  },
  {
    id: "d192-source-de-la-demande",
    kind: "donnee_absente",
    description:
      "« Source de la demande » (ligne 16) : __seo_keywords.source existe mais ne porte aucune valeur Google.fr ; la valeur keyword-engine ne se range ni dans Ads ni dans Google.fr ; une ligne n'a qu'une source et l'unicité (keyword, gamme) empêche de noter une même formulation vue dans les deux.",
    proposedOnly:
      "Une source par observation (Ads, Google.fr) avec sa ligne source ; le relevé Google.fr reste à produire (décisions 157 et 158).",
  },
  {
    id: "d192-generation",
    kind: "donnee_absente",
    description:
      "« Génération du modèle » (lignes 16, 18, 19 et 21) : __seo_keywords.generation est vide et le catalogue n'a pas d'attribut génération (auto_modele porte modele_parent, modele_mdg_id et le chiffre romain du nom). Les utiliser serait un substitut ; ces rattachements relèvent de la décision 159.",
    proposedOnly: "Une clé modèle × génération vérifiée face au constructeur.",
  },
  {
    id: "d192-affichable-et-compatible",
    kind: "donnee_absente",
    description:
      "« Fiche catalogue affichable et compatible » (ligne 18) : auto_type.type_display existe, mais seul '1' est lu par le code et le sens des autres valeurs n'est pas documenté ; pour « compatible avec la gamme », plusieurs tables candidates existent et aucune n'est désignée comme faisant foi.",
    proposedOnly:
      "Désigner la table qui fait foi pour la compatibilité gamme × type_id et le sens de chaque valeur de type_display.",
  },
  {
    id: "d192-v2-valide",
    kind: "donnee_absente",
    description:
      "« V2 validé » (ligne 19) : aucun stockage d'un V2 choisi entre gammes, de sa validation ni d'un arbitrage humain. Les lignes v_level = 'V2' existantes viennent de l'ancienne promotion par gamme.",
    proposedOnly:
      "Un enregistrement par modèle × génération × énergie : type_id V2, validation (qui, quand), arbitrage humain consigné.",
  },
  {
    id: "d192-voiture-sans-permis",
    kind: "donnee_absente",
    description:
      "« Voiture sans permis » (ligne 26) : aucun marqueur sur la marque, le modèle, la fiche ou la formulation.",
    proposedOnly:
      "Un marqueur vérifié au niveau du véhicule, et la ligne source Ads conservée avec la formulation.",
  },
  {
    id: "d192-etats-non-stockables",
    kind: "donnee_absente",
    description:
      "États « À vérifier » et « Hors V-Level • voiture sans permis » (lignes 22 et 26) : non stockables. Les contraintes de __seo_keywords.v_level n'admettent que des niveaux (l'une des deux rejette V6) et aucune colonne ne garde l'origine, les fiches possibles ni la précision manquante.",
    proposedOnly:
      "Une colonne d'état distincte de v_level et les champs de la ligne 22 ; toute contrainte modifiée est une migration.",
  },
  {
    id: "d192-decision-v1",
    kind: "donnee_absente",
    description:
      "« Marwane décide du V1 » (ligne 21) : aucun stockage de la décision par modèle et génération (gamme_seo_metrics.is_v1 est par gamme).",
    proposedOnly:
      "Un enregistrement de décision V1 par modèle × génération (date, décideur), avec l'avis documenté de l'agent.",
  },
  {
    id: "d192-objets-en-base",
    kind: "base",
    description:
      "Objets en base antérieurs à la décision 192, non modifiés et dont le contenu n'a pas été relu : la fonction propagate_vlevel_per_typeid, les déclencheurs v2_repetitions, les fonctions get_vlevel_*.",
    proposedOnly: "À reprendre par migration, après la décision sur les données d'entrée.",
  },
  {
    id: "d192-calculateur-recalcul-admin",
    kind: "calculateur_non_raccorde",
    calculator: "backend/src/modules/admin/services/gamme-vlevel.service.ts",
    description:
      "Recalcul d'une gamme, écrit en base. Applique la règle remplacée : champion par volume dans [modèle + énergie], V2 plafonné à 10 dans la gamme, V5 pris sur les fiches affichées du modèle sans contrôle de compatibilité. Laissé tel quel.",
    blockedBy: [
      "d192-fiche-verifiee",
      "d192-identifiee-avec-la-gamme",
      "d192-source-de-la-demande",
      "d192-generation",
      "d192-affichable-et-compatible",
      "d192-voiture-sans-permis",
      "d192-etats-non-stockables",
    ],
    proposedOnly:
      "Raccorder à classifyDemandGroup et selectV5 quand les données existent ; le V2 sort du recalcul d'une seule gamme (ligne 19).",
  },
  {
    id: "d192-calculateur-import-csv",
    kind: "calculateur_non_raccorde",
    calculator: "scripts/insert-missing-keywords.ts",
    description:
      "Import de mots-clés, écrit en base. Applique la règle remplacée (champion par volume puis ordre du fichier, V2 plafonné à 10 dans la gamme, V5 par parenté de modèle). Laissé tel quel.",
    blockedBy: [
      "d192-fiche-verifiee",
      "d192-identifiee-avec-la-gamme",
      "d192-source-de-la-demande",
      "d192-generation",
      "d192-affichable-et-compatible",
      "d192-voiture-sans-permis",
      "d192-etats-non-stockables",
    ],
    proposedOnly:
      "Raccorder à sortDemandObservations et classifyDemandGroup quand les données existent ; le V2 sort de l'import d'une seule gamme.",
  },
  {
    id: "d192-calculateur-packs-de-decision",
    kind: "calculateur_non_raccorde",
    calculator: "scripts/seo/vlevel-v3-pipeline.ts",
    description:
      "Packs de décision, lecture seule. Réélit V2, V3 et V4 avec l'ancien comparateur par volume et déduit la génération du chiffre romain du texte, ce qui est un substitut. Laissé tel quel.",
    blockedBy: [
      "d192-fiche-verifiee",
      "d192-identifiee-avec-la-gamme",
      "d192-source-de-la-demande",
      "d192-generation",
      "d192-voiture-sans-permis",
    ],
    proposedOnly:
      "Raccorder à classifyDemandGroup quand les données existent ; retirer la réélection du V2 dans une seule gamme.",
  },
  {
    id: "eligibility-gate-divergent",
    kind: "historique",
    description:
      "Gate d'éligibilité divergent : service=MOTOR_PATTERN regex vs script=type==='vehicle'. Unifier (décision owner).",
    gate: "G1",
  },
  {
    id: "v2-dedup-case-mismatch-and-script-energy-normalization",
    kind: "historique",
    description:
      "Service side is neutralized via shared lowercase helper (vLevelGroupKey). CLI script still uses raw energy; live data has NULL and 'unknown', so switching it to the canonical helper is data-affecting and deferred to G3 with before/after proof.",
    gate: "G3",
  },
  {
    id: "count-vehicles-no-gamme-absent",
    kind: "historique",
    description:
      "RPC count_vehicles_no_gamme (V6) appelée par le script mais ABSENTE de la DB → fallback. Créer la fn ou retirer l'appel mort.",
    gate: "G1",
  },
  {
    id: "score-seo-half-migrated",
    kind: "historique",
    description:
      "score_seo : formule v3 abandonnée mais colonne conservée (peuplée au volume brut). Figer-déprécié ou rebrancher — jamais DROP.",
    gate: "G1",
  },
] as const;

// ═════════════════════════════════════════════════════════════════════════════════════════════
// PARTIE B — REMPLACÉ PAR LA DÉCISION 192
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Ce qui suit N'EST PAS la règle en vigueur. C'est ce qui reste de l'ancienne règle (champion par
// volume dans [modèle + énergie], plafond de 10 V2 par gamme), conservé seulement parce que les
// calculateurs non raccordés l'appellent encore (voir V_LEVEL_KNOWN_GAPS, kind
// « calculateur_non_raccorde »). Ne rien brancher de nouveau dessus. À retirer avec le
// raccordement du dernier calculateur.

/**
 * Remplacé par la décision 192 — conservé seulement parce que gamme-vlevel.service.ts, scripts/insert-missing-keywords.ts ou scripts/seo/vlevel-v3-pipeline.ts l'appelle encore.
 *
 * Cap nommé du nombre de V2 par gamme (tue la magic constant « 10 » dupliquée dans les
 * deux calculateurs). Toute lecture du cap DOIT passer par cette constante.
 */
export const VLEVEL_V2_CAP = 10 as const;

/**
 * Remplacé par la décision 192 — conservé seulement parce que gamme-vlevel.service.ts ou scripts/seo/vlevel-v3-pipeline.ts l'appelle encore.
 *
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
 * Remplacé par la décision 192 — conservé seulement parce que gamme-vlevel.service.ts ou scripts/seo/vlevel-v3-pipeline.ts l'appelle encore.
 *
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
 * Remplacé par la décision 192 — conservé seulement parce que gamme-vlevel.service.ts l'appelle encore.
 *
 * Ce motif de texte n'est pas la donnée « version identifiée avec la gamme » de la ligne 16.
 *
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
 * Remplacé par la décision 192 — conservé seulement parce que gamme-vlevel.service.ts l'appelle encore.
 *
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
 * Remplacé par la décision 192 — conservé seulement parce que gamme-vlevel.service.ts l'appelle encore.
 *
 * Motif de motorisation dans le TEXTE d'un mot-clé véhicule (code moteur / cylindrée / puissance).
 * SoT unique — dé-duplique le regex auparavant copié dans `gamme-vlevel.service` (élection) et le
 * `TOKEN` de `scripts/seo/vlevel-v3-pipeline`. Une motorisation explicite ⇒ véhicule précis.
 */
// Quantificateurs BORNÉS (`\d{1,2}` cylindrée, `\d{2,4}` puissance, `\s?`) — pas de `\d+`
// non borné adjacent à un littéral, ce qui éliminerait le risque ReDoS polynomial (CodeQL
// js/polynomial-redos) tout en préservant la sémantique `.test()` sur les mots-clés réels
// (« 1.5 dci », « 110 ch », « 90cv »). Couvre cylindrée X.Y et puissance ch/cv.
export const VLEVEL_MOTOR_PATTERN =
  /(\d{1,2}\.\d{1,2}|hdi|dci|tdi|cdi|tce|tsi|vti|puretech|tfsi|gti|vtec|mpi|d4d|jtd|cdti|crdi|dtec|\d{2,4}\s?(?:ch|cv))/i;

/** Candidat véhicule minimal pour le test d'éligibilité V-Level. */
export interface VLevelVehicleCandidate {
  /** Texte du mot-clé. */
  readonly keyword?: string | null;
  /** type_id résolu (auto_type) — présent ⇒ véhicule complet, quel que soit le texte. */
  readonly typeId?: string | number | null;
}

/**
 * Remplacé par la décision 192 — conservé seulement parce que gamme-vlevel.service.ts l'appelle encore.
 *
 * Cette garde n'est pas la « version identifiée » de la ligne 17.
 *
 * Un mot-clé véhicule est-il éligible à l'élection V-Level (V2/V3/V4) ?
 *
 * `true` ssi il RÉSOUT VERS UN VÉHICULE PRÉCIS :
 *   - le TEXTE porte une motorisation ({@link VLEVEL_MOTOR_PATTERN}), OU
 *   - il a un `type_id` résolu (un type_id EST une motorisation/variante).
 *
 * Corrige la garde historiquement basée sur le TEXTE seul (`MOTOR_PATTERN`), qui déclassait à tort
 * des véhicules RÉSOLUS dont le mot-clé est model-only (ex. « filtre habitacle clio 3 » → type_id
 * 12345). Incident 2026-06-08 pg424 : 104/284 véhicules résolus wrongly NULL.
 *
 * Un model-only NON résolu (ni motif, ni type_id) n'est PAS éligible ICI — mais ne doit PAS être
 * nullifié en silence : il relève de l'ATTRIBUTION de motorisation (règle owner — Google Trends /
 * Search / demande, via decision-pack/generics-pack + web-evidence seed), jamais d'un silent-NULL.
 *
 * Pure & déterministe. NE CALCULE PAS v_level.
 */
export function isVLevelEligibleVehicle(c: VLevelVehicleCandidate): boolean {
  if (c.typeId != null && String(c.typeId).trim() !== "") return true;
  return VLEVEL_MOTOR_PATTERN.test(c.keyword ?? "");
}

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

/** Remplacé par la décision 192 — voir validateV2Promotion. */
export type V2Violation = "not_a_champion" | "unresolved_vehicle" | "energy_mismatch";

/**
 * Remplacé par la décision 192 — conservé seulement parce que selectV2Tier l'appelle encore.
 *
 * Valide qu'un candidat PEUT être promu V2. Pure & déterministe. N'enforce QUE les invariants
 * OBJECTIFS (sans seuil de jugement) :
 *   - `not_a_champion`     : viole `V2 ⟹ V3` (pas champion).
 *   - `unresolved_vehicle` : type_id NULL → pas un véhicule complet.
 *   - `energy_mismatch`    : énergies connues incohérentes (mot-clé gasoil ↔ véhicule essence).
 * Les garde-fous `demand_floor`/`real_parc` restent owner-tunables
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

/** Résultat de la sélection du tier V2 — cf. {@link selectV2Tier}. */
export interface V2TierSelection<T> {
  /** Champions promus V2 : sous-ensemble VALIDE des top-`cap` champions élite. */
  readonly v2: readonly T[];
  /**
 * Remplacé par la décision 192 — conservé seulement parce que gamme-vlevel.service.ts ou scripts/seo/vlevel-v3-pipeline.ts l'appelle encore.
 *
   * Champions élite (dans le top-`cap`) REJETÉS de V2 et leurs violations. Ils restent
   * V3 (ils demeurent le champion de leur groupe) — la démotion en V4 + ré-élection est
   * un job de recalc séparé, owner-gated. Exposé pour l'observabilité (log/decision-pack).
   */
  readonly rejected: ReadonlyArray<{
    readonly champion: T;
    readonly violations: readonly V2Violation[];
  }>;
}

/**
 * Remplacé par la décision 192 — conservé seulement parce que gamme-vlevel.service.ts ou scripts/seo/vlevel-v3-pipeline.ts l'appelle encore.
 *
 * Sélectionne le tier V2 = sous-ensemble VALIDE des top-`cap` champions élite.
 *
 * SoT UNIQUE du cut V2 : les calculateurs canoniques (`gamme-vlevel.service` recalc admin +
 * `scripts/seo/vlevel-v3-pipeline` reelection-pack) l'appellent au lieu de dupliquer la boucle
 * — ils ne peuvent donc plus diverger. Applique l'invariant `V2 ⟹ V3` + les garde-fous OBJECTIFS
 * ({@link validateV2Promotion}) AU MOMENT DE LA PROMOTION.
 *
 * `cap` = PLAFOND, PAS quota : on prend les top-`cap` champions élite (dédupliqués par groupe),
 * PUIS on retire ceux qui échouent {@link validateV2Promotion}. AUCUN backfill par des champions
 * de rang inférieur (« moins de V2 mais propres », règle owner 2026-06-08 : air 10→8). Un champion
 * rejeté RESTE V3 (cf. {@link V2TierSelection.rejected}).
 *
 * Pré-condition : `sortedChampions` DOIT être trié par {@link compareV3Champions} (volume DESC →
 * longueur ASC → keyword ASC) — l'appelant le garantit (même tie-break que l'élection in-group).
 * PURE & déterministe. NE MUTE RIEN. NE LIT PAS la DB (l'appelant fournit `toCandidate`).
 *
 * @param sortedChampions champions V3 (1 par groupe) déjà triés canoniquement.
 * @param cap plafond du tier V2 ({@link VLEVEL_V2_CAP}).
 * @param groupKeyOf clé de groupe `[modèle+énergie]` ({@link vLevelGroupKey}) — dédup défensive.
 * @param toCandidate projette un champion en {@link V2PromotionCandidate} (isChampion=true).
 */
export function selectV2Tier<T>(
  sortedChampions: readonly T[],
  cap: number,
  groupKeyOf: (champion: T) => string,
  toCandidate: (champion: T) => V2PromotionCandidate,
): V2TierSelection<T> {
  // 1. Pool élite = top-`cap` champions dédupliqués par groupe (1 V2 max / [modèle+énergie]).
  const seenGroup = new Set<string>();
  const elite: T[] = [];
  for (const champion of sortedChampions) {
    const key = groupKeyOf(champion);
    if (seenGroup.has(key)) continue;
    seenGroup.add(key);
    elite.push(champion);
    if (elite.length >= cap) break;
  }
  // 2. V2 = sous-ensemble VALIDE du pool élite. Pas de backfill (plafond, pas quota).
  const v2: T[] = [];
  const rejected: Array<{ champion: T; violations: readonly V2Violation[] }> = [];
  for (const champion of elite) {
    const { ok, violations } = validateV2Promotion(toCandidate(champion));
    if (ok) v2.push(champion);
    else rejected.push({ champion, violations });
  }
  return { v2, rejected };
}

// ── Relevé daté (ni règle ni cible) ──────────────────────────────────────────────────────────

/**
 * Relevé antérieur à la décision 192 : il décrit la base au 2026-06-05 sous l'ancienne règle.
 *
 * Snapshot DB de référence (forcing function — voir le test associé).
 * Capturé sur `cxpojprgwgubzjyqzmoq` le 2026-06-05. À METTRE À JOUR après tout recalc
 * (avec preuve before/after), comme le pattern `canon-fixture.test.ts`.
 */
export const VLEVEL_DB_BASELINE_2026_06_05 = {
  capturedAt: "2026-06-05",
  distribution: { V1: 0, V2: 93, V3: 330, V4: 7372, V5: 1201, V6: 0, NULL: 1348 },
  v5: { distinctTypeIds: 513, onRootModels: 268, joinableRows: 1046 },
} as const;
