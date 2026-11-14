/**
 * Behavioural proof that a PROD deploy keeps Caddy up (deploy of 2026-11-05).
 *
 * The deploy used to stop Caddy with the app: about 20 s of errors per deploy.
 * These tests EXECUTE `prod-caddy-config.sh` against a stubbed `docker` and
 * assert what it does:
 *
 *   1. Caddyfile unchanged and already loaded: no validation, no write, no
 *      recreation; compose only recreates Caddy if its definition changed.
 *   2. Caddyfile changed: validated inside the running Caddy BEFORE it is
 *      written, then Caddy alone is recreated.
 *   3. Invalid Caddyfile: nothing written, nothing recreated, deploy fails.
 *   4. Same content written after Caddy started (an earlier deploy stopped
 *      half-way): Caddy is recreated, so it does not keep an older config.
 *   5. Caddy absent: the file is written and compose starts Caddy.
 *   6. Caddy restarting after the update: deploy fails.
 *   7. No deployed file: deploy fails before any Docker call.
 *
 * Then the wiring in release-prod.yml: the script runs past the point of no
 * return and before the app is stopped, it is the only writer of the PROD
 * Caddyfile, and no stop or rm names the Caddy container.
 *
 * Run: node --test scripts/ci/prod-caddy-config.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  chmodSync,
  existsSync,
  utimesSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(SCRIPT_DIR, "prod-caddy-config.sh");
const CADDY = "nestjs-remix-caddy";
const STARTED = "2026-11-05T05:59:07.512345678Z";
const STARTED_MS = Date.parse(STARTED);

const OLD_CFG = 'www.example.test {\n    respond "old"\n}\n';
const NEW_CFG = 'www.example.test {\n    respond "new"\n}\n';

/**
 * A stub `docker` that logs every call (one line, args joined by spaces).
 * `exec` (the validation) records its stdin and what the live Caddyfile held
 * at that moment, to prove the validation runs before the write.
 */
const DOCKER_STUB = `#!/usr/bin/env bash
echo "$*" >> "$DOCKER_LOG"
case "$1" in
  inspect)
    if printf '%s' "$*" | grep -q 'StartedAt'; then
      [ "$STUB_STATE" = "absent" ] && exit 1
      echo "$STUB_STATE"
    else
      echo "$STUB_AFTER"
    fi
    exit 0 ;;
  exec)
    cat > "$STUB_DIR/validated"
    cp "$STUB_LIVE" "$STUB_DIR/live-at-validation" 2>/dev/null || true
    exit "$STUB_VALIDATE_EXIT" ;;
  compose|logs) exit 0 ;;
esac
exit 0
`;

/**
 * Run the script in a fresh PROD-like directory.
 * live: content of config/caddy/Caddyfile (null = absent);
 * liveMtimeMs: its mtime; deployed: content of the deployed Caddyfile.
 */
function run({
  live = OLD_CFG,
  liveMtimeMs = STARTED_MS - 3_600_000,
  deployed = NEW_CFG,
  state = `true ${STARTED}`,
  after = "true false",
  validateExit = 0,
  args,
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), "prod-caddy-config-"));
  const bin = join(dir, "bin");
  const prod = join(dir, "production");
  mkdirSync(bin);
  mkdirSync(join(prod, "config", "caddy"), { recursive: true });
  const stub = join(bin, "docker");
  writeFileSync(stub, DOCKER_STUB);
  chmodSync(stub, 0o755);
  const log = join(dir, "docker.log");
  writeFileSync(log, "");

  const liveFile = join(prod, "config", "caddy", "Caddyfile");
  if (live !== null) {
    writeFileSync(liveFile, live);
    const t = new Date(liveMtimeMs);
    utimesSync(liveFile, t, t);
  }
  const deployedFile = join(dir, "repo-Caddyfile");
  if (deployed !== null) writeFileSync(deployedFile, deployed);

  const r = spawnSync("bash", [SCRIPT, ...(args ?? [deployedFile])], {
    cwd: prod,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      DOCKER_LOG: log,
      STUB_DIR: dir,
      STUB_LIVE: liveFile,
      STUB_STATE: state,
      STUB_AFTER: after,
      STUB_VALIDATE_EXIT: String(validateExit),
      CADDY_SETTLE_SECONDS: "0",
    },
  });
  const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);
  const out = {
    code: r.status,
    output: `${r.stdout}${r.stderr}`,
    calls: readFileSync(log, "utf8").split("\n").filter(Boolean),
    live: read(liveFile),
    liveMtimeMs: existsSync(liveFile)
      ? Math.round(
          Number(
            spawnSync("stat", ["-c", "%Y", liveFile], { encoding: "utf8" })
              .stdout,
          ) * 1000,
        )
      : null,
    validated: read(join(dir, "validated")),
    liveAtValidation: read(join(dir, "live-at-validation")),
  };
  rmSync(dir, { recursive: true, force: true });
  return out;
}

const COMPOSE_UP =
  "compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d --no-deps";
const recreated = (calls) =>
  calls.includes(`${COMPOSE_UP} --force-recreate caddy`);
const upOnly = (calls) => calls.includes(`${COMPOSE_UP} caddy`);
const validatedIn = (calls) =>
  calls.some((c) => c.startsWith(`exec -i ${CADDY} sh -c`));

describe("prod-caddy-config.sh — Caddy stays up unless its Caddyfile changes", () => {
  test("unchanged and already loaded: Caddy is left running", () => {
    const r = run({ live: NEW_CFG, deployed: NEW_CFG });
    assert.equal(r.code, 0, r.output);
    assert.ok(
      !validatedIn(r.calls),
      `no validation expected:\n${r.calls.join("\n")}`,
    );
    assert.ok(
      !recreated(r.calls),
      `no recreation expected:\n${r.calls.join("\n")}`,
    );
    assert.ok(
      upOnly(r.calls),
      `compose up without recreation expected:\n${r.calls.join("\n")}`,
    );
    assert.equal(
      r.liveMtimeMs,
      Math.floor((STARTED_MS - 3_600_000) / 1000) * 1000,
      "the live file must not be rewritten",
    );
  });

  test("changed: validated in the running Caddy before the write, then Caddy alone is recreated", () => {
    const r = run();
    assert.equal(r.code, 0, r.output);
    assert.equal(
      r.validated,
      NEW_CFG,
      "the deployed file must be the one validated",
    );
    assert.equal(
      r.liveAtValidation,
      OLD_CFG,
      "validation must run BEFORE the live file is replaced",
    );
    assert.equal(r.live, NEW_CFG);
    assert.ok(
      recreated(r.calls),
      `Caddy must be recreated:\n${r.calls.join("\n")}`,
    );
    assert.ok(
      !r.calls.some((c) => /(^| )(stop|rm|restart|kill)( |$)/.test(c)),
      `no stop/rm/restart/kill:\n${r.calls.join("\n")}`,
    );
    const iValidate = r.calls.findIndex((c) => c.startsWith("exec "));
    const iRecreate = r.calls.findIndex((c) =>
      c.includes("--force-recreate caddy"),
    );
    assert.ok(
      iValidate >= 0 && iValidate < iRecreate,
      "validation must precede the recreation",
    );
  });

  test("invalid: nothing written, nothing recreated, the deploy fails", () => {
    const r = run({ validateExit: 1 });
    assert.notEqual(r.code, 0, r.output);
    assert.equal(r.live, OLD_CFG, "an invalid file must never be put in place");
    assert.ok(
      !r.calls.some((c) => c.startsWith("compose ")),
      `no compose call:\n${r.calls.join("\n")}`,
    );
  });

  test("same content written after Caddy started: Caddy is recreated", () => {
    const r = run({
      live: NEW_CFG,
      deployed: NEW_CFG,
      liveMtimeMs: STARTED_MS + 60_000,
    });
    assert.equal(r.code, 0, r.output);
    assert.ok(
      validatedIn(r.calls),
      "the file must be validated before the recreation",
    );
    assert.ok(
      recreated(r.calls),
      `Caddy must be recreated:\n${r.calls.join("\n")}`,
    );
  });

  test("written in the very second Caddy started: treated as not loaded", () => {
    const r = run({
      live: NEW_CFG,
      deployed: NEW_CFG,
      liveMtimeMs: STARTED_MS,
    });
    assert.equal(r.code, 0, r.output);
    assert.ok(
      recreated(r.calls),
      `Caddy must be recreated:\n${r.calls.join("\n")}`,
    );
  });

  test("Caddy absent: the file is written and compose starts Caddy", () => {
    const r = run({ state: "absent" });
    assert.equal(r.code, 0, r.output);
    assert.equal(r.live, NEW_CFG);
    assert.ok(!validatedIn(r.calls), "no container to validate in");
    assert.ok(
      upOnly(r.calls) && !recreated(r.calls),
      `compose up expected:\n${r.calls.join("\n")}`,
    );
  });

  test("Caddy stopped: the file is written and compose starts Caddy", () => {
    const r = run({ state: `false ${STARTED}` });
    assert.equal(r.code, 0, r.output);
    assert.equal(r.live, NEW_CFG);
    assert.ok(
      upOnly(r.calls) && !recreated(r.calls),
      `compose up expected:\n${r.calls.join("\n")}`,
    );
  });

  test("Caddy restarting after the update: the deploy fails", () => {
    const r = run({ after: "true true" });
    assert.notEqual(r.code, 0, r.output);
    assert.ok(
      r.calls.some((c) => c.startsWith(`logs --tail 50 ${CADDY}`)),
      "Caddy logs must be printed",
    );
  });

  test("no deployed file: fails before any Docker call", () => {
    for (const args of [[], ["/nonexistent/Caddyfile"]]) {
      const r = run({ args });
      assert.notEqual(r.code, 0, r.output);
      assert.deepEqual(r.calls, []);
      assert.equal(r.live, OLD_CFG);
    }
    const empty = run({ deployed: "" });
    assert.notEqual(empty.code, 0, empty.output);
    assert.deepEqual(empty.calls, []);
  });
});

// ── Wiring in release-prod.yml ────────────────────────────────────────────────
const workflow = readFileSync(
  new URL("../../.github/workflows/release-prod.yml", import.meta.url),
  "utf8",
);

function stepRun(name) {
  const start = workflow.indexOf(`      - name: ${name}`);
  assert.ok(start >= 0, `${name} step must exist`);
  const end = workflow.indexOf("\n      - name:", start + 1);
  const step = workflow.slice(start, end);
  return step.slice(
    step.indexOf("        run: |\n") + "        run: |\n".length,
  );
}

describe("release-prod.yml — Caddy is not stopped by the deploy", () => {
  const deploy = stepRun("🚀 Deploy to PROD");
  const PONR = 'echo "DEPLOY_STARTED=1" >> "$GITHUB_ENV"';
  const CALL =
    'bash "$GITHUB_WORKSPACE/scripts/ci/prod-caddy-config.sh" "$GITHUB_WORKSPACE/config/caddy/Caddyfile"';

  test("the script runs past the point of no return, after the push, before the app stops", () => {
    const iCall = deploy.indexOf(CALL);
    assert.ok(
      iCall >= 0,
      "the Deploy step must call prod-caddy-config.sh with the checked-out Caddyfile",
    );
    assert.ok(
      iCall > deploy.indexOf(PONR),
      "after the point of no return (a failure must roll back)",
    );
    assert.ok(
      iCall >
        deploy.indexOf("docker push massdoc/nestjs-remix-monorepo:production"),
      "after :production is promoted",
    );
    const iStop = deploy.indexOf("docker stop nestjs-remix-monorepo-prod");
    assert.ok(
      iStop > iCall,
      "before the app is stopped, so the old app serves while Caddy is recreated",
    );
    assert.equal(deploy.indexOf(CALL, iCall + 1), -1, "called once");
  });

  test("no stop or rm names the Caddy container", () => {
    for (const line of workflow.split("\n")) {
      if (/docker\s+(stop|rm|kill|restart)\b/.test(line)) {
        assert.ok(
          !line.includes(CADDY),
          `Caddy must stay up during the deploy: ${line.trim()}`,
        );
      }
    }
  });

  test("the script is the only writer of the PROD Caddyfile", () => {
    assert.ok(
      !/cp\s+\S*config\/caddy\/Caddyfile/.test(workflow),
      "the early config sync must not copy the Caddyfile: a running Caddy would not load it",
    );
  });

  test("this test runs before any PROD mutation", () => {
    const iVerify = workflow.indexOf(
      "node --test scripts/ci/prod-caddy-config.test.mjs",
    );
    const iDeploy = workflow.indexOf("      - name: 🚀 Deploy to PROD");
    assert.ok(
      iVerify >= 0 &&
        iVerify < workflow.indexOf("      - name: Login to Docker Hub"),
      "verify step before Docker Hub login",
    );
    assert.ok(iVerify < iDeploy);
  });
});
