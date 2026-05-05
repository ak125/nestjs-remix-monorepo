import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getRoleDisplayLabel,
  getRoleShortLabel,
} from "../index";

describe("getRoleDisplayLabel — canonical FR labels", () => {
  test("R3_CONSEILS → 'R3 · Conseils'", () => {
    assert.equal(getRoleDisplayLabel("R3_CONSEILS"), "R3 · Conseils");
  });

  test("R6_GUIDE_ACHAT → 'R6 · Guide d'achat'", () => {
    assert.equal(getRoleDisplayLabel("R6_GUIDE_ACHAT"), "R6 · Guide d'achat");
  });

  test("R6_SUPPORT → 'R6 · Support'", () => {
    assert.equal(getRoleDisplayLabel("R6_SUPPORT"), "R6 · Support");
  });

  test("R1_ROUTER → 'R1 · Router gamme'", () => {
    assert.equal(getRoleDisplayLabel("R1_ROUTER"), "R1 · Router gamme");
  });

  test("R8_VEHICLE → 'R8 · Véhicule'", () => {
    assert.equal(getRoleDisplayLabel("R8_VEHICLE"), "R8 · Véhicule");
  });
});

describe("getRoleDisplayLabel — legacy → canonical FR", () => {
  test("R3_guide → 'R6 · Guide d'achat'", () => {
    assert.equal(getRoleDisplayLabel("R3_guide"), "R6 · Guide d'achat");
  });

  test("R3_guide_howto → 'R3 · Conseils'", () => {
    assert.equal(getRoleDisplayLabel("R3_guide_howto"), "R3 · Conseils");
  });

  test("R3_BLOG → 'R3 · Conseils'", () => {
    assert.equal(getRoleDisplayLabel("R3_BLOG"), "R3 · Conseils");
  });

  test("R1_pieces → 'R1 · Router gamme'", () => {
    assert.equal(getRoleDisplayLabel("R1_pieces"), "R1 · Router gamme");
  });

  test("R6_BUYING_GUIDE → 'R6 · Guide d'achat'", () => {
    assert.equal(getRoleDisplayLabel("R6_BUYING_GUIDE"), "R6 · Guide d'achat");
  });
});

describe("getRoleDisplayLabel — R6 ambigu", () => {
  test("R6 bare → 'R6 · Legacy à qualifier' (NOT silently canonicalized)", () => {
    assert.equal(getRoleDisplayLabel("R6"), "R6 · Legacy à qualifier");
  });
});

describe("getRoleDisplayLabel — non-régression sur labels legacy", () => {
  test("R3_guide output never contains 'R3_guide'", () => {
    assert.equal(getRoleDisplayLabel("R3_guide").includes("R3_guide"), false);
  });

  test("R3_guide_howto output never contains 'R3_guide_howto'", () => {
    assert.equal(
      getRoleDisplayLabel("R3_guide_howto").includes("R3_guide_howto"),
      false,
    );
  });

  test("R3_BLOG output never contains 'BLOG'", () => {
    assert.equal(getRoleDisplayLabel("R3_BLOG").includes("BLOG"), false);
  });

  test("R1_pieces output never contains 'pieces'", () => {
    assert.equal(getRoleDisplayLabel("R1_pieces").includes("pieces"), false);
  });

  test("R6_BUYING_GUIDE output never contains 'BUYING'", () => {
    assert.equal(getRoleDisplayLabel("R6_BUYING_GUIDE").includes("BUYING"), false);
  });
});

describe("getRoleDisplayLabel — fallbacks", () => {
  test("null input → '—'", () => {
    assert.equal(getRoleDisplayLabel(null), "—");
  });

  test("undefined input → '—'", () => {
    assert.equal(getRoleDisplayLabel(undefined), "—");
  });

  test("empty string → '—'", () => {
    assert.equal(getRoleDisplayLabel(""), "—");
  });

  test("unknown role returns raw input (no crash)", () => {
    assert.equal(getRoleDisplayLabel("ZZZ_UNKNOWN"), "ZZZ_UNKNOWN");
  });
});

describe("getRoleShortLabel", () => {
  test("R1_ROUTER → 'R1'", () => {
    assert.equal(getRoleShortLabel("R1_ROUTER"), "R1");
  });

  test("R3_CONSEILS → 'R3'", () => {
    assert.equal(getRoleShortLabel("R3_CONSEILS"), "R3");
  });

  test("R6_GUIDE_ACHAT → 'R6'", () => {
    assert.equal(getRoleShortLabel("R6_GUIDE_ACHAT"), "R6");
  });

  test("R6_SUPPORT → 'R6'", () => {
    assert.equal(getRoleShortLabel("R6_SUPPORT"), "R6");
  });

  test("R8_VEHICLE → 'R8'", () => {
    assert.equal(getRoleShortLabel("R8_VEHICLE"), "R8");
  });

  test("R6 bare → 'R6'", () => {
    assert.equal(getRoleShortLabel("R6"), "R6");
  });

  test("legacy R3_BLOG → 'R3'", () => {
    assert.equal(getRoleShortLabel("R3_BLOG"), "R3");
  });

  test("null input → '—'", () => {
    assert.equal(getRoleShortLabel(null), "—");
  });
});
