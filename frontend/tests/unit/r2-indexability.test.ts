import { describe, it, expect } from "vitest";
import {
  R2_MIN_SELLABLE_PRODUCTS,
  countSellableProducts,
  readR2SellableGateConfig,
  resolveR2Robots,
} from "~/utils/seo/r2-indexability";

const p = (price: number, stock_status: string) => ({
  price_ttc: price,
  stock_status,
});

describe("countSellableProducts", () => {
  it("counts price>0 AND stock_status in {IN_STOCK,LOW_STOCK,PREORDER}", () => {
    const products = [
      p(1200, "IN_STOCK"), // ✓
      p(900, "LOW_STOCK"), // ✓
      p(1500, "PREORDER"), // ✓ preorder is sellable (pri_dispo='3')
      p(2000, "OUT_OF_STOCK"), // ✗ has a real price but unsellable
      p(0, "IN_STOCK"), // ✗ no price
    ];
    expect(countSellableProducts(products)).toBe(3);
  });

  it("does NOT treat a priced OUT_OF_STOCK piece as sellable (RPC keeps its real price)", () => {
    expect(countSellableProducts([p(5000, "OUT_OF_STOCK")])).toBe(0);
  });

  it("is empty-safe", () => {
    expect(countSellableProducts(null)).toBe(0);
    expect(countSellableProducts(undefined)).toBe(0);
    expect(countSellableProducts([])).toBe(0);
  });
});

describe("resolveR2Robots — gate OFF (legacy parity)", () => {
  // isCatalogGamme ignored when gate OFF.
  const off = {
    sellableGateEnabled: false,
    isCatalogGamme: true,
    sellableCount: 0,
    minSellable: 3,
  };

  it("index,follow when count>=2 (regardless of sellableCount)", () => {
    expect(resolveR2Robots({ ...off, count: 5, dataQuality: 0 })).toBe(
      "index, follow",
    );
  });
  it("index,follow when count===1 && dataQuality>=50", () => {
    expect(resolveR2Robots({ ...off, count: 1, dataQuality: 60 })).toBe(
      "index, follow",
    );
  });
  it("noindex,follow when count===1 && dataQuality<50", () => {
    expect(resolveR2Robots({ ...off, count: 1, dataQuality: 10 })).toBe(
      "noindex, follow",
    );
  });
  it("noindex,follow when count===0", () => {
    expect(resolveR2Robots({ ...off, count: 0, dataQuality: 0 })).toBe(
      "noindex, follow",
    );
  });
});

describe("resolveR2Robots — gate ON, catalog gamme (sellable threshold)", () => {
  const on = { sellableGateEnabled: true, isCatalogGamme: true, minSellable: 3 };

  it("index,follow when sellableCount >= threshold", () => {
    expect(
      resolveR2Robots({ ...on, sellableCount: 3, count: 99, dataQuality: 99 }),
    ).toBe("index, follow");
  });
  it("noindex,follow when sellableCount < threshold (even with many compatible products)", () => {
    expect(
      resolveR2Robots({ ...on, sellableCount: 2, count: 99, dataQuality: 99 }),
    ).toBe("noindex, follow");
  });
  it("noindex,follow when zero sellable (the priced-but-dead cohort)", () => {
    expect(
      resolveR2Robots({ ...on, sellableCount: 0, count: 40, dataQuality: 80 }),
    ).toBe("noindex, follow");
  });
  it("never emits nofollow", () => {
    for (const sellableCount of [0, 1, 2, 3, 10]) {
      const r = resolveR2Robots({ ...on, sellableCount, count: 2, dataQuality: 0 });
      expect(r).not.toContain("nofollow");
    }
  });
});

describe("resolveR2Robots — default threshold (1): noindex ONLY at 0 sellable", () => {
  const base = {
    sellableGateEnabled: true,
    isCatalogGamme: true,
    minSellable: R2_MIN_SELLABLE_PRODUCTS, // 1
  };

  it("1 sellable product → index (legitimate single-part page)", () => {
    expect(
      resolveR2Robots({ ...base, sellableCount: 1, count: 1, dataQuality: 0 }),
    ).toBe("index, follow");
  });
  it("0 sellable → noindex,follow (priced-but-dead / empty)", () => {
    expect(
      resolveR2Robots({ ...base, sellableCount: 0, count: 8, dataQuality: 90 }),
    ).toBe("noindex, follow");
  });
});

describe("resolveR2Robots — gate ON but OFF-catalog gamme (strict 232 scope)", () => {
  // Sellable gate must NOT touch gammes outside the 232 catalog set → legacy rule.
  const offCatalog = {
    sellableGateEnabled: true,
    isCatalogGamme: false,
    minSellable: 3,
  };

  it("keeps index,follow for a count>=2 off-catalog page even with 0 sellable", () => {
    expect(
      resolveR2Robots({ ...offCatalog, sellableCount: 0, count: 5, dataQuality: 0 }),
    ).toBe("index, follow");
  });
  it("uses legacy noindex for a thin off-catalog page (count 0)", () => {
    expect(
      resolveR2Robots({ ...offCatalog, sellableCount: 0, count: 0, dataQuality: 0 }),
    ).toBe("noindex, follow");
  });
});

describe("readR2SellableGateConfig", () => {
  it("defaults to disabled, threshold = R2_MIN_SELLABLE_PRODUCTS (1)", () => {
    expect(R2_MIN_SELLABLE_PRODUCTS).toBe(1);
    expect(readR2SellableGateConfig({})).toEqual({
      enabled: false,
      minSellable: R2_MIN_SELLABLE_PRODUCTS,
    });
  });
  it("enabled only when explicitly 'true'", () => {
    expect(readR2SellableGateConfig({ SEO_R2_SELLABLE_NOINDEX_ENABLED: "true" }).enabled).toBe(true);
    expect(readR2SellableGateConfig({ SEO_R2_SELLABLE_NOINDEX_ENABLED: "1" }).enabled).toBe(false);
    expect(readR2SellableGateConfig({ SEO_R2_SELLABLE_NOINDEX_ENABLED: "on" }).enabled).toBe(false);
  });
  it("threshold override accepts positive int, else falls back to default", () => {
    expect(readR2SellableGateConfig({ SEO_R2_MIN_SELLABLE_PRODUCTS: "5" }).minSellable).toBe(5);
    expect(readR2SellableGateConfig({ SEO_R2_MIN_SELLABLE_PRODUCTS: "0" }).minSellable).toBe(
      R2_MIN_SELLABLE_PRODUCTS,
    );
    expect(readR2SellableGateConfig({ SEO_R2_MIN_SELLABLE_PRODUCTS: "abc" }).minSellable).toBe(
      R2_MIN_SELLABLE_PRODUCTS,
    );
  });
});
