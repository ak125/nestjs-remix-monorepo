/**
 * tests/registry/llm-repo-map.test.ts — covers build-llm-repo-map.js (REPO_MAP.md).
 *
 * Regression: the generator iterated a hardcoded D1..D15 list, so D16
 * (declared in domains.yaml, present in canonical.json) was grouped then
 * silently never rendered. The domain list now comes from domains.yaml
 * (Layer 2 SoT) united with every domain id actually present in the data.
 *
 * Asserts, on fixtures and on the committed canonical.json:
 *   - every domain carrying data is rendered (no data loss: section sums == totals)
 *   - a domain carried only by tables/RPC is rendered
 *   - order is deterministic (numeric, undeclared ids after declared, UNKNOWN last)
 *   - declared-but-empty domains are listed, not silently dropped
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  renderRepoMap,
  loadDomainCatalog,
  orderDomainIds,
  groupByDomain,
} from "../../scripts/registry/build-llm-repo-map.js";

const ROOT = path.resolve(__dirname, "..", "..");
const DOMAINS_YAML = path.join(ROOT, ".spec/00-canon/repository-registry/domains.yaml");
const CANONICAL = path.join(ROOT, "audit/registry/canonical.json");

const CATALOG = [
  { id: "D1", name: "Catalog Core" },
  { id: "D2", name: "Legacy/XTR Migration" },
  { id: "D10", name: "Quality" },
  { id: "D16", name: "Maintenance" },
  { id: "D3", name: "Declared but empty" },
];

function file(p: string, domain: string) {
  return { path: p, domain, kind: "module", owner: "@ak125", status: "LIVE" };
}

function fixture() {
  return {
    files: [
      file("backend/src/modules/maintenance/maintenance.module.ts", "D16"),
      file("backend/src/modules/catalog/catalog.module.ts", "D1"),
      file("backend/src/modules/quality/q.ts", "D10"),
      file("backend/src/x.ts", "UNKNOWN"),
      file("backend/src/legacy.ts", "D2"),
    ],
    db: {
      // D9 is carried only by a table and an RPC, and is not declared.
      tables: [{ id: "t1", domain: "D9" }, { id: "t2" }],
      rpc: [{ id: "r1", domain: "D9" }],
    },
    deps: [],
    runtime: [{ path: "backend/src/modules/maintenance/maintenance.module.ts" }],
    meta: { sotFingerprint: "fixture" },
  };
}

function sectionIds(md: string): string[] {
  return [...md.matchAll(/^### (\S+) — /gm)].map((m) => m[1]);
}

function sumOf(md: string, label: string): number {
  return [...md.matchAll(new RegExp(`^- \\*\\*${label}\\*\\*: (\\d+)`, "gm"))].reduce(
    (acc, m) => acc + Number(m[1]),
    0,
  );
}

describe("build-llm-repo-map", () => {
  test("renders D16 and a tables/RPC-only domain", () => {
    const md = renderRepoMap(fixture(), "sha", CATALOG);
    assert.match(md, /^### D16 — Maintenance$/m);
    assert.match(md, /^### D9 — D9 \(absent de domains\.yaml\)$/m);
  });

  test("order: declared numeric, then undeclared, UNKNOWN last", () => {
    const md = renderRepoMap(fixture(), "sha", CATALOG);
    assert.deepEqual(sectionIds(md), ["D1", "D2", "D10", "D16", "D9", "UNKNOWN"]);
  });

  test("deterministic regardless of input order", () => {
    const a = fixture();
    const b = fixture();
    b.files.reverse();
    b.db.tables.reverse();
    const shuffled = [...CATALOG].reverse();
    assert.equal(renderRepoMap(a, "sha", CATALOG), renderRepoMap(b, "sha", shuffled));
  });

  test("declared-but-empty domains are listed, not rendered as sections", () => {
    const md = renderRepoMap(fixture(), "sha", CATALOG);
    assert.ok(!sectionIds(md).includes("D3"));
    assert.match(md, /Déclarés dans domains\.yaml sans aucune entrée : D3\b/);
  });

  test("no data loss: section sums equal global totals", () => {
    const c = fixture();
    const md = renderRepoMap(c, "sha", CATALOG);
    assert.equal(sumOf(md, "Files"), c.files.length);
    assert.equal(sumOf(md, "DB tables"), c.db.tables.length);
    assert.equal(sumOf(md, "DB RPC"), c.db.rpc.length);
    assert.equal(sumOf(md, "Runtime entrypoints"), c.runtime.length);
  });

  test("orderDomainIds is a pure total order over groups ∪ catalog", () => {
    const groups = groupByDomain(fixture());
    assert.deepEqual(orderDomainIds(groups, CATALOG), [
      "D1", "D2", "D3", "D10", "D16", "D9", "UNKNOWN",
    ]);
  });

  test("committed canonical.json: every domain carrying data has a section", () => {
    const canonical = JSON.parse(fs.readFileSync(CANONICAL, "utf8"));
    const catalog = loadDomainCatalog(DOMAINS_YAML);
    const md = renderRepoMap(canonical, "sha", catalog);
    const present = new Set<string>([
      ...canonical.files.map((f: { domain: string }) => f.domain),
      ...canonical.db.tables.map((t: { domain?: string }) => t.domain || "UNKNOWN"),
      ...canonical.db.rpc.map((r: { domain?: string }) => r.domain || "UNKNOWN"),
    ]);
    const rendered = new Set(sectionIds(md));
    for (const id of present) assert.ok(rendered.has(id), `domain ${id} carries data but has no section`);
    assert.equal(sumOf(md, "Files"), canonical.files.length);
    assert.equal(sumOf(md, "DB tables"), canonical.db.tables.length);
    assert.equal(sumOf(md, "DB RPC"), canonical.db.rpc.length);
    assert.equal(sumOf(md, "Runtime entrypoints"), canonical.runtime.length);
  });
});
