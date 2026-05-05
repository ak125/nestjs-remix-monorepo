import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  RoleId,
  SearchIntentSchema,
  classifyKeywordToRole,
} from "../index";

describe("classifyKeywordToRole — anti-drift R1 (golden table)", () => {
  const cases: Array<[string, RoleId]> = [
    // R2 transactional — must NOT fall into R1 anymore
    ["acheter filtre a huile", RoleId.R2_PRODUCT],
    ["filtre huile pas cher", RoleId.R2_PRODUCT],
    ["plaquette frein prix", RoleId.R2_PRODUCT],
    ["amortisseur livraison rapide", RoleId.R2_PRODUCT],

    // R6_GUIDE_ACHAT pre-purchase
    ["meilleur filtre a huile avis", RoleId.R6_GUIDE_ACHAT],
    ["comparatif plaquettes frein", RoleId.R6_GUIDE_ACHAT],
    ["filtre huile bosch vs mann", RoleId.R6_GUIDE_ACHAT],
    ["quel filtre a huile choisir", RoleId.R6_GUIDE_ACHAT],

    // R1_ROUTER navigational — must keep volume
    ["filtre a huile pour ma voiture", RoleId.R1_ROUTER],
    ["plaquette frein compatible", RoleId.R1_ROUTER],
    ["amortisseur selon modele", RoleId.R1_ROUTER],
    ["filtre a huile gamme", RoleId.R1_ROUTER],
    ["filtre a huile", RoleId.R1_ROUTER], // generic → default-router

    // R3_CONSEILS maintenance
    ["quand changer filtre a huile", RoleId.R3_CONSEILS],
    ["comment remplacer plaquettes", RoleId.R3_CONSEILS],

    // R4_REFERENCE definition
    ["c'est quoi un filtre a huile", RoleId.R4_REFERENCE],
    ["definition amortisseur", RoleId.R4_REFERENCE],

    // R5_DIAGNOSTIC symptom
    ["symptome filtre huile bouche", RoleId.R5_DIAGNOSTIC],
    ["voyant moteur allume", RoleId.R5_DIAGNOSTIC],

    // CONFLICTS — R2 transactional overrides EVERYTHING
    ["acheter filtre a huile voiture", RoleId.R2_PRODUCT], // not R1 even with "voiture"
    ["prix plaquette frein compatible", RoleId.R2_PRODUCT], // not R1 even with "compatible"
    ["comment choisir filtre huile pas cher", RoleId.R2_PRODUCT], // not R6 even with "comment choisir"
    ["filtre a huile bosch livraison", RoleId.R2_PRODUCT], // not R6 even with brand
    // Symptom + transactional → R2 (user wants product, not orientation)
    ["symptome filtre huile prix", RoleId.R2_PRODUCT],
    // Symptom alone → R5
    ["symptome filtre huile bouche bruit", RoleId.R5_DIAGNOSTIC],

    // R6_SUPPORT — post-purchase (SAV / warranty)
    ["garantie filtre a huile", RoleId.R6_SUPPORT],
    ["retour produit defectueux", RoleId.R6_SUPPORT],
    ["sav plaquette frein", RoleId.R6_SUPPORT],

    // R6_GUIDE_ACHAT brand anti-regression (preserves historical capture)
    ["filtre huile bosch", RoleId.R6_GUIDE_ACHAT],
    ["plaquette frein brembo top 5", RoleId.R6_GUIDE_ACHAT],
    ["mann filter equivalent", RoleId.R6_GUIDE_ACHAT],

    // Accent normalisation (NFD strip)
    ["plaquette de frêin pour ma voiture", RoleId.R1_ROUTER],
    ["symptôme moteur", RoleId.R5_DIAGNOSTIC],
  ];

  for (const [keyword, expected] of cases) {
    test(`classifies ${JSON.stringify(keyword)} → ${expected}`, () => {
      const result = classifyKeywordToRole(keyword);
      assert.equal(result.role, expected);
    });
  }
});

describe("classifyKeywordToRole — matched indicator", () => {
  test("returns matched: 'regex' when a trigger fires", () => {
    assert.equal(classifyKeywordToRole("acheter filtre").matched, "regex");
  });

  test("returns matched: 'default-router' for bare gamme name", () => {
    assert.equal(classifyKeywordToRole("filtre a huile").matched, "default-router");
  });

  test("default-router returns R1_ROUTER", () => {
    assert.equal(classifyKeywordToRole("xyz unknown gamme").role, RoleId.R1_ROUTER);
  });
});

describe("classifyKeywordToRole — empty / edge inputs", () => {
  test("empty string falls to default-router R1", () => {
    const result = classifyKeywordToRole("");
    assert.equal(result.role, RoleId.R1_ROUTER);
    assert.equal(result.matched, "default-router");
  });

  test("whitespace-only falls to default-router R1", () => {
    const result = classifyKeywordToRole("   ");
    assert.equal(result.role, RoleId.R1_ROUTER);
    assert.equal(result.matched, "default-router");
  });

  test("uppercase keyword normalised correctly", () => {
    assert.equal(classifyKeywordToRole("ACHETER FILTRE").role, RoleId.R2_PRODUCT);
  });
});

describe("SearchIntentSchema — Zod validation", () => {
  test("accepts canonical intent values", () => {
    assert.doesNotThrow(() => SearchIntentSchema.parse("transactionnelle"));
    assert.doesNotThrow(() => SearchIntentSchema.parse("informationnelle"));
    assert.doesNotThrow(() => SearchIntentSchema.parse("navigationnelle"));
    assert.doesNotThrow(() => SearchIntentSchema.parse("diagnostique"));
    assert.doesNotThrow(() => SearchIntentSchema.parse("investigation_commerciale"));
  });

  test("rejects non-canonical intent label", () => {
    assert.throws(() => SearchIntentSchema.parse("achat"));
    assert.throws(() => SearchIntentSchema.parse("commercial"));
    assert.throws(() => SearchIntentSchema.parse(""));
  });
});
