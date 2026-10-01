/**
 * Proof of the PR-time backend boot smoke (2026-10-01).
 *
 * `backend-boot-smoke.sh` boots backend/dist with the PREPROD .env and the
 * PREPROD compose service, through `backend-boot-smoke.compose.yml` layered on
 * docker-compose.preprod.yml. A smoke that boots something else than what
 * PREPROD boots proves nothing, so these tests pin, without Docker:
 *
 *   1. the overlay only replaces what cannot exist on a runner: the base file
 *      keeps env_file, environment, healthcheck test, Redis image and network;
 *      no PREPROD port, data directory or container name is reachable;
 *   2. what the overlay copies from the Dockerfile runner stage (WORKDIR,
 *      ENTRYPOINT, ENV, Node major) still matches it;
 *   3. render-preprod-env.sh substitutes its inputs, fails on a missing one
 *      without printing a partial file, and treats CRUX_API_KEY as optional;
 *   4. the script, run against a fake `docker`: renders and preflights the
 *      .env with the REAL Zod contract, scrubs the caller's environment, waits
 *      with the deploy step's budget, prints the backend log on failure, never
 *      reaches `up` when the preflight fails, and always tears down;
 *   5. ci.yml runs this test and the smoke after the core build, and the
 *      deploy step renders its .env with the same renderer.
 *
 * Run: node --test scripts/ci/backend-boot-smoke.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  copyFileSync,
  symlinkSync,
  chmodSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO = join(SCRIPT_DIR, "..", "..");
const SMOKE = "scripts/ci/backend-boot-smoke.sh";
const RENDERER = "scripts/ci/render-preprod-env.sh";
const OVERLAY = "scripts/ci/backend-boot-smoke.compose.yml";
const BASE_COMPOSE = "docker-compose.preprod.yml";
const PREFLIGHT = "scripts/ci/preflight-env-contract.ts";

// Compose merge tags (Compose >= 2.24). Kept visible instead of resolved, so a
// test can tell `!reset []` from a plain empty list.
const composeTag = (tag, kind) =>
  new yaml.Type(tag, { kind, construct: (value) => ({ tag, value }) });
const COMPOSE_SCHEMA = yaml.DEFAULT_SCHEMA.extend(
  ["!reset", "!override"].flatMap((t) =>
    ["scalar", "sequence", "mapping"].map((k) => composeTag(t, k)),
  ),
);
const loadYaml = (rel) =>
  yaml.load(readFileSync(join(REPO, rel), "utf8"), { schema: COMPOSE_SCHEMA });

const overlay = loadYaml(OVERLAY);
const base = loadYaml(BASE_COMPOSE);
const envList = (list) =>
  Object.fromEntries(
    list.map((entry) => {
      const i = entry.indexOf("=");
      return i < 0 ? [entry, undefined] : [entry.slice(0, i), entry.slice(i + 1)];
    }),
  );

function runnerStage() {
  const lines = readFileSync(join(REPO, "Dockerfile"), "utf8").split("\n");
  const from = lines.findIndex((l) => /^FROM\s+\S+\s+AS\s+runner\s*$/i.test(l));
  assert.ok(from >= 0, "Dockerfile has a `runner` stage");
  const stage = [];
  for (let i = from + 1; i < lines.length && !/^FROM\s/i.test(lines[i]); i++) {
    stage.push(lines[i]);
  }
  const env = {};
  for (const line of stage.filter((l) => /^ENV\s/i.test(l))) {
    const m = /^ENV\s+([A-Z_][A-Z0-9_]*)=("?)(.*)\2\s*$/.exec(line);
    assert.ok(m, `runner ENV line in KEY=value form: ${line}`);
    env[m[1]] = m[3];
  }
  const workdirs = stage.map((l) => /^WORKDIR\s+(\S+)/i.exec(l)).filter(Boolean);
  const entry = stage.map((l) => /^ENTRYPOINT\s+(\[.*\])\s*$/i.exec(l)).filter(Boolean);
  assert.equal(entry.length, 1, "runner stage has one exec-form ENTRYPOINT");
  const baseFrom = lines
    .map((l) => /^FROM\s+node:(\d+)-\S*\s+AS\s+base\s*$/i.exec(l))
    .find(Boolean);
  assert.ok(baseFrom, "Dockerfile base stage is FROM node:<major>-…");
  return {
    workdir: workdirs.at(-1)[1],
    env,
    entrypoint: JSON.parse(entry[0][1]),
    nodeMajor: baseFrom[1],
  };
}

describe("overlay keeps docker-compose.preprod.yml as the source of truth", () => {
  const backend = overlay.services.monorepo_preprod;
  const redis = overlay.services.redis_preprod;

  test("overrides only the two base services and the base network", () => {
    assert.deepEqual(Object.keys(overlay).sort(), ["networks", "services"]);
    for (const name of Object.keys(overlay.services)) {
      assert.ok(base.services[name], `base declares service ${name}`);
    }
    assert.deepEqual(Object.keys(overlay.networks), ["automecanik-preprod"]);
    assert.ok(base.networks["automecanik-preprod"]);
  });

  test("never touches env_file, the healthcheck test, NODE_ENV or Redis settings", () => {
    assert.equal(backend.env_file, undefined);
    assert.deepEqual(Object.keys(backend.healthcheck), ["start_interval"]);
    assert.deepEqual(Object.keys(envList(backend.environment)).sort(), [
      "HOME",
      "REGISTRY_DIR",
      "TZ",
    ]);
    assert.ok(
      base.services.monorepo_preprod.healthcheck.test.some((t) => t.endsWith("/health")),
      "the verdict is the base healthcheck: GET /health",
    );
    assert.deepEqual(Object.keys(redis).sort(), ["container_name", "restart", "volumes"]);
  });

  test("no PREPROD port, data directory or container name is reachable", () => {
    assert.deepEqual(backend.ports, { tag: "!reset", value: [] });
    assert.deepEqual(redis.volumes, { tag: "!reset", value: [] });
    assert.equal(overlay.networks["automecanik-preprod"].internal, true);
    for (const [name, svc] of Object.entries(overlay.services)) {
      assert.match(svc.container_name, /^boot-smoke-/);
      assert.notEqual(svc.container_name, base.services[name].container_name);
      assert.equal(svc.restart, "no");
    }
  });

  test("boots the checked-out tree, as the invoking user, from a pinned image", () => {
    assert.deepEqual(backend.volumes, {
      tag: "!override",
      value: ["${BOOT_SMOKE_TREE:?}:/app"],
    });
    assert.equal(backend.user, "${BOOT_SMOKE_UID:?}:${BOOT_SMOKE_GID:?}");
    // Full variant: the base healthcheck calls wget, absent from -slim.
    assert.match(backend.image, /^node:\d+-bookworm@sha256:[0-9a-f]{64}$/);
  });
});

describe("overlay matches the Dockerfile runner stage", () => {
  const runner = runnerStage();
  const backend = overlay.services.monorepo_preprod;
  const overlayEnv = envList(backend.environment);
  const baseEnv = envList(base.services.monorepo_preprod.environment);

  test("same WORKDIR, ENTRYPOINT and Node major", () => {
    assert.equal(backend.working_dir, runner.workdir);
    assert.equal(backend.volumes.value[0].split(":").at(-1), runner.workdir);
    assert.deepEqual(backend.entrypoint, runner.entrypoint);
    assert.equal(/^node:(\d+)-/.exec(backend.image)[1], runner.nodeMajor);
  });

  test("every runner ENV reaches the container with the image's value", () => {
    assert.ok(Object.keys(runner.env).length > 0);
    for (const [key, value] of Object.entries(runner.env)) {
      // NODE_ENV comes from the base compose, which overrides the image anyway.
      const actual = key === "NODE_ENV" ? baseEnv[key] : overlayEnv[key];
      assert.equal(actual, value, `${key} as in the Dockerfile runner stage`);
    }
  });
});

function render(env) {
  return spawnSync("bash", [join(REPO, RENDERER)], {
    env: { PATH: process.env.PATH, ...env },
    encoding: "utf8",
  });
}
const RENDER_INPUTS = {
  SUPABASE_URL: "https://input-url.invalid",
  SUPABASE_ANON_KEY: "input-anon-key",
  SESSION_SECRET: "input-session-secret",
  JWT_SECRET: "input-jwt-secret",
};
const parseEnv = (text) =>
  Object.fromEntries(
    text
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );

describe("render-preprod-env.sh", () => {
  test("substitutes each input verbatim, on stdout only", () => {
    const r = render({ ...RENDER_INPUTS, CRUX_API_KEY: "input-crux" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, "");
    const env = parseEnv(r.stdout);
    for (const [key, value] of Object.entries(RENDER_INPUTS)) assert.equal(env[key], value);
    assert.equal(env.CRUX_API_KEY, "input-crux");
    assert.equal(env.NODE_ENV, "preprod");
    assert.equal(env.READ_ONLY, "true");
  });

  test("CRUX_API_KEY is optional", () => {
    const r = render(RENDER_INPUTS);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(parseEnv(r.stdout).CRUX_API_KEY, "");
  });

  for (const missing of Object.keys(RENDER_INPUTS)) {
    test(`fails without ${missing} and prints no partial file`, () => {
      const inputs = { ...RENDER_INPUTS };
      delete inputs[missing];
      const r = render(inputs);
      assert.notEqual(r.status, 0);
      assert.equal(r.stdout, "");
      assert.match(r.stderr, new RegExp(missing));
    });
  }
});

// A scratch repository root holding the smoke's own files, a fake backend
// build, and links to the real node_modules and backend/src so the REAL
// preflight (tsx + the Zod contract) runs. Fakes for `docker` (and `npx` when
// asked) are generated with their output paths baked in, because the script
// runs compose under `env -i`.
function harness({ upStatus = 0, preflightStatus = null, dist = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "backend-boot-smoke-test-"));
  const root = join(dir, "root");
  for (const rel of [SMOKE, RENDERER, OVERLAY, BASE_COMPOSE, PREFLIGHT]) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    copyFileSync(join(REPO, rel), join(root, rel));
  }
  symlinkSync(join(REPO, "node_modules"), join(root, "node_modules"));
  mkdirSync(join(root, "backend"));
  symlinkSync(join(REPO, "backend", "src"), join(root, "backend", "src"));
  if (dist) {
    mkdirSync(join(root, "backend", "dist"));
    writeFileSync(join(root, "backend", "dist", "main.js"), "");
  }
  const bin = join(dir, "bin");
  const tmp = join(dir, "tmp");
  mkdirSync(bin);
  mkdirSync(tmp);
  const calls = join(dir, "docker-calls.jsonl");
  const seen = join(dir, "seen");
  mkdirSync(seen);
  writeFileSync(
    join(bin, "docker"),
    `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ args, env: process.env }) + "\\n");
if (args.includes("up")) {
  const project = path.dirname(args[args.indexOf("-f") + 1]);
  fs.copyFileSync(path.join(project, ".env"), ${JSON.stringify(join(seen, ".env"))});
  fs.copyFileSync(path.join(project, "docker-compose.preprod.yml"), ${JSON.stringify(join(seen, "compose.yml"))});
  process.exit(${upStatus});
}
if (args.includes("logs")) console.log("FAKE BACKEND LOG");
if (args.includes("ps")) console.log("FAKE PS");
`,
  );
  chmodSync(join(bin, "docker"), 0o755);
  if (preflightStatus !== null) {
    writeFileSync(join(bin, "npx"), `#!/bin/sh\nexit ${preflightStatus}\n`);
    chmodSync(join(bin, "npx"), 0o755);
  }
  const r = spawnSync("bash", [join(root, SMOKE)], {
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      HOME: process.env.HOME,
      TMPDIR: tmp,
      // Must never reach compose: the scrubbed environment drops them.
      SUPABASE_SERVICE_ROLE_KEY: "caller-service-role",
      DATABASE_URL: "caller-database-url",
      SENTRY_DSN: "caller-sentry-dsn",
    },
    encoding: "utf8",
  });
  const dockerCalls = existsSync(calls)
    ? readFileSync(calls, "utf8").trim().split("\n").map((l) => JSON.parse(l))
    : [];
  const seenFile = (name) =>
    existsSync(join(seen, name)) ? readFileSync(join(seen, name), "utf8") : null;
  const result = {
    r,
    root,
    dockerCalls,
    out: r.stdout + r.stderr,
    seenEnv: seenFile(".env"),
    seenCompose: seenFile("compose.yml"),
    // The smoke's own mktemp dirs; tsx keeps its compile cache in TMPDIR too.
    scratch: readdirSync(tmp).filter((n) => n.startsWith("backend-boot-smoke.")),
  };
  rmSync(dir, { recursive: true, force: true });
  return result;
}

const sub = (call) => call.args.find((a) => ["pull", "up", "down", "ps", "logs"].includes(a));

describe("backend-boot-smoke.sh", () => {
  test("healthy boot: renders, preflights, waits with the deploy budget, tears down", () => {
    const h = harness();
    assert.equal(h.r.status, 0, h.out);
    assert.deepEqual(h.dockerCalls.map(sub), ["pull", "up", "down"]);

    const work = dirname(h.dockerCalls[0].args[h.dockerCalls[0].args.indexOf("-f") + 1]);
    for (const call of h.dockerCalls) {
      assert.deepEqual(call.args.slice(0, 6), [
        "compose",
        "-p",
        "boot-smoke",
        "-f",
        join(work, "docker-compose.preprod.yml"),
        "-f",
      ]);
      assert.equal(call.args[6], join(h.root, OVERLAY));
      assert.equal(call.env.BOOT_SMOKE_TREE, h.root);
      assert.equal(call.env.BOOT_SMOKE_UID, String(process.getuid()));
      assert.equal(call.env.BOOT_SMOKE_GID, String(process.getgid()));
      for (const leaked of ["SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "SENTRY_DSN"]) {
        assert.equal(call.env[leaked], undefined, `${leaked} scrubbed`);
      }
    }
    const up = h.dockerCalls[1].args;
    const budget = Number(up[up.indexOf("--wait-timeout") + 1]);
    assert.ok(up.includes("-d") && up.includes("--wait"));
    assert.deepEqual(up.slice(up.indexOf("--pull"), up.indexOf("--pull") + 2), ["--pull", "never"]);
    assert.deepEqual(h.dockerCalls[2].args.slice(7), ["down", "-v", "--remove-orphans", "--timeout", "5"]);

    // The deploy step's health loop: 12 attempts, 10 s apart.
    const loop = /for i in \{1\.\.(\d+)\}; do\n([\s\S]*?)\ndone/.exec(deployStep().run);
    assert.ok(loop, "deploy step health loop");
    assert.match(loop[2], /localhost:3200\/health/);
    const pause = /^\s*sleep (\d+)$/m.exec(loop[2]);
    assert.equal(budget, Number(loop[1]) * Number(pause[1]));

    const env = parseEnv(h.seenEnv);
    assert.equal(env.READ_ONLY, "true");
    assert.match(env.SUPABASE_URL, /\.invalid$/);
    assert.match(env.JWT_SECRET, /^[0-9a-f]{64}$/);
    assert.match(env.SESSION_SECRET, /^[0-9a-f]{64}$/);
    assert.notEqual(env.JWT_SECRET, env.SESSION_SECRET);
    assert.equal(h.seenCompose, readFileSync(join(REPO, BASE_COMPOSE), "utf8"));
    assert.deepEqual(h.scratch, [], "scratch project dir removed");
  });

  test("unhealthy boot: fails, prints states and the backend log, tears down", () => {
    const h = harness({ upStatus: 1 });
    assert.equal(h.r.status, 1);
    assert.deepEqual(h.dockerCalls.map(sub), ["pull", "up", "ps", "logs", "down"]);
    assert.deepEqual(h.dockerCalls[3].args.slice(7), [
      "logs",
      "--no-color",
      "--tail",
      "200",
      "monorepo_preprod",
    ]);
    assert.match(h.out, /::error::backend\/dist did not become healthy/);
    assert.match(h.out, /FAKE PS/);
    assert.match(h.out, /FAKE BACKEND LOG/);
    assert.deepEqual(h.scratch, []);
  });

  test("preflight violation: never reaches compose up", () => {
    const h = harness({ preflightStatus: 1 });
    assert.notEqual(h.r.status, 0);
    assert.ok(!h.dockerCalls.map(sub).includes("up"));
    assert.deepEqual(h.scratch, []);
  });

  test("no backend build: fails before any docker call", () => {
    const h = harness({ dist: false });
    assert.equal(h.r.status, 1);
    assert.deepEqual(h.dockerCalls, []);
    assert.match(h.out, /run the core build/);
  });
});

const workflow = () => yaml.load(readFileSync(join(REPO, ".github/workflows/ci.yml"), "utf8"));
function deployStep() {
  const steps = workflow().jobs.deploy.steps.filter((s) => /Deploy to PREPROD/.test(s.name ?? ""));
  assert.equal(steps.length, 1, "one `Deploy to PREPROD` step");
  return steps[0];
}

describe("ci.yml wiring", () => {
  test("core-build runs this test, then the smoke after the build, blocking", () => {
    const job = workflow().jobs["core-build"];
    const at = (pattern) => job.steps.findIndex((s) => pattern.test(s.run ?? ""));
    const build = at(/npm run build --filter=@fafa\/backend/);
    const tests = at(/^node --test scripts\/ci\/backend-boot-smoke\.test\.mjs$/m);
    const smoke = at(/^bash scripts\/ci\/backend-boot-smoke\.sh$/m);
    assert.ok(build >= 0 && tests >= 0 && smoke >= 0);
    assert.ok(smoke > build, "the smoke boots what the build produced");
    for (const step of [job.steps[tests], job.steps[smoke]]) {
      assert.equal(step["continue-on-error"], undefined);
      assert.equal(step.if, undefined);
    }
    assert.equal(job["continue-on-error"], undefined);
  });

  test("the deploy step renders its .env with the same renderer, before the preflight", () => {
    const step = deployStep();
    const run = step.run;
    const renderAt = run.indexOf(
      'bash "$GITHUB_WORKSPACE/scripts/ci/render-preprod-env.sh" > "$PREPROD_DIR/.env"',
    );
    assert.ok(renderAt >= 0);
    assert.ok(renderAt < run.indexOf("preflight-env-contract.ts"));
    assert.doesNotMatch(run, /cat\s*>\s*"?\$PREPROD_DIR\/\.env"?\s*<</);
    for (const key of [...Object.keys(RENDER_INPUTS), "CRUX_API_KEY"]) {
      assert.ok(key in step.env, `deploy step env provides ${key}`);
    }
  });
});
