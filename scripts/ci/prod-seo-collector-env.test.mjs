/**
 * Behavioural proof of the PROD SEO collector config writer (2026-09-23).
 *
 * `prod-seo-collector-env.sh` writes GSC/GA4 credentials into ~/production/.env
 * during the PROD deploy. A private key must survive two parsers — bash `.`
 * (deploy step) and docker compose `env_file` (container) — and a wrong or
 * partial config must stop the deploy BEFORE the running container is touched.
 * These tests EXECUTE the script against scratch .env files and assert:
 *
 *   1. unset config writes SEO_MONITORING_ENABLED=false explicitly (rollback path);
 *   2. a complete GSC group enables the collector and every value reads back
 *      byte-identical through bash `.` AND through docker compose `env_file`;
 *   3. real newlines in a pasted key become literal `\n`, CR is dropped;
 *   4. a partial group, a single quote, or a value of the wrong shape FAILS and
 *      leaves the .env byte-identical (no temp file left behind);
 *   5. no value ever reaches stdout/stderr;
 *   6. re-running is idempotent and the file mode is kept;
 *   7. deploy-prod.yml runs the script BEFORE the point of no return.
 *
 * Run: npm run test:prod-seo-collector-env
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
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
const SCRIPT = join(SCRIPT_DIR, "prod-seo-collector-env.sh");
const DEPLOY_WORKFLOW = join(SCRIPT_DIR, "..", "..", ".github", "workflows", "deploy-prod.yml");

// A real throwaway PKCS#8 key, generated in memory for this run: real length and
// base64 alphabet (`+`, `/`, `=`), and no key-shaped literal committed to the repo.
const PEM = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({
  type: "pkcs8",
  format: "pem",
});
// The stored form (DEV .env, GitHub secret): line breaks as literal \n.
const KEY_LITERAL = PEM.replace(/\n/g, "\\n");
// The pasted form: real CRLF line breaks.
const KEY_MULTILINE = PEM.replace(/\n/g, "\r\n");
const EMAIL = "collector@fake-project.iam.gserviceaccount.com";
const SITE = "sc-domain:example.test";
const PROP = "123456789";

const GSC = {
  GSC_CLIENT_EMAIL_OVERRIDE: EMAIL,
  GSC_PRIVATE_KEY_OVERRIDE: KEY_LITERAL,
  GSC_SITE_URL_OVERRIDE: SITE,
};
const GA4 = {
  GA4_CLIENT_EMAIL_OVERRIDE: EMAIL,
  GA4_PRIVATE_KEY_OVERRIDE: KEY_LITERAL,
  GA4_PROPERTY_ID_OVERRIDE: PROP,
};

// A PROD-like .env: unrelated lines that must survive byte-for-byte, plus stale
// collector lines (DEV-style double-quoted key) that must be replaced, not duplicated.
const BASE_ENV = [
  "SUPABASE_URL=https://example.supabase.co",
  "SESSION_SECRET=keepme",
  "SEO_MONITORING_ENABLED=false",
  'GSC_PRIVATE_KEY="stale\\ndev-style\\nvalue\\n"',
  "REDIS_URL=redis://redis_prod:6379",
  "",
].join("\n");

function scratch(content = BASE_ENV, mode = 0o600) {
  const dir = mkdtempSync(join(tmpdir(), "seo-collector-env-"));
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

function assertNoLeak(out) {
  for (const secret of [EMAIL, "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC", SITE, PROP]) {
    assert.ok(!out.includes(secret), `output leaked a value: ${secret.slice(0, 12)}…`);
  }
}

function assertUntouched({ dir, file }, before) {
  assert.equal(readFileSync(file, "utf8"), before, ".env must be byte-identical");
  assert.deepEqual(readdirSync(dir), [".env"], "no temp file may be left behind");
}

describe("unset config", () => {
  test("writes SEO_MONITORING_ENABLED=false explicitly and keeps every other line", () => {
    const s = scratch();
    const r = run(s.file);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(linesStartingWith(s.file, "SEO_MONITORING_ENABLED"), [
      "SEO_MONITORING_ENABLED='false'",
    ]);
    const kept = BASE_ENV.split("\n").filter((l) => l && !l.startsWith("SEO_MONITORING_ENABLED="));
    const now = readFileSync(s.file, "utf8").split("\n");
    for (const line of kept) assert.ok(now.includes(line), `lost line: ${line.slice(0, 20)}`);
    assert.match(r.out, /SEO collector DISABLED/);
  });
});

describe("complete GSC group", () => {
  test("enables the collector and every value reads back identically through bash", () => {
    const s = scratch();
    const r = run(s.file, { ...GSC, ...GA4 });
    assert.equal(r.code, 0, r.out);
    assertNoLeak(r.out);
    const keys = [
      "GSC_CLIENT_EMAIL",
      "GSC_PRIVATE_KEY",
      "GSC_SITE_URL",
      "GA4_CLIENT_EMAIL",
      "GA4_PRIVATE_KEY",
      "GA4_PROPERTY_ID",
      "SEO_MONITORING_ENABLED",
      "SESSION_SECRET",
    ];
    assert.deepEqual(bashRead(s.file, keys), {
      GSC_CLIENT_EMAIL: EMAIL,
      GSC_PRIVATE_KEY: KEY_LITERAL,
      GSC_SITE_URL: SITE,
      GA4_CLIENT_EMAIL: EMAIL,
      GA4_PRIVATE_KEY: KEY_LITERAL,
      GA4_PROPERTY_ID: PROP,
      SEO_MONITORING_ENABLED: "true",
      SESSION_SECRET: "keepme",
    });
    for (const k of ["GSC_PRIVATE_KEY", "SEO_MONITORING_ENABLED"]) {
      assert.equal(linesStartingWith(s.file, k).length, 1, `${k} must not be duplicated`);
    }
  });

  test("docker compose env_file reads the same bytes as bash", (t) => {
    const probe = spawnSync("docker", ["compose", "version"], { encoding: "utf8" });
    if (probe.status !== 0) {
      t.skip("docker compose unavailable on this runner — compose parse NOT verified here");
      return;
    }
    const s = scratch();
    assert.equal(run(s.file, { ...GSC, ...GA4 }).code, 0);
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
    assert.equal(env.GSC_PRIVATE_KEY, KEY_LITERAL);
    assert.equal(env.GA4_PRIVATE_KEY, KEY_LITERAL);
    assert.equal(env.GSC_SITE_URL, SITE);
    assert.equal(env.GA4_PROPERTY_ID, PROP);
    assert.equal(env.SEO_MONITORING_ENABLED, "true");
  });

  test("a pasted multi-line key is stored with literal \\n and no CR", () => {
    const s = scratch();
    const r = run(s.file, { ...GSC, GSC_PRIVATE_KEY_OVERRIDE: KEY_MULTILINE });
    assert.equal(r.code, 0, r.out);
    assert.equal(bashRead(s.file, ["GSC_PRIVATE_KEY"]).GSC_PRIVATE_KEY, KEY_LITERAL.replace(/\\n$/, ""));
    assert.ok(!readFileSync(s.file, "utf8").includes("\r"));
  });

  test("re-running is idempotent and keeps the file mode", () => {
    const s = scratch(BASE_ENV, 0o600);
    assert.equal(run(s.file, GSC).code, 0);
    const first = readFileSync(s.file, "utf8");
    assert.equal(run(s.file, GSC).code, 0);
    assert.equal(readFileSync(s.file, "utf8"), first);
    assert.equal(statSync(s.file).mode & 0o777, 0o600);
  });
});

describe("refusals leave the .env byte-identical", () => {
  const cases = {
    "partial GSC group (no site URL)": { ...GSC, GSC_SITE_URL_OVERRIDE: "" },
    "partial GA4 group (no property id)": { ...GSC, ...GA4, GA4_PROPERTY_ID_OVERRIDE: "" },
    "GA4 group partial while GSC unset": { GA4_CLIENT_EMAIL_OVERRIDE: EMAIL },
    "single quote in a value": { ...GSC, GSC_SITE_URL_OVERRIDE: "sc-domain:it's.test" },
    "key pasted with its dotenv quotes": { ...GSC, GSC_PRIVATE_KEY_OVERRIDE: `"${KEY_LITERAL}"` },
    "service-account JSON pasted as key": {
      ...GSC,
      GSC_PRIVATE_KEY_OVERRIDE: `{"type":"service_account","private_key":"${KEY_LITERAL}"}`,
    },
    "site URL that is not a property": { ...GSC, GSC_SITE_URL_OVERRIDE: "example.test" },
    "non-numeric GA4 property id": { ...GSC, ...GA4, GA4_PROPERTY_ID_OVERRIDE: "properties/1" },
    "e-mail without @": { ...GSC, GSC_CLIENT_EMAIL_OVERRIDE: "collector" },
  };
  for (const [name, overrides] of Object.entries(cases)) {
    test(name, () => {
      const s = scratch();
      const r = run(s.file, overrides);
      assert.equal(r.code, 1, r.out);
      assert.match(r.out, /::error::SEO collector/);
      assertNoLeak(r.out);
      assertUntouched(s, BASE_ENV);
    });
  }

  test("missing .env fails", () => {
    const r = run(join(tmpdir(), "does-not-exist", ".env"), GSC);
    assert.equal(r.code, 1);
  });
});

describe("deploy-prod.yml wiring", () => {
  const wf = readFileSync(DEPLOY_WORKFLOW, "utf8");

  test("the script runs before the point of no return", () => {
    const call = wf.indexOf('scripts/ci/prod-seo-collector-env.sh" .env');
    const noReturn = wf.indexOf('echo "DEPLOY_STARTED=1" >> "$GITHUB_ENV"');
    assert.ok(call > 0, "deploy step must call prod-seo-collector-env.sh on .env");
    assert.ok(noReturn > 0, "point-of-no-return marker not found");
    assert.ok(call < noReturn, "collector config must be written BEFORE DEPLOY_STARTED=1");
  });

  test("every contract input is mapped from a secret or a variable", () => {
    // Credentials are secrets; property identifiers are variables. Each input X
    // is mapped as `X_OVERRIDE: ${{ <store>.PROD_X }}` (the script's CONTRACT).
    const byStore = {
      secrets: "GSC_CLIENT_EMAIL GSC_PRIVATE_KEY GA4_CLIENT_EMAIL GA4_PRIVATE_KEY",
      vars: "GSC_SITE_URL GA4_PROPERTY_ID",
    };
    for (const [store, names] of Object.entries(byStore)) {
      for (const name of names.split(" ")) {
        const mapping = `${name}_OVERRIDE: \${{ ${store}.PROD_${name} }}`;
        assert.ok(wf.includes(mapping), `${mapping} missing`);
      }
    }
  });
});
