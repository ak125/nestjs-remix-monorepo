import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { classifyRow, type ClassifiedRow } from "../lib/classify-row";

describe("classifyRow — canon-sourced role + intent (anti-drift)", () => {
  const cases: Array<[string, ClassifiedRow["role"], string]> = [
    // transactional → R2 (NOT R1 — this is the drift the canon fixes)
    ["acheter filtre a huile", "R2", "transactionnelle"],
    ["plaquette frein prix", "R2", "transactionnelle"],
    // diagnostic → R5 (NOT R1)
    ["symptome filtre huile bouche", "R5", "diagnostique"],
    ["voyant moteur allume", "R5", "diagnostique"],
    // navigational generic → R1
    ["filtre a huile", "R1", "navigationnelle"],
    ["plaquette frein compatible", "R1", "navigationnelle"],
    // maintenance how-to → R3
    ["quand changer filtre a huile", "R3", "informationnelle"],
    // definition → R4 (canon primary intent = informationnelle, not the
    // legacy build-keyword-clusters navigationnelle mapping)
    ["c'est quoi un filtre a huile", "R4", "informationnelle"],
    // buying guide → R6
    ["comparatif plaquettes frein", "R6", "investigation_commerciale"],
  ];

  for (const [kw, expectedRole, expectedIntent] of cases) {
    test(`"${kw}" → ${expectedRole} / ${expectedIntent}`, () => {
      const row = classifyRow(kw);
      assert.equal(row.role, expectedRole);
      assert.equal(row.intent, expectedIntent);
    });
  }

  test("R0_HOME maps to null role (excluded — violates R1-R8 CHECK)", () => {
    // "accueil" alone → R0_HOME. (NB: "automecanik" would match R1 via "auto".)
    const row = classifyRow("accueil");
    assert.equal(row.role, null);
  });

  test("kw is trimmed but preserved verbatim (accents kept)", () => {
    const row = classifyRow("  Filtre à Huile  ");
    assert.equal(row.kw, "Filtre à Huile");
  });
});
