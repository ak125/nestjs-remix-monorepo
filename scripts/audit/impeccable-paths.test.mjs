import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scripts = dirname(fileURLToPath(import.meta.url));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "impeccable-paths-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const init = spawnSync("git", ["init", "--quiet", root], {
    encoding: "utf8",
  });
  assert.equal(init.status, 0, init.stderr);
  mkdirSync(join(root, "audit/impeccable"), { recursive: true });
  const file = "frontend/app/example.tsx";
  writeFileSync(
    join(root, "audit/impeccable/baseline.json"),
    JSON.stringify({
      total: 1,
      byCategory: { "gray-on-color": 1 },
      byFile: { [file]: 1 },
    }),
  );
  return { root, file };
}

function run(root, script, issues, args = []) {
  const report = join(root, "report.json");
  writeFileSync(report, JSON.stringify({ issues }));
  return spawnSync(process.execPath, [join(scripts, script), ...args, report], {
    cwd: root,
    encoding: "utf8",
  });
}

for (const absolute of [false, true]) {
  test(`existing issue is accepted with ${absolute ? "native absolute" : "repository relative"} path`, (t) => {
    const { root, file } = fixture(t);
    const result = run(
      root,
      "impeccable-ratchet-check.mjs",
      [{ file: absolute ? join(root, file) : file, category: "gray-on-color" }],
      ["--json-file"],
    );
    assert.equal(result.status, 0, result.stderr);
  });
}

test("a new file remains a blocking regression even at unchanged total", (t) => {
  const { root } = fixture(t);
  const result = run(
    root,
    "impeccable-ratchet-check.mjs",
    [{ file: join(root, "frontend/app/new.tsx"), category: "gray-on-color" }],
    ["--json-file"],
  );
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /new offending file: frontend\/app\/new\.tsx/);
});

test("category and total growth remain blocking", (t) => {
  const { root, file } = fixture(t);
  const result = run(
    root,
    "impeccable-ratchet-check.mjs",
    [
      { file: join(root, file), category: "gray-on-color" },
      { file: join(root, file), category: "new-category" },
    ],
    ["--json-file"],
  );
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /total: 1/);
  assert.match(result.stderr, /category new-category/);
});

test("baseline writer stores the same canonical repository paths", (t) => {
  const { root, file } = fixture(t);
  const result = run(
    root,
    "impeccable-baseline-write.mjs",
    [{ file: join(root, file), category: "gray-on-color" }],
    ["--from"],
  );
  assert.equal(result.status, 0, result.stderr);
  const baseline = JSON.parse(
    readFileSync(join(root, "audit/impeccable/baseline.json"), "utf8"),
  );
  assert.deepEqual(baseline.byFile, { [file]: 1 });
});
