import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

test("pre-commit calls the real TypeScript overlay validator and propagates its verdict", () => {
  const fixture = mkdtempSync(join(tmpdir(), "overlay-hook-"));
  const run = (command: string, args: string[], extraEnv = {}) =>
    spawnSync(command, args, {
      cwd: fixture,
      encoding: "utf8",
      env: { ...process.env, ...extraEnv },
    });
  const git = (...args: string[]) => {
    const result = run("git", args);
    assert.equal(result.status, 0, result.stderr);
  };
  const put = (name: string, contents: string) => {
    const file = join(fixture, name);
    mkdirSync(resolve(file, ".."), { recursive: true });
    writeFileSync(file, contents);
  };
  const overlay = ".spec/00-canon/repository-registry/";
  const invocation = join(fixture, "validator-invoked");
  try {
    git("init", "--quiet");
    cpSync(join(ROOT, ".husky"), join(fixture, ".husky"), { recursive: true });
    mkdirSync(join(fixture, "scripts/registry"), { recursive: true });
    cpSync(
      join(ROOT, "scripts/registry/validate-overlay.ts"),
      join(fixture, "scripts/registry/validate-overlay.ts"),
    );
    cpSync(
      join(ROOT, "packages/registry/src"),
      join(fixture, "packages/registry/src"),
      { recursive: true },
    );
    symlinkSync(
      join(ROOT, "node_modules"),
      join(fixture, "node_modules"),
      "dir",
    );
    const scripts = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8"),
    ).scripts;
    put(
      "package.json",
      JSON.stringify({
        private: true,
        scripts: { "registry:validate": scripts["registry:validate"] },
      }),
    );
    put("input.ts", "export {};\n");
    put(
      overlay + "ownership.yaml",
      JSON.stringify({
        schemaVersion: "1.0.0",
        entries: [
          {
            glob: "input.ts",
            domain: "D1",
            owner: "@ak125",
            sourceConfidence: "high",
          },
        ],
      }),
    );
    const validDomains = JSON.stringify({
      schemaVersion: "1.0.0",
      entries: [{ id: "D1", name: "Test", criticality: "P1", owner: "@ak125" }],
    });
    put(overlay + "domains.yaml", validDomains);
    for (const name of ["status-overrides", "delete-policy"])
      put(
        overlay + name + ".yaml",
        JSON.stringify({ schemaVersion: "1.0.0", entries: [] }),
      );
    git("add", "--", overlay, "input.ts");

    // Only unrelated lint/AST steps are stubbed in this isolated fixture. npm
    // delegates to the real CLI and the repository's unchanged script command.
    const npm = run("sh", ["-c", "command -v npm"]).stdout.trim();
    assert.ok(npm);
    put("bin/npx", "#!/bin/sh\nexit 0\n");
    put(
      "bin/npm",
      '#!/bin/sh\nprintf "called\\n" >> "$HOOK_INVOCATION"\nexec "$REAL_NPM" "$@"\n',
    );
    for (const file of ["bin/npm", "bin/npx"])
      assert.equal(run("chmod", ["+x", file]).status, 0);
    const env = {
      PATH: join(fixture, "bin") + ":" + process.env.PATH,
      REAL_NPM: npm,
      HOOK_INVOCATION: invocation,
    };
    const hook = () => run("sh", [".husky/pre-commit"], env);

    let result = hook();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(
      existsSync(invocation),
      "overlay was staged but the validator was not invoked",
    );
    assert.equal(readFileSync(invocation, "utf8"), "called\n");
    assert.match(result.stderr, /All overlays valid/);

    // A valid schema with a missing domain must reach the semantic validator.
    put(
      overlay + "domains.yaml",
      JSON.stringify({ schemaVersion: "1.0.0", entries: [] }),
    );
    git("add", "--", overlay + "domains.yaml");
    result = hook();
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /domain "D1".*not declared/);
    assert.match(result.stdout, /Layer 2 overlay validation failed/);

    // A schema-invalid document must report a validation error, not a crash.
    put(
      overlay + "domains.yaml",
      JSON.stringify({ schemaVersion: "invalid", entries: [] }),
    );
    git("add", "--", overlay + "domains.yaml");
    result = hook();
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /Zod: schemaVersion/);
    assert.doesNotMatch(result.stderr, /FAILED:.*not iterable/);

    put(overlay + "domains.yaml", validDomains);
    git("add", "--", overlay + "domains.yaml");
    result = hook();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(readFileSync(invocation, "utf8").trim().split("\n").length, 4);

    git("reset", "--quiet");
    put("unrelated.txt", "unrelated\n");
    git("add", "--", "unrelated.txt");
    result = hook();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(readFileSync(invocation, "utf8").trim().split("\n").length, 4);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
