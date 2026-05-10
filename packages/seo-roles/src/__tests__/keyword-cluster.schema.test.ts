import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { RoleId, KeywordClusterSchema } from "../index";

describe("KeywordClusterSchema — Zod refinement on canonical role+intent pairs", () => {
  test("accepts R3_CONSEILS + informationnelle", () => {
    const cluster = KeywordClusterSchema.parse({
      role: RoleId.R3_CONSEILS,
      primary: "quand changer plaquettes",
      secondary: ["entretien plaquettes", "remplacement plaquette"],
      intent: "informationnelle",
    });
    assert.equal(cluster.role, RoleId.R3_CONSEILS);
    assert.equal(cluster.intent, "informationnelle");
  });

  test("rejects R3_CONSEILS + diagnostique (intent not in role's set)", () => {
    const result = KeywordClusterSchema.safeParse({
      role: RoleId.R3_CONSEILS,
      primary: "voyant moteur",
      secondary: [],
      intent: "diagnostique",
    });
    assert.equal(result.success, false);
  });

  test("rejects R6_GUIDE_ACHAT + transactionnelle (no leakage)", () => {
    const result = KeywordClusterSchema.safeParse({
      role: RoleId.R6_GUIDE_ACHAT,
      primary: "meilleur filtre huile",
      secondary: ["comparatif filtres"],
      intent: "transactionnelle",
    });
    assert.equal(result.success, false);
  });

  test("accepts R6_GUIDE_ACHAT + investigation_commerciale", () => {
    const cluster = KeywordClusterSchema.parse({
      role: RoleId.R6_GUIDE_ACHAT,
      primary: "meilleur filtre huile",
      secondary: ["comparatif"],
      intent: "investigation_commerciale",
    });
    assert.equal(cluster.intent, "investigation_commerciale");
  });

  test("accepts R1_ROUTER + transactionnelle (allowedLeakage)", () => {
    const cluster = KeywordClusterSchema.parse({
      role: RoleId.R1_ROUTER,
      primary: "filtre huile pour 2008",
      secondary: [],
      intent: "transactionnelle",
    });
    assert.equal(cluster.intent, "transactionnelle");
  });

  test("rejects deprecated output role R3_GUIDE", () => {
    const result = KeywordClusterSchema.safeParse({
      role: "R3_GUIDE",
      primary: "guide achat plaquettes",
      secondary: [],
      intent: "informationnelle",
    });
    assert.equal(result.success, false);
  });

  test("rejects unknown role", () => {
    const result = KeywordClusterSchema.safeParse({
      role: "R42_UNKNOWN",
      primary: "test",
      secondary: [],
      intent: "informationnelle",
    });
    assert.equal(result.success, false);
  });

  test("caps secondary list at 5 entries", () => {
    const result = KeywordClusterSchema.safeParse({
      role: RoleId.R3_CONSEILS,
      primary: "p",
      secondary: ["s1", "s2", "s3", "s4", "s5", "s6"],
      intent: "informationnelle",
    });
    assert.equal(result.success, false);
  });

  test("primary_volume is optional, non-negative integer", () => {
    const ok = KeywordClusterSchema.parse({
      role: RoleId.R3_CONSEILS,
      primary: "quand changer plaquettes",
      primary_volume: 0, // synthetic marker
      secondary: [],
      intent: "informationnelle",
    });
    assert.equal(ok.primary_volume, 0);

    const bad = KeywordClusterSchema.safeParse({
      role: RoleId.R3_CONSEILS,
      primary: "x",
      primary_volume: -1,
      secondary: [],
      intent: "informationnelle",
    });
    assert.equal(bad.success, false);
  });
});
