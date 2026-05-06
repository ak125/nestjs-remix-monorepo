import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  RoleId,
  FORBIDDEN_ROLE_IDS,
  LEGACY_ROLE_ALIASES,
  normalizeRoleId,
  assertCanonicalRole,
} from "../index";

describe("normalizeRoleId", () => {
  describe("canonical passthrough", () => {
    test("returns R3_CONSEILS for canonical input", () => {
      assert.equal(normalizeRoleId("R3_CONSEILS"), RoleId.R3_CONSEILS);
    });

    test("returns R6_GUIDE_ACHAT for canonical input", () => {
      assert.equal(normalizeRoleId("R6_GUIDE_ACHAT"), RoleId.R6_GUIDE_ACHAT);
    });

    test("returns R1_ROUTER for canonical input", () => {
      assert.equal(normalizeRoleId("R1_ROUTER"), RoleId.R1_ROUTER);
    });
  });

  describe("legacy alias mapping", () => {
    test("maps R3_guide → R6_GUIDE_ACHAT", () => {
      assert.equal(normalizeRoleId("R3_guide"), RoleId.R6_GUIDE_ACHAT);
    });

    test("maps R3_guide_achat → R6_GUIDE_ACHAT", () => {
      assert.equal(normalizeRoleId("R3_guide_achat"), RoleId.R6_GUIDE_ACHAT);
    });

    test("maps R3_BLOG → R3_CONSEILS", () => {
      assert.equal(normalizeRoleId("R3_BLOG"), RoleId.R3_CONSEILS);
    });

    test("maps R1_pieces → R1_ROUTER", () => {
      assert.equal(normalizeRoleId("R1_pieces"), RoleId.R1_ROUTER);
    });

    test("maps R4_GLOSSARY → R4_REFERENCE", () => {
      assert.equal(normalizeRoleId("R4_GLOSSARY"), RoleId.R4_REFERENCE);
    });

    test("maps R6_BUYING_GUIDE → R6_GUIDE_ACHAT", () => {
      assert.equal(normalizeRoleId("R6_BUYING_GUIDE"), RoleId.R6_GUIDE_ACHAT);
    });
  });

  describe("frontend short values (page-role.types.ts PageRole enum)", () => {
    test("maps R0 → R0_HOME", () => {
      assert.equal(normalizeRoleId("R0"), RoleId.R0_HOME);
    });

    test("maps R1 → R1_ROUTER", () => {
      assert.equal(normalizeRoleId("R1"), RoleId.R1_ROUTER);
    });

    test("maps R2 → R2_PRODUCT", () => {
      assert.equal(normalizeRoleId("R2"), RoleId.R2_PRODUCT);
    });

    test("maps R4 → R4_REFERENCE", () => {
      assert.equal(normalizeRoleId("R4"), RoleId.R4_REFERENCE);
    });

    test("maps R5 → R5_DIAGNOSTIC", () => {
      assert.equal(normalizeRoleId("R5"), RoleId.R5_DIAGNOSTIC);
    });

    test("maps R7 → R7_BRAND", () => {
      assert.equal(normalizeRoleId("R7"), RoleId.R7_BRAND);
    });

    test("maps R8 → R8_VEHICLE", () => {
      assert.equal(normalizeRoleId("R8"), RoleId.R8_VEHICLE);
    });

    test("maps R6_GUIDE → R6_GUIDE_ACHAT (frontend distinct value)", () => {
      assert.equal(normalizeRoleId("R6_GUIDE"), RoleId.R6_GUIDE_ACHAT);
    });

    test("preserves R3 ambiguity discipline (still null)", () => {
      assert.equal(normalizeRoleId("R3"), null);
    });

    test("preserves R6 ambiguity discipline (still null)", () => {
      assert.equal(normalizeRoleId("R6"), null);
    });
  });

  describe("worker page types", () => {
    test("maps R3_guide_howto → R3_CONSEILS", () => {
      assert.equal(normalizeRoleId("R3_guide_howto"), RoleId.R3_CONSEILS);
    });

    test("maps R5_diagnostic → R5_DIAGNOSTIC", () => {
      assert.equal(normalizeRoleId("R5_diagnostic"), RoleId.R5_DIAGNOSTIC);
    });

    test("maps R6_guide_achat → R6_GUIDE_ACHAT", () => {
      assert.equal(normalizeRoleId("R6_guide_achat"), RoleId.R6_GUIDE_ACHAT);
    });
  });

  describe("rejection of ambiguous / unknown", () => {
    test("rejects bare R3", () => {
      assert.equal(normalizeRoleId("R3"), null);
    });

    test("rejects bare R6", () => {
      assert.equal(normalizeRoleId("R6"), null);
    });

    test("rejects bare R9", () => {
      assert.equal(normalizeRoleId("R9"), null);
    });

    test("rejects unknown string", () => {
      assert.equal(normalizeRoleId("NONSENSE"), null);
    });

    test("rejects empty string", () => {
      assert.equal(normalizeRoleId(""), null);
    });

    for (const id of FORBIDDEN_ROLE_IDS) {
      test(`rejects forbidden role ID "${id}"`, () => {
        assert.equal(normalizeRoleId(id), null);
      });
    }
  });
});

describe("assertCanonicalRole", () => {
  test("returns canonical role for valid input", () => {
    assert.equal(assertCanonicalRole("R3_CONSEILS"), RoleId.R3_CONSEILS);
  });

  test("throws for legacy alias", () => {
    assert.throws(() => assertCanonicalRole("R3_guide"), /Non-canonical role in output/);
  });

  test("throws for ambiguous role", () => {
    assert.throws(() => assertCanonicalRole("R3"), /Non-canonical role in output/);
  });

  test("throws for deprecated R9_GOVERNANCE in output", () => {
    assert.throws(() => assertCanonicalRole("R9_GOVERNANCE"), /Deprecated role in output/);
  });
});

describe("anti-regression: no forbidden roles in enum output path", () => {
  const outputSafeRoles = Object.values(RoleId).filter(
    (r) => r !== RoleId.R9_GOVERNANCE && r !== RoleId.R3_GUIDE,
  );

  for (const role of outputSafeRoles) {
    test(`assertCanonicalRole accepts ${role}`, () => {
      assert.equal(assertCanonicalRole(role), role);
    });
  }

  test("FORBIDDEN_ROLE_IDS all rejected by normalizeRoleId", () => {
    for (const forbidden of FORBIDDEN_ROLE_IDS) {
      assert.equal(normalizeRoleId(forbidden), null);
    }
  });

  test("every LEGACY_ROLE_ALIASES target passes assertCanonicalRole", () => {
    for (const target of Object.values(LEGACY_ROLE_ALIASES)) {
      assert.doesNotThrow(() => assertCanonicalRole(target));
    }
  });
});

describe("LEGACY_ROLE_ALIASES integrity", () => {
  test("all values are valid RoleId members", () => {
    const validRoleIds = new Set(Object.values(RoleId));
    for (const [, target] of Object.entries(LEGACY_ROLE_ALIASES)) {
      assert.equal(validRoleIds.has(target), true);
    }
  });
});
