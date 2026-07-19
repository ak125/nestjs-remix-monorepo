/**
 * Behavioural proof of the PROD rollback path (audit 2026-07-16).
 *
 * `bash -n` and static step ordering prove NOTHING about whether the old image
 * is actually restored — and the rollback path only ever executes when things
 * are already broken, so it is the least-exercised and most safety-critical code
 * in the deploy. These tests EXECUTE `prod-rollback.sh` against a stubbed
 * `docker` and assert the observable behaviour:
 *
 *   1. it retags :production to the pinned OLD image ID and pushes it;
 *   2. a mismatch between the restored container image and the pinned ID FAILS
 *      (the regression that made the old rollback a silent no-op);
 *   3. an empty rollback point FAILS instead of pretending to roll back;
 *   4. a failed registry push FAILS — runtime back but canonical tag still
 *      resolving to the defective image is not a successful rollback;
 *   5. a degraded (noindex) homepage after rollback FAILS — restoring a broken
 *      page is not a rollback.
 *
 * Run: npm run test:prod-rollback
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROLLBACK_SH = join(SCRIPT_DIR, "prod-rollback.sh");

const OLD_ID = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const NEW_ID = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const HEALTHY_HEADERS = [
  "  HTTP/1.1 200 OK",
  "  Content-Type: text/html; charset=utf-8",
  "  Cache-Control: public, max-age=300",
].join("\n");

// The degraded homepage fallback: HTTP **200** + noindex (frontend/app/routes/_index.tsx).
const DEGRADED_HEADERS = [
  "  HTTP/1.1 200 OK",
  "  Content-Type: text/html; charset=utf-8",
  "  Cache-Control: no-store",
  "  X-Robots-Tag: noindex, follow",
].join("\n");

const SSR_BODY = '<!DOCTYPE html><html lang="fr"><body>x<script>window.__reactRouterContext={};</script></body></html>';

/** A stub `docker` that logs every invocation and answers per scenario env. */
const DOCKER_STUB = `#!/usr/bin/env bash
echo "$@" >> "$DOCKER_LOG"
case "$1" in
  stop|rm|tag|compose|pull) exit 0 ;;
  inspect) echo "$STUB_RESTORED_ID"; exit 0 ;;
  push) [ "\${STUB_PUSH_FAIL:-0}" = "1" ] && exit 1 || exit 0 ;;
  exec)
    shift 2
    # SSR probe headers: wget --server-response -O /dev/null (body discarded)
    if printf '%s' "$*" | grep -q -- '--server-response'; then
      printf '%s\\n' "$STUB_SSR_HEADERS" >&2
      exit 0
    # health: wget -qO- .../health
    elif printf '%s' "$*" | grep -q -- '/health'; then
      printf '%s\\n' "$STUB_HEALTH"
      exit 0
    # SSR probe body: wget -qO- .../ (no temp file — was 'cat /tmp/...' before
    # the read-only-rootfs fix, 2026-07-19)
    elif printf '%s' "$*" | grep -q -- 'wget'; then
      printf '%s\\n' "$STUB_SSR_BODY"
      exit 0
    fi
    exit 0 ;;
esac
exit 0
`;

/** Run prod-rollback.sh against the stub. Returns {code, stdout, dockerCalls}. */
function runRollback(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), "prod-rollback-"));
  const stub = join(dir, "docker");
  const log = join(dir, "docker.log");
  writeFileSync(stub, DOCKER_STUB);
  chmodSync(stub, 0o755);
  writeFileSync(log, "");

  let code = 0;
  let stdout = "";
  try {
    stdout = execFileSync("bash", [ROLLBACK_SH], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        DOCKER_LOG: log,
        ROLLBACK_SETTLE_SECONDS: "0",
        IMAGE_REPO: "massdoc/nestjs-remix-monorepo",
        PROD_CONTAINER: "nestjs-remix-monorepo-prod",
        // healthy defaults — each test overrides what it is about
        ROLLBACK_IMAGE_ID: OLD_ID,
        STUB_RESTORED_ID: OLD_ID,
        STUB_HEALTH: '{"status":"ok"}',
        STUB_SSR_HEADERS: HEALTHY_HEADERS,
        STUB_SSR_BODY: SSR_BODY,
        STUB_PUSH_FAIL: "0",
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
  return { code, stdout, dockerCalls };
}

describe("prod-rollback.sh — behavioural proof of the failure path", () => {
  test("restores the pinned OLD image and pushes it to the registry", () => {
    const { code, stdout, dockerCalls } = runRollback();

    assert.equal(code, 0, `expected success, got ${code}\n${stdout}`);

    // It must retag :production to the OLD id — NOT to :production-previous,
    // the tag the old broken logic corrupted.
    assert.ok(
      dockerCalls.some((c) => c === `tag ${OLD_ID} massdoc/nestjs-remix-monorepo:production`),
      `expected 'docker tag ${OLD_ID} …:production'. Calls:\n${dockerCalls.join("\n")}`,
    );
    assert.ok(
      !dockerCalls.some((c) => c.includes("production-previous")),
      "rollback must not depend on the :production-previous tag",
    );

    // The canonical registry tag must stop resolving to the defective image.
    assert.ok(
      dockerCalls.some((c) => c === "push massdoc/nestjs-remix-monorepo:production"),
      `expected 'docker push …:production'. Calls:\n${dockerCalls.join("\n")}`,
    );
    assert.match(stdout, /Rollback complete and VERIFIED/);
  });

  test("FAILS when the restored container runs a different image than the pinned ID", () => {
    // This is the exact regression that made the old rollback a silent no-op:
    // the container comes back up on the NEW (broken) image.
    const { code, stdout, dockerCalls } = runRollback({ STUB_RESTORED_ID: NEW_ID });

    assert.notEqual(code, 0, "a mismatched restore must FAIL, not silently pass");
    assert.match(stdout, /ROLLBACK VERIFICATION FAILED/);
    // and it must NOT publish the wrong image as canonical
    assert.ok(
      !dockerCalls.some((c) => c.startsWith("push ")),
      "must not push :production when the restore is unverified",
    );
  });

  test("FAILS when no rollback point was pinned (no silent pretend-rollback)", () => {
    const { code, stdout, dockerCalls } = runRollback({ ROLLBACK_IMAGE_ID: "" });

    assert.notEqual(code, 0);
    assert.match(stdout, /no rollback point was pinned/i);
    assert.equal(dockerCalls.length, 0, "must not touch docker at all");
  });

  test("FAILS when the registry push fails (runtime back, canonical tag still lying)", () => {
    const { code, stdout } = runRollback({ STUB_PUSH_FAIL: "1" });

    assert.notEqual(code, 0, "a rollback whose registry tag still resolves to the bad image is not successful");
    assert.match(stdout, /canonical tag STILL resolves to the defective/i);
  });

  test("FAILS when the restored homepage is the degraded 200+noindex fallback", () => {
    // Restoring a broken page is not a rollback. Note the fallback answers 200,
    // so only the noindex assertion catches it.
    const { code, stdout } = runRollback({ STUB_SSR_HEADERS: DEGRADED_HEADERS });

    assert.notEqual(code, 0);
    assert.match(stdout, /DEGRADED FALLBACK|SSR gate FAILED/);
  });

  test("FAILS when the restored runtime does not answer /health", () => {
    const { code, stdout } = runRollback({ STUB_HEALTH: '{"status":"down"}' });

    assert.notEqual(code, 0);
    assert.match(stdout, /Rollback \/health FAILED/);
  });
});
