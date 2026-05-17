import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractFindings,
  diffFindings,
  loadBaseline,
  loadDashboard,
  refresh,
  type Finding,
} from "./check-contract-drift-ratchet.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "__fixtures__");
const BASELINE = join(FIX, "ratchet-baseline/contract-drift-baseline.json");
const DASH = (name: string) => join(FIX, "ratchet-dashboards", name);

test("extractFindings: ownership orphans become ownership_gap findings", () => {
  const d = loadDashboard(DASH("no-change.json"));
  const findings = extractFindings(d);
  assert.deepEqual(
    findings.map((f) => `${f.kind}::${f.id}`).sort(),
    [
      "ownership_gap::fixtures/legacy-a.ts",
      "ownership_gap::fixtures/legacy-b.ts",
    ],
  );
});

test("extractFindings: contract status invalid/missing surface as findings", () => {
  const fake = {
    generatedAt: "2026-05-15T00:00:00.000Z",
    schemaVersion: "v1" as const,
    contracts: [
      { name: "architecture", file: "x", status: "ok" as const, entries: 1, sha256: "a" },
      { name: "db", file: "y", status: "invalid" as const, entries: 0, sha256: "" },
      { name: "rpc", file: "z", status: "missing" as const, entries: 0, sha256: "" },
    ],
    fingerprint: {
      canonical: { stale: false },
      depCruiserGenerated: { mtime: null, ageHours: null },
    },
    ownership: { gapCount: 0, sample: [], orphans: [] },
    coverage: {},
  };
  const findings = extractFindings(fake as never).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  assert.deepEqual(findings, [
    { kind: "contract_invalid", id: "db" },
    { kind: "contract_missing", id: "rpc" },
  ]);
});

test("extractFindings: canonical stale becomes singleton finding", () => {
  const fake = {
    generatedAt: "2026-05-15T00:00:00.000Z",
    schemaVersion: "v1" as const,
    contracts: [],
    fingerprint: {
      canonical: { stale: true, staleReason: "x" },
      depCruiserGenerated: { mtime: null, ageHours: null },
    },
    ownership: { gapCount: 0, sample: [], orphans: [] },
    coverage: {},
  };
  assert.deepEqual(extractFindings(fake as never), [
    { kind: "canonical_stale", id: "canonical" },
  ]);
});

test("diffFindings: added = current − baseline", () => {
  const baseline: Finding[] = [{ kind: "ownership_gap", id: "a" }];
  const current: Finding[] = [
    { kind: "ownership_gap", id: "a" },
    { kind: "ownership_gap", id: "b" },
  ];
  const { added, removed } = diffFindings(current, baseline);
  assert.deepEqual(added, [{ kind: "ownership_gap", id: "b" }]);
  assert.deepEqual(removed, []);
});

test("diffFindings: removed = baseline − current (resolved drift)", () => {
  const baseline: Finding[] = [
    { kind: "ownership_gap", id: "a" },
    { kind: "ownership_gap", id: "b" },
  ];
  const current: Finding[] = [{ kind: "ownership_gap", id: "a" }];
  const { added, removed } = diffFindings(current, baseline);
  assert.deepEqual(added, []);
  assert.deepEqual(removed, [{ kind: "ownership_gap", id: "b" }]);
});

test("diffFindings: order-independent (set semantics)", () => {
  const baseline: Finding[] = [
    { kind: "ownership_gap", id: "b" },
    { kind: "ownership_gap", id: "a" },
  ];
  const current: Finding[] = [
    { kind: "ownership_gap", id: "a" },
    { kind: "ownership_gap", id: "b" },
  ];
  const { added, removed } = diffFindings(current, baseline);
  assert.deepEqual(added, []);
  assert.deepEqual(removed, []);
});

test("diffFindings: kind discriminator prevents id collisions across kinds", () => {
  const baseline: Finding[] = [{ kind: "ownership_gap", id: "x" }];
  const current: Finding[] = [
    { kind: "ownership_gap", id: "x" },
    { kind: "contract_invalid", id: "x" },
  ];
  const { added } = diffFindings(current, baseline);
  assert.deepEqual(added, [{ kind: "contract_invalid", id: "x" }]);
});

test("loadBaseline: validates schemaVersion + mode", () => {
  const b = loadBaseline(BASELINE);
  assert.equal(b.schemaVersion, "v1");
  assert.equal(b.mode, "block-new-only");
  assert.equal(b.findings.length, 2);
});

test("loadBaseline: rejects malformed JSON (wrong schema)", () => {
  assert.throws(
    () => loadBaseline(join(FIX, "ratchet-dashboards/no-change.json")),
    /Baseline schema invalid/,
  );
});

test("end-to-end: no-change → 0 added, 0 removed", () => {
  const baseline = loadBaseline(BASELINE);
  const dashboard = loadDashboard(DASH("no-change.json"));
  const { added, removed } = diffFindings(
    extractFindings(dashboard),
    baseline.findings,
  );
  assert.equal(added.length, 0);
  assert.equal(removed.length, 0);
});

test("end-to-end: with-new → 1 added, 0 removed", () => {
  const baseline = loadBaseline(BASELINE);
  const dashboard = loadDashboard(DASH("with-new.json"));
  const { added, removed } = diffFindings(
    extractFindings(dashboard),
    baseline.findings,
  );
  assert.deepEqual(added, [
    { kind: "ownership_gap", id: "fixtures/new-violation.ts" },
  ]);
  assert.equal(removed.length, 0);
});

test("end-to-end: with-resolved → 0 added, 1 removed", () => {
  const baseline = loadBaseline(BASELINE);
  const dashboard = loadDashboard(DASH("with-resolved.json"));
  const { added, removed } = diffFindings(
    extractFindings(dashboard),
    baseline.findings,
  );
  assert.equal(added.length, 0);
  assert.deepEqual(removed, [
    { kind: "ownership_gap", id: "fixtures/legacy-b.ts" },
  ]);
});

test("refresh: idempotent when finding set unchanged (no createdAt churn)", () => {
  const dir = mkdtempSync(join(tmpdir(), "ratchet-refresh-"));
  const path = join(dir, "baseline.json");
  writeFileSync(path, readFileSync(BASELINE, "utf8"));
  const before = JSON.parse(readFileSync(path, "utf8")) as {
    createdAt: string;
    findings: Finding[];
  };

  refresh(path, before.findings);

  const after = JSON.parse(readFileSync(path, "utf8")) as { createdAt: string };
  assert.equal(
    after.createdAt,
    before.createdAt,
    "createdAt must not churn when set unchanged",
  );
});

test("refresh: emits widening warning when a NEW finding is accepted (set-diff, not length)", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ratchet-refresh-"));
  const path = join(dir, "baseline.json");
  writeFileSync(path, readFileSync(BASELINE, "utf8"));
  const before = JSON.parse(readFileSync(path, "utf8")) as {
    findings: Finding[];
  };

  // Drop one existing finding AND add a new one — same length, different set.
  // Pure length-based guard would miss this; set-diff guard catches it.
  const rotated: Finding[] = [
    ...before.findings.slice(1),
    { kind: "ownership_gap", id: "fixtures/__new-rotation.ts" },
  ];

  const captured: string[] = [];
  const orig = process.stderr.write.bind(process.stderr);
  // Override only for this test; restore on teardown.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.stderr as any).write = (chunk: string | Uint8Array) => {
    captured.push(
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
    );
    return true;
  };
  t.after(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stderr as any).write = orig;
  });

  refresh(path, rotated);

  const stderr = captured.join("");
  assert.match(
    stderr,
    /Baseline widening: 1 NEW finding/,
    "must warn on set-diff widening",
  );
  assert.match(
    stderr,
    /ownership_gap: fixtures\/__new-rotation\.ts/,
    "must list the accepted new id",
  );
});
