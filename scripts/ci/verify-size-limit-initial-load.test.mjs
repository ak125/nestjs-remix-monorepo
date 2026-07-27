#!/usr/bin/env node
// scripts/ci/verify-size-limit-initial-load.test.mjs
//
// A guard with no test can silently stop guarding. These cases assert that the
// verifier actually FAILS on the two states it exists to catch, and passes on a
// well-formed one. Runs against synthetic fixtures — no build required.
//
//   node --test scripts/ci/verify-size-limit-initial-load.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./verify-size-limit-initial-load.mjs", import.meta.url));

/**
 * Build a fake assets dir. `graph` maps chunk name -> array of statically imported
 * chunk names, mirroring what Rolldown emits.
 */
function fixture(graph, configEntries, { pad = 2048 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "size-limit-fixture-"));
  const assets = path.join(dir, "assets");
  fs.mkdirSync(assets);
  for (const [name, imports] of Object.entries(graph)) {
    const body = imports.map((i) => `import"./${i}";`).join("") || "export{};";
    // Pad past COVERAGE_REQUIRED_BYTES so coverage gaps are fatal by default; the
    // tolerance case below deliberately opts out with pad: 0.
    fs.writeFileSync(path.join(assets, name), body + "//" + "x".repeat(pad));
  }
  const cfg = path.join(dir, ".size-limit.json");
  fs.writeFileSync(cfg, JSON.stringify(configEntries, null, 2));
  return { dir, assets, cfg };
}

function run({ assets, cfg }) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT], {
      env: { ...process.env, SIZE_LIMIT_ASSETS: assets, SIZE_LIMIT_CONFIG: cfg },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out: stdout };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

const GRAPH = {
  "entry.client-aaa.js": ["root-bbb.js"],
  "root-bbb.js": ["app-core-ccc.js", "app-ui-primitives-ddd.js"],
  "app-core-ccc.js": [],
  "app-ui-primitives-ddd.js": [],
  "lazy-route-zzz.js": [], // not reachable from entry/root
};

const OK_ENTRY = [
  {
    name: "Initial load JS, gzip",
    path: [
      "build/client/assets/entry.client-*.js",
      "build/client/assets/root-*.js",
      "build/client/assets/app-core-*.js",
      "build/client/assets/app-ui-primitives-*.js",
    ],
    limit: "100 KB",
    gzip: true,
  },
];

test("passes when every glob matches and the set equals the real closure", () => {
  const f = fixture(GRAPH, OK_ENTRY);
  const r = run(f);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /verified/);
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test("FAILS on a glob that matches no file (the radix-vendor regression)", () => {
  const cfg = structuredClone(OK_ENTRY);
  cfg[0].path.push("build/client/assets/radix-vendor-*.js"); // emits nothing anymore
  const f = fixture(GRAPH, cfg);
  const r = run(f);
  assert.equal(r.code, 1, "an empty glob must fail the gate");
  assert.match(r.out, /empty glob/);
  assert.match(r.out, /radix-vendor/);
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test("FAILS when a chunk in the initial graph is not counted", () => {
  const cfg = structuredClone(OK_ENTRY);
  cfg[0].path = cfg[0].path.filter((p) => !p.includes("app-ui-primitives"));
  const f = fixture(GRAPH, cfg);
  const r = run(f);
  assert.equal(r.code, 1, "an uncounted initial-load chunk must fail the gate");
  assert.match(r.out, /graph drift/);
  assert.match(r.out, /NOT COUNTED/);
  assert.match(r.out, /app-ui-primitives-ddd\.js/);
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test("an uncovered chunk under 1 KB is tolerated and reported, not fatal", () => {
  // Same commit emits a 30-byte `errors-*.js` locally and no such chunk on the CI
  // runner. Pinning that name makes the gate flap; the byte risk is negligible.
  const cfg = structuredClone(OK_ENTRY);
  cfg[0].path = cfg[0].path.filter((p) => !p.includes("app-ui-primitives"));
  const f = fixture(GRAPH, cfg, { pad: 0 });
  const r = run(f);
  assert.equal(r.code, 0, `sub-KB gap must not fail:\n${r.out}`);
  assert.match(r.out, /under 1024 B are not covered/);
  assert.match(r.out, /app-ui-primitives-ddd\.js/);
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test("failure output suggests the corrected path list", () => {
  const cfg = structuredClone(OK_ENTRY);
  cfg[0].path = cfg[0].path.filter((p) => !p.includes("app-ui-primitives"));
  const f = fixture(GRAPH, cfg);
  const r = run(f);
  assert.equal(r.code, 1);
  assert.match(r.out, /Suggested "path" list/);
  assert.match(r.out, /build\/client\/assets\/app-ui-primitives-\*\.js/);
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test("FAILS when a chunk outside the initial graph is counted", () => {
  const cfg = structuredClone(OK_ENTRY);
  cfg[0].path.push("build/client/assets/lazy-route-*.js");
  const f = fixture(GRAPH, cfg);
  const r = run(f);
  assert.equal(r.code, 1, "over-counting must fail too, not just under-counting");
  assert.match(r.out, /COUNTED but not in the initial graph/);
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test("a dynamic import() does NOT pull a chunk into the initial budget", () => {
  const f = fixture(GRAPH, OK_ENTRY);
  // root dynamically imports the lazy route: separate request, out of budget.
  fs.appendFileSync(path.join(f.assets, "root-bbb.js"), 'const x=()=>import("./lazy-route-zzz.js");');
  const r = run(f);
  assert.equal(r.code, 0, r.out);
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test("FAILS loudly when the build output is missing", () => {
  const f = fixture(GRAPH, OK_ENTRY);
  const r = run({ assets: path.join(f.dir, "does-not-exist"), cfg: f.cfg });
  assert.equal(r.code, 1);
  assert.match(r.out, /Build output not found/);
  fs.rmSync(f.dir, { recursive: true, force: true });
});
