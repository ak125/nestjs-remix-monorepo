import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  countByFile,
  diffBaseline,
  type Baseline,
} from "./check-rag-authority-read-ratchet.ts";

const BASELINE: Baseline = {
  rule: "seo-no-rag-as-content-source",
  total: 5,
  files: {
    "a/r2-enricher.service.ts": 2,
    "a/r3-image-prompt.service.ts": 2,
    "a/vehicle-rag-generator.service.ts": 1,
  },
};

// ── countByFile: groups ast-grep matches, ignores foreign ruleIds ──────────────
test("countByFile groups by file and ignores other rules", () => {
  const matches = [
    { file: "a.ts", ruleId: "seo-no-rag-as-content-source" },
    { file: "a.ts", ruleId: "seo-no-rag-as-content-source" },
    { file: "b.ts", ruleId: "seo-no-rag-as-content-source" },
    { file: "a.ts", ruleId: "some-other-rule" }, // must be ignored
  ];
  assert.deepEqual(countByFile(matches), { "a.ts": 2, "b.ts": 1 });
});

// ── diffBaseline: the exact frozen debt passes ─────────────────────────────────
test("exact match → ok (frozen debt preserved)", () => {
  const { ok, drift } = diffBaseline({ ...BASELINE.files }, BASELINE);
  assert.equal(ok, true);
  assert.equal(drift.newFiles.length, 0);
  assert.equal(drift.increased.length, 0);
  assert.equal(drift.reducedWithoutRefresh.length, 0);
});

// ── Each failure condition the owner enumerated ────────────────────────────────
test("FAIL: findings increase at an existing file (new authority RAG read)", () => {
  const cur = { ...BASELINE.files, "a/r2-enricher.service.ts": 3 };
  const { ok, drift } = diffBaseline(cur, BASELINE);
  assert.equal(ok, false);
  assert.deepEqual(drift.increased, [
    { file: "a/r2-enricher.service.ts", from: 2, to: 3 },
  ]);
});

test("FAIL: a finding appears in a NEW file (writer path added)", () => {
  const cur = { ...BASELINE.files, "a/new-enricher.service.ts": 1 };
  const { ok, drift } = diffBaseline(cur, BASELINE);
  assert.equal(ok, false);
  assert.deepEqual(drift.newFiles, ["a/new-enricher.service.ts"]);
});

test("FAIL: a deleted writer path reappears (new-file vs refreshed baseline)", () => {
  // Baseline was refreshed DOWN after a deletion → file no longer listed.
  const refreshed: Baseline = {
    rule: BASELINE.rule,
    total: 3,
    files: {
      "a/r2-enricher.service.ts": 2,
      "a/vehicle-rag-generator.service.ts": 1,
    },
  };
  // The deleted r3-image-prompt path reappears.
  const cur = { ...refreshed.files, "a/r3-image-prompt.service.ts": 1 };
  const { ok, drift } = diffBaseline(cur, refreshed);
  assert.equal(ok, false);
  assert.deepEqual(drift.newFiles, ["a/r3-image-prompt.service.ts"]);
});

test("FAIL: a reduction without a baseline refresh (coverage loss must not masquerade as closure)", () => {
  const cur = { ...BASELINE.files, "a/r2-enricher.service.ts": 1 };
  const { ok, drift } = diffBaseline(cur, BASELINE);
  assert.equal(ok, false);
  assert.deepEqual(drift.reducedWithoutRefresh, [
    { file: "a/r2-enricher.service.ts", from: 2, to: 1 },
  ]);
});

test("FAIL: a file drops out entirely without a refresh", () => {
  const cur = {
    "a/r2-enricher.service.ts": 2,
    "a/r3-image-prompt.service.ts": 2,
  };
  const { ok, drift } = diffBaseline(cur, BASELINE);
  assert.equal(ok, false);
  assert.deepEqual(drift.reducedWithoutRefresh, [
    { file: "a/vehicle-rag-generator.service.ts", from: 1, to: 0 },
  ]);
});

// ── A legitimate B-tranche closure: delete a writer AND refresh in the same PR ──
test("closure done right → refreshed baseline matches new scan → ok", () => {
  const afterDeletion = {
    "a/r2-enricher.service.ts": 2,
    "a/vehicle-rag-generator.service.ts": 1,
  };
  const refreshed: Baseline = {
    rule: BASELINE.rule,
    total: 3,
    files: afterDeletion,
  };
  const { ok } = diffBaseline({ ...afterDeletion }, refreshed);
  assert.equal(ok, true);
});

// ── Integration: the committed baseline freezes the remaining debt (10/3) ─────
// R8 no longer reads RAG files as an editorial source. Its last two findings
// were removed with an explicit same-PR baseline refresh (20/8 → 18/7).
// The R1 keyword-plan batch followed: the service was retired, its two RAG
// reads with it, with an explicit same-PR baseline refresh (18/7 → 16/6).
// Mandat BI, tranche B3: R2EnricherService deleted (2), the router's RAG file
// probe and the R4 enricher's unused RAG file load removed (2 + 2), with an
// explicit same-PR baseline refresh (16/6 → 10/3).
test("committed baseline totals 10 findings across 3 files without R8, the R1 batch, R2, R4 or the router", () => {
  const p = join(
    process.cwd(),
    "audit/baselines/rag-authority-read-baseline.json",
  );
  const b = JSON.parse(readFileSync(p, "utf-8")) as Baseline;
  assert.equal(b.rule, "seo-no-rag-as-content-source");
  assert.equal(b.total, 10);
  assert.equal(Object.keys(b.files).length, 3);
  for (const closed of [
    "backend/src/modules/admin/services/r2-enricher.service.ts",
    "backend/src/modules/admin/services/r4-content-enricher.service.ts",
    "backend/src/modules/admin/services/execution-router.service.ts",
  ]) {
    assert.equal(
      Object.hasOwn(b.files, closed),
      false,
      `${closed} must not read the RAG as a content source again`,
    );
  }
  assert.equal(
    Object.hasOwn(
      b.files,
      "backend/src/modules/admin/services/r8-vehicle-enricher.service.ts",
    ),
    false,
    "R8 must not regain editorial authority from RAG",
  );
  assert.equal(
    Object.hasOwn(
      b.files,
      "backend/src/modules/admin/services/r1-keyword-plan-batch.service.ts",
    ),
    false,
    "the R1 keyword-plan batch must not regain editorial authority from RAG",
  );
  assert.equal(
    Object.values(b.files).reduce((a, c) => a + c, 0),
    b.total,
    "sum of per-file counts must equal total",
  );
});
