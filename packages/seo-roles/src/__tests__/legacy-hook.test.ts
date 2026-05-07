import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  RoleId,
  normalizeRoleId,
  setLegacyResolutionHook,
  type LegacyResolutionEvent,
} from "../index";

describe("legacy resolution hook (PR-A)", () => {
  let captured: LegacyResolutionEvent[] = [];

  beforeEach(() => {
    captured = [];
    setLegacyResolutionHook((event) => captured.push(event));
  });

  afterEach(() => {
    setLegacyResolutionHook(null);
  });

  describe("invoked exactly once for univocal legacy aliases", () => {
    test("R6_GUIDE → R6_GUIDE_ACHAT emits event", () => {
      const result = normalizeRoleId("R6_GUIDE");
      assert.equal(result, RoleId.R6_GUIDE_ACHAT);
      assert.equal(captured.length, 1);
      assert.deepEqual(captured[0], {
        from: "R6_GUIDE",
        to: RoleId.R6_GUIDE_ACHAT,
      });
    });

    test("R6_BUYING_GUIDE → R6_GUIDE_ACHAT emits event", () => {
      normalizeRoleId("R6_BUYING_GUIDE");
      assert.equal(captured.length, 1);
      assert.deepEqual(captured[0], {
        from: "R6_BUYING_GUIDE",
        to: RoleId.R6_GUIDE_ACHAT,
      });
    });

    test("R3_guide → R6_GUIDE_ACHAT emits event", () => {
      normalizeRoleId("R3_guide");
      assert.equal(captured.length, 1);
      assert.deepEqual(captured[0], {
        from: "R3_guide",
        to: RoleId.R6_GUIDE_ACHAT,
      });
    });

    test("R3_guide_achat → R6_GUIDE_ACHAT emits event", () => {
      normalizeRoleId("R3_guide_achat");
      assert.equal(captured.length, 1);
      assert.deepEqual(captured[0], {
        from: "R3_guide_achat",
        to: RoleId.R6_GUIDE_ACHAT,
      });
    });

    test("R3_BLOG → R3_CONSEILS emits event", () => {
      normalizeRoleId("R3_BLOG");
      assert.equal(captured.length, 1);
      assert.deepEqual(captured[0], {
        from: "R3_BLOG",
        to: RoleId.R3_CONSEILS,
      });
    });
  });

  describe("NOT invoked for canonical inputs", () => {
    test("R6_GUIDE_ACHAT (canonical) emits nothing", () => {
      normalizeRoleId("R6_GUIDE_ACHAT");
      assert.equal(captured.length, 0);
    });

    test("R6_SUPPORT (canonical) emits nothing", () => {
      normalizeRoleId("R6_SUPPORT");
      assert.equal(captured.length, 0);
    });

    test("R3_CONSEILS (canonical) emits nothing", () => {
      normalizeRoleId("R3_CONSEILS");
      assert.equal(captured.length, 0);
    });
  });

  describe("NOT invoked for forbidden / ambiguous inputs", () => {
    test("R6 (bare, FORBIDDEN) returns null and emits nothing", () => {
      const result = normalizeRoleId("R6");
      assert.equal(result, null);
      assert.equal(captured.length, 0);
    });

    test("R3 (bare, FORBIDDEN) returns null and emits nothing", () => {
      const result = normalizeRoleId("R3");
      assert.equal(result, null);
      assert.equal(captured.length, 0);
    });

    test("R9 (bare, FORBIDDEN) returns null and emits nothing", () => {
      const result = normalizeRoleId("R9");
      assert.equal(result, null);
      assert.equal(captured.length, 0);
    });

    test("R3_GUIDE (deprecated, FORBIDDEN) returns null and emits nothing", () => {
      const result = normalizeRoleId("R3_GUIDE");
      assert.equal(result, null);
      assert.equal(captured.length, 0);
    });
  });

  describe("NOT invoked for worker page_type inputs", () => {
    test("R6_guide_achat (worker page_type) emits nothing", () => {
      const result = normalizeRoleId("R6_guide_achat");
      assert.equal(result, RoleId.R6_GUIDE_ACHAT);
      assert.equal(captured.length, 0);
    });

    test("R3_conseils (worker page_type) emits nothing", () => {
      const result = normalizeRoleId("R3_conseils");
      assert.equal(result, RoleId.R3_CONSEILS);
      assert.equal(captured.length, 0);
    });
  });

  describe("NOT invoked for unknown inputs", () => {
    test("garbage string emits nothing", () => {
      const result = normalizeRoleId("XYZ_NONSENSE");
      assert.equal(result, null);
      assert.equal(captured.length, 0);
    });

    test("empty string emits nothing", () => {
      normalizeRoleId("");
      assert.equal(captured.length, 0);
    });
  });

  describe("hook lifecycle (set / clear / replace)", () => {
    test("setLegacyResolutionHook(null) silences emissions", () => {
      setLegacyResolutionHook(null);
      normalizeRoleId("R6_GUIDE");
      assert.equal(captured.length, 0);
    });

    test("replacing the hook switches receivers (last-wins)", () => {
      const second: LegacyResolutionEvent[] = [];
      setLegacyResolutionHook((e) => second.push(e));
      normalizeRoleId("R6_GUIDE");
      assert.equal(captured.length, 0);
      assert.equal(second.length, 1);
    });

    test("multiple distinct legacy resolutions accumulate", () => {
      normalizeRoleId("R6_GUIDE");
      normalizeRoleId("R6_BUYING_GUIDE");
      normalizeRoleId("R3_guide");
      assert.equal(captured.length, 3);
      assert.deepEqual(
        captured.map((e) => e.from),
        ["R6_GUIDE", "R6_BUYING_GUIDE", "R3_guide"],
      );
    });
  });
});
