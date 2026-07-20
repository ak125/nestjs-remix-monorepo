import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyAttributionGaps,
  grepWriterCounts,
  runAttributionWriteGap,
  CHECK_NAME,
  type AttrColumnRow,
} from "./attribution-write-gap.ts";
import { validateResult } from "./contract.ts";
import { type RpcClient } from "./runner.ts";

const NOW = "2026-07-05T12:00:00.000Z";
const COMMIT = "abc1234";

const rows: AttrColumnRow[] = [
  { table_name: "___order_lines", column_name: "orl_website_url", n_tup_ins: 0, n_tup_upd: 0 },
  { table_name: "___xtr_order", column_name: "ord_utm_source", n_tup_ins: 1200, n_tup_upd: 0 },
  { table_name: "___xtr_customer", column_name: "cst_referrer", n_tup_ins: 500, n_tup_upd: 3 },
];

const allWritten: Record<string, number> = {
  orl_website_url: 2,
  ord_utm_source: 1,
  cst_referrer: 1,
};
// orl_website_url: no writer + no traffic ⇒ no_runtime_writer (high)
// ord_utm_source: no writer + traffic     ⇒ unknown_writer (medium)
// cst_referrer:   has writer              ⇒ not a gap
const withGaps: Record<string, number> = {
  orl_website_url: 0,
  ord_utm_source: 0,
  cst_referrer: 4,
};

function stubClient(data: unknown, error: { message: string } | null = null): RpcClient {
  return { rpc: async () => ({ data, error }) };
}

test("classify: all columns written ⇒ no findings, candidate/gap counts", () => {
  const { findings, evidence } = classifyAttributionGaps(rows, allWritten);
  assert.equal(findings.length, 0);
  assert.deepEqual(evidence, { candidates: 3, no_writer: 0, unknown_writer: 0 });
});

test("classify: gaps ⇒ high (no traffic) + medium (traffic), sorted by table.column", () => {
  const { findings, evidence } = classifyAttributionGaps(rows, withGaps);
  assert.equal(findings.length, 2);
  assert.deepEqual(evidence, { candidates: 3, no_writer: 1, unknown_writer: 1 });
  // ___order_lines.orl_website_url sorts before ___xtr_order.ord_utm_source
  assert.deepEqual(
    findings.map((f) => f.id),
    ["attr-no-writer:___order_lines.orl_website_url", "attr-unknown-writer:___xtr_order.ord_utm_source"],
  );
  assert.equal(findings[0].severity, "high");
  assert.equal(findings[0].detail.category, "no_runtime_writer");
  assert.equal(findings[1].severity, "medium");
  assert.equal(findings[1].detail.category, "unknown_writer");
  assert.equal(findings[1].detail.n_tup_ins, 1200);
});

test("run: clean DB ⇒ PASS, RECURRING, contract-valid, deterministic generated_at", async () => {
  const r = await runAttributionWriteGap({
    client: stubClient(rows),
    writerCounts: () => allWritten,
    nowIso: NOW,
    sourceCommit: COMMIT,
  });
  assert.ok("result" in r);
  const res = r.result;
  assert.equal(res.check_name, CHECK_NAME);
  assert.equal(res.coverage_status, "RECURRING");
  assert.equal(res.health_status, "PASS");
  assert.equal(res.generated_at, NOW);
  assert.equal(res.source_commit, COMMIT);
  assert.equal(res.findings.length, 0);
  assert.ok(validateResult(res).ok, "result must satisfy the contract");
});

test("run: gaps ⇒ FAIL (a high finding) with contract-valid result", async () => {
  const r = await runAttributionWriteGap({
    client: stubClient(rows),
    writerCounts: () => withGaps,
    nowIso: NOW,
    sourceCommit: COMMIT,
  });
  assert.ok("result" in r);
  assert.equal(r.result.health_status, "FAIL");
  assert.equal(r.result.findings.length, 2);
  assert.ok(validateResult(r.result).ok);
});

test("run: RPC error (migration not applied) ⇒ UNKNOWN, never crash", async () => {
  const r = await runAttributionWriteGap({
    client: stubClient(null, { message: "function __gov_m11_attribution_columns() does not exist" }),
    writerCounts: () => ({}),
    nowIso: NOW,
    sourceCommit: COMMIT,
  });
  assert.ok("result" in r);
  assert.equal(r.result.health_status, "UNKNOWN");
  assert.equal(r.result.coverage_status, "RECURRING");
  assert.match(String((r.result.evidence as { error: string }).error), /does not exist/);
  assert.ok(validateResult(r.result).ok);
});

test("run: no client (no creds) ⇒ skipped", async () => {
  const r = await runAttributionWriteGap({ client: null, nowIso: NOW, sourceCommit: COMMIT });
  assert.ok("skipped" in r);
  assert.equal((r as { skipped: string }).skipped, "no-creds");
});

test("grepWriterCounts: write-call file counts; type decl + select read do not", () => {
  const root = mkdtempSync(join(tmpdir(), "attr-wg-"));
  const src = join(root, "backend/src");
  mkdirSync(src, { recursive: true });
  // Real writer: an insert that keys the column.
  writeFileSync(
    join(src, "writer.service.ts"),
    `await this.supabase.from("t").insert({ orl_website_url: url, note: n });\n`,
  );
  // Type-only declaration (keys the column but never inserts/updates) → must NOT count.
  writeFileSync(
    join(src, "types.ts"),
    `export interface OrderLine { orl_website_url: string; cst_referrer: string | null; }\n`,
  );
  // Read only (.select) → must NOT count.
  writeFileSync(
    join(src, "reader.service.ts"),
    `const { data } = await this.supabase.from("t").select("cst_referrer");\n`,
  );
  try {
    const counts = grepWriterCounts(root, ["orl_website_url", "cst_referrer", "ord_utm_source"]);
    assert.equal(counts.orl_website_url, 1, "written via insert payload");
    assert.equal(counts.cst_referrer, 0, "only declared in a type + read via select");
    assert.equal(counts.ord_utm_source, 0, "absent from code");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
