/**
 * compose-indexability — tests cascade (PR-UIDP-1).
 *
 * Couverture :
 *   - 8 branches de la cascade (canonical, R2_missing, R2_fail, families,
 *     gammes, fingerprint, tecdoc, default index)
 *   - Invariants v5/C2 (length ≤ 1, kind↔reasonCodes coherence)
 *   - Per-surface (R0..R8) — pas de surface oubliée
 *   - Pureté (même input → même verdict.kind + reasonCodes)
 *
 * Lancer : `npm run test --workspace=@repo/seo-role-contracts`
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeIndexabilityVerdict,
} from "../compose-indexability";
import {
  ReasonCode,
  RobotsVerdictKind,
  type IndexabilityInput,
} from "../robots-verdict";
import type { R2IndexabilityConditions } from "../r2-indexability-conditions";

const R2_OK: R2IndexabilityConditions = {
  has_price: true,
  has_stock: true,
  has_image: true,
  has_oem_ref: true,
  has_equivalent_ref: false,
  has_unique_product_ref: true,
  has_valid_canonical: true,
  is_duplicate_variant: false,
};

const R2_FAIL_NO_IMAGE: R2IndexabilityConditions = {
  ...R2_OK,
  has_image: false,
};

const URL_CANON = "https://www.automecanik.com/pieces/foo-1/bar-2/baz-3/qux-4.html";

describe("@repo/seo-role-contracts — computeIndexabilityVerdict — cascade", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. CANONICAL_MISMATCH (exclusif court-circuit)
  // ───────────────────────────────────────────────────────────────────────────
  describe("step 1 — canonical mismatch", () => {
    it("returns NOINDEX_NOFOLLOW + [CANONICAL_MISMATCH] when URL ≠ canonical (R8)", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: "https://www.automecanik.com/constructeurs/foo.html?utm=a",
        canonicalUrl: "https://www.automecanik.com/constructeurs/foo.html",
        availableGammes: 10,
      });
      assert.equal(v.kind, RobotsVerdictKind.NOINDEX_NOFOLLOW);
      assert.deepEqual(v.reasonCodes, [ReasonCode.CANONICAL_MISMATCH]);
    });

    it("canonical mismatch is exclusive (length === 1 même si families<3 aussi)", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R1_GAMME_ROUTER",
        requestedUrl: "https://x/a?utm=z",
        canonicalUrl: "https://x/a",
        availableFamilies: 0, // serait FAMILIES_BELOW_THRESHOLD si pas court-circuité
      });
      assert.equal(v.reasonCodes.length, 1);
      assert.equal(v.reasonCodes[0], ReasonCode.CANONICAL_MISMATCH);
    });

    it("R0_HOME (strict_canonical_match=true) déclenche le mismatch", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R0_HOME",
        requestedUrl: "https://www.automecanik.com/?ref=foo",
        canonicalUrl: "https://www.automecanik.com/",
      });
      assert.equal(v.kind, RobotsVerdictKind.NOINDEX_NOFOLLOW);
    });

    it("UNAVAILABLE_410 (strict_canonical_match=false) ne déclenche PAS mismatch", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "UNAVAILABLE_410",
        requestedUrl: "https://x/a?b=c",
        canonicalUrl: "https://x/a",
      });
      // Pas de blocage canonical → continue cascade → default index
      assert.equal(v.kind, RobotsVerdictKind.INDEX_FOLLOW);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. R2_CONDITIONS_MISSING (fail-safe)
  // ───────────────────────────────────────────────────────────────────────────
  describe("step 2 — R2 conditions missing", () => {
    it("R2_PRODUCT sans r2Conditions → NOINDEX_NOFOLLOW + [R2_CONDITIONS_MISSING]", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R2_PRODUCT",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
      });
      assert.equal(v.kind, RobotsVerdictKind.NOINDEX_NOFOLLOW);
      assert.deepEqual(v.reasonCodes, [ReasonCode.R2_CONDITIONS_MISSING]);
    });

    it("R2_PRODUCT_LIST sans r2Conditions → R2_CONDITIONS_MISSING", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R2_PRODUCT_LIST",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
      });
      assert.deepEqual(v.reasonCodes, [ReasonCode.R2_CONDITIONS_MISSING]);
    });

    it("R2_PRODUCT_IN_VEHICLE sans r2Conditions → R2_CONDITIONS_MISSING", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R2_PRODUCT_IN_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
      });
      assert.deepEqual(v.reasonCodes, [ReasonCode.R2_CONDITIONS_MISSING]);
    });

    it("R8_VEHICLE sans r2Conditions n'a PAS de R2 gate (pas R2 surface)", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableGammes: 10,
      });
      assert.equal(v.kind, RobotsVerdictKind.INDEX_FOLLOW);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. R2_GATE_FAIL
  // ───────────────────────────────────────────────────────────────────────────
  describe("step 3 — R2 gate fail", () => {
    it("R2_PRODUCT + r2Conditions OK → INDEX_FOLLOW", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R2_PRODUCT",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        r2Conditions: R2_OK,
      });
      assert.equal(v.kind, RobotsVerdictKind.INDEX_FOLLOW);
      assert.deepEqual(v.reasonCodes, []);
    });

    it("R2_PRODUCT + has_image=false → NOINDEX_NOFOLLOW + [R2_GATE_FAIL]", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R2_PRODUCT",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        r2Conditions: R2_FAIL_NO_IMAGE,
      });
      assert.equal(v.kind, RobotsVerdictKind.NOINDEX_NOFOLLOW);
      assert.deepEqual(v.reasonCodes, [ReasonCode.R2_GATE_FAIL]);
    });

    it("R2_PRODUCT + duplicate_variant=true → R2_GATE_FAIL", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R2_PRODUCT",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        r2Conditions: { ...R2_OK, is_duplicate_variant: true },
      });
      assert.deepEqual(v.reasonCodes, [ReasonCode.R2_GATE_FAIL]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. FAMILIES_BELOW_THRESHOLD (R1, R6, R7)
  // ───────────────────────────────────────────────────────────────────────────
  describe("step 4 — families below threshold", () => {
    it("R1_GAMME_ROUTER + families=2 (< 3) → NOINDEX_FOLLOW", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R1_GAMME_ROUTER",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableFamilies: 2,
      });
      assert.equal(v.kind, RobotsVerdictKind.NOINDEX_FOLLOW);
      assert.deepEqual(v.reasonCodes, [ReasonCode.FAMILIES_BELOW_THRESHOLD]);
    });

    it("R1_GAMME_ROUTER + families=3 (= threshold) → INDEX_FOLLOW", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R1_GAMME_ROUTER",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableFamilies: 3,
      });
      assert.equal(v.kind, RobotsVerdictKind.INDEX_FOLLOW);
    });

    it("R6_BUYING_GUIDE + families=1 → NOINDEX_FOLLOW", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R6_BUYING_GUIDE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableFamilies: 1,
      });
      assert.deepEqual(v.reasonCodes, [ReasonCode.FAMILIES_BELOW_THRESHOLD]);
    });

    it("R7_BRAND_HUB + families<3 → NOINDEX_FOLLOW", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R7_BRAND_HUB",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableFamilies: 0,
      });
      assert.deepEqual(v.reasonCodes, [ReasonCode.FAMILIES_BELOW_THRESHOLD]);
    });

    it("R8_VEHICLE n'a PAS de min_families (null) → ne déclenche pas", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableFamilies: 0,
        availableGammes: 10,
      });
      assert.equal(v.kind, RobotsVerdictKind.INDEX_FOLLOW);
    });

    it("availableFamilies undefined ne déclenche pas (input optional)", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R1_GAMME_ROUTER",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        // availableFamilies absent
      });
      assert.equal(v.kind, RobotsVerdictKind.INDEX_FOLLOW);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. GAMMES_BELOW_THRESHOLD (R1_GAMME_VEHICLE_ROUTER, R8)
  // ───────────────────────────────────────────────────────────────────────────
  describe("step 5 — gammes below threshold", () => {
    it("R8_VEHICLE + gammes=4 (< 5) → NOINDEX_FOLLOW", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableGammes: 4,
      });
      assert.equal(v.kind, RobotsVerdictKind.NOINDEX_FOLLOW);
      assert.deepEqual(v.reasonCodes, [ReasonCode.GAMMES_BELOW_THRESHOLD]);
    });

    it("R8_VEHICLE + gammes=5 → INDEX_FOLLOW", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableGammes: 5,
      });
      assert.equal(v.kind, RobotsVerdictKind.INDEX_FOLLOW);
    });

    it("R1_GAMME_VEHICLE_ROUTER + families=3 + gammes=4 → GAMMES (familles OK passées)", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R1_GAMME_VEHICLE_ROUTER",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableFamilies: 3,
        availableGammes: 4,
      });
      assert.deepEqual(v.reasonCodes, [ReasonCode.GAMMES_BELOW_THRESHOLD]);
    });

    it("R2_PRODUCT_LIST + gammes=0 → GAMMES_BELOW_THRESHOLD (threshold=1)", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R2_PRODUCT_LIST",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        r2Conditions: R2_OK,
        availableGammes: 0,
      });
      assert.deepEqual(v.reasonCodes, [ReasonCode.GAMMES_BELOW_THRESHOLD]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5b. SOFT_404_EMPTY_CONTENT (caller flag — ADR-095 §1, après gammes/avant fingerprint)
  // ───────────────────────────────────────────────────────────────────────────
  describe("step 5b — soft-404 empty content", () => {
    it("soft404=true → NOINDEX_FOLLOW + [SOFT_404_EMPTY_CONTENT]", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableGammes: 10,
        soft404: true,
      });
      assert.equal(v.kind, RobotsVerdictKind.NOINDEX_FOLLOW);
      assert.deepEqual(v.reasonCodes, [ReasonCode.SOFT_404_EMPTY_CONTENT]);
    });

    it("soft404=false explicite ne déclenche pas", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableGammes: 10,
        soft404: false,
      });
      assert.equal(v.kind, RobotsVerdictKind.INDEX_FOLLOW);
    });

    it("soft404 undefined ne déclenche pas (behaviour-preserving — callers existants)", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableGammes: 10,
      });
      assert.equal(v.kind, RobotsVerdictKind.INDEX_FOLLOW);
    });

    it("gammes<threshold court-circuite AVANT soft-404 (ordre cascade : 5 avant 5b)", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableGammes: 4, // < 5 → GAMMES_BELOW_THRESHOLD doit gagner
        soft404: true,
      });
      assert.deepEqual(v.reasonCodes, [ReasonCode.GAMMES_BELOW_THRESHOLD]);
    });

    it("soft-404 court-circuite AVANT fingerprint (ordre cascade : 5b avant 6)", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableGammes: 10,
        soft404: true,
        fingerprintMatch: true, // serait FINGERPRINT_DUPLICATE si pas court-circuité
      });
      assert.deepEqual(v.reasonCodes, [ReasonCode.SOFT_404_EMPTY_CONTENT]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. FINGERPRINT_DUPLICATE
  // ───────────────────────────────────────────────────────────────────────────
  describe("step 6 — fingerprint duplicate", () => {
    it("fingerprintMatch=true → NOINDEX_FOLLOW + [FINGERPRINT_DUPLICATE]", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableGammes: 10,
        fingerprintMatch: true,
      });
      assert.equal(v.kind, RobotsVerdictKind.NOINDEX_FOLLOW);
      assert.deepEqual(v.reasonCodes, [ReasonCode.FINGERPRINT_DUPLICATE]);
    });

    it("fingerprintMatch=false explicite ne déclenche pas", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableGammes: 10,
        fingerprintMatch: false,
      });
      assert.equal(v.kind, RobotsVerdictKind.INDEX_FOLLOW);
    });

    it("fingerprintMatch undefined ne déclenche pas (PR-9 inactif sur surface)", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableGammes: 10,
      });
      assert.equal(v.kind, RobotsVerdictKind.INDEX_FOLLOW);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. TECDOC_RELEASE_GATE (caller flag, R8)
  // ───────────────────────────────────────────────────────────────────────────
  describe("step 7 — tecdoc release gate", () => {
    it("tecdocReleaseGateOpen=true → NOINDEX_NOFOLLOW + [TECDOC_RELEASE_GATE]", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableGammes: 10,
        tecdocReleaseGateOpen: true,
      });
      assert.equal(v.kind, RobotsVerdictKind.NOINDEX_NOFOLLOW);
      assert.deepEqual(v.reasonCodes, [ReasonCode.TECDOC_RELEASE_GATE]);
    });

    it("tecdocReleaseGateOpen=false ne déclenche pas", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableGammes: 10,
        tecdocReleaseGateOpen: false,
      });
      assert.equal(v.kind, RobotsVerdictKind.INDEX_FOLLOW);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Default INDEX_FOLLOW
  // ───────────────────────────────────────────────────────────────────────────
  describe("step 8 — default index", () => {
    it("R0_HOME canonical match → INDEX_FOLLOW + reasonCodes:[]", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R0_HOME",
        requestedUrl: "https://www.automecanik.com/",
        canonicalUrl: "https://www.automecanik.com/",
      });
      assert.equal(v.kind, RobotsVerdictKind.INDEX_FOLLOW);
      assert.deepEqual(v.reasonCodes, []);
    });

    it("R3_ADVICE canonical match → INDEX_FOLLOW", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R3_ADVICE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
      });
      assert.equal(v.kind, RobotsVerdictKind.INDEX_FOLLOW);
    });

    it("BLOG_ARTICLE canonical match → INDEX_FOLLOW", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "BLOG_ARTICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
      });
      assert.equal(v.kind, RobotsVerdictKind.INDEX_FOLLOW);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // INVARIANTS V1 (v5/C2)
  // ───────────────────────────────────────────────────────────────────────────
  describe("invariants V1 (v5/C2) — reasonCodes.length ≤ 1", () => {
    const samples: IndexabilityInput[] = [
      // INDEX_FOLLOW cases
      { surfaceKey: "R0_HOME", requestedUrl: "https://x/", canonicalUrl: "https://x/" },
      { surfaceKey: "R3_ADVICE", requestedUrl: URL_CANON, canonicalUrl: URL_CANON },
      { surfaceKey: "R8_VEHICLE", requestedUrl: URL_CANON, canonicalUrl: URL_CANON, availableGammes: 10 },
      // NOINDEX cases (toutes branches)
      { surfaceKey: "R1_GAMME_ROUTER", requestedUrl: "https://x/?q=a", canonicalUrl: "https://x/" },
      { surfaceKey: "R2_PRODUCT", requestedUrl: URL_CANON, canonicalUrl: URL_CANON },
      { surfaceKey: "R2_PRODUCT", requestedUrl: URL_CANON, canonicalUrl: URL_CANON, r2Conditions: R2_FAIL_NO_IMAGE },
      { surfaceKey: "R1_GAMME_ROUTER", requestedUrl: URL_CANON, canonicalUrl: URL_CANON, availableFamilies: 0 },
      { surfaceKey: "R8_VEHICLE", requestedUrl: URL_CANON, canonicalUrl: URL_CANON, availableGammes: 1 },
      { surfaceKey: "R8_VEHICLE", requestedUrl: URL_CANON, canonicalUrl: URL_CANON, availableGammes: 10, soft404: true },
      { surfaceKey: "R8_VEHICLE", requestedUrl: URL_CANON, canonicalUrl: URL_CANON, availableGammes: 10, fingerprintMatch: true },
      { surfaceKey: "R8_VEHICLE", requestedUrl: URL_CANON, canonicalUrl: URL_CANON, availableGammes: 10, tecdocReleaseGateOpen: true },
    ];

    for (const sample of samples) {
      it(`invariant: ${sample.surfaceKey} length ≤ 1`, () => {
        const v = computeIndexabilityVerdict(sample);
        assert.ok(v.reasonCodes.length <= 1, `reasonCodes too long: ${JSON.stringify(v.reasonCodes)}`);
      });

      it(`invariant: ${sample.surfaceKey} kind↔length coherence`, () => {
        const v = computeIndexabilityVerdict(sample);
        if (v.kind === RobotsVerdictKind.INDEX_FOLLOW) {
          assert.equal(v.reasonCodes.length, 0, "INDEX_FOLLOW must have 0 reason codes");
        } else {
          assert.equal(v.reasonCodes.length, 1, "NOINDEX_* must have exactly 1 reason code");
        }
      });
    }

    it("context.computedAt is ISO-8601", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R0_HOME",
        requestedUrl: "https://x/",
        canonicalUrl: "https://x/",
      });
      assert.match(v.context.computedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("context preserves surfaceKey + URLs", () => {
      const v = computeIndexabilityVerdict({
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableGammes: 10,
      });
      assert.equal(v.context.surfaceKey, "R8_VEHICLE");
      assert.equal(v.context.requestedUrl, URL_CANON);
      assert.equal(v.context.canonicalUrl, URL_CANON);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Pureté
  // ───────────────────────────────────────────────────────────────────────────
  describe("pureté", () => {
    it("même input → même kind + reasonCodes (context.computedAt diffère, OK)", () => {
      const input: IndexabilityInput = {
        surfaceKey: "R8_VEHICLE",
        requestedUrl: URL_CANON,
        canonicalUrl: URL_CANON,
        availableGammes: 10,
        tecdocReleaseGateOpen: true,
      };
      const v1 = computeIndexabilityVerdict(input);
      const v2 = computeIndexabilityVerdict(input);
      assert.equal(v1.kind, v2.kind);
      assert.deepEqual(v1.reasonCodes, v2.reasonCodes);
    });
  });
});
