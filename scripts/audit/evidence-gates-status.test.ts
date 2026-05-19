import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parsePromMetric, evaluateCondition } from "./evidence-gates-status.ts";

describe("evaluateCondition", () => {
  test("== matches exact value", () => {
    assert.equal(evaluateCondition(0, "== 0"), true);
    assert.equal(evaluateCondition(1, "== 0"), false);
  });

  test("> matches strictly greater", () => {
    assert.equal(evaluateCondition(0.06, "> 0.05"), true);
    assert.equal(evaluateCondition(0.05, "> 0.05"), false);
  });

  test(">= matches greater-or-equal (funnel ratio)", () => {
    assert.equal(evaluateCondition(1.3, ">= 1.30"), true);
    assert.equal(evaluateCondition(1.29, ">= 1.30"), false);
  });

  test("< matches strictly less", () => {
    assert.equal(evaluateCondition(0.04, "< 0.05"), true);
    assert.equal(evaluateCondition(0.05, "< 0.05"), false);
  });

  test("rejects unsupported operator syntax", () => {
    assert.throws(() => evaluateCondition(0, "between 0 and 1"));
    assert.throws(() => evaluateCondition(0, "is zero"));
  });

  test("handles negative thresholds", () => {
    assert.equal(evaluateCondition(-1, "< 0"), true);
    assert.equal(evaluateCondition(-1, "> -2"), true);
  });
});

describe("parsePromMetric", () => {
  const PROM_BODY = `
# HELP pr_d_boundary_override_total_30d Boundary override count over 30 days
# TYPE pr_d_boundary_override_total_30d counter
pr_d_boundary_override_total_30d{module="rag-enrichment"} 0
pr_d_boundary_override_total_30d{module="catalog-orientation"} 0

# HELP diagnostic_kg_shadow_diverged_total_rate Shadow KG divergence rate
# TYPE diagnostic_kg_shadow_diverged_total_rate gauge
diagnostic_kg_shadow_diverged_total_rate{reason="timeout"} 0.012
diagnostic_kg_shadow_diverged_total_rate{reason="topN_mismatch"} 0.038

# HELP unrelated_metric Something else
# TYPE unrelated_metric counter
unrelated_metric 42
`.trim();

  test("sums values across all label sets (counter aggregation)", () => {
    assert.equal(parsePromMetric(PROM_BODY, "pr_d_boundary_override_total_30d"), 0);
  });

  test("sums fractional gauge values across labels", () => {
    const v = parsePromMetric(PROM_BODY, "diagnostic_kg_shadow_diverged_total_rate");
    assert.ok(v !== null);
    assert.ok(Math.abs((v ?? 0) - 0.05) < 1e-9);
  });

  test("handles metric without labels", () => {
    assert.equal(parsePromMetric(PROM_BODY, "unrelated_metric"), 42);
  });

  test("returns null when metric is absent", () => {
    assert.equal(parsePromMetric(PROM_BODY, "nonexistent_metric"), null);
  });

  test("does not match metric name as a prefix of another metric", () => {
    // "pr_d_boundary_override_total_30d" should NOT match
    // "pr_d_boundary_override_total_30d_extra" if the latter existed; the regex
    // anchors on the metric name followed by either { or whitespace.
    const body =
      "pr_d_boundary_override_total_30d_extra{foo=\"bar\"} 99\nunrelated 7";
    assert.equal(parsePromMetric(body, "pr_d_boundary_override_total_30d"), null);
  });

  test("handles scientific notation values", () => {
    const body = "metric_x 1.5e3";
    assert.equal(parsePromMetric(body, "metric_x"), 1500);
  });
});
