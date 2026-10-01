/**
 * Behavioural proof of the PROD diagnostic provenance flags writer (2026-09-30).
 *
 * `prod-diagnostic-provenance-env.sh` writes the three diagnostic provenance
 * rollout flags into ~/production/.env during the PROD deploy. The code never
 * fails on a bad value (`bool()` reads anything but `true` as false), so a wrong
 * value must stop the deploy BEFORE the running container is touched. These
 * tests EXECUTE the script against scratch .env files and assert:
 *
 *   1. unset config writes the three keys explicitly OFF (rollback path);
 *   2. true/false are written as is, existing lines are replaced (never
 *      duplicated), absent keys appended, every other line kept byte-for-byte;
 *   3. a boolean spelling the code would read as false FAILS and leaves the
 *      .env byte-identical;
 *   4. PRIMARY true with EXPOSE not true FAILS (the primary mode would weigh
 *      the ranking by an information nobody sees);
 *   5. re-running is idempotent and the file mode is kept;
 *   6. deploy-prod.yml maps each input from a variable, verifies this test and
 *      runs the script BEFORE the point of no return.
 *
 * Run: node --test scripts/ci/prod-diagnostic-provenance-env.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  chmodSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(SCRIPT_DIR, "prod-diagnostic-provenance-env.sh");
const DEPLOY_WORKFLOW = join(SCRIPT_DIR, "..", "..", ".github", "workflows", "deploy-prod.yml");

const PROJECTION = "DIAGNOSTIC_PROJECTION_ENABLED";
const EXPOSE = "DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED";
const PRIMARY = "DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED";
const KEYS = [PROJECTION, EXPOSE, PRIMARY];

// A PROD-like .env: unrelated lines that must survive byte-for-byte (including
// the neighbouring KG flags), plus stale provenance lines (hand-edit style,
// unquoted) that must be replaced, not duplicated. PROJECTION is absent on
// purpose: it must be appended.
const UNRELATED = [
  "SUPABASE_URL=https://example.supabase.co",
  "SESSION_SECRET=keepme",
  "# a comment line",
  "DIAGNOSTIC_KG_SHADOW_ENABLED=true",
  "DIAGNOSTIC_KG_PRIMARY_ENABLED='false'",
];
const BASE_ENV = [
  UNRELATED[0],
  `${EXPOSE}=true`,
  UNRELATED[1],
  UNRELATED[2],
  `${PRIMARY}=false`,
  UNRELATED[3],
  UNRELATED[4],
  "",
].join("\n");

function scratch(content = BASE_ENV, mode = 0o600) {
  const dir = mkdtempSync(join(tmpdir(), "diagnostic-provenance-env-"));
  const file = join(dir, ".env");
  writeFileSync(file, content);
  chmodSync(file, mode);
  return { dir, file };
}

function run(file, overrides = {}) {
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, ...overrides };
  const r = spawnSync("bash", [SCRIPT, file], { env, encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

/** Parse the file the way the deploy step does: `set -a; . .env`. */
function bashRead(file, keys) {
  const script = `set -a; . "$1"; set +a; for k in ${keys.join(" ")}; do printf '%s\\0' "\${!k-}"; done`;
  const r = spawnSync("bash", ["-c", script, "_", file], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const values = r.stdout.split("\0").slice(0, keys.length);
  return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
}

function linesStartingWith(file, key) {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.startsWith(`${key}=`));
}

/** Every line that is not one of the three keys, in order. */
function otherLines(file) {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l && !KEYS.some((k) => l.startsWith(`${k}=`)));
}

function assertUntouched({ dir, file }, before) {
  assert.equal(readFileSync(file, "utf8"), before, ".env must be byte-identical");
  assert.deepEqual(readdirSync(dir), [".env"], "no temp file may be left behind");
}

const override = (key) => `${key}_OVERRIDE`;

describe("unset config", () => {
  test("writes the three keys explicitly OFF and keeps every other line", () => {
    const s = scratch();
    const r = run(s.file);
    assert.equal(r.code, 0, r.out);
    for (const k of KEYS) {
      assert.deepEqual(linesStartingWith(s.file, k), [`${k}='false'`]);
    }
    assert.deepEqual(otherLines(s.file), UNRELATED, "other lines must be kept, in order");
    assert.deepEqual(bashRead(s.file, KEYS), {
      [PROJECTION]: "false",
      [EXPOSE]: "false",
      [PRIMARY]: "false",
    });
  });

  test("empty strings (GitHub renders an unset variable as '') behave as unset", () => {
    const s = scratch();
    const r = run(s.file, {
      [override(PROJECTION)]: "",
      [override(EXPOSE)]: "",
      [override(PRIMARY)]: "",
    });
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(bashRead(s.file, KEYS), {
      [PROJECTION]: "false",
      [EXPOSE]: "false",
      [PRIMARY]: "false",
    });
  });
});

describe("values written", () => {
  test("true/false are written as is; existing lines replaced, absent key appended", () => {
    const s = scratch();
    const r = run(s.file, {
      [override(PROJECTION)]: "true",
      [override(EXPOSE)]: "true",
      [override(PRIMARY)]: "false",
    });
    assert.equal(r.code, 0, r.out);
    for (const k of KEYS) {
      assert.equal(linesStartingWith(s.file, k).length, 1, `${k} must appear exactly once`);
    }
    assert.deepEqual(bashRead(s.file, [...KEYS, "SESSION_SECRET"]), {
      [PROJECTION]: "true",
      [EXPOSE]: "true",
      [PRIMARY]: "false",
      SESSION_SECRET: "keepme",
    });
    assert.deepEqual(otherLines(s.file), UNRELATED);
    assert.match(r.out, new RegExp(`${EXPOSE}=true`));
  });

  test("PRIMARY true is written when EXPOSE is true", () => {
    const s = scratch();
    const r = run(s.file, { [override(EXPOSE)]: "true", [override(PRIMARY)]: "true" });
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(bashRead(s.file, KEYS), {
      [PROJECTION]: "false",
      [EXPOSE]: "true",
      [PRIMARY]: "true",
    });
  });

  test("appends to a .env that has none of the keys and no final newline", () => {
    const body = UNRELATED.join("\n"); // no trailing newline
    const s = scratch(body);
    const r = run(s.file, { [override(PROJECTION)]: "true" });
    assert.equal(r.code, 0, r.out);
    assert.ok(readFileSync(s.file, "utf8").startsWith(`${body}\n`), "existing content kept");
    assert.deepEqual(otherLines(s.file), UNRELATED);
    assert.equal(bashRead(s.file, KEYS)[PROJECTION], "true");
  });

  test("re-running is idempotent and keeps the file mode", () => {
    const overrides = { [override(EXPOSE)]: "true", [override(PRIMARY)]: "true" };
    const s = scratch(BASE_ENV, 0o600);
    assert.equal(run(s.file, overrides).code, 0);
    const first = readFileSync(s.file, "utf8");
    assert.equal(run(s.file, overrides).code, 0);
    assert.equal(readFileSync(s.file, "utf8"), first);
    assert.equal(statSync(s.file).mode & 0o777, 0o600);
    assert.deepEqual(readdirSync(s.dir), [".env"]);
  });
});

describe("refusals leave the .env byte-identical", () => {
  // Every spelling below is read as false by the code — silently.
  const spellings = ["True", "TRUE", "yes", "1", " true", "true\n", "'true'", "off"];
  for (const key of KEYS) {
    for (const value of spellings) {
      test(`${key} ${JSON.stringify(value)}`, () => {
        const s = scratch();
        const r = run(s.file, { [override(key)]: value });
        assert.equal(r.code, 1, r.out);
        assert.match(r.out, new RegExp(`::error::Diagnostic provenance: ${key} is`));
        assert.doesNotMatch(r.out, /✅/);
        assertUntouched(s, BASE_ENV);
      });
    }
  }

  for (const [name, expose] of [
    ["EXPOSE false", "false"],
    ["EXPOSE unset", undefined],
  ]) {
    test(`PRIMARY true with ${name}`, () => {
      const s = scratch();
      const overrides = { [override(PRIMARY)]: "true" };
      if (expose !== undefined) overrides[override(EXPOSE)] = expose;
      const r = run(s.file, overrides);
      assert.equal(r.code, 1, r.out);
      assert.match(r.out, new RegExp(`::error::Diagnostic provenance: ${PRIMARY}=true requires ${EXPOSE}=true`));
      assertUntouched(s, BASE_ENV);
    });
  }

  test("missing .env fails", () => {
    const r = run(join(tmpdir(), "does-not-exist", ".env"), { [override(EXPOSE)]: "true" });
    assert.equal(r.code, 1);
    assert.match(r.out, /::error::Diagnostic provenance: .* not found/);
  });
});

describe("deploy-prod.yml wiring", () => {
  const wf = readFileSync(DEPLOY_WORKFLOW, "utf8");

  test("the script runs on .env before the point of no return", () => {
    const call = wf.indexOf('scripts/ci/prod-diagnostic-provenance-env.sh" .env');
    const noReturn = wf.indexOf('echo "DEPLOY_STARTED=1" >> "$GITHUB_ENV"');
    assert.ok(call > 0, "deploy step must call prod-diagnostic-provenance-env.sh on .env");
    assert.ok(noReturn > 0, "point-of-no-return marker not found");
    assert.ok(call < noReturn, "provenance flags must be written BEFORE DEPLOY_STARTED=1");
  });

  test("this test is verified before any PROD mutation", () => {
    const verify = wf.indexOf("scripts/ci/prod-diagnostic-provenance-env.test.mjs");
    const firstMutation = wf.indexOf("docker/login-action");
    assert.ok(verify > 0, "deploy-prod.yml must run prod-diagnostic-provenance-env.test.mjs");
    assert.ok(verify < firstMutation, "the test must run before the first PROD-facing step");
  });

  test("every contract input is mapped from a GitHub variable, never a secret", () => {
    for (const name of KEYS) {
      const mapping = `${name}_OVERRIDE: \${{ vars.PROD_${name} }}`;
      assert.ok(wf.includes(mapping), `${mapping} missing`);
      assert.ok(
        !wf.includes(`${name}_OVERRIDE: \${{ secrets.`),
        `${name} must be a variable (not a credential, readable with gh variable list)`,
      );
    }
  });
});
