/**
 * V-Level — la décision 192 est la seule règle écrite ; ces tests la verrouillent.
 *
 *   1. Les huit lignes de la décision, mot pour mot, dans le module ET dans la spec.
 *   2. Un cas synthétique par ligne (données fictives : aucune ne vient de la base).
 *   3. Les écarts connus : chaque donnée d'entrée absente, chaque calculateur non raccordé.
 *   4. Ce qui reste de l'ancienne règle, tant que des calculateurs non raccordés l'appellent.
 *
 * @see ../vlevel-invariants.ts
 * @see .spec/features/g-v-classification.md
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as api from "../index";
import {
  V_LEVEL_IDS,
  V_LEVEL_STATES,
  VLEVEL_STATE_TO_VERIFY,
  VLEVEL_STATE_LICENCE_FREE,
  VLEVEL_DECISION_192_LINES,
  VLevelInputError,
  sortDemandObservations,
  v3SourceTier,
  electV3,
  classifyDemandGroup,
  selectV5,
  electV2,
  decideV6,
  carryV1,
  V_LEVEL_INVARIANTS,
  V_LEVEL_KNOWN_GAPS,
  VLEVEL_V2_CAP,
  validateV2Promotion,
  selectV2Tier,
  isVLevelEligibleVehicle,
  vLevelGroupKey,
  compareV3Champions,
  VLEVEL_DB_BASELINE_2026_06_05 as BASELINE,
  type VLevelObservation,
  type VLevelGroupFiche,
  type V3Candidate,
  type VLevelCatalogueFiche,
} from "../index";

const REPO_ROOT = resolve(__dirname, "../../../..");

/** Copie indépendante des huit lignes : une modification d'un seul côté casse le test. */
const DECISION_192 = [
  { line: 16, label: "V3 · premier choix", scope: "Une gamme × un modèle × une génération × une énergie", rule: "Retenir une seule fiche vérifiée. Priorité à une version identifiée avec la gamme. À précision égale avec la gamme, préférer la version vue dans les deux sources, puis Ads seul, puis Google.fr seul." },
  { line: 17, label: "V4 · autres demandes", scope: "Même groupe et même gamme que le V3", rule: "Classer chaque autre version recherchée et identifiée par son moteur, sa puissance, son année ou sa période, et son type_id. Plusieurs graphies de la même version renvoient à une seule fiche." },
  { line: 18, label: "V5 · variantes restantes", scope: "Une gamme × un modèle × une génération", rule: "Dès le premier V3 vérifié, prendre toutes les fiches catalogue affichables et compatibles de cette génération. Retirer les V3 et V4 de la gamme. Le reste reçoit V5, toutes énergies et carrosseries comprises." },
  { line: 19, label: "V2 · choix entre gammes", scope: "Un modèle × une génération × une énergie", rule: "Chaque gamme ayant validé un V3 donne une voix à son type_id. Le seul type_id en tête devient V2. À égalité, garder le V2 validé s’il est parmi les premiers. Sinon consigner un arbitrage humain." },
  { line: 20, label: "V6 · véhicule sans demande observée", scope: "Une fiche catalogue exacte, toutes gammes contrôlées", rule: "Attribuer V6 après vérification de toutes les gammes, si aucune demande ni aucun V3, V4 ou V5 ne concerne la fiche. Un V5 dans une seule gamme suffit à l’exclure du V6." },
  { line: 21, label: "V1 · choix marketing", scope: "Un modèle et sa génération", rule: "L’agent étudie l’intérêt du modèle pour le public et la campagne, documente les indices et remet son avis. Marwane décide du V1." },
  { line: 22, label: "À vérifier", scope: "Formulation ambiguë ou recherche incomplète", rule: "Garder la formulation, son origine, les fiches possibles et la précision manquante. Reprendre la recherche avant toute élection." },
  { line: 26, label: "Périmètre · voitures sans permis", scope: "Toutes les gammes · agents, simulation et recalcul", rule: "Conserver la formulation Ads exacte et sa ligne source. Dès que la version est identifiée comme voiture sans permis, la marquer « Hors V-Level • voiture sans permis », y compris avec une fiche catalogue compatible." },
];

// ── Données synthétiques ─────────────────────────────────────────────────────────────────────

const obs = (o: Partial<VLevelObservation> & { formulation: string }): VLevelObservation => ({
  source: "ads",
  sourceLine: "ads:ligne-1",
  licenceFree: false,
  typeId: null,
  possibleTypeIds: [],
  missingPrecision: null,
  ...o,
});

const cand = (typeId: string, o: Partial<V3Candidate> = {}): V3Candidate => ({
  typeId,
  verified: true,
  identifiedWithGamme: true,
  sources: ["ads"],
  ...o,
});

const fiche = (typeId: string, o: Partial<VLevelGroupFiche> = {}): VLevelGroupFiche => ({
  typeId,
  formulations: [{ formulation: "piece modele " + typeId, source: "ads", sourceLine: "ads:" + typeId }],
  verified: true,
  identifiedWithGamme: true,
  engine: "1.5",
  power: "70 ch",
  yearOrPeriod: "2005-2012",
  licenceFree: false,
  ...o,
});

const cat = (typeId: string, o: Partial<VLevelCatalogueFiche> = {}): VLevelCatalogueFiche => ({
  typeId,
  modelGenerationKey: "modele-a|generation-3",
  displayable: true,
  compatibleWithGamme: true,
  licenceFree: false,
  ...o,
});

// ── 1. Les huit lignes ───────────────────────────────────────────────────────────────────────

describe("Décision 192 — les huit lignes, mot pour mot", () => {
  test("huit lignes : 16 à 22, et 26", () => {
    assert.deepEqual(
      VLEVEL_DECISION_192_LINES.map((l) => l.line),
      [16, 17, 18, 19, 20, 21, 22, 26],
    );
  });

  for (const expected of DECISION_192) {
    test("ligne " + expected.line + " — " + expected.label, () => {
      const line = VLEVEL_DECISION_192_LINES.find((l) => l.line === expected.line);
      assert.ok(line, "ligne absente du module");
      assert.equal(line.label, expected.label);
      assert.equal(line.scope, expected.scope);
      assert.equal(line.rule, expected.rule);
    });
  }

  test("la spec cite chaque ligne mot pour mot (intitulé, périmètre, règle)", () => {
    const spec = readFileSync(resolve(REPO_ROOT, ".spec/features/g-v-classification.md"), "utf8");
    for (const l of VLEVEL_DECISION_192_LINES) {
      assert.ok(spec.includes(l.label), "intitulé absent de la spec : ligne " + l.line);
      assert.ok(spec.includes(l.scope), "périmètre absent de la spec : ligne " + l.line);
      assert.ok(spec.includes("« " + l.rule + " »"), "règle absente de la spec : ligne " + l.line);
    }
  });

  test("six niveaux, chacun défini par sa ligne, sans reformulation", () => {
    assert.deepEqual([...V_LEVEL_IDS], ["V1", "V2", "V3", "V4", "V5", "V6"]);
    assert.deepEqual(
      V_LEVEL_INVARIANTS.map((v) => [v.id, v.decisionLine]),
      [
        ["V1", 21],
        ["V2", 19],
        ["V3", 16],
        ["V4", 17],
        ["V5", 18],
        ["V6", 20],
      ],
    );
    for (const v of V_LEVEL_INVARIANTS) {
      const line = VLEVEL_DECISION_192_LINES.find((l) => l.line === v.decisionLine);
      assert.equal(v.rule, line?.rule);
      assert.equal(typeof (api as Record<string, unknown>)[v.pureFunction], "function");
    }
  });

  test("V1 : Marwane décide ; les cinq autres niveaux viennent du calcul", () => {
    for (const v of V_LEVEL_INVARIANTS) {
      assert.equal(v.assignedBy, v.id === "V1" ? "Marwane" : "calcul");
    }
  });

  test("« À vérifier » et « Hors V-Level • voiture sans permis » sont des états, pas des niveaux", () => {
    assert.deepEqual([...V_LEVEL_STATES], ["À vérifier", "Hors V-Level • voiture sans permis"]);
    for (const s of V_LEVEL_STATES) assert.ok(!(V_LEVEL_IDS as readonly string[]).includes(s));
    assert.ok(DECISION_192.find((l) => l.line === 26)?.rule.includes("« " + VLEVEL_STATE_LICENCE_FREE + " »"));
    assert.equal(DECISION_192.find((l) => l.line === 22)?.label, VLEVEL_STATE_TO_VERIFY);
  });

  test("l'ancienne règle n'est plus exposée comme règle : signaux, dispatch, clé de groupe, propagation retirés", () => {
    for (const gone of [
      "VLEVEL_RANKING_SIGNALS",
      "VLEVEL_PAGE_DISPATCH",
      "VLEVEL_V2_PROMOTION",
      "V_GROUP_KEY",
      "V_PROPAGATE",
    ]) {
      assert.ok(!(gone in api), gone + " est encore exporté");
    }
    for (const v of V_LEVEL_INVARIANTS) assert.doesNotMatch(v.rule, /volume|top.?10|plafond/i);
  });
});

// ── 2. Un cas par ligne ──────────────────────────────────────────────────────────────────────

describe("Ligne 17 (seconde phrase), lignes 22 et 26 — tri des formulations relevées", () => {
  test("plusieurs graphies de la même version renvoient à une seule fiche", () => {
    const r = sortDemandObservations([
      obs({ formulation: "piece modele 1.5 70", typeId: "T1", sourceLine: "ads:10" }),
      obs({ formulation: "piece modele 1,5 70ch", typeId: "T1", sourceLine: "ads:11" }),
      obs({ formulation: "piece modele 1.5 70 cv", typeId: "T1", source: "google_fr", sourceLine: "google:4" }),
      obs({ formulation: "piece modele 2.0 150", typeId: "T2", sourceLine: "ads:12" }),
    ]);
    assert.deepEqual(
      r.versions.map((v) => [v.typeId, v.formulations.length]),
      [
        ["T1", 3],
        ["T2", 1],
      ],
    );
    assert.deepEqual(r.toVerify, []);
    assert.deepEqual(r.outOfScope, []);
  });

  test("à vérifier : la formulation, son origine, les fiches possibles et la précision manquante sont gardées", () => {
    const r = sortDemandObservations([
      obs({
        formulation: "piece modele 1.5",
        sourceLine: "ads:20",
        possibleTypeIds: ["T1", "T3"],
        missingPrecision: "puissance",
      }),
    ]);
    assert.deepEqual(r.versions, []);
    assert.deepEqual(r.toVerify, [
      {
        state: "À vérifier",
        formulation: "piece modele 1.5",
        source: "ads",
        sourceLine: "ads:20",
        possibleTypeIds: ["T1", "T3"],
        missingPrecision: "puissance",
      },
    ]);
  });

  test("à vérifier : une recherche incomplète sur une fiche pressentie garde cette fiche parmi les possibles", () => {
    const r = sortDemandObservations([
      obs({ formulation: "piece modele 1.5 70", typeId: "T1", missingPrecision: "période" }),
    ]);
    assert.deepEqual(r.versions, []);
    assert.deepEqual(r.toVerify[0].possibleTypeIds, ["T1"]);
    assert.equal(r.toVerify[0].state, VLEVEL_STATE_TO_VERIFY);
  });

  test("une formulation non identifiée sans précision manquante est refusée, pas classée", () => {
    assert.throws(() => sortDemandObservations([obs({ formulation: "piece modele" })]), VLevelInputError);
  });

  test("une formulation à plusieurs fiches possibles sans précision manquante est refusée", () => {
    assert.throws(
      () => sortDemandObservations([obs({ formulation: "piece modele", typeId: "T1", possibleTypeIds: ["T1", "T2"] })]),
      VLevelInputError,
    );
  });

  test("une formulation sans ligne source est refusée (l'origine se conserve)", () => {
    assert.throws(
      () => sortDemandObservations([obs({ formulation: "piece modele 1.5 70", typeId: "T1", sourceLine: " " })]),
      VLevelInputError,
    );
  });

  test("voiture sans permis : état « Hors V-Level • voiture sans permis », formulation Ads exacte et ligne source conservées", () => {
    const r = sortDemandObservations([
      obs({ formulation: "Piece  Voiturette X 400", sourceLine: "ads:31", licenceFree: true }),
    ]);
    assert.deepEqual(r.outOfScope, [
      {
        state: "Hors V-Level • voiture sans permis",
        formulation: "Piece  Voiturette X 400",
        source: "ads",
        sourceLine: "ads:31",
        typeId: null,
      },
    ]);
    assert.deepEqual(r.versions, []);
  });

  test("voiture sans permis : hors V-Level y compris avec une fiche catalogue compatible", () => {
    const r = sortDemandObservations([
      obs({ formulation: "piece voiturette x 400", typeId: "T9", licenceFree: true }),
      obs({ formulation: "piece modele 1.5 70", typeId: "T1" }),
    ]);
    assert.deepEqual(r.versions.map((v) => v.typeId), ["T1"]);
    assert.equal(r.outOfScope[0].typeId, "T9");
    assert.equal(r.outOfScope[0].state, VLEVEL_STATE_LICENCE_FREE);
  });
});

describe("Ligne 16 — V3 · premier choix", () => {
  test("une seule fiche vérifiée est retenue pour le groupe", () => {
    const r = electV3({
      researchComplete: true,
      candidates: [cand("T1", { sources: ["ads", "google_fr"] }), cand("T2"), cand("T3", { sources: ["google_fr"] })],
    });
    assert.deepEqual(r, { outcome: "elected", typeId: "T1", identifiedWithGamme: true, sourceTier: "both" });
  });

  test("ordre de priorité : identifiée avec la gamme, puis deux sources, Ads seul, Google.fr seul", () => {
    const ordered: V3Candidate[] = [
      cand("gamme-deux-sources", { sources: ["ads", "google_fr"] }),
      cand("gamme-ads", { sources: ["ads"] }),
      cand("gamme-google", { sources: ["google_fr"] }),
      cand("sans-gamme-deux-sources", { identifiedWithGamme: false, sources: ["google_fr", "ads"] }),
      cand("sans-gamme-ads", { identifiedWithGamme: false, sources: ["ads"] }),
      cand("sans-gamme-google", { identifiedWithGamme: false, sources: ["google_fr"] }),
    ];
    for (let i = 0; i < ordered.length; i++) {
      // L'ordre de présentation des candidats ne compte pas : on les passe à l'envers.
      const r = electV3({ researchComplete: true, candidates: ordered.slice(i).reverse() });
      assert.equal(r.outcome, "elected");
      assert.equal(r.outcome === "elected" && r.typeId, ordered[i].typeId);
    }
  });

  test("une fiche non vérifiée n'est jamais retenue, même mieux placée", () => {
    const r = electV3({
      researchComplete: true,
      candidates: [
        cand("T1", { verified: false, sources: ["ads", "google_fr"] }),
        cand("T2", { identifiedWithGamme: false, sources: ["google_fr"] }),
      ],
    });
    assert.equal(r.outcome === "elected" && r.typeId, "T2");
    assert.deepEqual(electV3({ researchComplete: true, candidates: [cand("T1", { verified: false })] }), {
      outcome: "none",
      reason: "no_verified_fiche",
    });
  });

  test("recherche incomplète : l'élection est suspendue (ligne 22)", () => {
    assert.deepEqual(electV3({ researchComplete: false, candidates: [cand("T1")] }), {
      outcome: "suspended",
      reason: "research_incomplete",
    });
  });

  test("égalité que la ligne 16 ne départage pas : aucun choix, les fiches à égalité sont nommées", () => {
    const r = electV3({ researchComplete: true, candidates: [cand("T2"), cand("T1")] });
    assert.deepEqual(r, {
      outcome: "undecided",
      reason: "tie_not_settled_by_decision_192",
      tiedTypeIds: ["T2", "T1"],
    });
  });

  test("entrées refusées : même fiche deux fois, version sans source", () => {
    assert.throws(() => electV3({ researchComplete: true, candidates: [cand("T1"), cand("T1")] }), VLevelInputError);
    assert.throws(() => electV3({ researchComplete: true, candidates: [cand("T1", { sources: [] })] }), VLevelInputError);
    assert.throws(() => v3SourceTier([]), VLevelInputError);
  });
});

describe("Lignes 16 et 17 — un groupe gamme × modèle × génération × énergie", () => {
  test("V3 unique par gamme et par groupe ; chaque autre version identifiée reçoit V4", () => {
    const groupeDiesel = classifyDemandGroup({
      researchComplete: true,
      fiches: [fiche("D1"), fiche("D2", { identifiedWithGamme: false }), fiche("D3", { identifiedWithGamme: false })],
    });
    const groupeEssence = classifyDemandGroup({
      researchComplete: true,
      fiches: [fiche("E1", { identifiedWithGamme: false }), fiche("E2")],
    });
    assert.equal(groupeDiesel.v3.outcome === "elected" && groupeDiesel.v3.typeId, "D1");
    assert.deepEqual(groupeDiesel.v4, ["D2", "D3"]);
    assert.equal(groupeEssence.v3.outcome === "elected" && groupeEssence.v3.typeId, "E2");
    assert.deepEqual(groupeEssence.v4, ["E1"]);
  });

  test("plusieurs graphies de la même version = une seule fiche V4", () => {
    const sorted = sortDemandObservations([
      obs({ formulation: "piece modele 1.5 70", typeId: "T1", source: "ads", sourceLine: "ads:1" }),
      obs({ formulation: "piece modele 1.5 70", typeId: "T1", source: "google_fr", sourceLine: "google:1" }),
      obs({ formulation: "piece modele 2.0 150", typeId: "T2", sourceLine: "ads:2" }),
      obs({ formulation: "piece modele 2,0 150ch", typeId: "T2", sourceLine: "ads:3" }),
      obs({ formulation: "piece modele 2.0 150 cv", typeId: "T2", sourceLine: "ads:4" }),
    ]);
    const r = classifyDemandGroup({
      researchComplete: true,
      fiches: sorted.versions.map((v) => fiche(v.typeId, { formulations: v.formulations })),
    });
    // T1 est vue dans les deux sources : elle passe devant T2 (Ads seul).
    assert.deepEqual(r.v3, { outcome: "elected", typeId: "T1", identifiedWithGamme: true, sourceTier: "both" });
    assert.deepEqual(r.v4, ["T2"]);
  });

  test("le même type_id présenté deux fois est refusé (une version = une fiche)", () => {
    assert.throws(
      () => classifyDemandGroup({ researchComplete: true, fiches: [fiche("T1"), fiche("T1")] }),
      VLevelInputError,
    );
  });

  test("une autre version sans puissance ni période n'est pas V4 : « À vérifier », précision manquante nommée", () => {
    const r = classifyDemandGroup({
      researchComplete: true,
      fiches: [fiche("T1"), fiche("T2", { identifiedWithGamme: false, power: null, yearOrPeriod: "" })],
    });
    assert.deepEqual(r.v4, []);
    assert.equal(r.toVerify.length, 1);
    assert.equal(r.toVerify[0].typeId, "T2");
    assert.equal(r.toVerify[0].state, "À vérifier");
    assert.equal(r.toVerify[0].missingPrecision, "puissance, année ou période");
    assert.equal(r.toVerify[0].formulations.length, 1);
  });

  test("sans V3 retenu, aucune fiche ne reçoit V4", () => {
    const sansVerifiee = classifyDemandGroup({
      researchComplete: true,
      fiches: [fiche("T1", { verified: false }), fiche("T2", { verified: false })],
    });
    assert.equal(sansVerifiee.v3.outcome, "none");
    assert.deepEqual(sansVerifiee.v4, []);
    assert.deepEqual(sansVerifiee.awaitingV3, ["T1", "T2"]);

    const suspendue = classifyDemandGroup({ researchComplete: false, fiches: [fiche("T1"), fiche("T2")] });
    assert.equal(suspendue.v3.outcome, "suspended");
    assert.deepEqual(suspendue.v4, []);
    assert.deepEqual(suspendue.awaitingV3, ["T1", "T2"]);
  });

  test("voiture sans permis : ni V3 ni V4, même vérifiée et mieux placée", () => {
    const r = classifyDemandGroup({
      researchComplete: true,
      fiches: [
        fiche("SP1", { licenceFree: true }),
        fiche("T2", { identifiedWithGamme: false }),
      ],
    });
    assert.equal(r.v3.outcome === "elected" && r.v3.typeId, "T2");
    assert.deepEqual(r.v4, []);
    assert.deepEqual(
      r.outOfScope.map((o) => [o.typeId, o.state, o.formulations[0].sourceLine]),
      [["SP1", "Hors V-Level • voiture sans permis", "ads:SP1"]],
    );
  });
});

describe("Ligne 18 — V5 · variantes restantes", () => {
  // Une génération : plusieurs énergies et carrosseries, plus une fiche d'une autre génération.
  const catalogue: VLevelCatalogueFiche[] = [
    cat("diesel-berline-70"),
    cat("diesel-berline-90"),
    cat("diesel-break-90"),
    cat("essence-berline-75"),
    cat("essence-coupe-130"),
    cat("electrique-berline"),
    cat("gpl-break-80"),
    cat("masquee", { displayable: false }),
    cat("incompatible", { compatibleWithGamme: false }),
    cat("autre-generation", { modelGenerationKey: "modele-a|generation-4" }),
  ];

  test("toutes énergies et carrosseries comprises ; les V3 et V4 de la gamme sont retirés", () => {
    const r = selectV5({
      modelGenerationKey: "modele-a|generation-3",
      verifiedV3TypeIds: ["diesel-berline-70", "essence-berline-75"],
      v4TypeIds: ["diesel-berline-90"],
      catalogue,
    });
    assert.equal(r.triggered, true);
    assert.deepEqual(r.v5, ["diesel-break-90", "essence-coupe-130", "electrique-berline", "gpl-break-80"]);
    assert.deepEqual(r.removedAsV3OrV4, ["diesel-berline-70", "diesel-berline-90", "essence-berline-75"]);
    assert.deepEqual(r.notRetained, [
      { typeId: "masquee", reason: "not_displayable" },
      { typeId: "incompatible", reason: "not_compatible" },
    ]);
  });

  test("dès le premier V3 vérifié : un seul suffit, dans une seule énergie", () => {
    const r = selectV5({
      modelGenerationKey: "modele-a|generation-3",
      verifiedV3TypeIds: ["diesel-berline-70"],
      v4TypeIds: [],
      catalogue,
    });
    assert.equal(r.v5.length, 6);
    assert.ok(r.v5.includes("essence-coupe-130") && r.v5.includes("electrique-berline"));
  });

  test("aucun V3 vérifié dans la génération : aucun V5", () => {
    const r = selectV5({
      modelGenerationKey: "modele-a|generation-3",
      verifiedV3TypeIds: [],
      v4TypeIds: ["diesel-berline-90"],
      catalogue,
    });
    assert.deepEqual(r, { triggered: false, v5: [], removedAsV3OrV4: [], notRetained: [], outOfScope: [] });
  });

  test("une fiche d'une autre génération ne reçoit pas V5", () => {
    const r = selectV5({
      modelGenerationKey: "modele-a|generation-3",
      verifiedV3TypeIds: ["diesel-berline-70"],
      v4TypeIds: [],
      catalogue,
    });
    assert.ok(!r.v5.includes("autre-generation"));
  });

  test("voiture sans permis de la génération : hors V-Level, pas V5", () => {
    const r = selectV5({
      modelGenerationKey: "modele-a|generation-3",
      verifiedV3TypeIds: ["diesel-berline-70"],
      v4TypeIds: [],
      catalogue: [...catalogue, cat("sans-permis", { licenceFree: true })],
    });
    assert.deepEqual(r.outOfScope, ["sans-permis"]);
    assert.ok(!r.v5.includes("sans-permis"));
  });
});

describe("Ligne 19 — V2 · choix entre gammes", () => {
  test("une voix par gamme ; le seul type_id en tête devient V2", () => {
    const r = electV2({
      validatedV2TypeId: null,
      votes: [
        { pgId: 1, typeId: "T1" },
        { pgId: 2, typeId: "T1" },
        { pgId: 3, typeId: "T2" },
      ],
    });
    assert.equal(r.outcome === "elected" && r.typeId, "T1");
    assert.deepEqual(r.outcome === "elected" && r.tally, [
      { typeId: "T1", votes: 2, pgIds: [1, 2] },
      { typeId: "T2", votes: 1, pgIds: [3] },
    ]);
  });

  test("une gamme ne donne qu'une voix : une seconde voix de la même gamme est refusée", () => {
    assert.throws(
      () =>
        electV2({
          validatedV2TypeId: null,
          votes: [
            { pgId: 1, typeId: "T1" },
            { pgId: 1, typeId: "T2" },
          ],
        }),
      VLevelInputError,
    );
  });

  test("le seul type_id en tête devient V2, même si un autre V2 était validé", () => {
    const r = electV2({
      validatedV2TypeId: "T2",
      votes: [
        { pgId: 1, typeId: "T1" },
        { pgId: 2, typeId: "T1" },
        { pgId: 3, typeId: "T2" },
      ],
    });
    assert.equal(r.outcome === "elected" && r.typeId, "T1");
  });

  test("égalité : le V2 validé est gardé s'il est parmi les premiers", () => {
    const r = electV2({
      validatedV2TypeId: "T2",
      votes: [
        { pgId: 1, typeId: "T1" },
        { pgId: 2, typeId: "T2" },
        { pgId: 3, typeId: "T3" },
      ],
    });
    assert.equal(r.outcome, "kept_validated");
    assert.equal(r.outcome === "kept_validated" && r.typeId, "T2");
  });

  test("égalité sans V2 validé : arbitrage humain consigné, aucun choix du code", () => {
    const r = electV2({
      validatedV2TypeId: null,
      votes: [
        { pgId: 1, typeId: "T2" },
        { pgId: 2, typeId: "T1" },
      ],
    });
    assert.equal(r.outcome, "human_arbitration");
    assert.deepEqual(r.outcome === "human_arbitration" && r.tiedTypeIds, ["T1", "T2"]);
    assert.ok(!("typeId" in r));
  });

  test("égalité, V2 validé hors des premiers : arbitrage humain", () => {
    const r = electV2({
      validatedV2TypeId: "T3",
      votes: [
        { pgId: 1, typeId: "T1" },
        { pgId: 2, typeId: "T1" },
        { pgId: 3, typeId: "T2" },
        { pgId: 4, typeId: "T2" },
        { pgId: 5, typeId: "T3" },
      ],
    });
    assert.equal(r.outcome, "human_arbitration");
  });

  test("aucune gamme n'a validé de V3 : rien n'est élu", () => {
    assert.deepEqual(electV2({ validatedV2TypeId: "T1", votes: [] }), { outcome: "none", reason: "no_vote" });
  });
});

describe("Ligne 20 — V6 · véhicule sans demande observée", () => {
  const base = { typeId: "T1", allGammesChecked: true, demandObserved: false, levels: [], licenceFree: false };

  test("toutes les gammes vérifiées, aucune demande, aucun V3, V4 ou V5 : V6", () => {
    assert.deepEqual(decideV6(base), { outcome: "V6" });
  });

  test("un V5 dans une seule gamme suffit à l'exclure du V6", () => {
    const r = decideV6({ ...base, levels: [{ pgId: 7, level: "V5" }] });
    assert.deepEqual(r, { outcome: "not_v6", reason: "has_level", levels: [{ pgId: 7, level: "V5" }] });
  });

  test("un V3 ou un V4 l'exclut aussi", () => {
    assert.equal(decideV6({ ...base, levels: [{ pgId: 82, level: "V3" }] }).outcome, "not_v6");
    assert.equal(decideV6({ ...base, levels: [{ pgId: 82, level: "V4" }] }).outcome, "not_v6");
  });

  test("une demande observée l'exclut", () => {
    assert.deepEqual(decideV6({ ...base, demandObserved: true }), { outcome: "not_v6", reason: "demand_observed" });
  });

  test("pas de V6 tant que toutes les gammes ne sont pas vérifiées", () => {
    assert.deepEqual(decideV6({ ...base, allGammesChecked: false }), {
      outcome: "not_v6",
      reason: "gammes_not_all_checked",
    });
  });

  test("voiture sans permis : hors V-Level, jamais V6", () => {
    assert.deepEqual(decideV6({ ...base, licenceFree: true }), {
      outcome: "out_of_scope",
      state: "Hors V-Level • voiture sans permis",
    });
  });
});

describe("Ligne 21 — V1 · choix marketing", () => {
  test("V1 seulement sur décision de Marwane ; sans décision, pas de V1", () => {
    const decisions = [
      { modelGenerationKey: "modele-a|generation-3", decidedBy: "Marwane" as const, decidedOn: "2026-11-25" },
    ];
    assert.equal(carryV1("modele-a|generation-3", decisions), true);
    assert.equal(carryV1("modele-a|generation-4", decisions), false);
    assert.equal(carryV1("modele-a|generation-3", []), false);
  });

  test("aucune fonction du module ne produit un V1 : carryV1 ne prend que la décision", () => {
    assert.equal(carryV1.length, 2);
    assert.equal(V_LEVEL_INVARIANTS.find((v) => v.id === "V1")?.pureFunction, "carryV1");
  });
});

// ── 3. Écarts connus ─────────────────────────────────────────────────────────────────────────

describe("Écarts connus — données d'entrée absentes et calculateurs non raccordés", () => {
  const ids = V_LEVEL_KNOWN_GAPS.map((g) => g.id);
  const missingData = V_LEVEL_KNOWN_GAPS.filter((g) => g.kind === "donnee_absente");
  const unwired = V_LEVEL_KNOWN_GAPS.filter((g) => g.kind === "calculateur_non_raccorde");

  test("identifiants uniques", () => {
    assert.equal(new Set(ids).size, ids.length);
  });

  test("chaque donnée d'entrée absente est déclarée, avec ce qu'il faudrait (proposé seulement)", () => {
    assert.deepEqual(
      missingData.map((g) => g.id),
      [
        "d192-fiche-verifiee",
        "d192-identifiee-avec-la-gamme",
        "d192-source-de-la-demande",
        "d192-generation",
        "d192-affichable-et-compatible",
        "d192-v2-valide",
        "d192-voiture-sans-permis",
        "d192-etats-non-stockables",
        "d192-decision-v1",
      ],
    );
    for (const g of missingData) assert.ok(g.proposedOnly && g.proposedOnly.length > 0, g.id);
  });

  test("les trois calculateurs sont déclarés non raccordés, chacun avec les données qui le bloquent", () => {
    assert.deepEqual(
      unwired.map((g) => g.calculator),
      [
        "backend/src/modules/admin/services/gamme-vlevel.service.ts",
        "scripts/insert-missing-keywords.ts",
        "scripts/seo/vlevel-v3-pipeline.ts",
      ],
    );
    for (const g of unwired) {
      assert.ok(g.calculator && existsSync(resolve(REPO_ROOT, g.calculator)), g.id + " : fichier introuvable");
      assert.ok(g.blockedBy && g.blockedBy.length > 0, g.id + " : aucune donnée bloquante déclarée");
      for (const b of g.blockedBy ?? []) {
        assert.ok(missingData.some((m) => m.id === b), g.id + " : écart bloquant inconnu " + b);
      }
    }
  });

  test("un calculateur non raccordé appelle encore l'ancienne règle, pas la décision 192", () => {
    for (const g of unwired) {
      const source = readFileSync(resolve(REPO_ROOT, g.calculator ?? ""), "utf8");
      assert.match(source, /VLEVEL_V2_CAP/, g.id);
      assert.doesNotMatch(source, /\b(electV3|classifyDemandGroup|selectV5|electV2|decideV6)\b/, g.id);
      assert.match(source, /remplacée? par la décision 192/i, g.id + " : en-tête non marqué");
    }
  });

  test("les écarts historiques gardent leur jalon", () => {
    const historical = V_LEVEL_KNOWN_GAPS.filter((g) => g.kind === "historique");
    assert.deepEqual(
      historical.map((g) => g.id),
      [
        "eligibility-gate-divergent",
        "v2-dedup-case-mismatch-and-script-energy-normalization",
        "count-vehicles-no-gamme-absent",
        "score-seo-half-migrated",
      ],
    );
    for (const g of historical) assert.match(g.gate ?? "", /^G[0-4]$/);
  });

  // Un todo par écart : visible dans la sortie des tests, sans faire échouer la CI.
  for (const gap of V_LEVEL_KNOWN_GAPS) {
    test("[" + gap.kind + "] " + gap.id + " — " + gap.description, { todo: true }, () => {});
  }
});

// ── 4. Remplacé par la décision 192 ──────────────────────────────────────────────────────────
// Ces fonctions ne sont plus la règle. Leurs tests restent tant que les calculateurs non
// raccordés les appellent : ils garantissent seulement que ce code hérité ne change pas en silence.

describe("Remplacé par la décision 192 — plafond de V2 par gamme", () => {
  test("VLEVEL_V2_CAP reste la seule lecture du plafond hérité", () => {
    assert.equal(VLEVEL_V2_CAP, 10);
  });
});

describe("Remplacé par la décision 192 — vLevelGroupKey (clé [modèle + énergie] du recalcul admin)", () => {
  test("groupe [model|energy] en lowercase", () => {
    assert.equal(vLevelGroupKey("clio", "diesel"), "clio|diesel");
  });

  test("case-insensitive (résout le mismatch group/dedup côté service)", () => {
    assert.equal(vLevelGroupKey("Clio", "Diesel"), vLevelGroupKey("clio", "diesel"));
    assert.equal(vLevelGroupKey("CLIO", "DIESEL"), "clio|diesel");
  });

  test("gamme universelle → énergie ignorée", () => {
    assert.equal(vLevelGroupKey("clio", "diesel", { gammeUniverselle: true }), "clio");
  });

  test("fallbacks _no_model / unknown (sémantique service energy||'unknown')", () => {
    assert.equal(vLevelGroupKey(null, null), "_no_model|unknown");
    assert.equal(vLevelGroupKey("clio", null), "clio|unknown");
    assert.equal(vLevelGroupKey("", ""), "_no_model|unknown");
  });

  test("même clé pour groupe ET dedup (ne peuvent plus diverger)", () => {
    assert.equal(vLevelGroupKey("clio", "diesel"), vLevelGroupKey("clio", "diesel"));
  });
});

describe("Remplacé par la décision 192 — compareV3Champions (volume DESC → longueur ASC → keyword ASC)", () => {
  test("volume DESC domine (avant toute égalité)", () => {
    const a = { keyword: "x", volume: 50 };
    const b = { keyword: "aaaaaaaa", volume: 500 };
    assert.ok(compareV3Champions(a, b) > 0, "b (vol 500) doit passer avant a (vol 50)");
    assert.ok(compareV3Champions(b, a) < 0);
  });

  test("à volume égal : keyword le plus COURT gagne", () => {
    const court = { keyword: "filtre a air 407", volume: 50 };
    const long = { keyword: "filtre a air 407 1.6 hdi", volume: 50 };
    assert.ok(compareV3Champions(court, long) < 0, "le plus court passe en premier (champion)");
  });

  test("à volume ET longueur égaux : keyword ASC tranche (ordre total)", () => {
    // Cas réel groupe [206] habitacle : deux keywords vol=500, len=20.
    const a = { keyword: "206 filtre habitacle", volume: 500 }; // '2' < 'f'
    const b = { keyword: "filtre habitacle 206", volume: 500 };
    assert.equal(a.keyword.length, b.keyword.length);
    assert.ok(compareV3Champions(a, b) < 0, "'206 filtre habitacle' (commence par '2') est champion canonique");
    assert.ok(compareV3Champions(b, a) > 0);
  });

  test("DÉTERMINISME : le tri est stable quelle que soit la permutation d'entrée", () => {
    // 5 champions ex-aequo à volume=500 (le palier qui rendait le cut V2 non reproductible).
    const base = [
      { keyword: "kangoo", volume: 500 },
      { keyword: "modus", volume: 500 },
      { keyword: "kadjar", volume: 500 },
      { keyword: "500x", volume: 500 },
      { keyword: "c3 aircross", volume: 500 },
    ];
    const order = (arr: typeof base) =>
      [...arr].sort(compareV3Champions).map((k) => k.keyword);
    const canonical = order(base);
    // longueur ASC puis keyword ASC : 500x(4) modus(5) kadjar(6) kangoo(6) c3 aircross(11)
    assert.deepEqual(canonical, ["500x", "modus", "kadjar", "kangoo", "c3 aircross"]);
    // deux permutations différentes -> MÊME résultat (reproductible)
    assert.deepEqual(order([...base].reverse()), canonical);
    assert.deepEqual(order([base[2], base[0], base[4], base[1], base[3]]), canonical);
  });

  test("tolère volume/keyword null|undefined (0 / chaîne vide)", () => {
    assert.equal(compareV3Champions({ keyword: "", volume: 0 }, { keyword: "", volume: 0 }), 0);
    assert.ok(compareV3Champions({ keyword: "a" }, { keyword: "a", volume: 10 }) > 0);
  });
});

describe("Remplacé par la décision 192 — validateV2Promotion (ancienne promotion V2 dans une gamme)", () => {
  test("candidat valide : champion + véhicule résolu + énergie cohérente", () => {
    const r = validateV2Promotion({
      isChampion: true,
      typeId: "9468",
      keywordEnergy: "diesel",
      vehicleEnergy: "Diesel",
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.violations, []);
  });

  test("not_a_champion : pas champion → ne peut PAS être V2 (V2 ⟹ V3)", () => {
    const r = validateV2Promotion({ isChampion: false, typeId: "9468" });
    assert.ok(r.violations.includes("not_a_champion"));
    assert.equal(r.ok, false);
  });

  test("unresolved_vehicle : type_id NULL → pas un véhicule (cas des entrées polluées)", () => {
    const r = validateV2Promotion({ isChampion: true, typeId: null });
    assert.ok(r.violations.includes("unresolved_vehicle"));
    assert.equal(r.ok, false);
  });

  test("energy_mismatch : mot-clé gasoil → véhicule essence (cas Duster 2025)", () => {
    const r = validateV2Promotion({
      isChampion: true,
      typeId: "77163",
      keywordEnergy: "gasoil",
      vehicleEnergy: "Essence",
    });
    assert.ok(r.violations.includes("energy_mismatch"));
    assert.equal(r.ok, false);
  });

  test("énergie inconnue d'un côté → PAS de faux rejet (other ⇒ compatible)", () => {
    const r = validateV2Promotion({
      isChampion: true,
      typeId: "100",
      keywordEnergy: "",
      vehicleEnergy: "Diesel",
    });
    assert.ok(!r.violations.includes("energy_mismatch"));
    assert.equal(r.ok, true);
  });
});

describe("Remplacé par la décision 192 — selectV2Tier (ancien plafond de V2 par gamme)", () => {
  // Champion minimal tel que fourni par les 2 calculateurs canoniques (service recalc + pipeline).
  type Champ = {
    id: number;
    keyword: string;
    model: string;
    energy: string;
    type_id: string | number | null;
    vehicleFuel: string | null; // auto_type.type_fuel, résolu par l'appelant (pas par selectV2Tier)
  };
  const groupKeyOf = (c: Champ) => vLevelGroupKey(c.model, c.energy);
  // Miroir EXACT de la projection des calculateurs : keywordEnergy = TEXTE du mot-clé.
  const toCandidate = (c: Champ) => ({
    isChampion: true as const,
    typeId: c.type_id,
    keywordEnergy: c.keyword,
    vehicleEnergy: c.vehicleFuel,
  });
  const champ = (over: Partial<Champ> & { id: number }): Champ => ({
    keyword: `kw${over.id}`,
    model: `model${over.id}`,
    energy: "diesel",
    type_id: String(1000 + over.id),
    vehicleFuel: "Diesel",
    ...over,
  });

  test("données propres : v2 = top-cap, aucun recalé (comportement préservé)", () => {
    const champs = [champ({ id: 1 }), champ({ id: 2 }), champ({ id: 3 })];
    const { v2, rejected } = selectV2Tier(champs, 10, groupKeyOf, toCandidate);
    assert.deepEqual(v2.map((c) => c.id), [1, 2, 3]);
    assert.equal(rejected.length, 0);
  });

  test("plafond, pas quota : invalide DANS le top-cap retiré SANS backfill (cap 3 → 2)", () => {
    const champs = [
      champ({ id: 1 }),
      champ({ id: 2, type_id: null }), // unresolved_vehicle, dans le top-3
      champ({ id: 3 }),
      champ({ id: 4 }), // hors top-cap : ne doit PAS remonter combler le trou
    ];
    const { v2, rejected } = selectV2Tier(champs, 3, groupKeyOf, toCandidate);
    assert.deepEqual(v2.map((c) => c.id), [1, 3], "v2 = valides du top-3, sans backfill de c4");
    assert.equal(v2.length, 2, "« moins de V2 mais propres » (pas re-rempli à 3)");
    assert.ok(!v2.some((c) => c.id === 4), "c4 (rang > cap) jamais promu");
    assert.deepEqual(rejected.map((r) => r.champion.id), [2]);
    assert.ok(rejected[0].violations.includes("unresolved_vehicle"));
  });

  test("energy_mismatch : « filtre a gasoil duster » sur véhicule essence → recalé (reste V3)", () => {
    const duster = champ({
      id: 9,
      keyword: "filtre a gasoil duster",
      model: "duster",
      energy: "diesel",
      type_id: "77163",
      vehicleFuel: "Essence",
    });
    const { v2, rejected } = selectV2Tier([duster], 10, groupKeyOf, toCandidate);
    assert.equal(v2.length, 0);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0].violations.includes("energy_mismatch"));
  });

  test("dédup défensive : 1 V2 max par groupe [model+energy]", () => {
    const a = champ({ id: 1, model: "clio", energy: "diesel" });
    const b = champ({ id: 2, model: "clio", energy: "diesel" }); // même groupe
    const { v2 } = selectV2Tier([a, b], 10, groupKeyOf, toCandidate);
    assert.deepEqual(v2.map((c) => c.id), [1], "le 2e du même groupe n'entre pas dans l'élite");
  });

  test("plafond respecté : jamais plus de cap V2, même avec surplus de champions valides", () => {
    const champs = Array.from({ length: 15 }, (_, i) => champ({ id: i + 1 }));
    const { v2 } = selectV2Tier(champs, VLEVEL_V2_CAP, groupKeyOf, toCandidate);
    assert.equal(v2.length, VLEVEL_V2_CAP);
  });

  test("PURE : n'altère pas le tableau d'entrée", () => {
    const champs = [champ({ id: 1 }), champ({ id: 2, type_id: null })];
    const snapshot = champs.map((c) => c.id);
    selectV2Tier(champs, 10, groupKeyOf, toCandidate);
    assert.deepEqual(champs.map((c) => c.id), snapshot);
  });
});

describe("Remplacé par la décision 192 — isVLevelEligibleVehicle (ancienne garde par motif de texte ou type_id)", () => {
  test("motorisation dans le TEXTE → éligible (comportement historique préservé)", () => {
    assert.equal(isVLevelEligibleVehicle({ keyword: "filtre a air clio 3 1.5 dci", typeId: null }), true);
    assert.equal(isVLevelEligibleVehicle({ keyword: "disque de frein 206 hdi", typeId: null }), true);
    assert.equal(isVLevelEligibleVehicle({ keyword: "plaquette megane 110 ch", typeId: null }), true);
  });

  test("model-only AVEC type_id résolu → éligible (FIX incident pg424 : véhicule résolu jamais NULL)", () => {
    // « filtre habitacle clio 3 » sans code moteur MAIS résolu à un type_id = véhicule complet.
    assert.equal(isVLevelEligibleVehicle({ keyword: "filtre habitacle clio 3", typeId: "12345" }), true);
    assert.equal(isVLevelEligibleVehicle({ keyword: "ds5 filtre habitacle", typeId: 77999 }), true);
  });

  test("model-only SANS type_id → NON éligible ici (relève de l'attribution motorisation, pas silent-NULL)", () => {
    assert.equal(isVLevelEligibleVehicle({ keyword: "filtre habitacle clio 3", typeId: null }), false);
    assert.equal(isVLevelEligibleVehicle({ keyword: "filtre a air fiat 500", typeId: "" }), false);
    assert.equal(isVLevelEligibleVehicle({ keyword: "ds5 filtre habitacle" }), false);
  });

  test("type_id 0 / espaces → traité comme NON résolu (cohérent validateV2Promotion)", () => {
    assert.equal(isVLevelEligibleVehicle({ keyword: "generic", typeId: "   " }), false);
    assert.equal(isVLevelEligibleVehicle({ keyword: "generic", typeId: null }), false);
  });

  test("tolère keyword null/undefined", () => {
    assert.equal(isVLevelEligibleVehicle({ keyword: null, typeId: "9468" }), true);
    assert.equal(isVLevelEligibleVehicle({ keyword: undefined, typeId: null }), false);
  });
});

describe("Relevé daté 2026-06-05 — antérieur à la décision 192 (ni règle ni cible)", () => {
  test("distribution 2026-06-05 figée (mettre à jour après recalc, preuve before/after)", () => {
    assert.deepEqual(BASELINE.distribution, {
      V1: 0,
      V2: 93,
      V3: 330,
      V4: 7372,
      V5: 1201,
      V6: 0,
      NULL: 1348,
    });
  });

  test("non-conformité V5 : onRoot ≤ distinct ; root > 0 (à corriger en G3)", () => {
    assert.ok(BASELINE.v5.onRootModels <= BASELINE.v5.distinctTypeIds);
    assert.equal(BASELINE.v5.distinctTypeIds, 513);
    assert.equal(BASELINE.v5.onRootModels, 268);
  });
});
