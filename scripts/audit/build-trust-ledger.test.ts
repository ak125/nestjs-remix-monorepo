import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTrustLedger, type DbProbeFn } from "./build-trust-ledger.ts";

const NOW = "2026-06-14T18:00:00.000Z";

/** Build a throwaway repo fixture with the committed audit/*.json artifacts. */
function makeRepo(opts?: {
  deadCount?: number;
  cycleCount?: number;
  dupCount?: number;
  boundaryViol?: number;
  unknownDomains?: number;
  canonicalMtime?: Date; // controls staleness
  runtimeTruth?: Record<string, unknown>; // <check> -> json (RECURRING)
}): string {
  const root = mkdtempSync(join(tmpdir(), "trust-ledger-"));
  mkdirSync(join(root, "audit/registry"), { recursive: true });
  mkdirSync(join(root, "audit-reports/runtime-truth"), { recursive: true });

  writeFileSync(
    join(root, "audit/dead-code-candidates.json"),
    JSON.stringify({ count: opts?.deadCount ?? 0, candidates: [] }),
  );
  writeFileSync(
    join(root, "audit/duplicate-map.json"),
    JSON.stringify({ count: opts?.dupCount ?? 0, duplicates: [] }),
  );
  writeFileSync(
    join(root, "audit/cycle-map.json"),
    JSON.stringify({ count: opts?.cycleCount ?? 0, cycles: [] }),
  );
  writeFileSync(
    join(root, "audit/module-boundaries.json"),
    JSON.stringify({
      deep_access_violations: Array.from({ length: opts?.boundaryViol ?? 0 }, (_, i) => ({ i })),
      domains: {},
    }),
  );
  const files = [
    ...Array.from({ length: opts?.unknownDomains ?? 0 }, (_, i) => ({
      path: `x${i}.ts`,
      domain: "UNKNOWN",
    })),
    { path: "backend/src/app.ts", domain: "D1" },
  ];
  const canonicalPath = join(root, "audit/registry/canonical.json");
  writeFileSync(
    canonicalPath,
    JSON.stringify({ files, db: {}, runtime: [], meta: { generatedAt: "1970-01-01T00:00:00.000Z" } }),
  );
  if (opts?.canonicalMtime) {
    utimesSync(canonicalPath, opts.canonicalMtime, opts.canonicalMtime);
  }

  for (const [check, json] of Object.entries(opts?.runtimeTruth ?? {})) {
    writeFileSync(
      join(root, `audit-reports/runtime-truth/${check}.json`),
      JSON.stringify(json),
    );
  }
  return root;
}

const noProbe: DbProbeFn = async () => null;

test("schema + exitCode 0 + deterministic stable sort", async () => {
  const repo = makeRepo();
  const r = await buildTrustLedger({ repoRoot: repo, nowIso: NOW, dbProbe: noProbe });
  assert.equal(r.exitCode, 0);
  assert.equal(r.json.schema_version, "trust-ledger/v1");
  assert.ok(r.json.rows.length > 0);
  // every row carries BOTH axes
  for (const row of r.json.rows) {
    assert.ok(["RECURRING", "MANUAL", "MISSING", "STALE"].includes(row.coverage_status));
    assert.ok(["PASS", "WARN", "FAIL", "UNKNOWN"].includes(row.health_status));
    assert.equal(row.autofixable, false);
  }
  // stable sort: owner→surface→dimension
  const keys = r.json.rows.map((x) => `${x.owner} ${x.surface} ${x.dimension}`);
  assert.deepEqual(keys, keys.slice().sort((a, b) => a.localeCompare(b)));
});

test("idempotent: same nowIso → byte-identical markdown; no run timestamp in body", async () => {
  const repo = makeRepo();
  const a = await buildTrustLedger({ repoRoot: repo, nowIso: NOW, dbProbe: noProbe });
  const b = await buildTrustLedger({ repoRoot: repo, nowIso: NOW, dbProbe: noProbe });
  assert.equal(a.markdown, b.markdown);
  // run timestamp must NOT leak into the diffed markdown body (json manifest only)
  assert.ok(!a.markdown.includes(NOW), "markdown must not embed run timestamp");
  assert.equal(a.json.generated_at, NOW);
});

test("coverage ≠ health: RECURRING archi check with violations is WARN, not PASS", async () => {
  const repo = makeRepo({ cycleCount: 15 });
  const r = await buildTrustLedger({ repoRoot: repo, nowIso: NOW, dbProbe: noProbe });
  const cycles = r.json.rows.find((x) => x.dimension === "Dependency cycles")!;
  assert.equal(cycles.coverage_status, "RECURRING");
  assert.equal(cycles.health_status, "WARN");
  assert.equal((cycles.evidence as { observed: number }).observed, 15);
});

test("no primary truth: every RECURRING row traces to a real source_path", async () => {
  const repo = makeRepo({ deadCount: 3 });
  const r = await buildTrustLedger({ repoRoot: repo, nowIso: NOW, dbProbe: noProbe });
  for (const row of r.json.rows) {
    if (row.coverage_status === "RECURRING" || row.coverage_status === "STALE") {
      assert.ok(row.source_path, `${row.dimension} RECURRING/STALE must have a source_path`);
    }
    if (row.coverage_status === "MISSING" && row.producer === "none (coverage-summary.json is transient CI artifact)") {
      assert.equal(row.source_path, null);
    }
  }
});

test("canonical stale ⇒ coverage STALE + health UNKNOWN (no false green)", async () => {
  // mtime 20 days before NOW
  const old = new Date(Date.parse(NOW) - 20 * 24 * 3600 * 1000);
  const repo = makeRepo({ canonicalMtime: old });
  const r = await buildTrustLedger({ repoRoot: repo, nowIso: NOW, dbProbe: noProbe });
  const fresh = r.json.rows.find((x) => x.dimension.startsWith("Inventory freshness"))!;
  assert.equal(fresh.coverage_status, "STALE");
  assert.equal(fresh.health_status, "UNKNOWN");
  assert.equal(fresh.freshness, "20d");
});

test("runtime-truth check: MANUAL when no runner JSON, RECURRING+health when present", async () => {
  const repoManual = makeRepo();
  const rm = await buildTrustLedger({ repoRoot: repoManual, nowIso: NOW, dbProbe: noProbe });
  const stableManual = rm.json.rows.find((x) => x.dimension.includes("STABLE/IMMUTABLE"))!;
  assert.equal(stableManual.coverage_status, "MANUAL");
  assert.equal(stableManual.health_status, "UNKNOWN");
  assert.equal(stableManual.source_path, null);

  const repoRec = makeRepo({
    runtimeTruth: {
      "pg-stable-write": {
        check_name: "pg-stable-write",
        generated_at: NOW,
        health_status: "FAIL",
        freshness: "<1h",
      },
    },
  });
  const rr = await buildTrustLedger({ repoRoot: repoRec, nowIso: NOW, dbProbe: noProbe });
  const stableRec = rr.json.rows.find((x) => x.dimension.includes("STABLE/IMMUTABLE"))!;
  assert.equal(stableRec.coverage_status, "RECURRING");
  assert.equal(stableRec.health_status, "FAIL");
  assert.ok(stableRec.source_path?.endsWith("pg-stable-write.json"));
});

test("DB probe: empty findings sink ⇒ MISSING consumer (the gap); null probe ⇒ skipped:no-creds", async () => {
  const repo = makeRepo();
  // live-ish probe: crawler fresh, findings sink empty
  const liveProbe: DbProbeFn = async () => ({
    snapshot_newest_iso: new Date(Date.parse(NOW) - 5 * 60 * 1000).toISOString(),
    findings_rows: 0,
  });
  const r = await buildTrustLedger({ repoRoot: repo, nowIso: NOW, dbProbe: liveProbe });
  assert.equal(r.json.manifest.db_enrichment, "applied");
  const live = r.json.rows.find((x) => x.dimension.includes("crawler liveness"))!;
  assert.equal(live.coverage_status, "RECURRING");
  assert.equal(live.health_status, "PASS"); // 5 min old = fresh
  const consumer = r.json.rows.find((x) => x.dimension.includes("findings consumer"))!;
  assert.equal(consumer.coverage_status, "MISSING"); // sink empty = no consumer
  assert.equal((consumer.evidence as { observed: { findings_rows: number } }).observed.findings_rows, 0);

  const rNull = await buildTrustLedger({ repoRoot: repo, nowIso: NOW, dbProbe: null });
  assert.equal(rNull.json.manifest.db_enrichment, "skipped:no-creds");
});

test("markdown has manifest + headlines + per-owner sections", async () => {
  const repo = makeRepo({ cycleCount: 15 });
  const r = await buildTrustLedger({ repoRoot: repo, nowIso: NOW, dbProbe: noProbe });
  assert.ok(r.markdown.includes("## Coverage manifest"));
  assert.ok(r.markdown.includes("## Headlines"));
  assert.ok(r.markdown.includes("## Owner: platform"));
  assert.ok(r.markdown.includes("does a recurring check exist"));
});
