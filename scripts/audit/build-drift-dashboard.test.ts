import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDashboard } from "./build-drift-dashboard.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const FIXTURE_OK = join(HERE, "__fixtures__/repo-ok");
const FIXTURE_BROKEN = join(HERE, "__fixtures__/repo-broken");

test("buildDashboard against happy-path fixture: 5 contracts all ok", async () => {
  const r = await buildDashboard({ repoRoot: FIXTURE_OK });
  assert.equal(r.exitCode, 0);
  assert.equal(r.json.schemaVersion, "v1");
  assert.equal(r.json.contracts.length, 5);
  for (const c of r.json.contracts) {
    assert.equal(c.status, "ok", `${c.name} should be ok, got ${c.status}`);
    assert.match(c.sha256, /^[a-f0-9]{12,64}$/);
    const expectedFile = c.name === "architecture" ? "files" : c.name;
    assert.ok(
      c.file.endsWith(`/${expectedFile}.json`),
      `${c.name}.file should end with /${expectedFile}.json, got ${c.file}`,
    );
  }
});

test("dashboard markdown contains the 6 fixed H2 sections", async () => {
  const r = await buildDashboard({ repoRoot: FIXTURE_OK });
  for (const heading of [
    "Contracts build status",
    "Canonical fingerprint consistency",
    "Ownership gaps",
    "Runtime contract coverage",
    "Dep governance coverage",
    "RPC + DB contract coverage",
  ]) {
    assert.ok(
      r.markdown.includes(`## ${heading}`),
      `missing section: ${heading}`,
    );
  }
});

test("broken fixture: deps=invalid, rpc=missing, script still exits 0", async () => {
  const r = await buildDashboard({ repoRoot: FIXTURE_BROKEN });
  assert.equal(r.exitCode, 0);
  const byName = Object.fromEntries(r.json.contracts.map((c) => [c.name, c]));
  assert.equal(byName.deps.status, "invalid");
  assert.equal(byName.rpc.status, "missing");
  assert.equal(byName.architecture.status, "ok");
  assert.equal(byName.db.status, "ok");
  assert.equal(byName.runtime.status, "ok");
});

test("coverage parser extracts numbers from fixture markdown", async () => {
  const r = await buildDashboard({ repoRoot: FIXTURE_OK });
  assert.equal((r.json.coverage as any).runtime.l1, 42);
  assert.equal((r.json.coverage as any).runtime.v1Sample, 28);
  assert.equal((r.json.coverage as any).deps.l1, 232);
  assert.equal((r.json.coverage as any).deps.v1Sample, 26);
  assert.equal((r.json.coverage as any).deps.familiesCovered, 11);
  assert.equal((r.json.coverage as any).deps.familiesTotal, 14);
  assert.equal((r.json.coverage as any).rpc.l1, 56);
  assert.equal((r.json.coverage as any).rpc.v1Sample, 18);
  assert.equal((r.json.coverage as any).rpc.domainsCovered, 8);
  assert.equal((r.json.coverage as any).rpc.domainsTotal, 15);
});

test("ownership gap detection: no orphans for files that match globs", async () => {
  // repo-ok fixture has globs for backend/** and frontend/**;
  // both file entries (backend/src/app.ts, frontend/app/root.tsx) match.
  const r = await buildDashboard({ repoRoot: FIXTURE_OK });
  assert.equal(r.json.ownership.gapCount, 0);
  assert.deepEqual(r.json.ownership.sample, []);
  assert.deepEqual(r.json.ownership.orphans, []);
});

test("ownership gap detection: full orphans list emitted, sorted, >10 entries", async () => {
  // Synthetic repo: 12 files where only 2 match the glob. Verifies that the
  // returned `orphans` array is the FULL list (not truncated like `sample`),
  // is sorted, and that `sample` is its first-10 prefix.
  const root = mkdtempSync(join(tmpdir(), "drift-orphans-"));
  mkdirSync(join(root, ".spec/00-canon/repository-registry"), { recursive: true });
  mkdirSync(join(root, "audit/registry"), { recursive: true });

  writeFileSync(
    join(root, ".spec/00-canon/repository-registry/ownership.yaml"),
    "schemaVersion: 1.0.0\nentries:\n  - glob: backend/**\n    domain: D1\n    owner: x\n    sourceConfidence: high\n    risk: low\n",
    "utf8",
  );

  const orphanPaths = [
    "orphan-z.ts",
    "orphan-a.ts",
    "orphan-m.ts",
    "orphan-c.ts",
    "orphan-b.ts",
    "orphan-d.ts",
    "orphan-e.ts",
    "orphan-f.ts",
    "orphan-g.ts",
    "orphan-h.ts",
    "orphan-i.ts",
    "orphan-j.ts",
  ];
  const ownedPaths = ["backend/src/owned-1.ts", "backend/src/owned-2.ts"];
  const allPaths = [...orphanPaths, ...ownedPaths];
  writeFileSync(
    join(root, "audit/registry/files.json"),
    JSON.stringify({
      entries: allPaths.map((p) => ({ path: p, id: p, owner: null, domain: null })),
    }),
    "utf8",
  );

  const r = await buildDashboard({ repoRoot: root });
  const sortedOrphans = orphanPaths.slice().sort();
  assert.equal(r.json.ownership.gapCount, orphanPaths.length);
  assert.deepEqual(r.json.ownership.orphans, sortedOrphans);
  assert.deepEqual(r.json.ownership.sample, sortedOrphans.slice(0, 10));
  assert.ok(
    r.json.ownership.orphans.length >= r.json.ownership.sample.length,
    "orphans must be at least as long as sample",
  );
});

test("canonical fingerprint: sotFingerprint surfaced, stale=false when sections non-empty", async () => {
  const r = await buildDashboard({ repoRoot: FIXTURE_OK });
  assert.equal(r.json.fingerprint.canonical.stale, false);
  assert.equal(r.json.fingerprint.canonical.sotFingerprint, "FIXTUREok0000");
  // Section sizes reflect the fixture: 1 entry per Layer 1 array.
  assert.equal(r.json.fingerprint.canonical.sectionSizes.files, 1);
  assert.equal(r.json.fingerprint.canonical.sectionSizes["db.tables"], 1);
  assert.equal(r.json.fingerprint.canonical.sectionSizes["db.rpc"], 1);
});
