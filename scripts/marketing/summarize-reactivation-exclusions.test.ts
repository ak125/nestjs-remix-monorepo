import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { runPilot } from "./reactivation-pilot";
import {
  summarizeExclusions,
  summarizeJson,
} from "./summarize-reactivation-exclusions";
const fixture = () =>
  JSON.parse(
    readFileSync(
      "scripts/marketing/fixtures/reactivation.synthetic.json",
      "utf8",
    ),
  );
const runtime = [
  "node_modules/tsx/dist/cli.mjs",
  "--tsconfig",
  "scripts/marketing/tsconfig.json",
];
const summary = "scripts/marketing/summarize-reactivation-exclusions.ts";
function execute(input: string, args: string[] = []) {
  return spawnSync(process.execPath, [...runtime, summary, ...args], {
    input,
    encoding: "utf8",
    timeout: 15000,
  });
}
test("180 days: project-scoped identities and three exclusions", () => {
  const s = summarizeExclusions(runPilot(fixture()));
  assert.equal(s.total_identities, 4);
  assert.equal(s.included_identities, 1);
  assert.equal(s.excluded_identities, 3);
  assert.deepEqual(s.exclusions_by_reason, {
    consent_unverified: 1,
    project_mismatch: 1,
    recent_purchase: 1,
  });
});
test("365 days: multi-reason exclusion is not an extra identity", () => {
  const f = fixture();
  f.rules.inactive_days = 365;
  const s = summarizeExclusions(runPilot(f));
  assert.equal(s.excluded_identities, 4);
  assert.equal(s.included_identities, 0);
  assert.deepEqual(s.exclusions_by_reason, {
    consent_unverified: 1,
    not_inactive: 2,
    project_mismatch: 1,
    recent_purchase: 1,
  });
  assert.equal(
    Object.values(s.exclusions_by_reason).reduce((a, b) => a + b, 0),
    5,
  );
});
test("cancellation keeps eligibility distinct from simulated candidates", () => {
  const f = fixture();
  f.cancelled = true;
  const s = summarizeExclusions(runPilot(f));
  assert.equal(s.included_identities, 1);
  assert.equal(s.simulation.candidates, 0);
});
test("duplicate reason is counted once and ordering is deterministic", () => {
  const r = runPilot(fixture());
  r.audience[2].reasons.push("consent_unverified");
  const before = structuredClone(r);
  const a = summarizeExclusions(r);
  assert.deepEqual(r, before);
  r.audience.reverse();
  assert.deepEqual(summarizeExclusions(r), a);
  assert.equal(a.exclusions_by_reason.consent_unverified, 1);
});
test("duplicate scoped identities and inconsistent candidate counts refuse", () => {
  const r = runPilot(fixture());
  r.audience.push(r.audience[0]);
  assert.throws(() => summarizeExclusions(r), /INVALID_OUTPUT/);
  const c = runPilot(fixture());
  c.simulation.candidates = 2;
  assert.throws(() => summarizeExclusions(c), /INVALID_OUTPUT/);
});
test("invalid JSON and wrong schema fail closed", () => {
  assert.throws(() => summarizeJson('{"audience": ['), /INVALID_JSON/);
  for (const value of [null, [], {}, { schema_version: "2.0.0" }])
    assert.throws(
      () => summarizeJson(JSON.stringify(value)),
      /INVALID_PILOT_RESULT/,
    );
  const r = runPilot(fixture());
  assert.throws(
    () => summarizeJson(JSON.stringify({ ...r, environment: "PROD" })),
    /INVALID_PILOT_RESULT/,
  );
  assert.throws(
    () =>
      summarizeJson(
        JSON.stringify({
          ...r,
          simulation: { ...r.simulation, real_sends: 1 },
        }),
      ),
    /INVALID_PILOT_RESULT/,
  );
});
test("CLI consumes actual pilot JSON and emits no identity or address", () => {
  const p = spawnSync(
    process.execPath,
    [
      ...runtime,
      "scripts/marketing/run-reactivation-pilot.ts",
      "--inactive-days",
      "180",
    ],
    { encoding: "utf8", timeout: 15000 },
  );
  assert.equal(p.status, 0, p.stderr);
  const s = execute(p.stdout);
  assert.equal(s.status, 0, s.stderr);
  assert.equal(s.stderr, "");
  assert.deepEqual(JSON.parse(s.stdout), summarizeJson(p.stdout));
  assert.doesNotMatch(s.stdout, /customer_id|synthetic-001|@/);
});
test("CLI malformed JSON returns a public code without stack or echoed payload", () => {
  const s = execute('{"audience": [');
  assert.equal(s.status, 1);
  assert.equal(s.stdout, "");
  assert.equal(s.stderr, "INVALID_JSON\n");
});
test("CLI projects simulation fields without leaking unknown input fields", () => {
  const result = runPilot(fixture());
  const input = {
    ...result,
    simulation: {
      ...result.simulation,
      recipient: "private-fixture@example.invalid",
      customer_id: "synthetic-private-fixture",
    },
  };
  const output = execute(JSON.stringify(input));
  assert.equal(output.status, 0, output.stderr);
  assert.deepEqual(JSON.parse(output.stdout).simulation, result.simulation);
  assert.doesNotMatch(output.stdout, /recipient|customer_id|private-fixture|@/);
});
test("CLI bad envelope returns a public refusal", () => {
  const s = execute("{}");
  assert.equal(s.status, 1);
  assert.equal(s.stdout, "");
  assert.equal(s.stderr, "INVALID_PILOT_RESULT\n");
});
test("CLI rejects arguments, including send", () => {
  const s = execute("{}", ["--send"]);
  assert.equal(s.status, 1);
  assert.equal(s.stdout, "");
  assert.equal(s.stderr, "INVALID_ARGUMENT\n");
});
