/**
 * Behavioural proof of the PREPROD response probe (preprod-response-probe.sh).
 *
 * The gate this replaces measured latency ONLY — `curl -o /dev/null -w "%{time_total}"`
 * with no status assertion — so a fast 500 produced a green ✅ row. It was found
 * during the PREPROD verification of PR #1297: the step does probe
 * `/pieces/filtre-a-huile-7.html`, but could not tell 200 from 500, leaving the
 * ADR-024 R1 gamme gate blind on the surface it exists to protect.
 *
 * These tests run the probe against a REAL local HTTP server (not a stubbed curl),
 * so the pass/fail decision is proven end-to-end for each observable response:
 * correct status, wrong status, redirect, network error, timeout, and slow-but-OK.
 *
 * Run: npm run test:preprod-response-probe
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

// MUST be async: the stub HTTP server lives in THIS process, so a synchronous
// execFileSync would block the event loop and the server could never answer —
// every probe would time out regardless of what the script does.
const execFileAsync = promisify(execFile);

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROBE_SH = join(SCRIPT_DIR, "preprod-response-probe.sh");

/**
 * Routes exercised by the tests. `/flap` alternates 200,500,200 to prove every
 * probe is status-checked rather than only the first (or an average).
 */
let flapCount = 0;
let server;
let PORT;

before(async () => {
  server = createServer((req, res) => {
    const path = req.url.split("?")[0];
    switch (path) {
      case "/ok":
        return res.writeHead(200, { "Content-Type": "text/html" }).end("<html>ok</html>");
      case "/boom":
        return res.writeHead(500, { "Content-Type": "text/html" }).end("<html>err</html>");
      case "/moved":
        return res.writeHead(301, { Location: "/ok" }).end();
      case "/found":
        return res.writeHead(302, { Location: "/ok" }).end();
      case "/slow":
        return setTimeout(
          () => res.writeHead(200, { "Content-Type": "text/html" }).end("<html>slow</html>"),
          250,
        );
      case "/hang":
        return; // never responds → curl --max-time must trip
      case "/flap": {
        const code = flapCount++ === 1 ? 500 : 200;
        return res.writeHead(code, { "Content-Type": "text/html" }).end("x");
      }
      default:
        return res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  PORT = server.address().port;
});

after(() => server?.close());

async function runProbeUrl(url, { label = "probe", budget = 2000, expected, env = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "preprod-response-probe-"));
  const summary = join(dir, "summary.md");
  writeFileSync(summary, "");

  const args = [PROBE_SH, url, label, String(budget)];
  if (expected !== undefined) args.push(String(expected));

  let code = 0;
  let stdout = "";
  try {
    ({ stdout } = await execFileAsync("bash", args, {
      encoding: "utf8",
      env: { ...process.env, GITHUB_STEP_SUMMARY: summary, ...env },
    }));
  } catch (e) {
    code = e.code ?? 1;
    stdout = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
  return { code, stdout, summary: readFileSync(summary, "utf8") };
}

const runProbe = (path, opts) => runProbeUrl(`http://127.0.0.1:${PORT}${path}`, opts);

describe("preprod-response-probe.sh — status is asserted, not just latency", () => {
  test("PASSES on a fast 200 (the only green case)", async () => {
    const { code, stdout, summary } = await runProbe("/ok");
    assert.equal(code, 0, `expected pass, got ${code}\n${stdout}`);
    assert.match(stdout, /✅.*HTTP 200/);
    assert.match(summary, /\| ✅ \| 200 \|/);
  });

  test("FAILS on a fast 500 — the exact blind spot (was a green ✅ row before)", async () => {
    const { code, stdout, summary } = await runProbe("/boom");
    assert.notEqual(code, 0, "a 500 must be blocking, however fast it answers");
    assert.match(stdout, /HTTP 500.*expected 200/);
    assert.match(summary, /❌ HTTP/);
  });

  test("FAILS on a fast 301 and does NOT follow it", async () => {
    const { code, stdout } = await runProbe("/moved");
    assert.notEqual(code, 0);
    assert.match(stdout, /HTTP 301.*expected 200/);
    assert.match(stdout, /redirect not followed on purpose/);
  });

  test("FAILS on a fast 302 and does NOT follow it", async () => {
    const { code, stdout } = await runProbe("/found");
    assert.notEqual(code, 0);
    assert.match(stdout, /HTTP 302.*expected 200/);
  });

  test("FAILS on a network error (connection refused → http_code 000)", async () => {
    // Port 1 has no listener: curl exits 7 and reports 000.
    const { code, stdout, summary } = await runProbeUrl("http://127.0.0.1:1/ok", {
      label: "unreachable",
    });
    assert.notEqual(code, 0);
    assert.match(stdout, /no usable response/);
    assert.match(summary, /no response/);
  });

  test("FAILS on a timeout (server never answers)", async () => {
    const { code, stdout } = await runProbe("/hang", { env: { PROBE_MAX_TIME: "1" } });
    assert.notEqual(code, 0);
    assert.match(stdout, /no usable response/);
  });

  test("FAILS when only ONE of the three probes is bad (no averaging away a flap)", async () => {
    flapCount = 0;
    const { code, stdout } = await runProbe("/flap");
    assert.notEqual(code, 0, "a 200,500,200 sequence must fail — every probe is checked");
    assert.match(stdout, /HTTP 200 500 200|HTTP .*500/);
  });
});

describe("preprod-response-probe.sh — latency stays a warning, never a failure", () => {
  test("WARNS but PASSES when a correct 200 exceeds its budget", async () => {
    const { code, stdout, summary } = await runProbe("/slow", { budget: 1 });
    assert.equal(code, 0, "slowness must remain non-blocking");
    assert.match(stdout, /⚠️.*exceeds budget/);
    assert.match(stdout, /::warning::/);
    assert.match(summary, /⚠️ SLOW/);
  });
});

describe("preprod-response-probe.sh — declared non-200 contracts", () => {
  test("PASSES a 301 only when 301 is explicitly declared as expected", async () => {
    const { code, stdout } = await runProbe("/moved", { expected: 301 });
    assert.equal(code, 0, "an explicitly declared redirect contract is allowed");
    assert.match(stdout, /✅.*HTTP 301/);
  });

  test("FAILS when a declared-301 URL starts answering 200 (contract drift both ways)", async () => {
    const { code, stdout } = await runProbe("/ok", { expected: 301 });
    assert.notEqual(code, 0);
    assert.match(stdout, /HTTP 200.*expected 301/);
  });
});

describe("preprod-response-probe.sh — static guarantees", () => {
  const src = readFileSync(PROBE_SH, "utf8");
  const code = src
    .split("\n")
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n");

  test("never follows redirects (no -L / --location)", async () => {
    assert.doesNotMatch(code, /curl[^\n|]*\s(-L|--location)\b/, "probe must not follow redirects");
  });

  test("captures status and timing in the SAME curl call (they cannot drift)", async () => {
    assert.match(code, /%\{http_code\}\s+%\{time_total\}/);
  });

  test("summary rows carry the HTTP column", async () => {
    const rows = code.match(/echo "\| \$LABEL \|[^"]*"/g) || [];
    assert.ok(rows.length >= 3, `expected the 3 summary rows, found ${rows.length}`);
    for (const row of rows) {
      assert.equal(
        (row.match(/\|/g) || []).length,
        6,
        `row must have 5 columns (Endpoint|Median|Budget|Status|HTTP): ${row}`,
      );
    }
  });
});
