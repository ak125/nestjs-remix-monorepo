import { describe, it, expect } from "vitest";

import { isSellable, isPreorder } from "~/utils/stock.utils";

/**
 * Commercial sellability gate (owner rule 2026-06-04):
 *   can_sell = price_exists && supplier availability confirmed (pri_dispo IN '1','2','3').
 *
 * Replaces the temporary `hasStockAvailable() === true`, which let ~91k pieces
 * with no sellable-dispo price (rendered 0,00 €) be added to cart at price 0.
 * The R2 RPC zeroes the price for any piece without a price in
 * pri_dispo IN ('1','2','3'), so `price > 0` is the faithful frontend proxy;
 * `stockStatus` (when surfaced) additionally excludes OUT_OF_STOCK explicitly.
 */
describe("isSellable — commercial gate", () => {
  it("blocks the 0,00 € defect: price 0 is never sellable", () => {
    expect(isSellable(0)).toBe(false);
    expect(isSellable(0, "IN_STOCK")).toBe(false); // price gate dominates
  });

  it("blocks missing / invalid / negative price", () => {
    expect(isSellable(undefined)).toBe(false);
    expect(isSellable(Number.NaN)).toBe(false);
    expect(isSellable(-5)).toBe(false);
  });

  it("sells when price>0 and no stock signal is surfaced (relies on price>0)", () => {
    expect(isSellable(42.9)).toBe(true);
    expect(isSellable(42.9, "")).toBe(true);
  });

  it("sells for confirmed-available statuses (pri_dispo 1/2/3)", () => {
    expect(isSellable(42.9, "IN_STOCK")).toBe(true); // '1'
    expect(isSellable(42.9, "LOW_STOCK")).toBe(true); // '2'
    expect(isSellable(42.9, "PREORDER")).toBe(true); // '3' — sur commande
    expect(isSellable(42.9, "En stock")).toBe(true); // legacy label
    expect(isSellable(42.9, "Sur commande")).toBe(true); // legacy label
  });

  it("blocks OUT_OF_STOCK even with a non-zero price", () => {
    expect(isSellable(42.9, "OUT_OF_STOCK")).toBe(false);
  });
});

describe("isPreorder — sur commande", () => {
  it("is true only for preorder statuses", () => {
    expect(isPreorder("PREORDER")).toBe(true);
    expect(isPreorder("Sur commande")).toBe(true);
    expect(isPreorder("IN_STOCK")).toBe(false);
    expect(isPreorder(undefined)).toBe(false);
  });
});
