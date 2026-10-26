import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";

// Read-only PROD observation report (2026-10-26), run by prod-smoke-tests.yml on
// the PROD host. It replaces reads that assumed someone could type a line in the
// server console. Nothing it prints identifies a client or measures traffic
// volume: no IP address, no request total, no distinct-address count.
//
//   1. Payment notification routes, from the Caddy site log read inside the
//      Caddy container (rotated files included): per route and method, whether
//      it is used, 429 and 5xx answers, and for the two payment_callback tiers
//      (30 per sliding 60 s, 15 per sliding 1 s, per handler and per address) the
//      highest count one address reached and the requests that came beyond it.
//      Windows start at arrival (ts - duration), as in callbacks.py v2.
//   2. Rate-limit counters, PROD and PREPROD: the destination the backend logged
//      at startup ("Compteurs sur host:port/db (source)", judged, never printed),
//      the reserved Redis (state, policy, used_memory against the 16 MiB signal
//      of the L2 DoD7 criteria) and the "budget non partagé" errors of the window.
//      The sessions Redis is never inspected.
//   3. Memory of the backend, Rust and limiter containers (docker stats).
//   4. GET /api/vehicles/brands/:brandId/models with a year, over the window:
//      latency percentiles from Caddy's duration, 421 / 429 / 5xx answers, and
//      the share answered by vehicle_models_rs when the log names the upstream.
//
// Verdicts: OK, ALERTE, "non vérifié" (a command failed or a field is missing),
// "non déployé" and "absent". The exit code is non-zero on ALERTE or "non
// vérifié" only.
//
// Usage: node scripts/ci/prod-observation-report.mjs
// Env: PO_CADDY_CONTAINER (default nestjs-remix-caddy), PO_WINDOW_HOURS.

export const PAYMENT_ROUTES = [
  "/api/paybox/callback",
  "/api/payments/callback/cyberplus",
  "/api/payments/callback/success",
  "/api/payments/callback/error",
];
// Always printed, used or not: a missing line would hide "absent".
export const SHOWN = [
  ["/api/paybox/callback", "POST"],
  ["/api/paybox/callback", "GET"],
  ["/api/payments/callback/cyberplus", "POST"],
  ["/api/payments/callback/cyberplus", "GET"],
  ["/api/payments/callback/success", "POST"],
  ["/api/payments/callback/error", "POST"],
];
// payment_callback tier of the two limited POSTs, then the global short tier.
export const TIERS = [
  { limit: 30, widthMs: 60_000, label: "30/60 s" },
  { limit: 15, widthMs: 1_000, label: "15/1 s" },
];
// L2 DoD7: above this, the reserved Redis moves to the 128 MB variant.
export const THROTTLER_USED_MEMORY_SIGNAL = 16 * 1024 * 1024;
// The schedule runs every 6 h; one more hour so a late run leaves no gap.
export const DEFAULT_WINDOW_HOURS = 7;
export const RUST_UPSTREAM = "vehicle_models_rs:3150";
export const CADDY_LOG_DIR = "/var/log/caddy";
// The current file, then the rotated ones, named by Caddy after the rotation
// time and reason: automecanik-2026-10-24T00-08-00.384-size.log.gz.
const LOG_FILE = /^automecanik(-[0-9T.-]+(-[a-z]+)?)?\.log(\.gz)?$/;

export const TARGETS = [
  {
    name: "PROD",
    backend: "nestjs-remix-monorepo-prod",
    throttlerService: "redis_throttler",
    rust: "vehicle-models-rs-prod",
  },
  {
    name: "PREPROD",
    backend: "nestjs-remix-monorepo-preprod",
    throttlerService: "redis_throttler_preprod",
    rust: "vehicle-models-rs-preprod",
  },
];

export function normalizePath(uri) {
  return (uri || "/").split("?")[0].replace(/\/+$/, "").toLowerCase();
}

function parseTs(ts) {
  if (typeof ts === "number") return ts * 1000;
  if (typeof ts !== "string") return NaN;
  // zap's iso8601 writes the offset without a colon (+0200).
  return Date.parse(ts.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
}

/** One Caddy access-log line → the fields this report reads, or null. */
export function parseAccessLine(line) {
  let d;
  try {
    d = JSON.parse(line);
  } catch {
    return null;
  }
  const r = d?.request;
  const tsMs = parseTs(d?.ts);
  if (!r || !Number.isFinite(tsMs)) return null;
  const duration = typeof d.duration === "number" && d.duration > 0 ? d.duration : 0;
  return {
    tsMs,
    arrivalMs: Math.round(tsMs) - Math.round(duration * 1000),
    duration,
    uri: r.uri || "/",
    path: normalizePath(r.uri),
    method: (r.method || "").toUpperCase(),
    ip: r.client_ip || r.remote_ip || "",
    status: Number(d.status) || 0,
    upstream: typeof d.upstream === "string" ? d.upstream : undefined,
  };
}

/**
 * Highest count one address reached in a sliding window of widthMs, and the
 * requests that arrived while it already had `limit` (what the tier refuses).
 * arrivals: [{ t, ip, recent }], any order.
 */
export function slidingWindows(arrivals, limit, widthMs) {
  const sorted = [...arrivals].sort((a, b) => a.t - b.t);
  const queues = new Map();
  let top = 0;
  let beyond = 0;
  let beyondRecent = 0;
  for (const { t, ip, recent } of sorted) {
    let q = queues.get(ip);
    if (!q) queues.set(ip, (q = []));
    while (q.length && t - q[0] >= widthMs) q.shift();
    if (q.length >= limit) {
      beyond += 1;
      if (recent) beyondRecent += 1;
    }
    q.push(t);
    top = Math.max(top, q.length);
  }
  return { top, beyond, beyondRecent };
}

/**
 * Caddyfile @vehicle_models of the L4 delivery (same rule as
 * vehicle-models-route-probe.mjs): GET or HEAD, one four-digit year.
 */
export function vehicleModelsEligible(method, uri) {
  if (method !== "GET" && method !== "HEAD") return false;
  let u;
  try {
    u = new URL(uri, "http://local");
  } catch {
    return false;
  }
  if (!/^\/api\/vehicles\/brands\/[^/]+\/models\/?$/.test(u.pathname)) return false;
  const years = u.searchParams.getAll("year");
  return (
    years.length === 1 &&
    /^[1-9][0-9][0-9][0-9]$/.test(years[0]) &&
    u.search.slice(1).split("&").length <= 1000
  );
}

export function createAccessAccumulator(cutoffMs) {
  const payments = new Map();
  const route = { durations: [], s421: 0, s429: 0, s5xx: 0, upstreams: { rust: 0, other: 0, none: 0 } };
  const state = { firstMs: Infinity, lastMs: -Infinity, unreadable: 0 };
  return {
    addLine(line) {
      if (!line) return;
      const e = parseAccessLine(line);
      if (!e) {
        state.unreadable += 1;
        return;
      }
      state.firstMs = Math.min(state.firstMs, e.tsMs);
      state.lastMs = Math.max(state.lastMs, e.tsMs);
      const recent = e.tsMs >= cutoffMs;
      if (PAYMENT_ROUTES.includes(e.path)) {
        const key = `${e.method} ${e.path}`;
        let p = payments.get(key);
        if (!p) {
          p = { s429: 0, s5xx: 0, s429Recent: 0, s5xxRecent: 0, arrivals: [] };
          payments.set(key, p);
        }
        if (e.status === 429) {
          p.s429 += 1;
          if (recent) p.s429Recent += 1;
        }
        if (e.status >= 500) {
          p.s5xx += 1;
          if (recent) p.s5xxRecent += 1;
        }
        p.arrivals.push({ t: e.arrivalMs, ip: e.ip, recent });
      } else if (recent && vehicleModelsEligible(e.method, e.uri)) {
        route.durations.push(e.duration * 1000);
        if (e.status === 421) route.s421 += 1;
        if (e.status === 429) route.s429 += 1;
        if (e.status >= 500) route.s5xx += 1;
        if (e.upstream === undefined) route.upstreams.none += 1;
        else if (e.upstream === RUST_UPSTREAM) route.upstreams.rust += 1;
        else route.upstreams.other += 1;
      }
    },
    result: () => ({ payments, route, ...state }),
  };
}

/** Nearest-rank percentile of an ascending array. */
export function percentile(sorted, p) {
  if (!sorted.length) return undefined;
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

const minute = (ms) => new Date(ms).toISOString().slice(0, 16);
const ms = (v) => `${v < 10 ? v.toFixed(1) : Math.round(v)} ms`;

export function judgePayments(acc, windowHours) {
  const lines = [];
  let verdict = "OK";
  if (!Number.isFinite(acc.firstMs)) {
    return { verdict: "non vérifié", lines: ["Paiement : non vérifié (aucune ligne lisible dans le journal de Caddy)"] };
  }
  lines.push(`Paiement : période couverte ${minute(acc.firstMs)} → ${minute(acc.lastMs)} (UTC) ; lignes illisibles ${acc.unreadable}`);
  const shown = SHOWN.map(([path, method]) => `${method} ${path}`);
  const keys = [...shown, ...[...acc.payments.keys()].filter((k) => !shown.includes(k)).sort()];
  for (const key of keys) {
    const p = acc.payments.get(key);
    if (!p) {
      lines.push(`  ${key} : absent`);
      continue;
    }
    const recentAlert = p.s429Recent > 0 || p.s5xxRecent > 0;
    if (recentAlert) verdict = "ALERTE";
    const tiers = TIERS.map(({ limit, widthMs, label }) => {
      const w = slidingWindows(p.arrivals, limit, widthMs);
      return `max d'une adresse en ${label.split("/")[1]} ${w.top}, au-delà de ${label} ${w.beyond} (${w.beyondRecent} sur ${windowHours} h)`;
    });
    lines.push(
      `  ${recentAlert ? "ALERTE" : "OK"} ${key} : utilisé ; 429 ${p.s429} (${p.s429Recent} sur ${windowHours} h) ; ` +
        `5xx ${p.s5xx} (${p.s5xxRecent} sur ${windowHours} h) ; ${tiers.join(" ; ")}`,
    );
  }
  return { verdict, lines };
}

export function judgeRoute(route, windowHours) {
  const n = route.durations.length;
  if (!n) return { verdict: "absent", lines: [`Route R2 : absent (aucune requête éligible sur ${windowHours} h)`] };
  const sorted = Float64Array.from(route.durations).sort();
  const alert = route.s421 > 0 || route.s5xx > 0;
  const rust =
    route.upstreams.none === n
      ? "amont non journalisé (Caddy sans log_append upstream)"
      : `servies par Rust ${Math.round((100 * route.upstreams.rust) / n)} %` +
        (route.upstreams.none ? `, amont non journalisé ${Math.round((100 * route.upstreams.none) / n)} %` : "");
  return {
    verdict: alert ? "ALERTE" : "OK",
    lines: [
      `Route R2 (GET /api/vehicles/brands/:brandId/models?year=…, ${windowHours} h) : ${alert ? "ALERTE" : "OK"} ; ` +
        `latence p50 ${ms(percentile(sorted, 0.5))}, p95 ${ms(percentile(sorted, 0.95))}, p99 ${ms(percentile(sorted, 0.99))} ; ` +
        `421 ${route.s421} ; 429 ${route.s429} ; 5xx ${route.s5xx} ; ${rust}`,
    ],
  };
}

/** First "Compteurs sur host:port/db (source)" line, or undefined. */
export function parseCounterTarget(line) {
  const m = /Compteurs sur ([^\s:]+):(\d+)\/(\d+) \(([A-Z_]+)\)/.exec(line);
  return m ? { host: m[1], port: Number(m[2]), db: Number(m[3]), source: m[4] } : undefined;
}

export function parseRedisInfo(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^(used_memory|maxmemory|maxmemory_policy):(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[1] === "maxmemory_policy" ? m[2] : Number(m[2]);
  }
  return out;
}

const mib = (b) => `${(b / 1024 / 1024).toFixed(1)} Mio`;

/** Worst first: ALERTE, then "non vérifié"; the others do not fail the run. */
export function overall(verdicts) {
  if (verdicts.includes("ALERTE")) return "ALERTE";
  if (verdicts.includes("non vérifié")) return "non vérifié";
  return "OK";
}

/**
 * throttler: { state: "none" | "inconnu" } | { name, state, restarts, info? }
 * (info = parsed INFO memory); target: parsed startup line or undefined;
 * startupRead: whether the startup log was read; errors undefined = not read.
 */
export function judgeLimiter(name, service, { throttler, target, startupRead, errors, recoveries }, windowHours) {
  if (throttler.state === "none") {
    if (target) {
      return { verdict: "ALERTE", lines: [`Limiteur ${name} : ALERTE ${service} absent alors que le backend journalise une destination`] };
    }
    if (!startupRead) {
      return { verdict: "non vérifié", lines: [`Limiteur ${name} : non vérifié (journal de démarrage du backend illisible)`] };
    }
    return { verdict: "non déployé", lines: [`Limiteur ${name} : non déployé (${service} jamais créé, compteurs dans chaque processus)`] };
  }
  const lines = [];
  const verdicts = [];
  const note = (verdict, line) => {
    verdicts.push(verdict);
    lines.push(line);
  };
  if (throttler.state === "inconnu") {
    note("non vérifié", `Limiteur ${name} : ${service} non vérifié (docker ps en erreur)`);
  } else if (throttler.state !== "running") {
    note("ALERTE", `Limiteur ${name} : ALERTE ${service} créé mais à l'état « ${throttler.state} »`);
  } else {
    const { used_memory: used, maxmemory: max, maxmemory_policy: policy } = throttler.info ?? {};
    if (!Number.isFinite(used) || !Number.isFinite(max) || !policy) {
      note("non vérifié", `Limiteur ${name} : ${service} en marche ; INFO memory non vérifié`);
    } else {
      const bad = policy !== "noeviction" || used > THROTTLER_USED_MEMORY_SIGNAL;
      note(
        bad ? "ALERTE" : "OK",
        `Limiteur ${name} : ${bad ? "ALERTE" : "OK"} ${service} en marche, ${throttler.restarts} redémarrage(s) ; ` +
          `used_memory ${mib(used)} (signal au-delà de ${mib(THROTTLER_USED_MEMORY_SIGNAL)}) ; maxmemory ${mib(max)} ; politique ${policy}`,
      );
    }
  }
  if (!startupRead) {
    note("non vérifié", "  destination des compteurs : non vérifiée (journal de démarrage illisible)");
  } else if (!target) {
    note("non vérifié", "  destination des compteurs : non vérifiée (aucune ligne « Compteurs sur » depuis le démarrage)");
  } else if (target.host === service && target.source === "THROTTLER_REDIS_URL") {
    note("OK", `  destination des compteurs : OK (${service}, source THROTTLER_REDIS_URL)`);
  } else {
    note("ALERTE", `  destination des compteurs : ALERTE autre que ${service} (source ${target.source})`);
  }
  if (errors === undefined) {
    note("non vérifié", "  ERROR « budget non partagé » : non vérifié");
  } else {
    note(
      errors > 0 ? "ALERTE" : "OK",
      `  ${errors > 0 ? "ALERTE" : "OK"} ERROR « budget non partagé » sur ${windowHours} h : ${errors} ; retours à Redis : ${recoveries}`,
    );
  }
  return { verdict: overall(verdicts), lines };
}

/** Reads every site log file; returns how many look like one but were not read. */
async function readCaddyLogs(caddy, io, acc) {
  const listed = io
    .docker(["exec", caddy, "ls", "-1", CADDY_LOG_DIR])
    .split("\n")
    .map((s) => s.trim());
  const names = listed.filter((s) => LOG_FILE.test(s)).sort();
  for (const name of names) {
    await io.stream(["exec", caddy, "cat", `${CADDY_LOG_DIR}/${name}`], (line) => acc.addLine(line), {
      gunzip: name.endsWith(".gz"),
    });
  }
  return listed.filter((s) => s.startsWith("automecanik") && !LOG_FILE.test(s)).length;
}

async function observeLimiter(target, io, windowHours) {
  const tryDocker = (args) => {
    try {
      return io.docker(args).trim();
    } catch {
      return undefined;
    }
  };
  const backend = tryDocker(["ps", "-a", "--filter", `name=^${target.backend}$`, "--format", '{{.Names}}\t{{.Label "com.docker.compose.project"}}']);
  const facts = { throttler: { state: "none" }, startupRead: false, target: undefined };
  if (!backend) return { facts, missingBackend: true };
  // The limiter Redis of the same compose project: PROD and PREPROD share the host.
  const project = backend.split("\n")[0].split("\t")[1];
  const ps = tryDocker([
    "ps", "-a",
    ...(project ? ["--filter", `label=com.docker.compose.project=${project}`] : []),
    "--filter", `label=com.docker.compose.service=${target.throttlerService}`,
    "--format", "{{.Names}}\t{{.State}}",
  ]);
  const row = ps?.split("\n").find(Boolean);
  if (ps === undefined) facts.throttler = { state: "inconnu" };
  else if (row) {
    const [name, state] = row.split("\t");
    const restarts = tryDocker(["inspect", "--format", "{{.RestartCount}}", name]);
    facts.throttler = { name, state, restarts: restarts ?? "?" };
    if (state === "running") {
      const info = tryDocker(["exec", name, "redis-cli", "info", "memory"]);
      if (info !== undefined) facts.throttler.info = parseRedisInfo(info);
    }
  }
  const startedAt = tryDocker(["inspect", "--format", "{{.State.StartedAt}}", target.backend]);
  if (startedAt) {
    try {
      await io.stream(["logs", "--since", startedAt, target.backend], (line) => {
        facts.target = parseCounterTarget(line);
        return facts.target !== undefined;
      });
      facts.startupRead = true;
    } catch {
      facts.startupRead = false;
    }
  }
  try {
    let errors = 0;
    let recoveries = 0;
    await io.stream(["logs", "--since", `${windowHours}h`, target.backend], (line) => {
      if (line.includes("budget non partagé")) errors += 1;
      else if (line.includes("budget partagé rétabli")) recoveries += 1;
    });
    Object.assign(facts, { errors, recoveries });
  } catch {
    // errors stays undefined: "non vérifié".
  }
  return { facts, missingBackend: false };
}

function observeMemory(names, io) {
  // Without names, docker stats would list every container of the host.
  if (!names.length) return { verdict: "non vérifié", lines: ["Mémoire : non vérifiée (aucun conteneur trouvé)"] };
  let stats;
  try {
    stats = io.docker(["stats", "--no-stream", "--format", "{{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}", ...names]);
  } catch {
    return { verdict: "non vérifié", lines: ["Mémoire : non vérifiée (docker stats en erreur)"] };
  }
  const lines = ["Mémoire :"];
  for (const row of stats.split("\n").filter(Boolean)) {
    const [name, usage, perc] = row.split("\t");
    lines.push(`  ${name} ${usage} (${perc})`);
  }
  return { verdict: "OK", lines };
}

/** Builds the report; io ={ docker(args) → stdout, stream(args, onLine, opts) → Promise, now() }. */
export async function runReport(config, io) {
  const lines = [];
  const verdicts = [];
  const cutoffMs = io.now() - config.windowHours * 3_600_000;

  const acc = createAccessAccumulator(cutoffMs);
  let accessRead = true;
  let unexpected = 0;
  try {
    unexpected = await readCaddyLogs(config.caddy, io, acc);
  } catch {
    accessRead = false;
  }
  if (accessRead) {
    const payments = judgePayments(acc.result(), config.windowHours);
    const route = judgeRoute(acc.result().route, config.windowHours);
    verdicts.push(payments.verdict, route.verdict);
    lines.push(...payments.lines, ...route.lines);
    // A rotation naming change must not shrink the period silently.
    if (unexpected) {
      verdicts.push("non vérifié");
      lines.push(`Paiement et route R2 : non vérifiés (${unexpected} fichier(s) de journal au nom inattendu, non lus)`);
    }
  } else {
    verdicts.push("non vérifié");
    lines.push("Paiement et route R2 : non vérifiés (journal de Caddy illisible)");
  }

  const running = [];
  for (const target of config.targets) {
    const { facts, missingBackend } = await observeLimiter(target, io, config.windowHours);
    if (missingBackend) {
      verdicts.push("non vérifié");
      lines.push(`Limiteur ${target.name} : non vérifié (conteneur ${target.backend} introuvable)`);
      continue;
    }
    const limiter = judgeLimiter(target.name, target.throttlerService, facts, config.windowHours);
    verdicts.push(limiter.verdict);
    lines.push(...limiter.lines);
    running.push(target.backend);
    if (facts.throttler.state === "running") running.push(facts.throttler.name);
  }
  for (const target of config.targets) {
    try {
      if (io.docker(["ps", "--filter", `name=^${target.rust}$`, "--format", "{{.Names}}"]).trim()) running.push(target.rust);
    } catch {
      // A failed lookup leaves the Rust line out of the memory section.
    }
  }
  const memory = observeMemory(running, io);
  verdicts.push(memory.verdict);
  lines.push(...memory.lines);

  const verdict = overall(verdicts);
  lines.push(`Verdict : ${verdict}`);
  return { verdict, lines };
}

function docker(args) {
  const r = spawnSync("docker", args, { encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  if (r.error) throw r.error;
  // Never echo docker's output: an exec error could carry configuration.
  if (r.status !== 0) throw new Error(`docker ${args[0]} exited with ${r.status}`);
  return r.stdout;
}

/**
 * Streams the output of `bin args` line by line, in bounded memory; `docker
 * logs` replays the container's stderr on its own stderr, so both are read
 * then. onLine returning true stops the read early (the process is killed).
 */
export function dockerStream(args, onLine, { gunzip = false, bin = "docker" } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    const sources = [gunzip ? child.stdout.pipe(createGunzip()) : child.stdout];
    if (args[0] === "logs") sources.push(child.stderr);
    else child.stderr.resume();
    let stopped = false;
    let failed;
    let open = sources.length + 1;
    const settle = () => {
      if (--open > 0) return;
      if (failed) reject(failed);
      else resolvePromise();
    };
    for (const source of sources) {
      const rl = createInterface({ input: source, crlfDelay: Infinity });
      source.on("error", (err) => {
        if (!stopped) failed ??= new Error(`docker ${args[0]}: ${err.code ?? "stream error"}`);
        rl.close();
      });
      rl.on("error", () => {});
      rl.on("line", (line) => {
        if (stopped) return;
        if (onLine(line) === true) {
          stopped = true;
          child.kill();
        }
      });
      rl.on("close", settle);
    }
    child.on("error", (err) => {
      failed ??= err;
    });
    child.on("close", (code) => {
      if (!stopped && code !== 0) failed ??= new Error(`docker ${args[0]} exited with ${code}`);
      settle();
    });
  });
}

async function main() {
  const env = process.env;
  const windowHours = Number(env.PO_WINDOW_HOURS || DEFAULT_WINDOW_HOURS);
  if (!Number.isInteger(windowHours) || windowHours < 1) throw new Error("PO_WINDOW_HOURS must be a positive integer");
  const { verdict, lines } = await runReport(
    { caddy: env.PO_CADDY_CONTAINER || "nestjs-remix-caddy", targets: TARGETS, windowHours },
    { docker, stream: dockerStream, now: () => Date.now() },
  );
  for (const line of lines) console.log(line);
  if (verdict !== "OK") {
    console.log(`::error::prod observation: ${verdict}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`::error::prod observation: ${error.message}`);
    process.exitCode = 1;
  });
}
