/**
 * Behavioural proof of the PROD SEO Projection flags writer (2026-09-24).
 *
 * `prod-seo-projection-env.sh` writes the three SEO Projection rollout flags
 * into ~/production/.env during the PROD deploy. The code never fails on a bad
 * value (`bool()` reads anything but `true` as false; the canary is an
 * exact-match allowlist), so a wrong value must stop the deploy BEFORE the
 * running container is touched. These tests EXECUTE the script against scratch
 * .env files and assert:
 *
 *   1. unset config writes the three keys explicitly OFF / empty (rollback path);
 *   2. true/false are written as is, existing lines are replaced (never
 *      duplicated), absent keys appended, every other line kept byte-for-byte;
 *   3. a valid canary list is trimmed and normalised, and reads back identically
 *      through bash `.` AND docker compose `env_file`;
 *   4. a boolean spelling the code would read as false, an empty canary token or
 *      a malformed one FAILS and leaves the .env byte-identical — also under a
 *      UTF-8 locale where bash regex ranges would let `à` / `É` through;
 *   5. a canary set while the master flag is OFF is written, with a notice;
 *   6. re-running is idempotent and the file mode is kept;
 *   7. deploy-prod.yml maps each input from a variable, verifies this test and
 *      runs the script BEFORE the point of no return.
 *
 * Run: node --test scripts/ci/prod-seo-projection-env.test.mjs
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
const SCRIPT = join(SCRIPT_DIR, "prod-seo-projection-env.sh");
const DEPLOY_WORKFLOW = join(SCRIPT_DIR, "..", "..", ".github", "workflows", "deploy-prod.yml");

const KEYS = [
  "SEO_PROJECTION_R1_FEED_ENABLED",
  "SEO_PROJECTION_READ_V1",
  "SEO_PROJECTION_READ_CANARY",
];
const R3_TOKEN = "R3_CONSEILS@gamme:filtre-a-huile";

// A PROD-like .env: unrelated lines that must survive byte-for-byte, plus stale
// projection lines (hand-edit style, unquoted) that must be replaced, not duplicated.
// SEO_PROJECTION_READ_CANARY is absent on purpose: it must be appended.
const UNRELATED = [
  "SUPABASE_URL=https://example.supabase.co",
  "SESSION_SECRET=keepme",
  "# a comment line",
  "SEO_MONITORING_ENABLED='true'",
  "REDIS_URL=redis://redis_prod:6379",
];
const BASE_ENV = [
  UNRELATED[0],
  "SEO_PROJECTION_READ_V1=true",
  UNRELATED[1],
  UNRELATED[2],
  "SEO_PROJECTION_R1_FEED_ENABLED=true",
  UNRELATED[3],
  UNRELATED[4],
  "",
].join("\n");

function scratch(content = BASE_ENV, mode = 0o600) {
  const dir = mkdtempSync(join(tmpdir(), "seo-projection-env-"));
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

describe("unset config", () => {
  test("writes the three keys explicitly OFF / empty and keeps every other line", () => {
    const s = scratch();
    const r = run(s.file);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(linesStartingWith(s.file, "SEO_PROJECTION_R1_FEED_ENABLED"), [
      "SEO_PROJECTION_R1_FEED_ENABLED='false'",
    ]);
    assert.deepEqual(linesStartingWith(s.file, "SEO_PROJECTION_READ_V1"), [
      "SEO_PROJECTION_READ_V1='false'",
    ]);
    assert.deepEqual(linesStartingWith(s.file, "SEO_PROJECTION_READ_CANARY"), [
      "SEO_PROJECTION_READ_CANARY=''",
    ]);
    assert.deepEqual(otherLines(s.file), UNRELATED, "other lines must be kept, in order");
    assert.deepEqual(bashRead(s.file, KEYS), {
      SEO_PROJECTION_R1_FEED_ENABLED: "false",
      SEO_PROJECTION_READ_V1: "false",
      SEO_PROJECTION_READ_CANARY: "",
    });
    assert.match(r.out, /SEO_PROJECTION_READ_CANARY=\(empty — fail-closed/);
    assert.doesNotMatch(r.out, /::notice::/);
  });

  test("empty strings (GitHub renders an unset variable as '') behave as unset", () => {
    const s = scratch();
    const r = run(s.file, {
      SEO_PROJECTION_R1_FEED_ENABLED_OVERRIDE: "",
      SEO_PROJECTION_READ_V1_OVERRIDE: "",
      SEO_PROJECTION_READ_CANARY_OVERRIDE: "",
    });
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(bashRead(s.file, KEYS), {
      SEO_PROJECTION_R1_FEED_ENABLED: "false",
      SEO_PROJECTION_READ_V1: "false",
      SEO_PROJECTION_READ_CANARY: "",
    });
  });
});

describe("values written", () => {
  test("true/false are written as is; existing lines replaced, absent key appended", () => {
    const s = scratch();
    const r = run(s.file, {
      SEO_PROJECTION_R1_FEED_ENABLED_OVERRIDE: "false",
      SEO_PROJECTION_READ_V1_OVERRIDE: "true",
      SEO_PROJECTION_READ_CANARY_OVERRIDE: R3_TOKEN,
    });
    assert.equal(r.code, 0, r.out);
    for (const k of KEYS) {
      assert.equal(linesStartingWith(s.file, k).length, 1, `${k} must appear exactly once`);
    }
    assert.deepEqual(bashRead(s.file, [...KEYS, "SESSION_SECRET"]), {
      SEO_PROJECTION_R1_FEED_ENABLED: "false",
      SEO_PROJECTION_READ_V1: "true",
      SEO_PROJECTION_READ_CANARY: R3_TOKEN,
      SESSION_SECRET: "keepme",
    });
    assert.deepEqual(otherLines(s.file), UNRELATED);
    assert.match(r.out, /SEO_PROJECTION_READ_V1=true/);
    assert.doesNotMatch(r.out, /::notice::/);
  });

  test("appends to a .env that has none of the keys, and to one without a final newline", () => {
    const body = UNRELATED.join("\n"); // no trailing newline
    const s = scratch(body);
    const r = run(s.file, { SEO_PROJECTION_R1_FEED_ENABLED_OVERRIDE: "true" });
    assert.equal(r.code, 0, r.out);
    const now = readFileSync(s.file, "utf8");
    assert.ok(now.startsWith(`${body}\n`), "existing content must be kept byte-for-byte");
    assert.deepEqual(otherLines(s.file), UNRELATED);
    assert.equal(bashRead(s.file, KEYS).SEO_PROJECTION_R1_FEED_ENABLED, "true");
  });

  test("a canary list is trimmed and normalised (comma-joined, no spaces)", () => {
    const s = scratch();
    const r = run(s.file, {
      SEO_PROJECTION_READ_V1_OVERRIDE: "true",
      SEO_PROJECTION_READ_CANARY_OVERRIDE: ` ${R3_TOKEN} ,\tR4_REFERENCE@gamme:plaquette-de-frein,R7_BRAND@constructeur:renault ,R8_VEHICLE@vehicle:golf-5-1-9-tdi\n`,
    });
    assert.equal(r.code, 0, r.out);
    const expected = `${R3_TOKEN},R4_REFERENCE@gamme:plaquette-de-frein,R7_BRAND@constructeur:renault,R8_VEHICLE@vehicle:golf-5-1-9-tdi`;
    assert.deepEqual(linesStartingWith(s.file, "SEO_PROJECTION_READ_CANARY"), [
      `SEO_PROJECTION_READ_CANARY='${expected}'`,
    ]);
    assert.equal(bashRead(s.file, KEYS).SEO_PROJECTION_READ_CANARY, expected);
    // The consumer splits on `,` and trims (feature-flags.service.ts csv()).
    const parsed = expected.split(",").map((t) => t.trim()).filter(Boolean);
    assert.ok(parsed.includes(R3_TOKEN));
    assert.match(r.out, new RegExp(`SEO_PROJECTION_READ_CANARY=${expected}`));
  });

  test("docker compose env_file reads the same bytes as bash", (t) => {
    const probe = spawnSync("docker", ["compose", "version"], { encoding: "utf8" });
    if (probe.status !== 0) {
      t.skip("docker compose unavailable on this runner — compose parse NOT verified here");
      return;
    }
    const s = scratch();
    const canary = `${R3_TOKEN},R8_VEHICLE@vehicle:golf-5-1-9-tdi`;
    assert.equal(
      run(s.file, {
        SEO_PROJECTION_R1_FEED_ENABLED_OVERRIDE: "true",
        SEO_PROJECTION_READ_CANARY_OVERRIDE: canary,
      }).code,
      0,
    );
    writeFileSync(
      join(s.dir, "compose.yml"),
      "services:\n  app:\n    image: busybox\n    env_file: .env\n",
    );
    const r = spawnSync(
      "docker",
      ["compose", "-f", join(s.dir, "compose.yml"), "config", "--format", "json"],
      { cwd: s.dir, encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME } },
    );
    assert.equal(r.status, 0, r.stderr);
    const env = JSON.parse(r.stdout).services.app.environment;
    assert.equal(env.SEO_PROJECTION_R1_FEED_ENABLED, "true");
    assert.equal(env.SEO_PROJECTION_READ_V1, "false");
    assert.equal(env.SEO_PROJECTION_READ_CANARY, canary);
  });

  test("a canary set while READ_V1 is not true is written, with a notice", () => {
    const s = scratch();
    const r = run(s.file, { SEO_PROJECTION_READ_CANARY_OVERRIDE: R3_TOKEN });
    assert.equal(r.code, 0, r.out);
    assert.equal(bashRead(s.file, KEYS).SEO_PROJECTION_READ_CANARY, R3_TOKEN);
    assert.match(r.out, /::notice::SEO projection: canary set while SEO_PROJECTION_READ_V1=false/);
  });

  test("re-running is idempotent and keeps the file mode", () => {
    const overrides = {
      SEO_PROJECTION_READ_V1_OVERRIDE: "true",
      SEO_PROJECTION_READ_CANARY_OVERRIDE: R3_TOKEN,
    };
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
  const cases = {
    // Booleans: every spelling below is read as false by the code — silently.
    "R1 feed 'True'": { SEO_PROJECTION_R1_FEED_ENABLED_OVERRIDE: "True" },
    "R1 feed 'TRUE'": { SEO_PROJECTION_R1_FEED_ENABLED_OVERRIDE: "TRUE" },
    "R1 feed 'yes'": { SEO_PROJECTION_R1_FEED_ENABLED_OVERRIDE: "yes" },
    "READ_V1 '1'": { SEO_PROJECTION_READ_V1_OVERRIDE: "1" },
    "READ_V1 ' true' (leading space)": { SEO_PROJECTION_READ_V1_OVERRIDE: " true" },
    "READ_V1 'true\\n' (trailing newline)": { SEO_PROJECTION_READ_V1_OVERRIDE: "true\n" },
    "READ_V1 quoted \"'true'\"": { SEO_PROJECTION_READ_V1_OVERRIDE: "'true'" },
    "READ_V1 'off'": { SEO_PROJECTION_READ_V1_OVERRIDE: "off" },
    // Canary: empty tokens.
    "canary empty token in the middle (a,,b)": {
      SEO_PROJECTION_READ_CANARY_OVERRIDE: `${R3_TOKEN},,R4_REFERENCE@gamme:x`,
    },
    "canary trailing comma": { SEO_PROJECTION_READ_CANARY_OVERRIDE: `${R3_TOKEN},` },
    "canary leading comma": { SEO_PROJECTION_READ_CANARY_OVERRIDE: `,${R3_TOKEN}` },
    "canary whitespace only": { SEO_PROJECTION_READ_CANARY_OVERRIDE: "   " },
    // Canary: malformed tokens.
    "canary bare entity (no role)": { SEO_PROJECTION_READ_CANARY_OVERRIDE: "gamme:filtre-a-huile" },
    "canary bare role (no entity)": { SEO_PROJECTION_READ_CANARY_OVERRIDE: "R3_CONSEILS" },
    "canary lowercase role": { SEO_PROJECTION_READ_CANARY_OVERRIDE: "r3_conseils@gamme:filtre-a-huile" },
    "canary role starting with a digit": { SEO_PROJECTION_READ_CANARY_OVERRIDE: "3R_CONSEILS@gamme:x" },
    "canary role with a dash": { SEO_PROJECTION_READ_CANARY_OVERRIDE: "R3-CONSEILS@gamme:x" },
    "canary entity without namespace": { SEO_PROJECTION_READ_CANARY_OVERRIDE: "R3_CONSEILS@filtre-a-huile" },
    "canary unknown namespace": { SEO_PROJECTION_READ_CANARY_OVERRIDE: "R3_CONSEILS@diagnostic:bruit" },
    "canary uppercase slug": { SEO_PROJECTION_READ_CANARY_OVERRIDE: "R3_CONSEILS@gamme:Filtre-a-huile" },
    "canary accented slug": { SEO_PROJECTION_READ_CANARY_OVERRIDE: "R3_CONSEILS@gamme:filtre-à-huile" },
    "canary slug starting with a dash": { SEO_PROJECTION_READ_CANARY_OVERRIDE: "R3_CONSEILS@gamme:-filtre" },
    "canary slug with an underscore": { SEO_PROJECTION_READ_CANARY_OVERRIDE: "R3_CONSEILS@gamme:filtre_a_huile" },
    "canary space inside a token": { SEO_PROJECTION_READ_CANARY_OVERRIDE: "R3_CONSEILS @gamme:filtre-a-huile" },
    "canary line break inside a token": {
      SEO_PROJECTION_READ_CANARY_OVERRIDE: "R3_CONSEILS@gamme:filtre\n-a-huile",
    },
    "canary single quote": { SEO_PROJECTION_READ_CANARY_OVERRIDE: "R3_CONSEILS@gamme:it's" },
    "canary ';' separator instead of ','": {
      SEO_PROJECTION_READ_CANARY_OVERRIDE: `${R3_TOKEN};R4_REFERENCE@gamme:x`,
    },
    "one bad input among valid ones": {
      SEO_PROJECTION_R1_FEED_ENABLED_OVERRIDE: "true",
      SEO_PROJECTION_READ_V1_OVERRIDE: "true",
      SEO_PROJECTION_READ_CANARY_OVERRIDE: `${R3_TOKEN},R4_REFERENCE@gamme:Bad`,
    },
  };
  for (const [name, overrides] of Object.entries(cases)) {
    test(name, () => {
      const s = scratch();
      const r = run(s.file, overrides);
      assert.equal(r.code, 1, r.out);
      assert.match(r.out, /::error::SEO projection/);
      assert.doesNotMatch(r.out, /✅/);
      assertUntouched(s, BASE_ENV);
    });
  }

  test("an empty token is named as such, with its position", () => {
    const s = scratch();
    const r = run(s.file, { SEO_PROJECTION_READ_CANARY_OVERRIDE: `${R3_TOKEN},,R4_REFERENCE@gamme:x` });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /token #2 is empty/);
    assertUntouched(s, BASE_ENV);
  });

  test("the token check is byte-wise whatever the runner's locale", (t) => {
    // Under en_US/fr_FR UTF-8, bash `=~` ranges follow collation: [a-z] matches
    // `à` and [A-Z] matches `É`. The script pins LC_ALL=C; prove it under such
    // a locale, if the runner has one.
    const loose = ["fr_FR.UTF-8", "en_US.UTF-8"].find(
      (loc) =>
        spawnSync("bash", ["-c", '[[ "à" =~ ^[a-z]$ ]]'], {
          env: { PATH: process.env.PATH, LC_ALL: loc },
        }).status === 0,
    );
    if (!loose) {
      t.skip("no collation-order locale on this runner — the LC_ALL=C pin is NOT exercised here");
      return;
    }
    for (const token of ["R3_CONSEILS@gamme:filtre-à-huile", "É3_CONSEILS@gamme:filtre-a-huile"]) {
      const s = scratch();
      const r = run(s.file, { LC_ALL: loose, SEO_PROJECTION_READ_CANARY_OVERRIDE: token });
      assert.equal(r.code, 1, `${token} under ${loose}: ${r.out}`);
      assertUntouched(s, BASE_ENV);
    }
  });

  test("missing .env fails", () => {
    const r = run(join(tmpdir(), "does-not-exist", ".env"), {
      SEO_PROJECTION_READ_V1_OVERRIDE: "true",
    });
    assert.equal(r.code, 1);
    assert.match(r.out, /::error::SEO projection: .* not found/);
  });
});

describe("deploy-prod.yml wiring", () => {
  const wf = readFileSync(DEPLOY_WORKFLOW, "utf8");

  test("the script runs on .env before the point of no return", () => {
    const call = wf.indexOf('scripts/ci/prod-seo-projection-env.sh" .env');
    const noReturn = wf.indexOf('echo "DEPLOY_STARTED=1" >> "$GITHUB_ENV"');
    assert.ok(call > 0, "deploy step must call prod-seo-projection-env.sh on .env");
    assert.ok(noReturn > 0, "point-of-no-return marker not found");
    assert.ok(call < noReturn, "projection flags must be written BEFORE DEPLOY_STARTED=1");
  });

  test("this test is verified before any PROD mutation", () => {
    const verify = wf.indexOf("scripts/ci/prod-seo-projection-env.test.mjs");
    const firstMutation = wf.indexOf("docker/login-action");
    assert.ok(verify > 0, "deploy-prod.yml must run prod-seo-projection-env.test.mjs");
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
