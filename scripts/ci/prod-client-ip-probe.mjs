import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

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
    `Caddy configuration verified: sha256=${hash}; client source=CF-Connecting-IP`,
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
