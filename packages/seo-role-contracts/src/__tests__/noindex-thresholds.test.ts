/**
 * noindex-thresholds — tests valeurs chiffrées par surface.
 *
 * Lancer : `npm run test --workspace=@repo/seo-role-contracts`
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NOINDEX_THRESHOLDS,
  NoindexThresholdsSchema,
  getThresholds,
} from "../noindex-thresholds";

describe("@repo/seo-role-contracts — noindex-thresholds", () => {
  it("R1_GAMME_VEHICLE_ROUTER applies both family and gamme thresholds", () => {
    const t = getThresholds("R1_GAMME_VEHICLE_ROUTER");
    assert.equal(t.min_families, 3);
    assert.equal(t.min_gammes, 5);
    assert.equal(t.strict_canonical_match, true);
  });

  it("R0_HOME has no family/gamme thresholds but enforces canonical match", () => {
    const t = getThresholds("R0_HOME");
    assert.equal(t.min_families, null);
    assert.equal(t.min_gammes, null);
    assert.equal(t.strict_canonical_match, true);
  });

  it("R8_VEHICLE enforces gammes>=5 (no families threshold)", () => {
    const t = getThresholds("R8_VEHICLE");
    assert.equal(t.min_families, null);
    assert.equal(t.min_gammes, 5);
  });

  it("UNAVAILABLE_410 disables strict canonical match (410 short-circuit)", () => {
    const t = getThresholds("UNAVAILABLE_410");
    assert.equal(t.strict_canonical_match, false);
    assert.equal(t.min_families, null);
    assert.equal(t.min_gammes, null);
  });

  it("every threshold record passes Zod validation", () => {
    for (const [key, value] of Object.entries(NOINDEX_THRESHOLDS)) {
      const parsed = NoindexThresholdsSchema.safeParse(value);
      assert.ok(
        parsed.success,
        `Threshold for ${key} fails Zod validation`,
      );
    }
  });
});
