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
  V_GROUP_KEY,
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
