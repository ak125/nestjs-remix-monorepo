// =============================================================================
// Tests for check-env-var-drift.mjs — pure extraction + drift logic.
// Run: node --test scripts/ci/check-env-var-drift.test.mjs
// =============================================================================
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  parseEnvExampleKeys,
  parseSchemaKeys,
  extractUsedEnvVars,
  computeDrift,
} from "./check-env-var-drift.mjs";

describe("parseEnvExampleKeys", () => {
  test("keeps UPPER_SNAKE keys, ignores comments/blanks/lowercase", () => {
    const keys = parseEnvExampleKeys("# comment\nFOO=1\n\nBAR_BAZ=x\nlowercase=no");
    assert.deepEqual([...keys].sort(), ["BAR_BAZ", "FOO"]);
  });

  test("a key with empty value still counts as declared", () => {
    assert.ok(parseEnvExampleKeys("EMPTY=").has("EMPTY"));
  });
});

describe("parseSchemaKeys", () => {
  test("extracts only `KEY: z.…` object keys", () => {
    const keys = parseSchemaKeys(
      "  A: z.string(),\n  B_C: z.enum(['x']),\n  notZod: 1,\n  lower: z.string(),",
    );
    assert.deepEqual([...keys].sort(), ["A", "B_C"]);
  });
});

describe("extractUsedEnvVars", () => {
  test("captures dot, bracket and destructuring access", () => {
    const used = extractUsedEnvVars(
      "process.env.ALPHA; process.env['BETA']; const { GAMMA, DELTA = 'd' } = process.env;",
    );
    assert.deepEqual([...used].sort(), ["ALPHA", "BETA", "DELTA", "GAMMA"]);
  });

  test("ignores lowercase ConfigService keys (no false positives)", () => {
    const used = extractUsedEnvVars("config.get('hero'); this.cfg.get('seo'); process.env.REAL_VAR");
    assert.deepEqual([...used], ["REAL_VAR"]);
  });

  test("captures renamed destructure key (left identifier)", () => {
    const used = extractUsedEnvVars("const { FOO_BAR } = process.env;");
    assert.deepEqual([...used], ["FOO_BAR"]);
  });
});

describe("computeDrift", () => {
  test("splits undeclared into new (fail) vs stale-baseline (burn-down)", () => {
    const r = computeDrift({
      usedVars: new Set(["DECLARED", "OLD_DRIFT", "NEW_DRIFT"]),
      declaredVars: new Set(["DECLARED"]),
      baseline: ["OLD_DRIFT", "GONE"],
    });
    assert.deepEqual(r, {
      undeclared: ["NEW_DRIFT", "OLD_DRIFT"],
      newDrift: ["NEW_DRIFT"], // not in baseline → CI fails on this
      staleBaseline: ["GONE"], // baseline entry no longer drifting → removable
    });
  });

  test("green path: every used var declared → no drift at all", () => {
    const r = computeDrift({
      usedVars: new Set(["A", "B"]),
      declaredVars: new Set(["A", "B"]),
      baseline: [],
    });
    assert.deepEqual(r, { undeclared: [], newDrift: [], staleBaseline: [] });
  });

  test("a baselined var that becomes declared is reported stale", () => {
    const r = computeDrift({
      usedVars: new Set(["NOW_DECLARED"]),
      declaredVars: new Set(["NOW_DECLARED"]),
      baseline: ["NOW_DECLARED"],
    });
    assert.deepEqual(r.newDrift, []);
    assert.deepEqual(r.staleBaseline, ["NOW_DECLARED"]);
  });
});
