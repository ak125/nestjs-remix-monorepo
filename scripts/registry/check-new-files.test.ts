#!/usr/bin/env tsx
/**
 * Tests for the new-file set of check-new-files.js, run as the real CLI on a
 * throwaway git repository (the script and its overlay copied in).
 *
 * Regression: the pre-push hook runs the gate on the branch tip, not on a merge
 * with main. Diffing `origin/main..HEAD` then listed every file main had deleted
 * since the branch point as "added by the branch", and refused the push of any
 * branch behind main (7 files deleted on main by #1900 refused every pending
 * branch). The gate must measure what the branch adds since its merge-base, as it
 * does in CI on the PR merge ref.
 *
 * Run: npm run registry:test:check-new-files
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const SCRIPT = "scripts/registry/check-new-files.js";
const OVERLAY = ".spec/00-canon/repository-registry";
// No global or system git config: like the CI runner, which has no identity,
// so every git call that writes a commit (merge included) must carry its own.
const GIT_ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };

test("gate counts only the files the branch adds since its merge-base", async (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "check-new-files-"));
  const put = (file: string, contents: string) => {
    mkdirSync(dirname(join(fixture, file)), { recursive: true });
    writeFileSync(join(fixture, file), contents);
  };
  const git = (...args: string[]) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd: fixture, stdio: "pipe", env: GIT_ENV },
    );
  const commit = (message: string) => {
    git("add", "-A");
    git("commit", "--quiet", "-m", message);
  };
  const gate = () => {
    const r = spawnSync(process.execPath, [SCRIPT, "--base", "main", "--json"], {
      cwd: fixture,
      encoding: "utf8",
      timeout: 60000,
    });
    assert.notEqual(r.stdout, "", r.stderr);
    const report = JSON.parse(r.stdout);
    return {
      status: r.status,
      paths: report.results.map((x: { path: string }) => x.path).sort(),
      failed: report.results
        .filter((x: { verdict: string }) => x.verdict !== "ok")
        .map((x: { path: string }) => x.path)
        .sort(),
    };
  };
  try {
    mkdirSync(join(fixture, "scripts/registry"), { recursive: true });
    copyFileSync(join(ROOT, SCRIPT), join(fixture, SCRIPT));
    symlinkSync(join(ROOT, "node_modules"), join(fixture, "node_modules"), "dir");
    put(".gitignore", "node_modules\n");
    put(
      `${OVERLAY}/ownership.yaml`,
      "entries:\n  - glob: covered/**\n    owner: fixture\n    domain: D1\n",
    );
    put(`${OVERLAY}/domains.yaml`, "entries: []\n");
    put("covered/kept.txt", "kept\n");
    put("legacy/uncovered.txt", "pre-existing file outside the overlay\n");
    git("init", "--quiet", "--initial-branch=main");
    commit("base");

    git("switch", "--quiet", "-c", "feature");
    put("covered/new.txt", "added by the branch\n");
    commit("feature adds a covered file");

    git("switch", "--quiet", "main");
    rmSync(join(fixture, "legacy/uncovered.txt"));
    commit("main deletes a pre-existing uncovered file");
    git("switch", "--quiet", "feature");

    await t.test("branch behind main: files deleted on main are not added by the branch", () => {
      const r = gate();
      assert.deepEqual(r.paths, ["covered/new.txt"]);
      assert.equal(r.status, 0);
    });

    await t.test("an uncovered file added by the branch is still refused", () => {
      put("stray/new.txt", "added by the branch, outside the overlay\n");
      commit("feature adds an uncovered file");
      const r = gate();
      assert.deepEqual(r.failed, ["stray/new.txt"]);
      assert.equal(r.status, 1);
    });

    await t.test("CI shape (main merged into the branch): same new files", () => {
      git("merge", "--quiet", "--no-edit", "main");
      const r = gate();
      assert.deepEqual(r.paths, ["covered/new.txt", "stray/new.txt"]);
      assert.deepEqual(r.failed, ["stray/new.txt"]);
      assert.equal(r.status, 1);
    });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
