import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { assignVolumeBuckets } from "../lib/volume-buckets";

describe("assignVolumeBuckets — deterministic percentile tiers", () => {
  test("large set: top 10% HIGH, next 30% MED, rest LOW", () => {
    // 10 items, volumes 100..10 desc
    const items = Array.from({ length: 10 }, (_, i) => ({
      kw: `k${i}`,
      volume: 100 - i * 10,
    }));
    const out = assignVolumeBuckets(items);
    const byKw = new Map(out.map((o) => [o.kw, o.vol]));
    assert.equal(byKw.get("k0"), "HIGH"); // rank 1 / 10 → top 10%
    assert.equal(byKw.get("k1"), "MED"); // within next 30%
    assert.equal(byKw.get("k3"), "MED"); // cumulative 40%
    assert.equal(byKw.get("k9"), "LOW"); // tail
  });

  test("small set (<5): top 1 HIGH, rest MED", () => {
    const items = [
      { kw: "a", volume: 500 },
      { kw: "b", volume: 400 },
      { kw: "c", volume: 300 },
    ];
    const out = assignVolumeBuckets(items);
    const byKw = new Map(out.map((o) => [o.kw, o.vol]));
    assert.equal(byKw.get("a"), "HIGH");
    assert.equal(byKw.get("b"), "MED");
    assert.equal(byKw.get("c"), "MED");
  });

  test("1-2 items: all MED (too small for HIGH)", () => {
    const out = assignVolumeBuckets([{ kw: "solo", volume: 999 }]);
    assert.equal(out[0].vol, "MED");
  });

  test("empty input → empty output", () => {
    assert.deepEqual(assignVolumeBuckets([]), []);
  });

  test("stable: ties broken by input order, output covers all inputs", () => {
    const items = [
      { kw: "x", volume: 50 },
      { kw: "y", volume: 50 },
    ];
    const out = assignVolumeBuckets(items);
    assert.equal(out.length, 2);
    assert.ok(out.every((o) => ["HIGH", "MED", "LOW"].includes(o.vol)));
  });
});
