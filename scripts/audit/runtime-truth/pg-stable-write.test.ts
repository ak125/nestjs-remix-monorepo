import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyStableWriters,
  runPgStableWrite,
  CHECK_NAME,
  type StableFnRow,
} from "./pg-stable-write.ts";
import { validateResult } from "./contract.ts";
import { type RpcClient } from "./runner.ts";

const NOW = "2026-06-14T20:00:00.000Z";
const COMMIT = "abc1234";

const clean: StableFnRow[] = [
  { function_name: "rpc_get_x", volatility: "STABLE", writes: false, write_ops: "" },
  { function_name: "rpc_calc_y", volatility: "IMMUTABLE", writes: false, write_ops: "" },
];
const dirty: StableFnRow[] = [
  ...clean,
  { function_name: "rpc_cleanup_z", volatility: "STABLE", writes: true, write_ops: "DELETE FROM cache" },
  { function_name: "rpc_aa_bump", volatility: "STABLE", writes: true, write_ops: "UPDATE t SET" },
];

function stubClient(data: unknown, error: { message: string } | null = null): RpcClient {
  return { rpc: async () => ({ data, error }) };
}

test("classify: clean rows ⇒ no findings, scanned/violating counts", () => {
  const { findings, evidence } = classifyStableWriters(clean);
  assert.equal(findings.length, 0);
  assert.deepEqual(evidence, { scanned: 2, violating: 0 });
});

test("classify: violators ⇒ critical findings, sorted by function_name", () => {
  const { findings, evidence } = classifyStableWriters(dirty);
  assert.equal(findings.length, 2);
  assert.deepEqual(evidence, { scanned: 4, violating: 2 });
  assert.ok(findings.every((f) => f.severity === "critical"));
  assert.deepEqual(
    findings.map((f) => f.id),
    ["stable-write:rpc_aa_bump", "stable-write:rpc_cleanup_z"], // sorted
  );
  assert.match(findings[0].fix_hint!, /ALTER FUNCTION public\.rpc_aa_bump VOLATILE/);
});

test("run: clean DB ⇒ PASS, RECURRING, contract-valid, deterministic generated_at", async () => {
  const r = await runPgStableWrite({
    client: stubClient(clean),
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

test("run: violators ⇒ FAIL with critical findings", async () => {
  const r = await runPgStableWrite({ client: stubClient(dirty), nowIso: NOW, sourceCommit: COMMIT });
  assert.ok("result" in r);
  assert.equal(r.result.health_status, "FAIL");
  assert.equal(r.result.findings.length, 2);
  assert.ok(validateResult(r.result).ok);
});

test("run: RPC error (migration not applied) ⇒ UNKNOWN, never crash", async () => {
  const r = await runPgStableWrite({
    client: stubClient(null, { message: "function __gov_m7... does not exist" }),
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
  const r = await runPgStableWrite({ client: null, nowIso: NOW, sourceCommit: COMMIT });
  assert.ok("skipped" in r);
  assert.equal((r as { skipped: string }).skipped, "no-creds");
});
