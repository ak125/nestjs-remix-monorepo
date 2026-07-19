/**
 * Behavioural proof of the PROD app-recreate path (deploy outage fix, 2026-07-19).
 *
 * The whole point of this deploy change is a behaviour that static YAML review
 * cannot prove: **Caddy is never stopped**, the readiness poll **succeeds early
 * and fails fast**, and Caddy is restarted **only when the Caddyfile changed**.
 * These tests EXECUTE prod-app-recreate.sh against a stubbed `docker` and assert
 * the observable calls. Mirrors prod-rollback.test.mjs.
 *
 *   1. happy path: app is force-recreated, Caddy is NEVER stop/rm'd, exit 0;
 *   2. unchanged Caddyfile ⇒ Caddy is NOT restarted (no needless blip);
 *   3. changed Caddyfile ⇒ Caddy IS restarted (only apply path under admin off);
 *   4. app never healthy ⇒ FAILS (non-zero) so the caller's failure() rollback runs;
 *   5. degraded 200+noindex homepage ⇒ FAILS (SSR gate catches it);
 *   6. wrong image on the recreated container ⇒ FAILS before the health poll.
 *
 * Run: npm run test:prod-app-recreate
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const RECREATE_SH = join(SCRIPT_DIR, "prod-app-recreate.sh");

const EXPECTED_IMAGE = "massdoc/nestjs-remix-monorepo:production";

const HEALTHY_HEADERS = [
  "  HTTP/1.1 200 OK",
  "  Content-Type: text/html; charset=utf-8",
  "  Cache-Control: public, max-age=120",
].join("\n");

// The degraded homepage fallback: HTTP 200 + noindex (frontend/app/routes/_index.tsx).
const DEGRADED_HEADERS = [
  "  HTTP/1.1 200 OK",
  "  Content-Type: text/html; charset=utf-8",
  "  X-Robots-Tag: noindex, follow",
].join("\n");

const SSR_BODY =
  '<!DOCTYPE html><html lang="fr"><body>x<script>window.__reactRouterContext={};</script></body></html>';

/**
 * A stub `docker` that logs every invocation and answers per-scenario env.
 * `inspect` returns the image the recreated app claims to run.
 */
const DOCKER_STUB = `#!/usr/bin/env bash
echo "$@" >> "$DOCKER_LOG"
case "$1" in
  compose|restart|rm|stop|logs|tag|pull|push) exit 0 ;;
  inspect) echo "$STUB_ACTUAL_IMAGE"; exit 0 ;;
  exec)
    shift 2
    if printf '%s' "$*" | grep -q -- '--server-response'; then
      printf '%s\\n' "$STUB_SSR_HEADERS" >&2
      exit 0
    elif printf '%s' "$*" | grep -q -- '/health'; then
      printf '%s\\n' "$STUB_HEALTH"
      exit 0
    elif printf '%s' "$*" | grep -q -- 'wget'; then
      printf '%s\\n' "$STUB_SSR_BODY"
      exit 0
    fi
    exit 0 ;;
esac
exit 0
`;

/**
 * Run prod-app-recreate.sh against the stub in an isolated CWD.
 * `caddyfileSha` (or undefined) seeds the recorded Caddyfile hash so we can drive
 * the changed / unchanged branches deterministically.
 */
function runRecreate(env = {}, { caddyfileContent = "caddy-config-v1\n", seededSha } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "prod-app-recreate-"));
  const stub = join(dir, "docker");
  const log = join(dir, "docker.log");
  writeFileSync(stub, DOCKER_STUB);
  chmodSync(stub, 0o755);
  writeFileSync(log, "");

  // The script reads CADDYFILE_PATH (relative to CWD) + a sidecar .deployed.sha.
  const caddyfile = join(dir, "Caddyfile");
  writeFileSync(caddyfile, caddyfileContent);
  if (seededSha !== undefined) {
    writeFileSync(`${caddyfile}.deployed.sha`, seededSha);
  }

  let code = 0;
  let stdout = "";
  try {
    stdout = execFileSync("bash", [RECREATE_SH], {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        DOCKER_LOG: log,
        CADDYFILE_PATH: "Caddyfile",
        READINESS_INTERVAL_SECONDS: "0", // one pass, no real waiting
        READINESS_TIMEOUT_SECONDS: "0",
        EXPECTED_IMAGE,
        // healthy defaults — each test overrides what it is about
        STUB_ACTUAL_IMAGE: EXPECTED_IMAGE,
        STUB_HEALTH: '{"status":"ok"}',
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
  const dockerCalls = existsSync(log)
    ? readFileSync(log, "utf8").split("\n").filter(Boolean)
    : [];
  return { code, stdout, dockerCalls, dir };
}

/** Did the stub ever see Caddy in a stop/rm? That is the regression this fixes. */
function caddyWasTornDown(dockerCalls) {
  return dockerCalls.some(
    (c) =>
      (c.startsWith("stop ") || c.startsWith("rm ")) &&
      c.includes("nestjs-remix-caddy"),
  );
}

describe("prod-app-recreate.sh — behavioural proof (Caddy stays up, poll, conditional reload)", () => {
  test("happy path: app force-recreated, Caddy NEVER torn down, exit 0", () => {
    const { code, stdout, dockerCalls } = runRecreate();

    assert.equal(code, 0, `expected success, got ${code}\n${stdout}`);

    // The core invariant: Caddy is never stopped or removed.
    assert.ok(
      !caddyWasTornDown(dockerCalls),
      `Caddy must NEVER be stopped/removed. Calls:\n${dockerCalls.join("\n")}`,
    );

    // The app IS recreated in place.
    assert.ok(
      dockerCalls.some(
        (c) => c.includes("compose") && c.includes("--force-recreate") && c.includes("monorepo_prod"),
      ),
      `expected 'compose … --force-recreate monorepo_prod'. Calls:\n${dockerCalls.join("\n")}`,
    );
    assert.match(stdout, /Caddy never went down/);
  });

  test("unchanged Caddyfile ⇒ Caddy is NOT restarted", () => {
    // Seed the recorded sha to the current file's sha so the script sees no change.
    const content = "caddy-config-stable\n";
    const sha = createHash("sha256").update(content).digest("hex");
    const { code, dockerCalls } = runRecreate({}, { caddyfileContent: content, seededSha: sha });

    assert.equal(code, 0);
    assert.ok(
      !dockerCalls.some((c) => c === "restart nestjs-remix-caddy"),
      `Caddy must not be restarted when its config is unchanged. Calls:\n${dockerCalls.join("\n")}`,
    );
  });

  test("changed Caddyfile ⇒ Caddy IS restarted (after the app is healthy)", () => {
    // Seed a DIFFERENT recorded sha ⇒ the script detects a change.
    const { code, dockerCalls } = runRecreate(
      {},
      { caddyfileContent: "caddy-config-v2\n", seededSha: "0000stalehash0000" },
    );

    assert.equal(code, 0);
    assert.ok(
      dockerCalls.some((c) => c === "restart nestjs-remix-caddy"),
      `Caddy must be restarted when its config changed. Calls:\n${dockerCalls.join("\n")}`,
    );
    // Still never a stop/rm — a restart is graceful, not a teardown.
    assert.ok(!caddyWasTornDown(dockerCalls));
  });

  test("app never becomes healthy ⇒ FAILS so the caller's rollback runs", () => {
    const { code, stdout, dockerCalls } = runRecreate({ STUB_HEALTH: '{"status":"down"}' });

    assert.notEqual(code, 0, "an app that never gets healthy must fail the deploy");
    assert.match(stdout, /did not become healthy/);
    // Even on failure, Caddy was never torn down.
    assert.ok(!caddyWasTornDown(dockerCalls));
  });

  test("degraded 200+noindex homepage ⇒ FAILS (SSR gate catches it)", () => {
    const { code, stdout } = runRecreate({ STUB_SSR_HEADERS: DEGRADED_HEADERS });

    assert.notEqual(code, 0, "a degraded (noindex) homepage must fail the deploy");
    assert.match(stdout, /DEGRADED FALLBACK|SSR gate failed/);
  });

  test("wrong image on the recreated container ⇒ FAILS before the health poll", () => {
    const { code, stdout } = runRecreate({
      STUB_ACTUAL_IMAGE: "massdoc/nestjs-remix-monorepo:some-other-tag",
    });

    assert.notEqual(code, 0);
    assert.match(stdout, /runs '.*', expected/);
  });
});
