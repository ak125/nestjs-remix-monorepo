/**
 * Tests for check-dependency-graph-ratchet.ts pure functions.
 * Run: tsx --test scripts/audit/check-dependency-graph-ratchet.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  extractFindings,
  diffFindings,
  MAX_STACK_DEPTH,
  type DgFinding,
} from "./check-dependency-graph-ratchet.ts";

function graph(nodes: Array<{ id: string; number: number; depth: number }>) {
  return { meta: { degraded: false }, nodes };
}

describe("extractFindings", () => {
  test("flags only nodes deeper than MAX_STACK_DEPTH", () => {
    const g = graph([
      { id: "pr:1", number: 1, depth: 1 },
      { id: "pr:2", number: 2, depth: 2 },
      { id: "pr:3", number: 3, depth: 3 },
      { id: "pr:4", number: 4, depth: 4 },
    ]);
    const f = extractFindings(g);
    assert.deepEqual(
      f.map((x) => x.id),
      ["pr:3", "pr:4"],
    );
    assert.equal(MAX_STACK_DEPTH, 2);
  });

  test("empty when all within target", () => {
    assert.deepEqual(extractFindings(graph([{ id: "pr:1", number: 1, depth: 2 }])), []);
  });

  test("findings sorted by id", () => {
    const g = graph([
      { id: "pr:30", number: 30, depth: 3 },
      { id: "pr:10", number: 10, depth: 3 },
    ]);
    assert.deepEqual(extractFindings(g).map((x) => x.id), ["pr:10", "pr:30"]);
  });
});

describe("diffFindings (block-new ratchet)", () => {
  const baseline: DgFinding[] = [{ kind: "stack_too_deep", id: "pr:456", depth: 3 }];

  test("no added when current ⊆ baseline", () => {
    const { added, removed } = diffFindings(baseline, baseline);
    assert.equal(added.length, 0);
    assert.equal(removed.length, 0);
  });

  test("detects a NEW deep stack (added)", () => {
    const current: DgFinding[] = [
      { kind: "stack_too_deep", id: "pr:456", depth: 3 },
      { kind: "stack_too_deep", id: "pr:999", depth: 3 },
    ];
    const { added, removed } = diffFindings(current, baseline);
    assert.deepEqual(added.map((f) => f.id), ["pr:999"]);
    assert.equal(removed.length, 0);
  });

  test("detects a linearized stack (removed, informational)", () => {
    const { added, removed } = diffFindings([], baseline);
    assert.equal(added.length, 0);
    assert.deepEqual(removed.map((f) => f.id), ["pr:456"]);
  });

  test("simultaneous add + remove", () => {
    const current: DgFinding[] = [{ kind: "stack_too_deep", id: "pr:777", depth: 4 }];
    const { added, removed } = diffFindings(current, baseline);
    assert.deepEqual(added.map((f) => f.id), ["pr:777"]);
    assert.deepEqual(removed.map((f) => f.id), ["pr:456"]);
  });
});
