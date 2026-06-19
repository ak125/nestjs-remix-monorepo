import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyOverloadAmbiguity,
  runRpcOverloadAmbiguity,
  CHECK_NAME,
  type OverloadRow,
} from "./rpc-overload-ambiguity.ts";
import { validateResult } from "./contract.ts";
import { type RpcClient } from "./runner.ts";

const NOW = "2026-06-15T20:00:00.000Z";
const COMMIT = "abc1234";

test("classifyOverloadAmbiguity: rows ⇒ sorted critical findings; empty ⇒ none", () => {
  const rows: OverloadRow[] = [
    { function_name: "get_cart_stats", ambiguity_kind: "type_only", overload_count: 3 },
    {
      function_name: "backfill_seo_keywords_type_ids",
      ambiguity_kind: "subset_default",
      overload_count: 2,
    },
  ];
  const { findings, evidence } = classifyOverloadAmbiguity(rows);
  assert.equal(findings.length, 2);
  // sorted alphabetically → backfill first
  assert.equal(findings[0].id, "overload-ambiguity:backfill_seo_keywords_type_ids");
  assert.equal(findings[0].severity, "critical");
  assert.equal(
    (findings[1].detail as { function: string }).function,
    "get_cart_stats",
  );
  assert.deepEqual(evidence, { ambiguous_functions: 2 });

  assert.equal(classifyOverloadAmbiguity([]).findings.length, 0);
});

function stub(data: unknown, error: { message: string } | null = null): RpcClient {
  return { rpc: async () => ({ data, error }) };
}

test("run: ambiguous overload ⇒ FAIL, contract-valid", async () => {
  const r = await runRpcOverloadAmbiguity({
    nowIso: NOW,
    sourceCommit: COMMIT,
    client: stub([
      { function_name: "get_cart_stats", ambiguity_kind: "type_only", overload_count: 3 },
    ]),
  });
  assert.ok(!("skipped" in r));
  if ("skipped" in r) return;
  assert.equal(r.result.check_name, CHECK_NAME);
  assert.equal(r.result.coverage_status, "RECURRING");
  assert.equal(r.result.health_status, "FAIL"); // critical ⇒ FAIL
  assert.ok(validateResult(r.result).ok);
});

test("run: clean DB (no ambiguous overloads) ⇒ PASS", async () => {
  const r = await runRpcOverloadAmbiguity({
    nowIso: NOW,
    sourceCommit: COMMIT,
    client: stub([]),
  });
  if ("skipped" in r) return assert.fail("unexpected skip");
  assert.equal(r.result.health_status, "PASS");
  assert.equal(r.result.findings.length, 0);
});

test("run: no creds ⇒ skipped (PR lane)", async () => {
  const r = await runRpcOverloadAmbiguity({ client: null });
  assert.deepEqual(r, { skipped: "no-creds" });
});

test("run: RPC missing/error ⇒ UNKNOWN, no crash", async () => {
  const r = await runRpcOverloadAmbiguity({
    nowIso: NOW,
    sourceCommit: COMMIT,
    client: stub(null, { message: "function __gov_m10_overload_ambiguity() does not exist" }),
  });
  if ("skipped" in r) return assert.fail("unexpected skip");
  assert.equal(r.result.health_status, "UNKNOWN");
  assert.equal(r.result.findings.length, 0);
  assert.ok(validateResult(r.result).ok);
});
