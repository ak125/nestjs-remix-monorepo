/**
 * Behavioural proof of the read-only PROD observation report (2026-10-26).
 *
 * The report runs only on the PROD host (prod-smoke-tests.yml), where a wrong
 * verdict is the only thing anyone sees. These tests drive it against a stubbed
 * docker and synthetic Caddy lines (documentation addresses, no PROD data):
 *
 *   1. payment tiers count from arrival (ts - duration), like callbacks.py v2;
 *   2. a 429 or 5xx on a payment route inside the window is ALERTE, an older
 *      one is reported only;
 *   3. nothing printed identifies a client or measures volume: no address, no
 *      request total, and the counter destination is judged, never echoed;
 *   4. the limiter verdicts follow the L2 DoD7 criteria (reserved Redis,
 *      noeviction, 16 MiB signal, "budget non partagé"), and "non déployé"
 *      before L2 does not fail the run;
 *   5. a failed command or a missing field is "non vérifié", never OK;
 *   6. docker is only asked to read: exec targets the Caddy container and the
 *      limiter Redis only, never the sessions Redis;
 *   7. the streaming reader decompresses rotated files, stops early on request
 *      and fails on a non-zero exit.
 *
 * Run: node --test scripts/ci/prod-observation-report.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import {
  TARGETS,
  THROTTLER_USED_MEMORY_SIGNAL,
  dockerStream,
  judgeLimiter,
  judgePayments,
  judgeRoute,
  createAccessAccumulator,
  parseAccessLine,
  parseCounterTarget,
  parseRedisInfo,
  percentile,
  runReport,
  slidingWindows,
  vehicleModelsEligible,
} from "./prod-observation-report.mjs";

const NOW = Date.parse("2026-10-26T12:00:00.000Z");
const CUTOFF = NOW - 7 * 3_600_000;
const IP_A = "203.0.113.5";
const IP_B = "198.51.100.7";

function line({ ts, method = "POST", uri, ip = IP_A, status = 200, duration = 0.01, upstream }) {
  return JSON.stringify({
    level: "info",
    ts,
    logger: "http.log.access",
    msg: "handled request",
    request: { remote_ip: "10.0.0.2", client_ip: ip, method, host: "www.automecanik.com", uri },
    duration,
    status,
    ...(upstream ? { upstream } : {}),
  });
}

const at = (iso, plusMs = 0) => new Date(Date.parse(iso) + plusMs).toISOString();

describe("access log parsing", () => {
  test("ISO with Z, ISO with a colon-less offset and epoch seconds give the same instant", () => {
    const uri = "/api/paybox/callback";
    const a = parseAccessLine(line({ ts: "2026-10-26T10:00:00.000Z", uri }));
    const b = parseAccessLine(line({ ts: "2026-10-26T12:00:00.000+0200", uri }));
    const c = parseAccessLine(line({ ts: Date.parse("2026-10-26T10:00:00.000Z") / 1000, uri }));
    assert.equal(a.tsMs, b.tsMs);
    assert.equal(a.tsMs, c.tsMs);
  });

  test("arrival is ts minus duration; path loses query, trailing slash and case", () => {
    const e = parseAccessLine(line({ ts: "2026-10-26T10:00:01.500Z", uri: "/API/Paybox/Callback/?x=1", duration: 1.2 }));
    assert.equal(e.arrivalMs, Date.parse("2026-10-26T10:00:00.300Z"));
    assert.equal(e.path, "/api/paybox/callback");
  });

  test("non-JSON and request-less lines are unreadable", () => {
    assert.equal(parseAccessLine("not json"), null);
    assert.equal(parseAccessLine(JSON.stringify({ ts: "2026-10-26T10:00:00Z" })), null);
  });
});

describe("payment tiers", () => {
  test("31 requests of one address in 60 s: one beyond 30/60 s", () => {
    const arrivals = Array.from({ length: 31 }, (_, i) => ({ t: i * 1000, ip: IP_A, recent: true }));
    arrivals.push({ t: 5_000, ip: IP_B, recent: true });
    assert.deepEqual(slidingWindows(arrivals, 30, 60_000), { top: 31, beyond: 1, beyondRecent: 1 });
  });

  test("a slow request counts in the 1 s window of its arrival, not of its log write", () => {
    const acc = createAccessAccumulator(CUTOFF);
    for (let i = 0; i < 15; i++) {
      acc.addLine(line({ ts: at("2026-10-26T10:00:00.000Z", i * 50), uri: "/api/paybox/callback" }));
    }
    // Written at 10:00:01.500, arrived at 10:00:00.300.
    acc.addLine(line({ ts: "2026-10-26T10:00:01.500Z", uri: "/api/paybox/callback", duration: 1.2 }));
    const p = acc.result().payments.get("POST /api/paybox/callback");
    assert.equal(slidingWindows(p.arrivals, 15, 1000).beyond, 1);
  });

  test("429/5xx in the window are ALERTE; older ones are reported, unused routes are absent", () => {
    const old = createAccessAccumulator(CUTOFF);
    old.addLine(line({ ts: "2026-10-20T08:00:00.000Z", uri: "/api/payments/callback/cyberplus", status: 429 }));
    old.addLine(line({ ts: "2026-10-26T11:00:00.000Z", uri: "/api/paybox/callback" }));
    const quiet = judgePayments(old.result(), 7);
    assert.equal(quiet.verdict, "OK");
    assert.match(quiet.lines.join("\n"), /OK POST \/api\/payments\/callback\/cyberplus : utilisé ; 429 1 \(0 sur 7 h\)/);
    assert.match(quiet.lines.join("\n"), /GET \/api\/paybox\/callback : absent/);

    const fresh = createAccessAccumulator(CUTOFF);
    fresh.addLine(line({ ts: "2026-10-26T11:00:00.000Z", uri: "/api/paybox/callback", status: 502 }));
    assert.equal(judgePayments(fresh.result(), 7).verdict, "ALERTE");
  });

  test("no readable line is non vérifié", () => {
    const acc = createAccessAccumulator(CUTOFF);
    acc.addLine("garbage");
    assert.equal(judgePayments(acc.result(), 7).verdict, "non vérifié");
  });
});

describe("R2 route", () => {
  test("eligibility mirrors Caddyfile @vehicle_models", () => {
    assert.equal(vehicleModelsEligible("GET", "/api/vehicles/brands/441/models?year=2008&page=0"), true);
    assert.equal(vehicleModelsEligible("HEAD", "/api/vehicles/brands/441/models/?year=2008"), true);
    assert.equal(vehicleModelsEligible("GET", "/api/vehicles/brands/441/models?page=0"), false);
    assert.equal(vehicleModelsEligible("GET", "/api/vehicles/brands/441/models?year=2008&year=2009"), false);
    assert.equal(vehicleModelsEligible("GET", "/api/vehicles/brands/441/models?year=0123"), false);
    assert.equal(vehicleModelsEligible("POST", "/api/vehicles/brands/441/models?year=2008"), false);
  });

  test("percentiles are nearest-rank", () => {
    const sorted = Float64Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(percentile(sorted, 0.5), 5);
    assert.equal(percentile(sorted, 0.95), 10);
    assert.equal(percentile(new Float64Array(0), 0.5), undefined);
  });

  test("a 421 is ALERTE; the Rust share is a percentage, never a count", () => {
    const acc = createAccessAccumulator(CUTOFF);
    const uri = "/api/vehicles/brands/441/models?year=2008";
    acc.addLine(line({ ts: "2026-10-26T11:00:00Z", method: "GET", uri, upstream: "vehicle_models_rs:3150", duration: 0.004 }));
    acc.addLine(line({ ts: "2026-10-26T11:00:01Z", method: "GET", uri, upstream: "vehicle_models_rs:3150", duration: 0.006 }));
    acc.addLine(line({ ts: "2026-10-26T11:00:02Z", method: "GET", uri, upstream: "monorepo_prod:3000", duration: 0.05 }));
    acc.addLine(line({ ts: "2026-10-26T11:00:03Z", method: "GET", uri, upstream: "monorepo_prod:3000", status: 421 }));
    // Outside the window: not counted.
    acc.addLine(line({ ts: "2026-10-25T01:00:00Z", method: "GET", uri, status: 500 }));
    const r = judgeRoute(acc.result().route, 7);
    assert.equal(r.verdict, "ALERTE");
    assert.match(r.lines[0], /421 1 ; 429 0 ; 5xx 0 ; servies par Rust 50 %/);
  });

  test("before L4 the log names no upstream; no eligible request is absent", () => {
    const acc = createAccessAccumulator(CUTOFF);
    acc.addLine(line({ ts: "2026-10-26T11:00:00Z", method: "GET", uri: "/api/vehicles/brands/1/models?year=2010" }));
    const r = judgeRoute(acc.result().route, 7);
    assert.equal(r.verdict, "OK");
    assert.match(r.lines[0], /amont non journalisé/);
    assert.equal(judgeRoute(createAccessAccumulator(CUTOFF).result().route, 7).verdict, "absent");
  });
});

describe("limiter verdicts", () => {
  const info = (used, policy = "noeviction") => ({ used_memory: used, maxmemory: 64 * 1024 * 1024, maxmemory_policy: policy });
  const running = (used, policy) => ({ name: "app-redis_throttler-1", state: "running", restarts: "0", info: info(used, policy) });
  const target = parseCounterTarget('{"level":30,"msg":"Compteurs sur redis_throttler:6379/0 (THROTTLER_REDIS_URL)"}');
  const base = { throttler: running(2 * 1024 * 1024), target, startupRead: true, errors: 0, recoveries: 0 };
  const judge = (facts) => judgeLimiter("PROD", "redis_throttler", { ...base, ...facts }, 7);

  test("the startup line parses, and the reserved Redis with noeviction is OK without echoing host:port", () => {
    assert.deepEqual(target, { host: "redis_throttler", port: 6379, db: 0, source: "THROTTLER_REDIS_URL" });
    const r = judge({});
    assert.equal(r.verdict, "OK");
    assert.doesNotMatch(r.lines.join("\n"), /:6379/);
  });

  test("another destination, a fallback source, a non-running Redis, wrong policy, memory signal or errors are ALERTE", () => {
    assert.equal(judge({ target: { ...target, source: "REDIS_URL" } }).verdict, "ALERTE");
    assert.equal(judge({ target: { ...target, host: "redis_prod" } }).verdict, "ALERTE");
    assert.equal(judge({ throttler: { name: "x", state: "restarting", restarts: "9" } }).verdict, "ALERTE");
    assert.equal(judge({ throttler: running(1024, "allkeys-lru") }).verdict, "ALERTE");
    assert.equal(judge({ throttler: running(THROTTLER_USED_MEMORY_SIGNAL + 1) }).verdict, "ALERTE");
    assert.equal(judge({ errors: 1 }).verdict, "ALERTE");
  });

  test("before L2: no reserved Redis and no startup line is non déployé; a line without the Redis is ALERTE", () => {
    assert.equal(judge({ throttler: { state: "none" }, target: undefined }).verdict, "non déployé");
    assert.equal(judge({ throttler: { state: "none" } }).verdict, "ALERTE");
  });

  test("unread log, missing startup line, missing INFO field or failed lookup is non vérifié", () => {
    assert.equal(judge({ startupRead: false }).verdict, "non vérifié");
    assert.equal(judge({ target: undefined }).verdict, "non vérifié");
    assert.equal(judge({ errors: undefined }).verdict, "non vérifié");
    assert.equal(judge({ throttler: { ...running(1), info: { used_memory: 1 } } }).verdict, "non vérifié");
    assert.equal(judge({ throttler: { state: "inconnu" } }).verdict, "non vérifié");
    assert.equal(judge({ throttler: { state: "none" }, target: undefined, startupRead: false }).verdict, "non vérifié");
  });

  test("INFO memory parses the three fields over CRLF", () => {
    assert.deepEqual(parseRedisInfo("# Memory\r\nused_memory:1048576\r\nmaxmemory:67108864\r\nmaxmemory_policy:noeviction\r\n"), {
      used_memory: 1048576,
      maxmemory: 67108864,
      maxmemory_policy: "noeviction",
    });
  });
});

/** Stub docker for the whole report: PROD after L2, PREPROD before L2. */
function stubIo({ caddyFiles, failStats = false, extraNames = [] } = {}) {
  const calls = [];
  const files = caddyFiles ?? {
    // Name of a rotated file as Caddy 2.11.4 writes it (bench capture, 2026-10-24).
    "automecanik-2026-10-24T00-08-00.384-size.log.gz": [
      line({ ts: "2026-10-20T08:00:00.000Z", uri: "/api/payments/callback/cyberplus", ip: IP_B }),
    ],
    "automecanik.log": [
      line({ ts: "2026-10-26T11:00:00.000Z", uri: "/api/paybox/callback" }),
      line({ ts: "2026-10-26T11:00:01.000Z", method: "GET", uri: "/api/vehicles/brands/441/models?year=2008" }),
    ],
  };
  const docker = (args) => {
    calls.push(args);
    const cmd = args.join(" ");
    if (cmd === "exec nestjs-remix-caddy ls -1 /var/log/caddy") {
      return [...Object.keys(files), "access.log", "x;rm", ...extraNames].join("\n");
    }
    if (cmd.startsWith("ps -a --filter name=^nestjs-remix-monorepo-prod$")) return "nestjs-remix-monorepo-prod\tapp\n";
    if (cmd.startsWith("ps -a --filter name=^nestjs-remix-monorepo-preprod$")) return "nestjs-remix-monorepo-preprod\tpreprod\n";
    if (cmd.includes("com.docker.compose.service=redis_throttler ")) return "app-redis_throttler-1\trunning\n";
    if (cmd.includes("com.docker.compose.service=redis_throttler_preprod")) return "";
    if (cmd === "inspect --format {{.RestartCount}} app-redis_throttler-1") return "0\n";
    if (cmd === "exec app-redis_throttler-1 redis-cli info memory") return "used_memory:1048576\r\nmaxmemory:67108864\r\nmaxmemory_policy:noeviction\r\n";
    if (cmd.startsWith("inspect --format {{.State.StartedAt}}")) return "2026-10-26T09:00:00.000000000Z\n";
    if (cmd.startsWith("ps --filter name=^vehicle-models-rs")) return "";
    if (cmd.startsWith("stats")) {
      if (failStats) throw new Error("docker stats exited with 1");
      return "nestjs-remix-monorepo-prod\t900MiB / 4GiB\t21.97%\n";
    }
    throw new Error(`unexpected docker ${cmd}`);
  };
  const stream = async (args, onLine) => {
    calls.push(args);
    let lines;
    if (args[0] === "exec") lines = files[args[3].split("/").pop()];
    else if (args[0] === "logs" && args.at(-1) === "nestjs-remix-monorepo-prod") {
      lines = ['{"level":30,"msg":"Compteurs sur redis_throttler:6379/0 (THROTTLER_REDIS_URL)"}', '{"level":30,"msg":"ready"}'];
    } else if (args[0] === "logs") lines = ['{"level":30,"msg":"ready"}'];
    if (!lines) throw new Error(`unexpected stream ${args.join(" ")}`);
    for (const l of lines) if (onLine(l) === true) return;
  };
  return { io: { docker, stream, now: () => NOW }, calls };
}

describe("whole report against a stubbed docker", () => {
  const config = { caddy: "nestjs-remix-caddy", targets: TARGETS, windowHours: 7 };

  test("PROD after L2 and PREPROD before L2 give OK; nothing identifies a client or measures volume", async () => {
    const { io, calls } = stubIo();
    const { verdict, lines } = await runReport(config, io);
    const text = lines.join("\n");
    assert.equal(verdict, "OK", text);
    // The rotated file was read: the period starts in it.
    assert.match(text, /période couverte 2026-10-20T08:00 → 2026-10-26T11:00/);
    assert.match(text, /Limiteur PREPROD : non déployé/);
    assert.match(text, /destination des compteurs : OK \(redis_throttler, source THROTTLER_REDIS_URL\)/);
    for (const forbidden of [IP_A, IP_B, "10.0.0.2", ":6379", "requêtes", "IP distinctes"]) {
      assert.ok(!text.includes(forbidden), `report prints ${forbidden}`);
    }
    // Only listed log files are read: never a name outside automecanik*.log*.
    assert.ok(!calls.some((a) => a.includes("/var/log/caddy/x;rm") || a.includes("/var/log/caddy/access.log")));
    // docker only reads; exec reaches Caddy and the limiter Redis, never the sessions Redis.
    for (const args of calls) {
      assert.ok(["exec", "ps", "inspect", "logs", "stats"].includes(args[0]), args.join(" "));
      if (args[0] === "exec") assert.ok(["nestjs-remix-caddy", "app-redis_throttler-1"].includes(args[1]), args.join(" "));
      assert.ok(!args.some((a) => /redis_prod|redis-preprod|config|flush/i.test(a)), args.join(" "));
    }
  });

  test("a site log file under an unexpected name is non vérifié, not skipped silently", async () => {
    const r = await runReport(config, stubIo({ extraNames: ["automecanik-2026-10-25T00-00-00.000.log.zst"] }).io);
    assert.equal(r.verdict, "non vérifié");
    assert.match(r.lines.join("\n"), /1 fichier\(s\) de journal au nom inattendu, non lus/);
  });

  test("a failed docker stats or an unreadable Caddy log is non vérifié", async () => {
    assert.equal((await runReport(config, stubIo({ failStats: true }).io)).verdict, "non vérifié");
    const broken = stubIo();
    const stream = broken.io.stream;
    broken.io.stream = (args, onLine) => (args[0] === "exec" ? Promise.reject(new Error("docker exec exited with 1")) : stream(args, onLine));
    const r = await runReport(config, broken.io);
    assert.equal(r.verdict, "non vérifié");
    assert.match(r.lines.join("\n"), /Paiement et route R2 : non vérifiés/);
  });

  test("a recent 429 on a payment notification fails the run", async () => {
    const { io } = stubIo({
      caddyFiles: { "automecanik.log": [line({ ts: "2026-10-26T11:30:00.000Z", uri: "/api/paybox/callback", status: 429 })] },
    });
    assert.equal((await runReport(config, io)).verdict, "ALERTE");
  });
});

describe("streaming reader", () => {
  const dir = mkdtempSync(join(tmpdir(), "po-stream-"));
  const fake = join(dir, "fake-docker.sh");
  // Stands in for docker: `exec <c> cat <file>` prints the file, `logs` writes
  // to both streams, anything else exits 3.
  writeFileSync(
    fake,
    '#!/bin/sh\ncase "$1" in\n  exec) cat "$4" ;;\n  logs) echo out-line; echo err-line >&2 ;;\n  *) exit 3 ;;\nesac\n',
  );
  chmodSync(fake, 0o755);
  const gz = join(dir, "automecanik-1.log.gz");
  writeFileSync(gz, gzipSync(Array.from({ length: 1000 }, (_, i) => `line ${i}`).join("\n") + "\n"));

  test("decompresses a rotated file line by line", async () => {
    let n = 0;
    await dockerStream(["exec", "c", "cat", gz], () => void (n += 1), { gunzip: true, bin: fake });
    assert.equal(n, 1000);
  });

  test("stops early when the callback returns true", async () => {
    const seen = [];
    await dockerStream(["exec", "c", "cat", gz], (l) => seen.push(l) >= 3, { gunzip: true, bin: fake });
    assert.deepEqual(seen, ["line 0", "line 1", "line 2"]);
  });

  test("docker logs reads stdout and stderr", async () => {
    const seen = [];
    await dockerStream(["logs", "--since", "7h", "c"], (l) => void seen.push(l), { bin: fake });
    assert.deepEqual(seen.sort(), ["err-line", "out-line"]);
  });

  test("a non-zero exit rejects without echoing output", async () => {
    await assert.rejects(dockerStream(["stats"], () => {}, { bin: fake }), /docker stats exited with 3/);
  });
});
