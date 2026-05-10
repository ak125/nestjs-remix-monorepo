/**
 * r2-indexability-conditions — tests gate R2 (7 conditions cumulatives).
 *
 * Lancer : `npm run test --workspace=@repo/seo-role-contracts`
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateR2Indexability,
  type R2IndexabilityConditions,
} from "../r2-indexability-conditions";

const ALL_OK: R2IndexabilityConditions = {
  has_price: true,
  has_stock: true,
  has_image: true,
  has_oem_ref: true,
  has_equivalent_ref: false, // OEM seul suffit
  has_unique_product_ref: true,
  has_valid_canonical: true,
  is_duplicate_variant: false,
};

describe("@repo/seo-role-contracts — r2-indexability-conditions", () => {
  it("returns indexable=true when all conditions met", () => {
    const verdict = evaluateR2Indexability(ALL_OK);
    assert.equal(verdict.indexable, true);
    assert.deepEqual(verdict.blockingReasons, []);
  });

  it("missing price ⇒ noindex with reason missing_price", () => {
    const verdict = evaluateR2Indexability({ ...ALL_OK, has_price: false });
    assert.equal(verdict.indexable, false);
    assert.deepEqual(verdict.blockingReasons, ["missing_price"]);
  });

  it("equivalent_ref alone (no OEM) is sufficient — OR semantics", () => {
    const verdict = evaluateR2Indexability({
      ...ALL_OK,
      has_oem_ref: false,
      has_equivalent_ref: true,
    });
    assert.equal(verdict.indexable, true);
    assert.deepEqual(verdict.blockingReasons, []);
  });

  it("neither OEM nor equivalent_ref ⇒ noindex", () => {
    const verdict = evaluateR2Indexability({
      ...ALL_OK,
      has_oem_ref: false,
      has_equivalent_ref: false,
    });
    assert.equal(verdict.indexable, false);
    assert.deepEqual(verdict.blockingReasons, [
      "missing_oem_or_equivalent_ref",
    ]);
  });

  it("duplicate_variant blocks even if all other conditions met", () => {
    const verdict = evaluateR2Indexability({
      ...ALL_OK,
      is_duplicate_variant: true,
    });
    assert.equal(verdict.indexable, false);
    assert.deepEqual(verdict.blockingReasons, ["duplicate_variant"]);
  });

  it("aggregates multiple blocking reasons in declared order", () => {
    const verdict = evaluateR2Indexability({
      has_price: false,
      has_stock: false,
      has_image: false,
      has_oem_ref: false,
      has_equivalent_ref: false,
      has_unique_product_ref: false,
      has_valid_canonical: false,
      is_duplicate_variant: true,
    });
    assert.equal(verdict.indexable, false);
    assert.deepEqual(verdict.blockingReasons, [
      "missing_price",
      "missing_stock",
      "missing_image",
      "missing_oem_or_equivalent_ref",
      "missing_unique_product_ref",
      "invalid_canonical",
      "duplicate_variant",
    ]);
  });
});
