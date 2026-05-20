/**
 * tests/registry/dependency-graph-builder.test.ts — pure buildGraph() transform
 * against a fixed planning fixture (no live gh / no file I/O).
 *
 * Like planning.json, dependency-graph.json is a time-varying snapshot; this
 * gates the TRANSFORM (stack-parent resolution + depth + metrics + graceful
 * degradation), not live state.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildGraph } from "../../scripts/registry/build-dependency-graph.js";
import { DependencyGraphSchema } from "../../packages/registry/src/index";

const NOW = Date.parse("2026-05-20T12:00:00Z");

// PR 700 on main; 701 stacks on 700; 702 stacks on 701 (depth 3); 800 on main.
function planningFixture() {
  return {
    meta: { degraded: false },
    entries: [
      { number: 700, headRef: "feat/a", baseRef: "main", status: "review", workType: "seo-runtime" },
      { number: 701, headRef: "feat/b", baseRef: "feat/a", status: "review", workType: null },
      { number: 702, headRef: "feat/c", baseRef: "feat/b", status: "in-progress", workType: null },
      { number: 800, headRef: "fix/x", baseRef: "main", status: "review", workType: "cleanup" },
    ],
  };
}

describe("buildGraph — stack DAG", () => {
  test("computes depth along the stack chain", () => {
    const g = buildGraph(planningFixture(), NOW);
    const depth = Object.fromEntries(g.nodes.map((n) => [n.number, n.depth]));
    assert.equal(depth[700], 1); // on main
    assert.equal(depth[701], 2); // on 700
    assert.equal(depth[702], 3); // on 701
    assert.equal(depth[800], 1); // on main
    assert.equal(g.metrics.maxStackDepth, 3);
    assert.equal(g.invariants.maxStackDepth, 3);
  });

  test("emits stacks-on edges only for stacked PRs", () => {
    const g = buildGraph(planningFixture(), NOW);
    assert.equal(g.metrics.stackCount, 2); // 701->700, 702->701
    assert.deepEqual(
      g.edges,
      [
        { from: "pr:701", to: "pr:700", kind: "stacks-on" },
        { from: "pr:702", to: "pr:701", kind: "stacks-on" },
      ],
    );
  });

  test("nodes sorted deterministically by id", () => {
    const g = buildGraph(planningFixture(), NOW);
    const ids = g.nodes.map((n) => n.id);
    assert.deepEqual(ids, [...ids].sort());
  });

  test("deterministic: same input → identical JSON", () => {
    const a = JSON.stringify(buildGraph(planningFixture(), NOW));
    const b = JSON.stringify(buildGraph(planningFixture(), NOW));
    assert.equal(a, b);
  });

  test("does not cycle on malformed mutual baseRef", () => {
    const planning = {
      meta: { degraded: false },
      entries: [
        { number: 1, headRef: "a", baseRef: "b", status: "review", workType: null },
        { number: 2, headRef: "b", baseRef: "a", status: "review", workType: null },
      ],
    };
    const g = buildGraph(planning, NOW);
    // Guard caps traversal; must terminate with finite depths.
    assert.ok(Number.isFinite(g.metrics.maxStackDepth));
    assert.ok(g.metrics.maxStackDepth >= 2);
  });

  test("degrades gracefully when planning is null", () => {
    const g = buildGraph(null, NOW);
    assert.equal(g.meta.degraded, true);
    assert.equal(g.metrics.prCount, 0);
    assert.deepEqual(g.nodes, []);
    assert.deepEqual(g.edges, []);
    assert.equal(g.metrics.maxStackDepth, 0);
  });

  test("degrades when planning.meta.degraded is true", () => {
    const g = buildGraph({ meta: { degraded: true }, entries: [] }, NOW);
    assert.equal(g.meta.degraded, true);
  });

  test("output validates against DependencyGraphSchema", () => {
    const populated = DependencyGraphSchema.safeParse(buildGraph(planningFixture(), NOW));
    assert.equal(populated.success, true, JSON.stringify(populated.error?.format(), null, 2));
    const degraded = DependencyGraphSchema.safeParse(buildGraph(null, NOW));
    assert.equal(degraded.success, true);
  });
});
