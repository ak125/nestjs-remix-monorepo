// scripts/seo/__tests__/r-seo-09-phase2-cli.test.mjs
//
// Integration tests for the R-SEO-09 Phase 2 CLI. Sets up an isolated git
// repo in a tmpdir, commits a baseline route file, applies a change in HEAD,
// and asserts the CLI exit code + output.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, "..", "check-url-immutability.mjs");
const NODE_MODULES = resolve(__dirname, "..", "..", "..", "node_modules");

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function setupRepo() {
  const root = mkdtempSync(join(tmpdir(), "r-seo-09-phase2-"));
  // Symlink node_modules so the CLI can resolve @typescript-eslint/parser
  // without re-installing inside every tmpdir.
  execSync(`ln -s ${JSON.stringify(NODE_MODULES)} ${JSON.stringify(join(root, "node_modules"))}`);
  git(root, "init", "--quiet", "--initial-branch=main");
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "user.name", "Test");
  return root;
}

function commitFile(root, relpath, content, msg) {
  const abs = join(root, relpath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  git(root, "add", relpath);
  git(root, "commit", "--quiet", "-m", msg);
}

function runCli(root, args, env = {}) {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, BASE_REF: "main", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      code: err.status ?? -1,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
    };
  }
}

const BASE_ROUTE = `import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [
  { title: "Page" },
  { tagName: "link", rel: "canonical", href: "https://example.com/foo" },
];

export default function FooRoute() {
  return <div className="text-purple-600">hello</div>;
}
`;

test("CLI exits 0 when no route files changed", () => {
  const root = setupRepo();
  try {
    commitFile(root, "README.md", "hi", "init");
    commitFile(root, "frontend/app/routes/_index.tsx", BASE_ROUTE, "add route");
    git(root, "branch", "feature");
    git(root, "checkout", "--quiet", "feature");
    commitFile(root, "docs/note.md", "doc", "non-route change");

    const result = runCli(root, ["--pr"]);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /OK: no R-SEO-09 canonical surface touched|OK: no changes/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI exits 0 on className-only route change (codemod-safe)", () => {
  const root = setupRepo();
  try {
    commitFile(root, "README.md", "hi", "init");
    commitFile(root, "frontend/app/routes/_index.tsx", BASE_ROUTE, "add route");
    git(root, "branch", "feature");
    git(root, "checkout", "--quiet", "feature");
    const modified = BASE_ROUTE.replace("text-purple-600", "text-foreground");
    commitFile(root, "frontend/app/routes/_index.tsx", modified, "classname swap");

    const result = runCli(root, ["--pr"]);
    assert.equal(result.code, 0, `expected exit 0, got ${result.code}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI exits 1 on canonical URL change in meta", () => {
  const root = setupRepo();
  try {
    commitFile(root, "README.md", "hi", "init");
    commitFile(root, "frontend/app/routes/_index.tsx", BASE_ROUTE, "add route");
    git(root, "branch", "feature");
    git(root, "checkout", "--quiet", "feature");
    const modified = BASE_ROUTE.replace("https://example.com/foo", "https://example.com/bar");
    commitFile(root, "frontend/app/routes/_index.tsx", modified, "canonical change");

    const result = runCli(root, ["--pr"]);
    assert.equal(result.code, 1, `expected exit 1, got ${result.code}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    assert.match(result.stderr, /HARD BLOCK/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI override bypasses block when R_SEO_09_OVERRIDE=1", () => {
  const root = setupRepo();
  try {
    commitFile(root, "README.md", "hi", "init");
    commitFile(root, "frontend/app/routes/_index.tsx", BASE_ROUTE, "add route");
    git(root, "branch", "feature");
    git(root, "checkout", "--quiet", "feature");
    const modified = BASE_ROUTE.replace("https://example.com/foo", "https://example.com/bar");
    commitFile(root, "frontend/app/routes/_index.tsx", modified, "canonical change");

    const result = runCli(root, ["--pr"], { R_SEO_09_OVERRIDE: "1" });
    assert.equal(result.code, 0, `expected exit 0 (override), got ${result.code}\nstderr: ${result.stderr}`);
    assert.match(result.stdout, /OVERRIDE active/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI --audit mode never exits non-zero", () => {
  const root = setupRepo();
  try {
    commitFile(root, "README.md", "hi", "init");
    commitFile(root, "frontend/app/routes/_index.tsx", BASE_ROUTE, "add route");
    git(root, "branch", "feature");
    git(root, "checkout", "--quiet", "feature");
    const modified = BASE_ROUTE.replace("https://example.com/foo", "https://example.com/bar");
    commitFile(root, "frontend/app/routes/_index.tsx", modified, "canonical change");

    const result = runCli(root, ["--audit"]);
    assert.equal(result.code, 0, `audit mode must exit 0; got ${result.code}`);
    assert.match(result.stdout, /AUDIT MODE/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI handles filenames with `$` (Remix route param markers like admin.gammes-seo.$pgId.tsx)", () => {
  // Regression : earlier shell-based exec mangled `$pgId` via variable
  // expansion → base-surface returned null, false-positive HARD BLOCK.
  // This test exercises a classic Remix dynamic route filename.
  const root = setupRepo();
  try {
    commitFile(root, "README.md", "hi", "init");
    commitFile(root, "frontend/app/routes/admin.gammes-seo.$pgId.tsx", BASE_ROUTE, "add dynamic route");
    git(root, "branch", "feature");
    git(root, "checkout", "--quiet", "feature");
    const modified = BASE_ROUTE.replace("text-purple-600", "text-foreground");
    commitFile(root, "frontend/app/routes/admin.gammes-seo.$pgId.tsx", modified, "classname swap");

    const result = runCli(root, ["--pr"]);
    assert.equal(result.code, 0, `dynamic-route className change must pass; got ${result.code}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI blocks on route rename (filename = URL pattern)", () => {
  const root = setupRepo();
  try {
    commitFile(root, "README.md", "hi", "init");
    commitFile(root, "frontend/app/routes/old-slug.tsx", BASE_ROUTE, "add route");
    git(root, "branch", "feature");
    git(root, "checkout", "--quiet", "feature");
    git(root, "mv", "frontend/app/routes/old-slug.tsx", "frontend/app/routes/new-slug.tsx");
    git(root, "commit", "--quiet", "-m", "rename route");

    const result = runCli(root, ["--pr"]);
    assert.equal(result.code, 1, `rename must block; got ${result.code}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
