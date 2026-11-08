/**
 * r8-tecdoc-release-gate — bornes de la plage TecDoc R8 (servie noindex).
 *
 * Lancer : `npm run test --workspace=@repo/seo-role-contracts`
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  R8_TECDOC_RELEASE_GATE_RANGE,
  isR8TecdocReleaseGateOpen,
} from "../r8-tecdoc-release-gate";

describe("@repo/seo-role-contracts — isR8TecdocReleaseGateOpen", () => {
  it("bornes incluses [60000, 83456]", () => {
    assert.equal(isR8TecdocReleaseGateOpen(59999), false);
    assert.equal(isR8TecdocReleaseGateOpen(60000), true);
    assert.equal(isR8TecdocReleaseGateOpen(83389), true);
    assert.equal(isR8TecdocReleaseGateOpen(83456), true);
    assert.equal(isR8TecdocReleaseGateOpen(83457), false);
  });

  it("type_id legacy hors plage", () => {
    assert.equal(isR8TecdocReleaseGateOpen(19053), false);
  });

  it("plage exposée identique au prédicat", () => {
    assert.deepEqual(R8_TECDOC_RELEASE_GATE_RANGE, { min: 60000, max: 83456 });
  });
});
