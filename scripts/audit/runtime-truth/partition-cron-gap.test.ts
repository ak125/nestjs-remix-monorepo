import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyPartitionGaps,
  runPartitionCronGap,
  CHECK_NAME,
  type PartitionRow,
} from "./partition-cron-gap.ts";
import { validateResult } from "./contract.ts";
import { type RpcClient } from "./runner.ts";

const NOW = "2026-06-14T20:00:00.000Z";
const COMMIT = "abc1234";

const row = (o: Partial<PartitionRow>): PartitionRow => ({
  parent_table: "t",
  n_partitions: 5,
  has_default: false,
  max_upper_bound: "2026-12-01",
  days_remaining: 200,
  has_rotation_cron: true,
  ...o,
});

// current prod shape: all covered (cron + margin) or default → 0 findings
const healthy: PartitionRow[] = [
  row({ parent_table: "__seo_cwv_raw", days_remaining: 4, has_rotation_cron: true }),
  row({ parent_table: "__seo_snapshot_synthetic", days_remaining: 15, has_rotation_cron: true }),
  row({ parent_table: "pieces_price_history", has_default: true, days_remaining: 48 }),
];

function stub(data: unknown, error: { message: string } | null = null): RpcClient {
  return { rpc: async () => ({ data, error }) };
}

test("classify: healthy (cron+margin / default) ⇒ 0 findings", () => {
  const { findings, evidence } = classifyPartitionGaps(healthy);
  assert.equal(findings.length, 0);
  assert.equal((evidence as { scanned: number }).scanned, 3);
  assert.equal((evidence as { with_default: number }).with_default, 1);
  assert.equal((evidence as { tightest_no_default_days: number }).tightest_no_default_days, 4);
});

test("classify: imminent exhaustion (no default, <2d) ⇒ critical", () => {
  const { findings } = classifyPartitionGaps([row({ parent_table: "x", has_default: false, days_remaining: 1, has_rotation_cron: true })]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "critical");
  assert.match(findings[0].id, /partition-imminent:x/);
});

test("classify: low margin + no cron ⇒ high; with cron ⇒ none", () => {
  const noCron = classifyPartitionGaps([row({ parent_table: "y", has_default: false, days_remaining: 5, has_rotation_cron: false })]);
  assert.equal(noCron.findings.length, 1);
  assert.equal(noCron.findings[0].severity, "high");

  const withCron = classifyPartitionGaps([row({ parent_table: "y", has_default: false, days_remaining: 5, has_rotation_cron: true })]);
  assert.equal(withCron.findings.length, 0);
});

test("classify: default partition is a safety net (never flagged)", () => {
  const { findings } = classifyPartitionGaps([row({ has_default: true, days_remaining: 0 })]);
  assert.equal(findings.length, 0);
});

test("classify: null days_remaining ⇒ skip (no guessing)", () => {
  const { findings } = classifyPartitionGaps([row({ has_default: false, days_remaining: null })]);
  assert.equal(findings.length, 0);
});

test("run: healthy DB ⇒ PASS, RECURRING, contract-valid, deterministic", async () => {
  const r = await runPartitionCronGap({ client: stub(healthy), nowIso: NOW, sourceCommit: COMMIT });
  assert.ok("result" in r);
  assert.equal(r.result.check_name, CHECK_NAME);
  assert.equal(r.result.health_status, "PASS");
  assert.equal(r.result.coverage_status, "RECURRING");
  assert.equal(r.result.generated_at, NOW);
  assert.ok(validateResult(r.result).ok);
});

test("run: a critical gap ⇒ FAIL", async () => {
  const r = await runPartitionCronGap({
    client: stub([row({ parent_table: "z", has_default: false, days_remaining: 0, has_rotation_cron: false })]),
    nowIso: NOW,
    sourceCommit: COMMIT,
  });
  assert.ok("result" in r);
  assert.equal(r.result.health_status, "FAIL");
  assert.ok(validateResult(r.result).ok);
});

test("run: RPC error ⇒ UNKNOWN; no client ⇒ skipped", async () => {
  const err = await runPartitionCronGap({ client: stub(null, { message: "not exist" }), nowIso: NOW, sourceCommit: COMMIT });
  assert.ok("result" in err);
  assert.equal(err.result.health_status, "UNKNOWN");

  const sk = await runPartitionCronGap({ client: null, nowIso: NOW, sourceCommit: COMMIT });
  assert.ok("skipped" in sk);
});
