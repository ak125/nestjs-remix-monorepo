import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  RoleId,
  assertCanonicalRoleStrict,
  isCanonicalRoleId,
  type CanonicalRoleId,
} from "../index";

describe("assertCanonicalRoleStrict — branded canonical assertion", () => {
  test("returns branded CanonicalRoleId for canonical input", () => {
    const role: CanonicalRoleId = assertCanonicalRoleStrict("R3_CONSEILS");
    assert.equal(role, RoleId.R3_CONSEILS);
  });

  test("accepts all output-safe canonical roles", () => {
    const outputSafe = Object.values(RoleId).filter(
      (r) => r !== RoleId.R9_GOVERNANCE && r !== RoleId.R3_GUIDE,
    );
    for (const role of outputSafe) {
      assert.doesNotThrow(() => assertCanonicalRoleStrict(role));
    }
  });

  test("throws for legacy alias", () => {
    assert.throws(
      () => assertCanonicalRoleStrict("R3_guide"),
      /Non-canonical role in output/,
    );
  });

  test("throws for bare R3", () => {
    assert.throws(
      () => assertCanonicalRoleStrict("R3"),
      /Non-canonical role in output/,
    );
  });

  test("throws for bare R6", () => {
    assert.throws(
      () => assertCanonicalRoleStrict("R6"),
      /Non-canonical role in output/,
    );
  });

  test("throws for deprecated R9_GOVERNANCE", () => {
    assert.throws(
      () => assertCanonicalRoleStrict("R9_GOVERNANCE"),
      /Deprecated role in output/,
    );
  });

  test("throws for deprecated R3_GUIDE", () => {
    assert.throws(
      () => assertCanonicalRoleStrict("R3_GUIDE"),
      /Deprecated role in output/,
    );
  });

  test("throws for unknown string", () => {
    assert.throws(
      () => assertCanonicalRoleStrict("ZZZ"),
      /Non-canonical role in output/,
    );
  });
});

describe("isCanonicalRoleId — type guard", () => {
  test("returns true for canonical roles", () => {
    assert.equal(isCanonicalRoleId("R3_CONSEILS"), true);
    assert.equal(isCanonicalRoleId("R6_GUIDE_ACHAT"), true);
    assert.equal(isCanonicalRoleId("R6_SUPPORT"), true);
    assert.equal(isCanonicalRoleId("R8_VEHICLE"), true);
  });

  test("returns false for deprecated roles", () => {
    assert.equal(isCanonicalRoleId("R9_GOVERNANCE"), false);
    assert.equal(isCanonicalRoleId("R3_GUIDE"), false);
  });

  test("returns false for legacy aliases", () => {
    assert.equal(isCanonicalRoleId("R3_guide"), false);
    assert.equal(isCanonicalRoleId("R3_BLOG"), false);
    assert.equal(isCanonicalRoleId("R6_BUYING_GUIDE"), false);
  });

  test("returns false for bare forbidden", () => {
    assert.equal(isCanonicalRoleId("R3"), false);
    assert.equal(isCanonicalRoleId("R6"), false);
    assert.equal(isCanonicalRoleId("R9"), false);
  });

  test("returns false for non-strings", () => {
    assert.equal(isCanonicalRoleId(null), false);
    assert.equal(isCanonicalRoleId(undefined), false);
    assert.equal(isCanonicalRoleId(42), false);
    assert.equal(isCanonicalRoleId({}), false);
  });
});
