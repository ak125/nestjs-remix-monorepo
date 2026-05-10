import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { RoleId, getRoleIntents, isIntentAllowedForRole } from "../index";

describe("getRoleIntents — canonical intent slots per role", () => {
  test("R3_CONSEILS is strict editorial — no leakage tolerated", () => {
    const i = getRoleIntents(RoleId.R3_CONSEILS);
    assert.equal(i.primary, "informationnelle");
    assert.deepEqual([...i.secondary], []);
    assert.deepEqual([...i.allowedLeakage], []);
  });

  test("R6_GUIDE_ACHAT primary is investigation_commerciale, no transactional leakage", () => {
    const i = getRoleIntents(RoleId.R6_GUIDE_ACHAT);
    assert.equal(i.primary, "investigation_commerciale");
    assert.deepEqual([...i.secondary], ["informationnelle"]);
    // CRITICAL: R6 must NOT leak transactionnelle — that's R2's surface.
    assert.deepEqual([...i.allowedLeakage], []);
    assert.equal(i.allowedLeakage.includes("transactionnelle"), false);
  });

  test("R2_PRODUCT is transactionnelle pure", () => {
    const i = getRoleIntents(RoleId.R2_PRODUCT);
    assert.equal(i.primary, "transactionnelle");
    assert.deepEqual([...i.secondary], []);
    assert.deepEqual([...i.allowedLeakage], []);
  });

  test("R5_DIAGNOSTIC is diagnostique pure", () => {
    const i = getRoleIntents(RoleId.R5_DIAGNOSTIC);
    assert.equal(i.primary, "diagnostique");
    assert.deepEqual([...i.secondary], []);
    assert.deepEqual([...i.allowedLeakage], []);
  });

  test("R1_ROUTER tolerates transactional leakage (router → product)", () => {
    const i = getRoleIntents(RoleId.R1_ROUTER);
    assert.equal(i.primary, "navigationnelle");
    assert.deepEqual([...i.allowedLeakage], ["transactionnelle"]);
  });

  test("R4_REFERENCE has navigationnelle as secondary, no transactional leakage", () => {
    const i = getRoleIntents(RoleId.R4_REFERENCE);
    assert.equal(i.primary, "informationnelle");
    assert.deepEqual([...i.secondary], ["navigationnelle"]);
    assert.deepEqual([...i.allowedLeakage], []);
  });
});

describe("isIntentAllowedForRole — Zod refinement helper", () => {
  test("R3_CONSEILS accepts ONLY informationnelle", () => {
    assert.equal(isIntentAllowedForRole(RoleId.R3_CONSEILS, "informationnelle"), true);
    assert.equal(isIntentAllowedForRole(RoleId.R3_CONSEILS, "diagnostique"), false);
    assert.equal(isIntentAllowedForRole(RoleId.R3_CONSEILS, "transactionnelle"), false);
    assert.equal(isIntentAllowedForRole(RoleId.R3_CONSEILS, "navigationnelle"), false);
    assert.equal(
      isIntentAllowedForRole(RoleId.R3_CONSEILS, "investigation_commerciale"),
      false,
    );
  });

  test("R6_GUIDE_ACHAT does NOT accept transactionnelle (no leakage)", () => {
    assert.equal(
      isIntentAllowedForRole(RoleId.R6_GUIDE_ACHAT, "investigation_commerciale"),
      true,
    );
    assert.equal(
      isIntentAllowedForRole(RoleId.R6_GUIDE_ACHAT, "informationnelle"),
      true,
    );
    assert.equal(
      isIntentAllowedForRole(RoleId.R6_GUIDE_ACHAT, "transactionnelle"),
      false,
    );
  });

  test("R1_ROUTER accepts navigationnelle and transactionnelle (leakage)", () => {
    assert.equal(isIntentAllowedForRole(RoleId.R1_ROUTER, "navigationnelle"), true);
    assert.equal(isIntentAllowedForRole(RoleId.R1_ROUTER, "transactionnelle"), true);
    assert.equal(isIntentAllowedForRole(RoleId.R1_ROUTER, "diagnostique"), false);
  });
});
