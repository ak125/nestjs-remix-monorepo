"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { test } = require("node:test");
const yaml = require("js-yaml");
const { classify } = require("./check-new-files.js");

const root = path.resolve(__dirname, "../..");

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "registry-branch-gate-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, {
    cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const write = (name, text) => {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  };
  const commit = (message) => { git("add", "."); git("commit", "-m", message); };
  git("init", "--initial-branch=main");
  git("config", "user.name", "Registry fixture");
  git("config", "user.email", "registry-test@example.invalid");
  write(".gitignore", "node_modules/\n");
  write("scripts/registry/check-new-files.js", fs.readFileSync(path.join(__dirname, "check-new-files.js")));
  fs.symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "junction");
  write(".spec/00-canon/repository-registry/ownership.yaml", "entries:\n  - glob: src/owned/**\n    owner: '@ak125'\n    domain: D15\n");
  write(".spec/00-canon/repository-registry/domains.yaml", "entries: []\n");
  write("legacy.ts", "export const legacy = true;\n");
  commit("initial fixture");
  git("branch", "candidate");
  const gate = (base = "main") => {
    const p = spawnSync(process.execPath, ["scripts/registry/check-new-files.js", "--base", base, "--json"], { cwd: dir, encoding: "utf8" });
    assert.equal(p.error, undefined);
    return { status: p.status, stderr: p.stderr, report: p.stdout ? JSON.parse(p.stdout) : null };
  };
  const diverge = () => {
    git("rm", "legacy.ts");
    write("main-only.ts", "export const mainOnly = true;\n");
    commit("main advances independently");
    git("checkout", "candidate");
  };
  return { git, write, commit, gate, diverge };
}

test("ignores files deleted on main after the branch fork", (t) => {
  const f = fixture(t); f.diverge();
  f.write("src/owned/added.ts", "export const added = true;\n"); f.commit("owned addition");
  const result = f.gate();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.report.results.map((r) => r.path), ["src/owned/added.ts"]);
});

test("still blocks a genuine unowned addition on a diverged branch", (t) => {
  const f = fixture(t); f.diverge();
  f.write("unowned.ts", "export const unowned = true;\n"); f.commit("unowned addition");
  const result = f.gate();
  assert.equal(result.status, 1);
  assert.equal(result.report.missing_both, 1);
  assert.deepEqual(result.report.results, [{ path: "unowned.ts", verdict: "missing_both" }]);
});

test("keeps blocking unowned additions when the base is an ancestor", (t) => {
  const f = fixture(t); f.git("checkout", "candidate");
  f.write("unowned.ts", "export const unowned = true;\n"); f.commit("unowned addition");
  const result = f.gate();
  assert.equal(result.status, 1);
  assert.equal(result.report.missing_both, 1);
});

test("accepts owned additions when the base is an ancestor", (t) => {
  const f = fixture(t); f.git("checkout", "candidate");
  f.write("src/owned/added.ts", "export const added = true;\n"); f.commit("owned addition");
  assert.equal(f.gate().status, 0);
});

test("checks the candidate additions after a rebase without counting main additions", (t) => {
  const f = fixture(t); f.diverge();
  f.write("unowned.ts", "export const unowned = true;\n"); f.commit("unowned addition");
  f.git("rebase", "main");
  const result = f.gate();
  assert.equal(result.status, 1);
  assert.deepEqual(result.report.results.map((r) => r.path), ["unowned.ts"]);
});

test("returns an empty result for HEAD equal to the base", (t) => {
  const f = fixture(t); const result = f.gate();
  assert.equal(result.status, 0); assert.equal(result.report.totalNew, 0);
});

test("fails closed when the base ref is missing", (t) => {
  const f = fixture(t); const result = f.gate("absent-ref");
  assert.equal(result.status, 2); assert.equal(result.report, null);
  assert.match(result.stderr, /Cannot compute new files diff/);
});

test("fails closed for unrelated histories instead of comparing their trees", (t) => {
  const f = fixture(t);
  f.git("checkout", "--orphan", "unrelated");
  f.write("unrelated.ts", "export const unrelated = true;\n"); f.commit("independent root");
  const result = f.gate();
  assert.equal(result.status, 2); assert.equal(result.report, null);
});

test("the preserved scenario migration resolves to the existing video owner and domain", () => {
  const overlayDir = path.join(root, ".spec/00-canon/repository-registry");
  const overlay = {
    ownership: yaml.load(fs.readFileSync(path.join(overlayDir, "ownership.yaml"), "utf8")).entries,
    domains: yaml.load(fs.readFileSync(path.join(overlayDir, "domains.yaml"), "utf8")).entries,
  };
  const migration = "backend/supabase/migrations/20261013_video_scenario.sql";
  assert.deepEqual(classify(migration, overlay), {
    verdict: "ok", ownerGlob: migration, owner: "@ak125/marketing-team", domain: "D12",
  });
  assert.equal(classify("backend/supabase/migrations/20991231_unowned_video_scenario.sql", overlay).verdict, "missing_both");
});