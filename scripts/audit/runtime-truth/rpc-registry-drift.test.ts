import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  extractRpcCalls,
  classifyRpcDrift,
  scanRpcCalls,
  runRpcRegistryDrift,
  CHECK_NAME,
  type RpcCallSite,
} from "./rpc-registry-drift.ts";
import { validateResult } from "./contract.ts";
import { type RpcClient } from "./runner.ts";

const NOW = "2026-06-14T21:00:00.000Z";
const COMMIT = "abc1234";

test("extractRpcCalls: literal single/double/backtick quotes", () => {
  const src = `a.rpc('foo', {x:1}); b.rpc("bar"); c.rpc(\`baz\`); d.rpc(dynamic);`;
  assert.deepEqual(extractRpcCalls(src), ["foo", "bar", "baz"]);
});

test("classifyRpcDrift: missing RPCs ⇒ medium findings; present ⇒ none", () => {
  const calls: RpcCallSite[] = [
    { name: "exists_a", files: ["x.ts"] },
    { name: "missing_b", files: ["y.ts", "z.ts"] },
  ];
  const { findings, evidence } = classifyRpcDrift(calls, ["exists_a", "other"]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "medium");
  assert.equal(findings[0].id, "rpc-drift:missing_b");
  assert.deepEqual((findings[0].detail as { call_sites: string[] }).call_sites, ["y.ts", "z.ts"]);
  assert.deepEqual(evidence, { scanned_calls: 2, missing: 1, db_functions: 2 });

  assert.equal(classifyRpcDrift(calls, ["exists_a", "missing_b"]).findings.length, 0);
});

test("scanRpcCalls: walks tree, ignores tests/.d.ts/node_modules", () => {
  const root = mkdtempSync(join(tmpdir(), "rpcdrift-"));
  mkdirSync(join(root, "sub/node_modules"), { recursive: true });
  writeFileSync(join(root, "a.ts"), "x.rpc('alpha'); y.rpc('beta');");
  writeFileSync(join(root, "sub/b.ts"), "z.rpc('alpha');");
  writeFileSync(join(root, "a.test.ts"), "q.rpc('should_be_ignored');");
  writeFileSync(join(root, "types.d.ts"), "w.rpc('also_ignored');");
  writeFileSync(join(root, "sub/node_modules/c.ts"), "n.rpc('vendor_ignored');");
  const calls = scanRpcCalls(root);
  const names = calls.map((c) => c.name);
  assert.deepEqual(names, ["alpha", "beta"]); // sorted, dedup, tests/d.ts/node_modules excluded
  assert.equal(calls.find((c) => c.name === "alpha")!.files.length, 2);
});

function stub(data: unknown, error: { message: string } | null = null): RpcClient {
  return { rpc: async () => ({ data, error }) };
}

test("run: a missing RPC ⇒ FAIL (medium findings), contract-valid", async () => {
  const calls: RpcCallSite[] = [
    { name: "increment_advice_views", files: ["blog/advice.service.ts"] },
    { name: "resolve_gamme_alias", files: ["x.ts"] },
  ];
  const r = await runRpcRegistryDrift({
    calls,
    client: stub([{ function_name: "resolve_gamme_alias" }]),
    nowIso: NOW,
    sourceCommit: COMMIT,
  });
  assert.ok("result" in r);
  assert.equal(r.result.check_name, CHECK_NAME);
  assert.equal(r.result.health_status, "WARN"); // medium ⇒ WARN
  assert.equal(r.result.findings.length, 1);
  assert.equal(r.result.findings[0].id, "rpc-drift:increment_advice_views");
  assert.ok(validateResult(r.result).ok);
});

test("run: all present ⇒ PASS", async () => {
  const calls: RpcCallSite[] = [{ name: "ok_rpc", files: ["x.ts"] }];
  const r = await runRpcRegistryDrift({ calls, client: stub([{ function_name: "ok_rpc" }]), nowIso: NOW, sourceCommit: COMMIT });
  assert.ok("result" in r);
  assert.equal(r.result.health_status, "PASS");
});

test("run: RPC error ⇒ UNKNOWN; no client ⇒ skipped", async () => {
  const err = await runRpcRegistryDrift({ calls: [], client: stub(null, { message: "nope" }), nowIso: NOW, sourceCommit: COMMIT });
  assert.ok("result" in err);
  assert.equal(err.result.health_status, "UNKNOWN");
  const sk = await runRpcRegistryDrift({ calls: [], client: null, nowIso: NOW, sourceCommit: COMMIT });
  assert.ok("skipped" in sk);
});
