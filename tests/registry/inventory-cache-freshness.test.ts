import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

test("real inventory producer and registry loader enforce cache freshness", async (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "inventory-freshness-"));
  const put = (file: string, contents: string) => {
    mkdirSync(dirname(join(fixture, file)), { recursive: true });
    writeFileSync(join(fixture, file), contents);
  };
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: fixture, stdio: "pipe" });
  const run = (args: string[]) =>
    spawnSync(process.execPath, args, {
      cwd: fixture,
      encoding: "utf8",
      timeout: 60000,
    });
  const build = () => {
    const r = run(["scripts/audit/build-deep-inventory.js", "--quiet"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  };
  const load = () =>
    run(["-e", "require('./scripts/registry/lib/utils').loadInventoryCache()"]);
  const rejected = () => {
    const r = load();
    assert.equal(r.status, 1, "stale cache accepted: " + r.stdout + r.stderr);
    assert.match(r.stderr, /npm run audit:inventory/);
  };
  try {
    for (const file of [
      "scripts/audit/build-deep-inventory.js",
      "scripts/registry/lib/utils.js",
    ]) {
      mkdirSync(dirname(join(fixture, file)), { recursive: true });
      copyFileSync(join(ROOT, file), join(fixture, file));
    }
    symlinkSync(
      join(ROOT, "node_modules"),
      join(fixture, "node_modules"),
      "dir",
    );
    put(".gitignore", "node_modules/\n/audit/\n");
    put(
      "package.json",
      JSON.stringify({ name: "inventory-fixture", private: true }),
    );
    put("package-lock.json", "{}\n");
    put(
      ".dependency-cruiser.cjs",
      "module.exports = { forbidden: [], options: { doNotFollow: { path: 'node_modules' } } };\n",
    );
    put(
      "knip.json",
      JSON.stringify({
        entry: ["backend/src/main.ts", "frontend/app/root.tsx"],
        project: ["backend/src/**/*.ts", "frontend/app/**/*.tsx"],
      }),
    );
    put(
      "backend/tsconfig.json",
      JSON.stringify({ compilerOptions: { target: "ES2022" } }),
    );
    put(
      "backend/src/main.ts",
      "import { value } from './value'; export const result = value;\n",
    );
    put("backend/src/value.ts", "export const value = 1;\n");
    put(
      "frontend/app/root.tsx",
      "export default function Root() { return null; }\n",
    );
    git("init", "--quiet");
    git("add", ".");
    git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    );
    build();
    const cachePath = "audit/cache/codebase-inventory.json";
    const originalCache = readFileSync(join(fixture, cachePath), "utf8");

    await t.test("unchanged inputs accept the actual producer output", () => {
      const r = load();
      assert.equal(r.status, 0, r.stderr);
    });
    await t.test(
      "same-size source edit with restored mtime is rejected",
      () => {
        const file = "backend/src/value.ts";
        const previous = readFileSync(join(fixture, file), "utf8");
        const stat = statSync(join(fixture, file));
        try {
          put(file, previous.replace("= 1", "= 2"));
          utimesSync(join(fixture, file), stat.atime, stat.mtime);
          rejected();
        } finally {
          put(file, previous);
        }
      },
    );
    await t.test("new untracked source is rejected", () => {
      try {
        put("backend/src/new.ts", "export {};\n");
        rejected();
      } finally {
        rmSync(join(fixture, "backend/src/new.ts"), { force: true });
      }
    });
    await t.test("new staged source is rejected", () => {
      try {
        put("backend/src/new.ts", "export {};\n");
        git("add", "backend/src/new.ts");
        rejected();
      } finally {
        git("reset", "--quiet", "HEAD", "--", "backend/src/new.ts");
        rmSync(join(fixture, "backend/src/new.ts"), { force: true });
      }
    });
    await t.test("source deletion is rejected", () => {
      const file = "backend/src/value.ts",
        old = readFileSync(join(fixture, file), "utf8");
      try {
        rmSync(join(fixture, file));
        rejected();
      } finally {
        put(file, old);
      }
    });
    await t.test("source rename is rejected", () => {
      const from = join(fixture, "backend/src/value.ts"),
        to = join(fixture, "backend/src/renamed.ts");
      try {
        renameSync(from, to);
        rejected();
      } finally {
        renameSync(to, from);
      }
    });
    for (const file of [
      "backend/tsconfig.json",
      "package-lock.json",
      "scripts/audit/build-deep-inventory.js",
    ]) {
      await t.test(`changed input ${file} is rejected`, () => {
        const old = readFileSync(join(fixture, file), "utf8");
        try {
          put(file, old + "\n");
          rejected();
        } finally {
          put(file, old);
        }
      });
    }
    await t.test("legacy cache without source provenance is rejected", () => {
      try {
        put(cachePath, JSON.stringify({ files: [], file_count: 0 }));
        rejected();
      } finally {
        put(cachePath, originalCache);
      }
    });
    await t.test("mismatched runtime projection is rejected", () => {
      const file = "audit/runtime-entrypoints.json",
        old = readFileSync(join(fixture, file), "utf8");
      try {
        put(file, "{}\n");
        rejected();
      } finally {
        put(file, old);
      }
    });
    await t.test(
      "unrelated generated output does not invalidate the cache",
      () => {
        put("audit/registry/canonical.json", "{}\n");
        const r = load();
        assert.equal(r.status, 0, r.stderr);
      },
    );
    await t.test(
      "source edit during analysis fails without publishing a replacement cache",
      async () => {
        const file = "backend/src/value.ts",
          previous = readFileSync(join(fixture, file), "utf8");
        let changed = false;
        let stderr = "";
        try {
          const status = await new Promise<number | null>((resolve, reject) => {
            const child = spawn(
              process.execPath,
              ["scripts/audit/build-deep-inventory.js"],
              {
                cwd: fixture,
                stdio: ["ignore", "ignore", "pipe"],
                timeout: 60000,
              },
            );
            child.stderr.on("data", (chunk) => {
              stderr += chunk.toString();
              if (!changed && stderr.includes("running dependency-cruiser")) {
                changed = true;
                put(file, previous.replace("= 1", "= 3"));
              }
            });
            child.on("error", reject);
            child.on("close", resolve);
          });
          assert.ok(changed, stderr);
          assert.equal(status, 1, stderr);
          assert.match(stderr, /inputs changed during analysis/);
          assert.equal(
            readFileSync(join(fixture, cachePath), "utf8"),
            originalCache,
          );
        } finally {
          put(file, previous);
        }
      },
    );
    await t.test(
      "rebuilding after a source edit restores validity deterministically",
      () => {
        put("backend/src/value.ts", "export const value = 2;\n");
        build();
        assert.equal(load().status, 0);
        const regenerated = readFileSync(join(fixture, cachePath), "utf8");
        assert.notEqual(regenerated, originalCache);
        build();
        assert.equal(
          readFileSync(join(fixture, cachePath), "utf8"),
          regenerated,
        );
      },
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
