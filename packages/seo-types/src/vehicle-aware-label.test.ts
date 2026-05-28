import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  enrichTypeNameForHeadings,
  isTypeNameAmbiguousForSeo,
  type VehicleLabelInput,
} from "./vehicle-aware-label.js";

describe("vehicle-aware-label", () => {
  describe("FIXTURES audit 2026-05-26", () => {
    it("FIXTURE #1 EXACT — C5 III 2.0 HDi 140 ch vs 163 ch", () => {
      const a = enrichTypeNameForHeadings({
        typeName: "2.0 HDi",
        powerPs: "140",
        fuel: "Diesel",
      });
      const b = enrichTypeNameForHeadings({
        typeName: "2.0 HDi",
        powerPs: "163",
        fuel: "Diesel",
      });
      assert.notStrictEqual(a.value, b.value);
      assert.strictEqual(a.value, "2.0 HDi 140 ch");
      assert.strictEqual(b.value, "2.0 HDi 163 ch");
      assert.strictEqual(a.isEnriched, true);
      assert.strictEqual(b.isEnriched, true);
    });

    it("FIXTURE #2 — 1.4 HDI Diesel 69 ch (fuel implicite, no duplication)", () => {
      const r = enrichTypeNameForHeadings({
        typeName: "1.4 HDI",
        powerPs: "69",
        fuel: "Diesel",
      });
      assert.strictEqual(r.value, "1.4 HDI 69 ch");
      assert.strictEqual(r.isEnriched, true);
    });

    it("FIXTURE #2 bis — 1.4 Essence 75 ch (fuel explicite ajouté)", () => {
      const r = enrichTypeNameForHeadings({
        typeName: "1.4",
        powerPs: "75",
        fuel: "Essence",
      });
      assert.strictEqual(r.value, "1.4 Essence 75 ch");
      assert.strictEqual(r.isEnriched, true);
    });

    it("FIXTURE #3 — 206 1.1 60 ch vs 1.4 75 ch", () => {
      const a = enrichTypeNameForHeadings({
        typeName: "1.1",
        powerPs: "60",
        fuel: "Essence",
      });
      const b = enrichTypeNameForHeadings({
        typeName: "1.4",
        powerPs: "75",
        fuel: "Essence",
      });
      assert.notStrictEqual(a.value, b.value);
      assert.strictEqual(a.value, "1.1 Essence 60 ch");
      assert.strictEqual(b.value, "1.4 Essence 75 ch");
    });
  });

  describe("Sport trim & extended fuel coverage", () => {
    it("enriches short sport trims like '2.0 RC' with power_ps", () => {
      const r = enrichTypeNameForHeadings({
        typeName: "2.0 RC",
        powerPs: "177",
      });
      assert.strictEqual(r.value, "2.0 RC 177 ch");
      assert.strictEqual(r.isEnriched, true);
    });

    it("enriches TDCI (Ford) without adding fuel", () => {
      const r = enrichTypeNameForHeadings({
        typeName: "1.4 TDCI",
        powerPs: "90",
        fuel: "Diesel",
      });
      assert.strictEqual(r.value, "1.4 TDCI 90 ch");
    });

    it("enriches CRDI (Hyundai/Kia) without adding fuel", () => {
      const r = enrichTypeNameForHeadings({
        typeName: "1.6 CRDI",
        powerPs: "115",
        fuel: "Diesel",
      });
      assert.strictEqual(r.value, "1.6 CRDI 115 ch");
    });
  });

  describe("Idempotency & normalization", () => {
    it("is idempotent when typeName already contains 'X ch'", () => {
      const r = enrichTypeNameForHeadings({
        typeName: "2.0 HDi 140 ch",
        powerPs: "140",
      });
      assert.deepStrictEqual(r, {
        value: "2.0 HDi 140 ch",
        isEnriched: false,
      });
    });

    it("normalizes powerPs with ' ch' suffix (no 'ch ch')", () => {
      const r = enrichTypeNameForHeadings({
        typeName: "2.0 HDi",
        powerPs: "140 ch",
      });
      assert.strictEqual(r.value, "2.0 HDi 140 ch");
    });

    it("handles whitespace-only powerPs as absent", () => {
      const r = enrichTypeNameForHeadings({
        typeName: "2.0 HDi",
        powerPs: "   ",
      });
      assert.deepStrictEqual(r, { value: "2.0 HDi", isEnriched: false });
    });
  });

  describe("No-op cases (zero-regression guarantee)", () => {
    it("returns baseline when powerPs is undefined", () => {
      const r = enrichTypeNameForHeadings({ typeName: "2.0 HDi" });
      assert.deepStrictEqual(r, { value: "2.0 HDi", isEnriched: false });
    });

    it("returns empty when typeName is empty", () => {
      const r = enrichTypeNameForHeadings({ typeName: "", powerPs: "140" });
      assert.deepStrictEqual(r, { value: "", isEnriched: false });
    });

    it("returns empty when input is fully empty", () => {
      const r = enrichTypeNameForHeadings({});
      assert.deepStrictEqual(r, { value: "", isEnriched: false });
    });

    it("does not enrich non-displacement labels", () => {
      for (const tn of ["GTI", "Hybrid Touring", "4x4 Limited"]) {
        const r = enrichTypeNameForHeadings({ typeName: tn, powerPs: "180" });
        assert.deepStrictEqual(
          r,
          { value: tn, isEnriched: false },
          `expected no-op for "${tn}"`,
        );
      }
    });

    it("does not enrich '1.4 HDI 16V' (3 parts) — fallback safe", () => {
      const r = enrichTypeNameForHeadings({
        typeName: "1.4 HDI 16V",
        powerPs: "90",
      });
      assert.deepStrictEqual(r, { value: "1.4 HDI 16V", isEnriched: false });
    });

    it("does not enrich '2.0i' (no space) — fallback safe", () => {
      const r = enrichTypeNameForHeadings({
        typeName: "2.0i",
        powerPs: "140",
      });
      assert.deepStrictEqual(r, { value: "2.0i", isEnriched: false });
    });
  });

  describe("Determinism", () => {
    it("produces same output for same input across multiple calls", () => {
      const input: VehicleLabelInput = {
        typeName: "2.0 HDi",
        powerPs: "140",
        fuel: "Diesel",
      };
      assert.deepStrictEqual(
        enrichTypeNameForHeadings(input),
        enrichTypeNameForHeadings(input),
      );
    });
  });

  describe("Pattern regex coverage", () => {
    it("matches displacement formats", () => {
      for (const tn of [
        "2.0",
        "1.4",
        "2,0",
        "3.0 V6",
        "1.6 TDI",
        "2.0 RC",
        "1.0",
        "5.0 V10",
      ]) {
        assert.strictEqual(
          isTypeNameAmbiguousForSeo(tn, "100"),
          true,
          `expected ambiguous match for "${tn}"`,
        );
      }
    });

    it("does not match non-displacement formats", () => {
      for (const tn of [
        "GTI",
        "Hybrid Touring",
        "4x4 Limited",
        "1.4 HDI 16V",
        "2.0i",
        "Dynamique Cuir",
        "",
      ]) {
        assert.strictEqual(
          isTypeNameAmbiguousForSeo(tn, "100"),
          false,
          `expected NO ambiguous match for "${tn}"`,
        );
      }
    });

    it("enriches '2,0 HDi' (FR comma + abbrev)", () => {
      const r = enrichTypeNameForHeadings({
        typeName: "2,0 HDi",
        powerPs: "140",
      });
      assert.strictEqual(r.value, "2,0 HDi 140 ch");
    });
  });
});
