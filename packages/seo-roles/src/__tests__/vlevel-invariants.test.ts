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

  test("6 écarts restants (était 7)", () => {
    assert.equal(V_LEVEL_KNOWN_GAPS.length, 6);
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

describe("Méthode V-Level — doctrine figée (signaux recherche, jamais ventes)", () => {
  test("signal primaire = volume de recherche KW ; affinage Trends + web", () => {
    assert.equal(VLEVEL_RANKING_SIGNALS.primary, "kw_search_volume");
    assert.deepEqual([...VLEVEL_RANKING_SIGNALS.refine], ["google_trends", "web_search"]);
  });

  test("les VENTES sont explicitement EXCLUES du classement", () => {
    assert.ok(VLEVEL_RANKING_SIGNALS.excluded.includes("sales"));
    assert.ok(VLEVEL_RANKING_SIGNALS.excluded.includes("orders"));
  });

  test("V1 = niveau MODÈLE, classé recherche, jamais ventes, à construire", () => {
    const v1 = V_LEVEL_INVARIANTS.find((v) => v.id === "V1")!;
    assert.match(v1.meaning, /MODÈLE/);
    assert.match(v1.meaning, /jamais par ventes/);
    assert.equal(v1.built, false);
  });

  test("V3 = 1 véhicule complet = 1 page R2", () => {
    const v3 = V_LEVEL_INVARIANTS.find((v) => v.id === "V3")!;
    assert.match(v3.meaning, /VÉHICULE COMPLET/);
    assert.match(v3.meaning, /R2/);
  });
});
