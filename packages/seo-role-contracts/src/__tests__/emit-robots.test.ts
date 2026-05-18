/**
 * emit-robots — tests symétrie meta == header par construction.
 *
 * Single emission point V1 (cf. plan UIDP v5) :
 *   - Le seul module qui mappe enum → texte HTTP
 *   - `metaContent === headerValue` garanti (futur split V2+ documenté ADR)
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emitRobotsForVerdict } from "../emit-robots";
import {
  RobotsVerdictKind,
  ReasonCode,
  type IndexabilityVerdict,
} from "../robots-verdict";

const baseContext = {
  surfaceKey: "R8_VEHICLE" as const,
  requestedUrl: "https://x/a",
  canonicalUrl: "https://x/a",
  computedAt: "2026-05-17T00:00:00.000Z",
};

describe("@repo/seo-role-contracts — emitRobotsForVerdict", () => {
  it("INDEX_FOLLOW → 'index, follow' (meta === header)", () => {
    const verdict: IndexabilityVerdict = {
      kind: RobotsVerdictKind.INDEX_FOLLOW,
      reasonCodes: [],
      context: baseContext,
    };
    const emit = emitRobotsForVerdict(verdict);
    assert.equal(emit.metaContent, "index, follow");
    assert.equal(emit.headerValue, "index, follow");
    assert.equal(emit.metaContent, emit.headerValue);
  });

  it("NOINDEX_FOLLOW → 'noindex, follow' (meta === header)", () => {
    const verdict: IndexabilityVerdict = {
      kind: RobotsVerdictKind.NOINDEX_FOLLOW,
      reasonCodes: [ReasonCode.FAMILIES_BELOW_THRESHOLD],
      context: baseContext,
    };
    const emit = emitRobotsForVerdict(verdict);
    assert.equal(emit.metaContent, "noindex, follow");
    assert.equal(emit.headerValue, "noindex, follow");
    assert.equal(emit.metaContent, emit.headerValue);
  });

  it("NOINDEX_NOFOLLOW → 'noindex, nofollow' (meta === header)", () => {
    const verdict: IndexabilityVerdict = {
      kind: RobotsVerdictKind.NOINDEX_NOFOLLOW,
      reasonCodes: [ReasonCode.CANONICAL_MISMATCH],
      context: baseContext,
    };
    const emit = emitRobotsForVerdict(verdict);
    assert.equal(emit.metaContent, "noindex, nofollow");
    assert.equal(emit.headerValue, "noindex, nofollow");
  });

  it("invariant : metaContent === headerValue pour TOUS les kinds V1", () => {
    for (const kind of Object.values(RobotsVerdictKind)) {
      const verdict: IndexabilityVerdict = {
        kind,
        reasonCodes: [],
        context: baseContext,
      };
      const emit = emitRobotsForVerdict(verdict);
      assert.equal(
        emit.metaContent,
        emit.headerValue,
        `Divergence détectée pour kind ${kind} — viole l'invariant V1 (cf. plan § "split V2+")`,
      );
    }
  });
});
