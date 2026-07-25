/**
 * Behavioural proof of the PREPROD response SUITE (preprod-response-suite.sh).
 *
 * The per-probe suite (preprod-response-probe.test.mjs) proves one endpoint's
 * verdict. It cannot see the ORCHESTRATION defect that review of PR #1316 caught:
 * an aggregate "any failure → retry" made a WRONG STATUS retryable, so a first
 * pass of `200,500,200` followed by a clean second pass ended the job GREEN — the
 * exact silent fallback the gate exists to prevent.
 *
 * These tests therefore drive the whole suite against a real local HTTP server and
 * pin the retry boundary:
 *   - a wrong status is NEVER retried, even when the endpoint self-heals;
 *   - a transport failure MAY be retried once, and only after a stable target;
 *   - when both happen, the wrong status dominates.
 *
 * Run: npm run test:preprod-response-suite
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SUITE_SH = join(SCRIPT_DIR, "preprod-response-suite.sh");

// Fast stability polling: the real defaults (4 × 3s) would make each retry test
// wait 12s. The VALUES are not what is under test — the retry BOUNDARY is.
const FAST_STABILITY = { STABLE_NEEDED: "2", STABLE_SLEEP: "1", STABLE_TRIES: "15" };

/**
 * Starts a stub app. `routes` maps a path to a handler(res, hitIndex).
 *
 * The routing table is a Map, not a plain object: `req.url` is attacker-controlled,
 * so `routes[path]` would resolve inherited members (`constructor`, `toString`, …)
 * and then invoke them — CodeQL js/unvalidated-dynamic-method-call, high severity.
 * A Map has no prototype chain to walk, so only declared routes can ever dispatch.
 */
async function startServer(routes, port = 0) {
  const table = new Map(Object.entries(routes));
  const hits = new Map();
  const server = createServer((req, res) => {
    const path = req.url.split("?")[0];
    const n = hits.get(path) ?? 0;
    hits.set(path, n + 1);
    const handler = table.get(path);
    if (typeof handler !== "function") return res.writeHead(404).end();
    return handler(res, n);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return { server, port: server.address().port, close: () => new Promise((r) => server.close(r)) };
}

const ok = (res) => res.writeHead(200, { "Content-Type": "text/html" }).end("ok");
const boom = (res) => res.writeHead(500).end("err");
/** 500 for the first `n` hits, then 200 — an endpoint that "self-heals". */
const flipAfter = (n) => (res, hit) => (hit < n ? boom(res) : ok(res));
const hang = () => {};

function specFile(lines) {
  const dir = mkdtempSync(join(tmpdir(), "preprod-suite-spec-"));
  const f = join(dir, "spec.txt");
  writeFileSync(f, lines.join("\n") + "\n");
  return f;
}

async function runSuite(port, spec, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), "preprod-suite-"));
  const summary = join(dir, "summary.md");
  writeFileSync(summary, "");
  let code = 0;
  let stdout = "";
  try {
    ({ stdout } = await execFileAsync("bash", [SUITE_SH, `http://127.0.0.1:${port}`], {
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_STEP_SUMMARY: summary,
        PROBE_SPEC_FILE: spec,
        ...FAST_STABILITY,
        ...env,
      },
    }));
  } catch (e) {
    code = e.code ?? 1;
    stdout = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
  return { code, stdout, summary: readFileSync(summary, "utf8") };
}

describe("preprod-response-suite.sh — a wrong status is never retried", () => {
  test("exit 1 when an endpoint self-heals 500→200: NO retry, no stability wait", async () => {
    // 3 probes per pass. flipAfter(3) ⇒ pass 1 sees 500,500,500 and a hypothetical
    // pass 2 would see 200,200,200 — the precise scenario that used to end green.
    const app = await startServer({ "/health": ok, "/flip": flipAfter(3) });
    try {
      const spec = specFile(["/health|/health|2000|200", "/flip|Flipper|2000|200"]);
      const started = Date.now();
      const { code, stdout } = await runSuite(app.port, spec);

      assert.equal(code, 1, `a wrong status must block, got ${code}\n${stdout}`);
      assert.match(stdout, /wrong HTTP status is a real defect — never retried/);
      assert.doesNotMatch(stdout, /re-running the response probes/, "must NOT re-run");
      assert.doesNotMatch(stdout, /transient PREPROD restart/, "must NOT wait for stability");
      assert.ok(Date.now() - started < 5000, "must fail fast, not sit in the stability loop");
    } finally {
      await app.close();
    }
  });

  test("exit 1 when a wrong status and a transport failure co-occur (status dominates)", async () => {
    const app = await startServer({ "/health": ok, "/boom": boom, "/hang": hang });
    try {
      const spec = specFile([
        "/health|/health|2000|200",
        "/boom|Boom|2000|200",
        "/hang|Hang|2000|200",
      ]);
      const { code, stdout } = await runSuite(app.port, spec, { PROBE_MAX_TIME: "1" });
      assert.equal(code, 1, "a co-occurring transport blip must not make a defect retryable");
      assert.doesNotMatch(stdout, /re-running the response probes/);
    } finally {
      await app.close();
    }
  });

  test("exit 1, no retry, when a probe sees 500 → connection reset → 200", async () => {
    // The residual masking path: the 500 is real, the reset lands mid-sequence.
    // If the probe reports "transport", the suite re-runs, the endpoint is warm,
    // and the defect ships green. End-to-end proof that it cannot.
    const app = await startServer({
      "/health": ok,
      "/mixed": (res, hit) => {
        if (hit === 0) return boom(res);
        if (hit === 1) return res.socket.destroy();
        return ok(res);
      },
    });
    try {
      const spec = specFile(["/health|/health|2000|200", "/mixed|Mixed|2000|200"]);
      const { code, stdout } = await runSuite(app.port, spec);
      assert.equal(code, 1, `an observed 500 must dominate a later reset, got ${code}\n${stdout}`);
      assert.doesNotMatch(stdout, /re-running the response probes/, "must NOT re-run");
      assert.doesNotMatch(stdout, /transient PREPROD restart/, "must NOT wait for stability");
    } finally {
      await app.close();
    }
  });

  test("an unexpected probe exit code is a defect, never classified as transport", async () => {
    // 127 = probe not executable / not found. It proves NOTHING about the
    // endpoint, so granting it the transport re-run would be a free green.
    const dir = mkdtempSync(join(tmpdir(), "preprod-suite-badprobe-"));
    const stub = join(dir, "exit127.sh");
    writeFileSync(stub, "#!/usr/bin/env bash\nexit 127\n", { mode: 0o755 });

    const app = await startServer({ "/health": ok });
    try {
      const spec = specFile(["/health|/health|2000|200"]);
      const { code, stdout } = await runSuite(app.port, spec, { PROBE_BIN: stub });
      assert.equal(code, 1, "an unexpected exit code must block, not retry");
      assert.match(stdout, /exited 127 \(unexpected\)/);
      assert.doesNotMatch(stdout, /re-running the response probes/);
    } finally {
      await app.close();
    }
  });

  test("every endpoint is still probed after a failure (summary is complete)", async () => {
    const app = await startServer({ "/health": ok, "/boom": boom, "/late": ok });
    try {
      const spec = specFile([
        "/health|/health|2000|200",
        "/boom|Boom|2000|200",
        "/late|Late|2000|200",
      ]);
      const { code, summary } = await runSuite(app.port, spec);
      assert.equal(code, 1);
      assert.match(summary, /\| Late \|/, "probing must not truncate at the first defect");
    } finally {
      await app.close();
    }
  });
});

describe("preprod-response-suite.sh — a transport failure may be retried once", () => {
  test("exit 0 when the target is down, then comes back and answers 200", async () => {
    // Grab a port, release it: pass 1 hits connection-refused (transport, exit 2),
    // the suite polls /health, and the app appears mid-loop.
    const probe = await startServer({});
    const port = probe.port;
    await probe.close();

    const spec = specFile(["/health|/health|2000|200", "/page|Page|2000|200"]);
    const suite = runSuite(port, spec);

    let app;
    const boot = new Promise((resolve) =>
      setTimeout(async () => {
        app = await startServer({ "/health": ok, "/page": ok }, port);
        resolve();
      }, 1500),
    );

    const [{ code, stdout }] = await Promise.all([suite, boot]);
    try {
      assert.equal(code, 0, `a recovered transport failure may pass, got ${code}\n${stdout}`);
      assert.match(stdout, /transient PREPROD restart/);
      assert.match(stdout, /re-running the response probes once/);
    } finally {
      await app?.close();
    }
  });

  test("exit 2 when the target never re-stabilizes", async () => {
    const probe = await startServer({});
    const port = probe.port;
    await probe.close();
    const spec = specFile(["/health|/health|2000|200"]);
    const { code, stdout } = await runSuite(port, spec, { STABLE_TRIES: "2" });
    assert.equal(code, 2, "an unreachable target is a transport verdict, not a status one");
    assert.match(stdout, /did not re-stabilize/);
  });

  test("exit 1 when the re-run still returns a wrong status", async () => {
    // Down at first (transport → retry allowed), then permanently 500.
    const probe = await startServer({});
    const port = probe.port;
    await probe.close();

    const spec = specFile(["/health|/health|2000|200", "/page|Page|2000|200"]);
    const suite = runSuite(port, spec);

    let app;
    const boot = new Promise((resolve) =>
      setTimeout(async () => {
        app = await startServer({ "/health": ok, "/page": boom }, port);
        resolve();
      }, 1500),
    );

    const [{ code, stdout }] = await Promise.all([suite, boot]);
    try {
      assert.equal(code, 1, "the single re-run must not rescue a real defect");
      assert.match(stdout, /still failing after the single re-run/);
    } finally {
      await app?.close();
    }
  });
});

describe("preprod-response-suite.sh — a run that probes nothing must fail", () => {
  test("exit 1 when PROBE_SPEC_FILE points at a missing file", async () => {
    const app = await startServer({ "/health": ok });
    try {
      const missing = join(mkdtempSync(join(tmpdir(), "preprod-suite-nospec-")), "absent.txt");
      const { code, stdout } = await runSuite(app.port, missing);
      assert.equal(code, 1, "a missing spec must fail, not silently probe zero endpoints");
      assert.match(stdout, /missing or unreadable/);
    } finally {
      await app.close();
    }
  });

  test("exit 1 when PROBE_SPEC_FILE is empty (or whitespace only)", async () => {
    const app = await startServer({ "/health": ok });
    try {
      const { code, stdout } = await runSuite(app.port, specFile(["", "   "]));
      assert.equal(code, 1, "an empty spec must fail — a vacuous green proves nothing");
      assert.match(stdout, /is empty/);
    } finally {
      await app.close();
    }
  });
});

describe("preprod-response-suite.sh — happy path and static guarantees", () => {
  test("exit 0 when every endpoint answers its expected status (200 and a declared 301)", async () => {
    const app = await startServer({
      "/health": ok,
      "/page": ok,
      "/legacy": (res) => res.writeHead(301, { Location: "/" }).end(),
    });
    try {
      const spec = specFile([
        "/health|/health|2000|200",
        "/page|Page|2000|200",
        "/legacy|Legacy (declared 301)|2000|301",
      ]);
      const { code, summary } = await runSuite(app.port, spec);
      assert.equal(code, 0);
      assert.match(summary, /\| ✅ \| 301 \|/);
    } finally {
      await app.close();
    }
  });

  const src = readFileSync(SUITE_SH, "utf8");
  const code = src
    .split("\n")
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n");

  test("the health-stability poll is bounded on connect AND total time", () => {
    // Without --max-time the announced bound is a lie: a socket that is accepted
    // but never answers hangs the loop indefinitely.
    const health = code.match(/curl[^\n]*\/health[^\n]*/g) || [];
    assert.ok(health.length > 0, "expected a health poll");
    for (const line of health) {
      assert.match(line, /--connect-timeout\s+\d+/, `missing --connect-timeout: ${line}`);
      assert.match(line, /--max-time\s+\d+/, `missing --max-time: ${line}`);
    }
  });

  test("the retry is bounded to exactly one re-run", () => {
    const reruns = code.match(/^\s*run_probes\s*$/gm) || [];
    assert.equal(reruns.length, 2, "exactly one initial pass and one re-run");
  });

  test("the default spec pins the R1 gamme page the closure verification needed", () => {
    assert.match(code, /\/pieces\/filtre-a-huile-7\.html\|R1 Gamme \(filtre-a-huile\)\|3000\|200/);
  });
});
