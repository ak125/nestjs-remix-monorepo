import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { inferLayerFromPath } from "../canonical/lib/infer-layer-from-path";

// Table-driven tests for the layer inference helper used by runtime-contract
// to validate that an entry's declared `layer` matches the canonical layer
// computed from its `path`. The helper reads architecture.yaml#layers[]
// (id + rootGlobs) and returns the most specific match.
//
// Algorithm: longest-matching-glob-wins (deterministic, ordering-independent).
// `backend/src/workers/main.ts` matches both `backend/src/**` and
// `backend/src/workers/**` — the longer glob (workers) wins.

const ARCHITECTURE_LAYERS = [
  { id: "frontend", rootGlobs: ["frontend/app/**"] },
  { id: "backend", rootGlobs: ["backend/src/**"] },
  { id: "packages", rootGlobs: ["packages/**"] },
  { id: "scripts", rootGlobs: ["scripts/**"] },
  { id: "workers", rootGlobs: ["backend/src/workers/**"] },
] as const;

describe("inferLayerFromPath — happy path (5 architecture layers)", () => {
  const cases: ReadonlyArray<{ path: string; expected: string }> = [
    { path: "frontend/app/routes/_index.tsx", expected: "frontend" },
    { path: "frontend/app/root.tsx", expected: "frontend" },
    { path: "backend/src/app.module.ts", expected: "backend" },
    { path: "backend/src/api/api.module.ts", expected: "backend" },
    { path: "backend/src/workers/main.ts", expected: "workers" },
    { path: "backend/src/workers/seo-monitor.processor.ts", expected: "workers" },
    { path: "packages/registry/src/index.ts", expected: "packages" },
    { path: "packages/ui/src/Button.tsx", expected: "packages" },
    { path: "scripts/audit/build-deep-inventory.js", expected: "scripts" },
    { path: "scripts/registry/build-canonical-registry.js", expected: "scripts" },
  ];

  for (const { path, expected } of cases) {
    test(`${path} → ${expected}`, () => {
      const layer = inferLayerFromPath(path, ARCHITECTURE_LAYERS);
      assert.equal(layer, expected);
    });
  }
});

describe("inferLayerFromPath — specificity (longest glob wins)", () => {
  test("backend/src/workers/main.ts matches workers (longer) not backend (shorter)", () => {
    const layer = inferLayerFromPath(
      "backend/src/workers/main.ts",
      ARCHITECTURE_LAYERS,
    );
    assert.equal(layer, "workers");
  });

  test("layer order in input array does not affect result (deterministic)", () => {
    const reordered = [...ARCHITECTURE_LAYERS].reverse();
    const layer = inferLayerFromPath(
      "backend/src/workers/main.ts",
      reordered,
    );
    assert.equal(layer, "workers");
  });
});

describe("inferLayerFromPath — no match", () => {
  test("returns undefined for path matching no layer", () => {
    const layer = inferLayerFromPath(
      "docs/superpowers/specs/2026-05-14-design.md",
      ARCHITECTURE_LAYERS,
    );
    assert.equal(layer, undefined);
  });

  test("returns undefined for empty layer list", () => {
    const layer = inferLayerFromPath("backend/src/app.module.ts", []);
    assert.equal(layer, undefined);
  });

  test("returns undefined for path not under any rootGlob prefix", () => {
    const layer = inferLayerFromPath(
      "frontend/vite.config.ts",
      ARCHITECTURE_LAYERS,
    );
    // Note: frontend rootGlob is `frontend/app/**`, so vite.config.ts
    // (which is at frontend/) does NOT match. Correct behavior.
    assert.equal(layer, undefined);
  });
});

describe("inferLayerFromPath — multiple rootGlobs per layer", () => {
  test("layer with 2 rootGlobs matches via either", () => {
    const layers = [
      { id: "polylith", rootGlobs: ["a/**", "b/**"] },
    ];
    assert.equal(inferLayerFromPath("a/x.ts", layers), "polylith");
    assert.equal(inferLayerFromPath("b/y.ts", layers), "polylith");
    assert.equal(inferLayerFromPath("c/z.ts", layers), undefined);
  });

  test("longest matching glob across layers wins regardless of layer", () => {
    const layers = [
      { id: "broad", rootGlobs: ["a/**"] },
      { id: "narrow", rootGlobs: ["a/sub/deep/**"] },
    ];
    assert.equal(inferLayerFromPath("a/sub/deep/x.ts", layers), "narrow");
    assert.equal(inferLayerFromPath("a/other/x.ts", layers), "broad");
  });
});
