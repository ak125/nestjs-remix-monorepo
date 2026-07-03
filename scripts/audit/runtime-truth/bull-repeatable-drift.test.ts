import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyBullDrift,
  redactRedisUrl,
  runBullRepeatableDrift,
  CHECK_NAME,
  type BullQueueState,
} from "./bull-repeatable-drift.ts";

const state = (o: Partial<BullQueueState> = {}): BullQueueState => ({
  queue: "seo-monitor",
  repeatables: [],
  cwvRepeatableCount: 0,
  cwvWaiting: 0,
  cwvDelayed: 0,
  cwvActive: 0,
  redis: "redis://***:***@host:6379/0",
  ...o,
});

// Post-retirement steady state: pg_cron is the sole CWV orchestrator → 0 Bull artifacts.
test("classify: no cwv artifacts ⇒ 0 findings (pg_cron is sole orchestrator)", () => {
  const { findings, evidence } = classifyBullDrift(state());
  assert.equal(findings.length, 0);
  assert.equal((evidence as { cwvRepeatableCount: number }).cwvRepeatableCount, 0);
});

test("classify: a surviving cwv repeatable ⇒ 1 critical (dual orchestrator)", () => {
  const { findings } = classifyBullDrift(
    state({
      cwvRepeatableCount: 1,
      repeatables: [
        { name: "cwv-aggregation-hourly", cron: "5 * * * *", every: null, tz: "UTC", key: "k" },
      ],
    }),
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "critical");
  assert.match(findings[0].id, /bull-cwv-orchestrator-persisted:seo-monitor/);
  assert.ok(findings[0].fix_hint && findings[0].fix_hint.length > 0);
});

test("classify: any live waiting/delayed/active cwv job ⇒ critical", () => {
  for (const k of ["cwvWaiting", "cwvDelayed", "cwvActive"] as const) {
    const { findings } = classifyBullDrift(state({ [k]: 2 }));
    assert.equal(findings.length, 1, `${k} should flag`);
    assert.equal(findings[0].severity, "critical");
  }
});

test("classify: only NON-cwv repeatables present ⇒ 0 findings (queue is shared)", () => {
  const { findings } = classifyBullDrift(
    state({
      repeatables: [
        { name: "seo-daily-fetch", cron: "0 4 * * *", every: null, tz: "UTC", key: "x" },
      ],
    }),
  );
  assert.equal(findings.length, 0);
});

test("redact: masks credentials, keeps host; handles unset/unparseable", () => {
  assert.match(redactRedisUrl("redis://user:s3cr3t@cache.internal:6379/1"), /\*\*\*@cache\.internal/);
  assert.doesNotMatch(redactRedisUrl("redis://user:s3cr3t@cache.internal:6379/1"), /s3cr3t/);
  assert.equal(redactRedisUrl(undefined), "(unset)");
  assert.equal(redactRedisUrl("not a url"), "(unparseable, redacted)");
});

test("run: no REDIS_URL ⇒ skipped (never connects)", async () => {
  const r = await runBullRepeatableDrift({ redisUrl: undefined, nowIso: "2026-06-26T00:00:00.000Z", sourceCommit: "abc1234" });
  assert.ok("skipped" in r);
  assert.equal((r as { skipped: string }).skipped, "no-redis");
});

test("export: CHECK_NAME is stable", () => {
  assert.equal(CHECK_NAME, "bull-repeatable-drift");
});
