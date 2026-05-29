import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  pickH1Suffix,
  selectFromPool,
  SEO_PRICE_VARIATIONS,
} from "./seo-variations.js";

describe("selectFromPool", () => {
  it("deterministic rotation by (typeId+pgId+offset)", () => {
    const pool = ["A", "B", "C", "D", "E"];
    // (0+0+0) % 5 = 0 → "A"
    assert.strictEqual(selectFromPool(pool, { typeId: 0, pgId: 0 }), "A");
    // (1+0+0) % 5 = 1 → "B"
    assert.strictEqual(selectFromPool(pool, { typeId: 1, pgId: 0 }), "B");
    // (0+0+2) % 5 = 2 → "C"
    assert.strictEqual(selectFromPool(pool, { typeId: 0, pgId: 0 }, 2), "C");
  });

  it("returns undefined when pool empty", () => {
    assert.strictEqual(selectFromPool([], { typeId: 1, pgId: 1 }), undefined);
  });

  it("normalizes negative modulo (defensive)", () => {
    const pool = ["A", "B", "C"];
    // (0+0-1) % 3 = -1 → normalized to 2 → "C"
    assert.strictEqual(selectFromPool(pool, { typeId: 0, pgId: 0 }, -1), "C");
  });
});

describe("pickH1Suffix", () => {
  it("primary compSwitch2 when non-empty (deterministic exact match)", () => {
    const compSwitch2 = [
      "synchroniser les soupapes",
      "entraîner la pompe à eau",
    ];
    const ctx = { typeId: 9466, pgId: 307 };
    // (9466 + 307 + 2) % 2 = 9775 % 2 = 1 → index 1
    const r = pickH1Suffix({
      compSwitch2,
      priceVariations: SEO_PRICE_VARIATIONS,
      ctx,
    });
    assert.strictEqual(r, "entraîner la pompe à eau");
  });

  it("fallback priceVariations when compSwitch2 empty", () => {
    // (31997 + 3902 + 0) % 7 = 35899 % 7 = 3 → SEO_PRICE_VARIATIONS[3] = "économique"
    const r = pickH1Suffix({
      compSwitch2: [],
      priceVariations: SEO_PRICE_VARIATIONS,
      ctx: { typeId: 31997, pgId: 3902 },
    });
    assert.strictEqual(r, "économique");
  });

  it("fallback literal when both pools empty", () => {
    const r = pickH1Suffix({
      compSwitch2: [],
      priceVariations: [],
      ctx: { typeId: 1, pgId: 1 },
      literalFallback: "au meilleur prix",
    });
    assert.strictEqual(r, "au meilleur prix");
  });

  it("fallback literal defaults to 'au meilleur prix'", () => {
    const r = pickH1Suffix({
      compSwitch2: [],
      priceVariations: [],
      ctx: { typeId: 1, pgId: 1 },
    });
    assert.strictEqual(r, "au meilleur prix");
  });

  it("normalizes trailing punctuation", () => {
    // (0+0+2) % 1 = 0 → only element
    const r = pickH1Suffix({
      compSwitch2: ["synchroniser les soupapes."],
      priceVariations: SEO_PRICE_VARIATIONS,
      ctx: { typeId: 0, pgId: 0 },
    });
    assert.strictEqual(r, "synchroniser les soupapes");
  });

  it("collapses multiple whitespace", () => {
    const r = pickH1Suffix({
      compSwitch2: ["entraîner  la  pompe"],
      priceVariations: SEO_PRICE_VARIATIONS,
      ctx: { typeId: 0, pgId: 0 },
    });
    assert.strictEqual(r, "entraîner la pompe");
  });

  it("is deterministic across multiple calls", () => {
    const opts = {
      compSwitch2: ["A", "B", "C"],
      priceVariations: SEO_PRICE_VARIATIONS,
      ctx: { typeId: 100, pgId: 200 },
    };
    assert.strictEqual(pickH1Suffix(opts), pickH1Suffix(opts));
    assert.strictEqual(pickH1Suffix(opts), pickH1Suffix(opts));
  });

  it("4 audit fixtures produce >= 3 distinct suffixes (rotation OK)", () => {
    // Représente la situation réelle post-deploy : pg_id=307 a compSwitch2 chargé,
    // pg_id=3902 n'a pas de rows alias=2 → fallback SEO_PRICE_VARIATIONS.
    const compSwitch2_307 = [
      "synchroniser les soupapes",
      "entraîner la pompe à eau",
      "optimiser les performances",
    ];
    const fixtures = [
      { typeId: 30091, pgId: 307 },
      { typeId: 9466, pgId: 307 },
      { typeId: 31997, pgId: 3902 },
      { typeId: 32794, pgId: 3902 },
    ];
    const results = fixtures.map((ctx) =>
      pickH1Suffix({
        compSwitch2: ctx.pgId === 307 ? compSwitch2_307 : [],
        priceVariations: SEO_PRICE_VARIATIONS,
        ctx,
      }),
    );
    const distinct = new Set(results);
    assert.ok(
      distinct.size >= 3,
      `expected >=3 distinct suffixes, got ${distinct.size}: ${JSON.stringify(results)}`,
    );
    // None ends with "au meilleur prix" via fallback literal (because both pools non-empty)
    const allLiteralFallback = results.every((r) => r === "au meilleur prix");
    assert.ok(
      !allLiteralFallback,
      "expected at least one suffix from compSwitch2 or priceVariations rotation",
    );
  });

  it("SEO_PRICE_VARIATIONS contains 7 distinct entries", () => {
    assert.strictEqual(SEO_PRICE_VARIATIONS.length, 7);
    assert.strictEqual(new Set(SEO_PRICE_VARIATIONS).size, 7);
  });
});
