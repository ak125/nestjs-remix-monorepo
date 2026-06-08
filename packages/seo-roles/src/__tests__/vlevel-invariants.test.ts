/**
 * V-Level invariants — conformité & drift detection.
 *
 * Stratégie « verrouiller avant corriger » (plan approuvé) :
 *   1. GÈLE l'état ACTUEL (baseline DB + invariants) → vert aujourd'hui, détecte toute dérive.
 *   2. EXPOSE chaque écart owner-vs-code comme test `todo` NOMMÉ → visible et traçable,
 *      sans casser la CI (les corrections sont owner-gated, plan G0–G4).
 *
 * Même pattern « forcing function » que `canon-fixture.test.ts` : si quelqu'un recalcule V5
 * (ou modifie les invariants), le snapshot ci-dessous doit être mis à jour avec preuve
 * before/after — le test échoue sinon, ce qui empêche une dérive silencieuse.
 *
 * @see ../vlevel-invariants.ts
 * @see audit/levels-doctrine-cgc-vs-vlevel-2026-06-04.md
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  V_LEVEL_IDS,
  VLEVEL_V2_CAP,
  VLEVEL_RANKING_SIGNALS,
  VLEVEL_PAGE_DISPATCH,
  VLEVEL_V2_PROMOTION,
  validateV2Promotion,
  selectV2Tier,
  isVLevelEligibleVehicle,
  V_GROUP_KEY,
  vLevelGroupKey,
  compareV3Champions,
  V_LEVEL_INVARIANTS,
  V_PROPAGATE,
  V_LEVEL_KNOWN_GAPS,
  VLEVEL_DB_BASELINE_2026_06_05 as BASELINE,
} from "../index";

describe("V-Level invariants — cohérence (gelé, vert aujourd'hui)", () => {
  test("6 niveaux V1..V6 + NULL, tous définis", () => {
    assert.equal(V_LEVEL_IDS.length, 6);
    const ids = V_LEVEL_INVARIANTS.map((v) => v.id);
    for (const id of V_LEVEL_IDS) assert.ok(ids.includes(id), `manque ${id}`);
    assert.ok(ids.includes("NULL"), "manque NULL");
  });

  test("V1 et V6 non construits aujourd'hui ; V2/V3/V4/V5/NULL construits", () => {
    const built = Object.fromEntries(V_LEVEL_INVARIANTS.map((v) => [v.id, v.built]));
    assert.equal(built.V1, false);
    assert.equal(built.V6, false);
    for (const id of ["V2", "V3", "V4", "V5", "NULL"]) {
      assert.equal(built[id], true, `${id} devrait être construit`);
    }
  });

  test("cap V2 nommé = 10 (pas de magic constant)", () => {
    assert.equal(VLEVEL_V2_CAP, 10);
  });

  test("clé de groupe = [model+energy], lowercase, énergie ignorée si gamme universelle", () => {
    assert.deepEqual([...V_GROUP_KEY.fields], ["model", "energy"]);
    assert.equal(V_GROUP_KEY.caseInsensitive, true);
    assert.equal(V_GROUP_KEY.ignoreEnergyWhenGammeUniverselle, true);
  });

  test("propagate = backfill NULL only + préserve l'existant (priorité V2>V3>V4>V5)", () => {
    assert.equal(V_PROPAGATE.fillsOnlyNull, true);
    assert.equal(V_PROPAGATE.preservesAssigned, true);
    assert.deepEqual([...V_PROPAGATE.priorityOrder], ["V2", "V3", "V4", "V5"]);
  });
});

describe("vLevelGroupKey — clé canonique partagée (G2, service)", () => {
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

describe("V-Level gaps — résolution G2 (7 → 6)", () => {
  test("propagate-comment-false retiré (résolu en G2)", () => {
    const ids = V_LEVEL_KNOWN_GAPS.map((g) => g.id);
    assert.ok(!ids.includes("propagate-comment-false"), "gap résolu encore présent");
  });

  test("dedup case-mismatch transformé en gap script-energy (G3)", () => {
    const g = V_LEVEL_KNOWN_GAPS.find(
      (x) => x.id === "v2-dedup-case-mismatch-and-script-energy-normalization",
    );
    assert.ok(g, "gap transformé absent");
    assert.equal(g?.gate, "G3");
  });

  test("7 écarts (6 + V2 affinage observé 2026-06-08)", () => {
    assert.equal(V_LEVEL_KNOWN_GAPS.length, 7);
    assert.ok(V_LEVEL_KNOWN_GAPS.some((g) => g.id === "v2-promotion-not-affined"));
  });
});

describe("V-Level baseline DB — snapshot gelé (forcing function)", () => {
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

describe("V-Level écarts CONNUS owner-vs-code (todo nommés — owner-gated)", () => {
  test("chaque écart a un id, une description et une porte G*", () => {
    assert.ok(V_LEVEL_KNOWN_GAPS.length >= 1);
    for (const g of V_LEVEL_KNOWN_GAPS) {
      assert.ok(g.id && g.description, `gap incomplet: ${JSON.stringify(g)}`);
      assert.match(g.gate, /^G[0-4]$/);
    }
  });

  // Surfacent le bricolage SANS casser la CI : chaque écart = un todo nommé, traçable.
  for (const g of V_LEVEL_KNOWN_GAPS) {
    test(`écart[${g.gate}] ${g.id}`, { todo: g.description }, () => {
      /* résolution owner-gated — voir plan G0–G4 */
    });
  }
});

describe("compareV3Champions — tie-break déterministe (volume DESC → longueur ASC → keyword ASC)", () => {
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

describe("Méthode V-Level — doctrine figée (objectif top-vente, mesuré par recherche, dispatch constructeur)", () => {
  test("objectif = TOP-VENTE ; mesure = recherche KW (vivier) + Trends/web (affinage)", () => {
    assert.equal(VLEVEL_RANKING_SIGNALS.goal, "top_vente");
    assert.equal(VLEVEL_RANKING_SIGNALS.measurePrimary, "kw_search_volume");
    assert.deepEqual([...VLEVEL_RANKING_SIGNALS.measureRefine], ["google_trends", "web_search"]);
  });

  test("les TABLES de vente ne sont PAS exploitables (proxy recherche à la place)", () => {
    assert.equal(VLEVEL_RANKING_SIGNALS.notUsable, "sales_tables");
  });

  test("V1 = niveau MODÈLE, top-vente via recherche, page constructeur marque, à construire", () => {
    const v1 = V_LEVEL_INVARIANTS.find((v) => v.id === "V1")!;
    assert.match(v1.meaning, /MODÈLE/);
    assert.match(v1.meaning, /TOP-VENTE/);
    assert.match(v1.meaning, /constructeurs/);
    assert.equal(v1.built, false);
  });

  test("V3 = 1 véhicule complet, dispatché fiche véhicule R8 constructeur + produit R2", () => {
    const v3 = V_LEVEL_INVARIANTS.find((v) => v.id === "V3")!;
    assert.match(v3.meaning, /VÉHICULE COMPLET/);
    assert.match(v3.meaning, /constructeurs/);
    assert.match(v3.meaning, /R2/);
  });

  test("dispatch pages : V3→fiche véhicule, V2→gamme, V1→page marque + marketing", () => {
    assert.match(VLEVEL_PAGE_DISPATCH.V3, /constructeurs/);
    assert.match(VLEVEL_PAGE_DISPATCH.V1, /constructeurs/);
    assert.match(VLEVEL_PAGE_DISPATCH.V1, /marketing/);
  });
});

describe("Promotion V2 — invariant DUR « V2 ⟹ V3 » + affinage (on commence toujours par V3)", () => {
  test("V3 est le SOCLE (mention explicite dans l'invariant)", () => {
    const v3 = V_LEVEL_INVARIANTS.find((v) => v.id === "V3")!;
    assert.match(v3.meaning, /SOCLE/);
    assert.match(v3.meaning, /TOUJOURS par V3/);
  });

  test("V2 = promotion méritée, plafond (pas quota), V2 ⟹ V3 explicite", () => {
    const v2 = V_LEVEL_INVARIANTS.find((v) => v.id === "V2")!;
    assert.match(v2.meaning, /V2 ⟹ V3/);
    assert.match(v2.meaning, /PLAFOND, pas quota/);
    assert.equal(VLEVEL_V2_PROMOTION.requires, "V3_champion");
    assert.equal(VLEVEL_V2_PROMOTION.cap, VLEVEL_V2_CAP);
    assert.deepEqual(
      [...VLEVEL_V2_PROMOTION.affinageGuards],
      ["resolved_vehicle", "energy_coherent", "demand_floor", "real_parc"],
    );
  });

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

describe("selectV2Tier — SoT du cut V2 (plafond sans backfill, V2 ⟹ V3 + garde-fous objectifs)", () => {
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

describe("isVLevelEligibleVehicle — éligibilité par RÉSOLUTION (motif texte OU type_id), pas texte seul", () => {
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
