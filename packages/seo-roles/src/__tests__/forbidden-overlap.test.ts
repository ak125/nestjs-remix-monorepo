import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { RoleId, getForbiddenOverlap } from "../index";

describe("getForbiddenOverlap — canonical pollution vocabulary", () => {
  test("R3_CONSEILS forbids diagnostic vocabulary (R5 territory)", () => {
    const terms = getForbiddenOverlap(RoleId.R3_CONSEILS);
    assert.ok(terms.includes("diagnostiquer"));
    assert.ok(terms.includes("bruit anormal"));
    assert.ok(terms.includes("code dtc"));
    assert.ok(terms.includes("code obd"));
  });

  test("R3_CONSEILS forbids transactional vocabulary (R2 territory)", () => {
    const terms = getForbiddenOverlap(RoleId.R3_CONSEILS);
    assert.ok(terms.includes("commander"));
    assert.ok(terms.includes("ajouter au panier"));
    assert.ok(terms.includes("prix"));
    assert.ok(terms.includes("livraison"));
  });

  test("R4_REFERENCE forbids transactional and diagnostic vocabulary", () => {
    const terms = getForbiddenOverlap(RoleId.R4_REFERENCE);
    assert.ok(terms.includes("acheter"));
    assert.ok(terms.includes("symptome"));
    assert.ok(terms.includes("panne"));
  });

  test("R6_GUIDE_ACHAT forbids transactional vocab (investigation_commerciale != transactional)", () => {
    const terms = getForbiddenOverlap(RoleId.R6_GUIDE_ACHAT);
    assert.ok(terms.includes("ajouter au panier"));
    assert.ok(terms.includes("commander"));
    assert.ok(terms.includes("livraison"));
  });

  test("R5_DIAGNOSTIC forbids buying-guide and reference vocabulary", () => {
    const terms = getForbiddenOverlap(RoleId.R5_DIAGNOSTIC);
    assert.ok(terms.includes("guide d'achat"));
    assert.ok(terms.includes("definition"));
    assert.ok(terms.includes("glossaire"));
  });

  test("returns frozen arrays (defensive immutability)", () => {
    const terms = getForbiddenOverlap(RoleId.R3_CONSEILS);
    assert.equal(Object.isFrozen(terms), true);
  });

  test("deprecated and non-writing roles return empty arrays", () => {
    assert.deepEqual([...getForbiddenOverlap(RoleId.R3_GUIDE)], []);
    assert.deepEqual([...getForbiddenOverlap(RoleId.R9_GOVERNANCE)], []);
    assert.deepEqual([...getForbiddenOverlap(RoleId.AGENTIC_ENGINE)], []);
    assert.deepEqual([...getForbiddenOverlap(RoleId.FOUNDATION)], []);
  });

  test("all terms are pre-normalised (lowercase, no diacritics)", () => {
    // The canon stores terms in normalised form so callers can compare against
    // normalizeSeoText(content) directly without per-term re-normalisation.
    for (const role of Object.values(RoleId)) {
      for (const term of getForbiddenOverlap(role)) {
        assert.equal(
          term,
          term.toLowerCase(),
          `term "${term}" in ${role} should be lowercase`,
        );
        // No combining diacritics
        assert.equal(
          /[̀-ͯ]/.test(term.normalize("NFD")),
          false,
          `term "${term}" in ${role} should have no diacritics`,
        );
      }
    }
  });
});
