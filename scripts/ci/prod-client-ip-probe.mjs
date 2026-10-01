import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

// Kept self-contained: this exact function also runs inside the live app
// container, using its Node runtime, without copying files or installing tools.
export async function probeRateLimit(url, fetchRequest = fetch) {
  let previous;
  const remaining = [];
  for (const forged of ["127.0.0.1", "172.17.0.1"]) {
    const response = await fetchRequest(url, {
      headers: {
        "CF-Connecting-IP": "203.0.113.254",
        "X-Forwarded-For": forged,
        "User-Agent": "AutoMecanik-Deployment-Check",
      },
      signal: AbortSignal.timeout(15000),
    });
    await response.body?.cancel();
    const limit = response.headers.get("x-ratelimit-limit-medium");
    const value = response.headers.get("x-ratelimit-remaining-medium");
    if (!response.ok || limit !== "100" || !/^\d+$/.test(value ?? "")) {
      throw new Error(
        `Rate limiter missing or invalid: HTTP ${response.status}, limit=${limit}, remaining=${value}`,
      );
    }
    const current = Number(value);
    if (
      current >= 100 ||
      (previous !== undefined && current !== previous - 1)
    ) {
      throw new Error(
        "Forwarded IP variations did not consume the same rate-limit bucket",
      );
    }
    previous = current;
    remaining.push(current);
  }
  return { requests: 2, limit: 100, remaining };
}

const isApplicationProxy = (value) =>
  value.handler === "reverse_proxy" &&
  value.upstreams?.some((upstream) => upstream.dial === "monorepo_prod:3000");

// /api/observability/* is the Prometheus exposition, anonymous by design for
// the scraper that reaches the container on the internal network. The edge
// answers it itself, with a bare 404 (`handle @observability { respond 404 }`
// or `respond @observability 404`).
const OBSERVABILITY_MATCH = [
  { path: ["/api/observability", "/api/observability/*"] },
];
const NOT_FOUND = { handler: "static_response", status_code: 404 };
const isObservabilityRoute = (route) =>
  isDeepStrictEqual(route.match, OBSERVABILITY_MATCH) &&
  [
    [NOT_FOUND],
    [{ handler: "subroute", routes: [{ handle: [NOT_FOUND] }] }],
  ].some((handle) => isDeepStrictEqual(route.handle, handle));

// Route lists run in order, and a handle group runs only its first matching
// route: the 404 must lead its group and every application proxy of the
// server routes must live in a later route of the same list. Error routes
// never run for that path (a static 404 is a response, not an error).
function assertObservabilityNotServed(servers) {
  const found = [];
  const proxies = [];
  function visit(value, ancestry) {
    if (!value || typeof value !== "object") return;
    if (isApplicationProxy(value)) proxies.push(ancestry);
    for (const [key, child] of Object.entries(value)) {
      if (key === "routes" && Array.isArray(child)) {
        child.forEach((route, index) => {
          const step = { routes: child, index };
          if (isObservabilityRoute(route)) found.push(step);
          visit(route, [...ancestry, step]);
        });
      } else visit(child, ancestry);
    }
  }
  for (const server of servers) visit({ routes: server.routes }, []);
  if (found.length !== 1) {
    throw new Error(
      `Caddy must answer /api/observability/* with exactly one bare 404 route (found ${found.length})`,
    );
  }
  const [{ routes, index }] = found;
  const { group } = routes[index];
  if (
    group !== undefined &&
    routes.slice(0, index).some((route) => route.group === group)
  ) {
    throw new Error(
      "The /api/observability/* 404 must come first in its handle group",
    );
  }
  if (
    !proxies.every((ancestry) =>
      ancestry.some((step) => step.routes === routes && step.index > index),
    )
  ) {
    throw new Error(
      "Every application proxy must come after the /api/observability/* 404",
    );
  }
}

export function assertCaddyConfig(expectedBytes, runtimeHash, adapted) {
  const expectedHash = createHash("sha256").update(expectedBytes).digest("hex");
  if (runtimeHash.trim().split(/\s+/)[0] !== expectedHash) {
    throw new Error("Running Caddyfile differs from the deployed Git revision");
  }
  const servers = Object.values(adapted.apps?.http?.servers ?? {});
  if (
    !servers.length ||
    servers.some(
      (server) =>
        JSON.stringify(server.client_ip_headers) !==
        JSON.stringify(["Cf-Connecting-Ip"]),
    )
  ) {
    throw new Error("Caddy client_ip_headers must use only Cf-Connecting-Ip");
  }
  const proxies = [];
  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (isApplicationProxy(value)) proxies.push(value);
    for (const child of Object.values(value)) visit(child);
  }
  visit(adapted);
  if (
    !proxies.length ||
    proxies.some((proxy) =>
      ["Cf-Connecting-Ip", "X-Forwarded-For", "X-Real-Ip"].some(
        (header) =>
          JSON.stringify(proxy.headers?.request?.set?.[header]) !==
          JSON.stringify(["{http.vars.client_ip}"]),
      ),
    )
  ) {
    throw new Error(
      "Every application proxy must normalize all three client IP headers",
    );
  }
  assertObservabilityNotServed(servers);
  return expectedHash;
}

function main() {
  const docker = (args, input) =>
    execFileSync("docker", args, {
      encoding: "utf8",
      timeout: 60000,
      input,
      stdio: ["pipe", "pipe", "inherit"],
    });
  const caddy = ["exec", "nestjs-remix-caddy"];
  const runtimeHash = docker([...caddy, "sha256sum", "/etc/caddy/Caddyfile"]);
  const adapted = JSON.parse(
    docker([
      ...caddy,
      "caddy",
      "adapt",
      "--config",
      "/etc/caddy/Caddyfile",
      "--adapter",
      "caddyfile",
    ]),
  );
  const hash = assertCaddyConfig(
    readFileSync(new URL("../../config/caddy/Caddyfile", import.meta.url)),
    runtimeHash,
    adapted,
  );
  docker([
    ...caddy,
    "caddy",
    "validate",
    "--config",
    "/etc/caddy/Caddyfile",
    "--adapter",
    "caddyfile",
  ]);
  console.log(
    `Caddy configuration verified: sha256=${hash}; client source=CF-Connecting-IP; /api/observability/* answered 404 at the edge`,
  );
  const source = `(${probeRateLimit.toString()})('http://127.0.0.1:3000/api/catalog/families').then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });`;
  const result = docker(
    ["exec", "-i", "nestjs-remix-monorepo-prod", "node", "--input-type=module"],
    source,
  );
  console.log(`Live application rate-limit verification: ${result.trim()}`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
