/**
 * Behavioural proof of the PROD SSR gate (prod-ssr-probe.sh).
 *
 * This gate had NO test and ran for the first time ever during a real PROD
 * deploy — where it false-failed: it wrote the body to `-O /tmp/ssr-probe.html`
 * inside a container whose rootfs is not writable, so the body file was empty
 * and the marker check rejected even the known-good image on rollback (incident
 * 2026-07-19, tag v2026.07.19-deploy-safety-sentry-beacon).
 *
 * These tests:
 *   1. EXECUTE prod-ssr-probe.sh against a stubbed `docker` and assert the
 *      pass/fail decision for each observable homepage state;
 *   2. statically assert the probe never writes a temp file inside the
 *      container (the exact regression), i.e. it captures via /dev/null + stdout.
 *
 * Run: npm run test:prod-ssr-probe
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROBE_SH = join(SCRIPT_DIR, "prod-ssr-probe.sh");

const HEALTHY_HEADERS = [
  "  HTTP/1.1 200 OK",
  "  Content-Type: text/html; charset=utf-8",
  "  Cache-Control: public, max-age=300",
].join("\n");

// The degraded homepage fallback answers 200 + noindex (frontend/app/routes/_index.tsx).
const DEGRADED_HEADERS = [
  "  HTTP/1.1 200 OK",
  "  Content-Type: text/html; charset=utf-8",
  "  X-Robots-Tag: noindex, follow",
].join("\n");

const ERROR_HEADERS = ["  HTTP/1.1 503 Service Unavailable", "  Content-Type: text/html"].join("\n");
const JSON_HEADERS = ["  HTTP/1.1 200 OK", "  Content-Type: application/json"].join("\n");

const SSR_BODY = '<!DOCTYPE html><html lang="fr"><body>x<script>window.__reactRouterContext={};</script></body></html>';
const NO_MARKER_BODY = "<!DOCTYPE html><html><body>no hydration payload here</body></html>";

/**
 * A stub `docker` mirroring the two calls the probe makes:
 *   - `wget --server-response -O /dev/null URL`  → headers to STDERR
 *   - `wget -qO- URL`                            → body to STDOUT
 */
const DOCKER_STUB = `#!/usr/bin/env bash
echo "$@" >> "$DOCKER_LOG"
case "$1" in
  exec)
    shift 2
    if printf '%s' "$*" | grep -q -- '--server-response'; then
      printf '%s\\n' "$STUB_SSR_HEADERS" >&2
      exit 0
    elif printf '%s' "$*" | grep -q -- 'wget'; then
      printf '%s\\n' "$STUB_SSR_BODY"
      exit 0
    fi
    exit 0 ;;
esac
exit 0
`;

function runProbe(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), "prod-ssr-probe-"));
  const stub = join(dir, "docker");
  const log = join(dir, "docker.log");
  writeFileSync(stub, DOCKER_STUB);
  chmodSync(stub, 0o755);
  writeFileSync(log, "");

  let code = 0;
  let stdout = "";
  try {
    stdout = execFileSync("bash", [PROBE_SH, "test"], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        DOCKER_LOG: log,
        PROD_CONTAINER: "nestjs-remix-monorepo-prod",
        STUB_SSR_HEADERS: HEALTHY_HEADERS,
        STUB_SSR_BODY: SSR_BODY,
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    code = e.status ?? 1;
    stdout = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
  return { code, stdout };
}

describe("prod-ssr-probe.sh — behavioural proof of the SSR gate", () => {
  test("PASSES on a healthy, indexable, server-rendered homepage", () => {
    const { code, stdout } = runProbe();
    assert.equal(code, 0, `expected pass, got ${code}\n${stdout}`);
    assert.match(stdout, /✅.*SSR marker present, indexable/);
  });

  test("FAILS when the body lacks the SSR marker (not server-rendered)", () => {
    const { code, stdout } = runProbe({ STUB_SSR_BODY: NO_MARKER_BODY });
    assert.notEqual(code, 0);
    assert.match(stdout, /lacks the stable SSR marker/);
  });

  test("FAILS on the degraded 200 + noindex homepage fallback", () => {
    const { code, stdout } = runProbe({ STUB_SSR_HEADERS: DEGRADED_HEADERS });
    assert.notEqual(code, 0);
    assert.match(stdout, /noindex|DEGRADED FALLBACK/);
  });

  test("FAILS when GET / is not 200", () => {
    const { code, stdout } = runProbe({ STUB_SSR_HEADERS: ERROR_HEADERS });
    assert.notEqual(code, 0);
    assert.match(stdout, /expected 200/);
  });

  test("FAILS when Content-Type is not text/html", () => {
    const { code, stdout } = runProbe({ STUB_SSR_HEADERS: JSON_HEADERS });
    assert.notEqual(code, 0);
    assert.match(stdout, /not text\/html/);
  });
});

describe("prod-ssr-probe.sh — must not write a temp file in the container (2026-07-19 regression)", () => {
  const src = readFileSync(PROBE_SH, "utf8");
  // Strip full-line comments — the header comment intentionally *quotes* the bad
  // `-O /tmp/...` pattern to document the incident; only real code should be checked.
  const code = src
    .split("\n")
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n");

  test("does not write the response body to a container path", () => {
    // The read-only-rootfs bug: `wget -O /tmp/ssr-probe.html`. Any `-O <path>`
    // other than `-` (stdout) or `/dev/null` risks the same failure.
    const badWrites = code.match(/-O\s+(?!-|\/dev\/null)\S+/g) || [];
    assert.deepEqual(
      badWrites,
      [],
      `probe must not '-O' to a container file (read-only rootfs). Found: ${badWrites.join(", ")}`,
    );
    assert.doesNotMatch(code, /\bcat\s+\/tmp/, "probe must not cat a container temp file");
  });

  test("captures body via stdout (wget -qO-) and headers via /dev/null", () => {
    assert.match(code, /wget\s+-qO-/, "body must stream to stdout");
    assert.match(code, /-O\s+\/dev\/null/, "headers must discard body to /dev/null");
  });
});
