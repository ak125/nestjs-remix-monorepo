import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildR2TitleTypeLabel,
  enrichTypeNameForHeadings,
  FUEL_IMPLYING_TYPE_TOKENS,
  isFuelImpliedByTypeName,
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

  describe("FUEL_IMPLYING_TYPE_TOKENS — liste unique (mandat DW 2026-11-19)", () => {
    it("aucun jeton en double (casse ignorée)", () => {
      const seen = new Set<string>();
      for (const t of FUEL_IMPLYING_TYPE_TOKENS) {
        const k = t.token.toLowerCase();
        assert.ok(!seen.has(k), `doublon ${t.token}`);
        seen.add(k);
      }
    });

    it("sous-ensemble legacyHeading = ancienne liste du H1", () => {
      const legacy = FUEL_IMPLYING_TYPE_TOKENS.filter((t) => t.legacyHeading)
        .map((t) => t.token.toUpperCase())
        .sort();
      assert.deepStrictEqual(legacy, [
        "CDI",
        "CRDI",
        "D",
        "DCI",
        "HDI",
        "JTD",
        "TDCI",
        "TDI",
      ]);
    });

    it("H1 inchangé : enrichissement identique à l'ancien motif", () => {
      const OLD = /\b(HDI|HDi|TDI|TDi|DCI|dCi|CDI|JTD|TDCI|CRDI|D)\b/i;
      const corpus = [
        "2.0 HDi",
        "1.5 dCi",
        "1.6 TDI",
        "1.9 D",
        "1.6 e-HDi",
        "1.4",
        "2.0 TDCi",
        "2.2 CRDi",
        "1.3 JTD",
        "2.2 CDI",
        "1.6 BlueHDi",
        "1.2 PureTech",
        "1.4 TSI",
        "2.0 TD",
        "1.9 TID",
        "1.8 T",
        "2.0 i",
        "3.0 V6",
        "1.6 16V",
        "1.6 D4D",
      ];
      for (const typeName of corpus) {
        for (const fuel of ["Diesel", "Essence", ""]) {
          const got = enrichTypeNameForHeadings({
            typeName,
            powerPs: "90",
            fuel,
          });
          const expected = isTypeNameAmbiguousForSeo(typeName, "90")
            ? `${typeName} ${!OLD.test(typeName) && fuel ? `${fuel} ` : ""}90 ch`
            : typeName;
          assert.strictEqual(got.value, expected, `${typeName} / ${fuel}`);
        }
      }
    });
  });

  describe("isFuelImpliedByTypeName", () => {
    it("jeton du même carburant → implicite", () => {
      assert.ok(isFuelImpliedByTypeName("1.5 dCi", "Diesel"));
      assert.ok(isFuelImpliedByTypeName("1.6 e-HDi", "diesel"));
      assert.ok(isFuelImpliedByTypeName("1.2 PureTech", "Essence"));
      assert.ok(isFuelImpliedByTypeName("1.4 T-Jet", "Essence"));
      assert.ok(isFuelImpliedByTypeName("1.9 D", " Diesel "));
    });

    it("carburant différent ou hybride → non implicite", () => {
      assert.ok(!isFuelImpliedByTypeName("2.0 BlueHDi", "Diesel-Électrique"));
      assert.ok(!isFuelImpliedByTypeName("1.4 TSI", "Essence-Électrique"));
      assert.ok(!isFuelImpliedByTypeName("1.5 dCi", "Essence"));
      assert.ok(!isFuelImpliedByTypeName("1.4 TSI", "Essence-Gaz GNC"));
    });

    it("mot entier seulement", () => {
      assert.ok(!isFuelImpliedByTypeName("1.6 GTD", "Diesel"));
      assert.ok(!isFuelImpliedByTypeName("2.0 TDIx", "Diesel"));
      assert.ok(!isFuelImpliedByTypeName("1.4 16V", "Essence"));
      assert.ok(!isFuelImpliedByTypeName("", "Diesel"));
      assert.ok(!isFuelImpliedByTypeName("1.5 dCi", ""));
    });
  });

  describe("buildR2TitleTypeLabel — « <type> [carburant] <puissance> ch »", () => {
    it("carburant écrit quand le type ne le dit pas", () => {
      assert.strictEqual(
        buildR2TitleTypeLabel({
          typeName: "1.4",
          powerPs: "75",
          fuel: "Essence",
        }),
        "1.4 Essence 75 ch",
      );
      assert.strictEqual(
        buildR2TitleTypeLabel({
          typeName: "1.4 16V",
          powerPs: "88",
          fuel: "Essence",
        }),
        "1.4 16V Essence 88 ch",
      );
    });

    it("carburant implicite omis", () => {
      assert.strictEqual(
        buildR2TitleTypeLabel({
          typeName: "1.5 dCi",
          powerPs: "86",
          fuel: "Diesel",
        }),
        "1.5 dCi 86 ch",
      );
      assert.strictEqual(
        buildR2TitleTypeLabel({
          typeName: "1.2 PureTech",
          powerPs: "110",
          fuel: "Essence",
        }),
        "1.2 PureTech 110 ch",
      );
    });

    it("hybride : le carburant reste écrit malgré le jeton", () => {
      assert.strictEqual(
        buildR2TitleTypeLabel({
          typeName: "2.0 BlueHDi",
          powerPs: "180",
          fuel: "Diesel-Électrique",
        }),
        "2.0 BlueHDi Diesel-Électrique 180 ch",
      );
    });

    it("carburant déjà écrit dans le type → pas de répétition", () => {
      assert.strictEqual(
        buildR2TitleTypeLabel({
          typeName: "3.0 Essence",
          powerPs: "211",
          fuel: "Essence",
        }),
        "3.0 Essence 211 ch",
      );
    });

    it("idempotent sur un type déjà enrichi par le H1", () => {
      const raw = { typeName: "1.4", powerPs: "75", fuel: "Essence" };
      const enriched = enrichTypeNameForHeadings({ ...raw, fuel: undefined });
      assert.strictEqual(enriched.value, "1.4 75 ch");
      assert.strictEqual(
        buildR2TitleTypeLabel({ ...raw, typeName: enriched.value }),
        buildR2TitleTypeLabel(raw),
      );
      const withFuel = enrichTypeNameForHeadings(raw);
      assert.strictEqual(
        buildR2TitleTypeLabel({ ...raw, typeName: withFuel.value }),
        "1.4 Essence 75 ch",
      );
    });

    it("données absentes : rien d'inventé", () => {
      assert.strictEqual(buildR2TitleTypeLabel({ typeName: "1.4" }), "1.4");
      assert.strictEqual(
        buildR2TitleTypeLabel({ typeName: "1.4", powerPs: "75" }),
        "1.4 75 ch",
      );
      assert.strictEqual(
        buildR2TitleTypeLabel({ typeName: "1.4", fuel: "Essence" }),
        "1.4 Essence",
      );
      assert.strictEqual(
        buildR2TitleTypeLabel({
          typeName: "1.4",
          powerPs: "75 ch",
          fuel: "Essence",
        }),
        "1.4 Essence 75 ch",
      );
    });
  });
});
