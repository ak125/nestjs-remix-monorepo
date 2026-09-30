import { setTimeout } from "node:timers/promises";

function integer(headers, key) {
  const value = headers[key];
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error(`Missing or invalid rate-limit header: ${key}`);
  }
  return Number(value);
}

/**
 * Whole seconds of idle time that release every earlier hit of the burst tier.
 * Nest expires each hit one TTL after it arrived, so a request sent after this
 * idle time starts in an empty `short` window: it can only be throttled by its
 * own cost, never by how fast the requests before it returned. Callers pacing
 * real requests (shell smokes via the CLI below) take it from THROTTLER_TIERS.
 *
 * @param {Array<{name: string, ttl: number}>} tiers
 */
export function burstWindowSeconds(tiers) {
  const short = tiers.find(({ name }) => name === "short");
  if (!short || !Number.isSafeInteger(short.ttl) || short.ttl <= 0) {
    throw new Error("Rate-budget setup requires the configured numeric TTLs");
  }
  return Math.ceil(short.ttl / 1000);
}

/**
 * Admit an independent scenario using the real SSR bucket on the runner's IP.
 * Reserve 32 requests for navigation/loaders/prefetch. This is headroom, not an
 * exemption: an over-budget scenario still receives 429 and fails normally.
 * Never retry a scenario request or add latency inside its measured actions.
 * Missing limiter headers, unexpected HTTP errors and long exhaustion fail.
 *
 * @param {{ tiers: Array<{name: string, ttl: number}>,
 *   probe: () => Promise<{status: number, headers: Record<string, string>}>,
 *   sleep?: (ms: number) => Promise<unknown>, now?: () => number,
 *   log?: (message: string) => void, maxWaitMs?: number }} options
 */
export async function waitForRateBudget({
  tiers,
  probe,
  sleep = setTimeout,
  now = Date.now,
  log = console.log,
  maxWaitMs = 75_000,
}) {
  if (
    tiers.some(
      ({ name, ttl }) => !name || !Number.isSafeInteger(ttl) || ttl <= 0,
    )
  ) {
    throw new Error("Rate-budget setup requires the configured numeric TTLs");
  }
  const shortSeconds = burstWindowSeconds(tiers);
  const deadline = now() + maxWaitMs;
  for (;;) {
    const { status, headers } = await probe();
    let waitSeconds = 0;
    let ready = false;
    if (status === 429) {
      // Nest exposes the actual blocked tier. The HTML error filter's generic
      // Retry-After is always 60 and does not identify the exhausted window.
      const blocked = tiers
        .map(({ name }) => name)
        .filter((tier) => `retry-after-${tier}` in headers);
      if (!blocked.length)
        throw new Error("429 without a named retry-after tier");
      waitSeconds = Math.max(
        ...blocked.map((tier) => integer(headers, `retry-after-${tier}`)),
        1,
      );
    } else {
      if (status !== 200)
        throw new Error(`Rate-budget setup returned HTTP ${status}`);
      for (const { name: tier, ttl } of tiers) {
        const limit = integer(headers, `x-ratelimit-limit-${tier}`);
        const remaining = integer(headers, `x-ratelimit-remaining-${tier}`);
        integer(headers, `x-ratelimit-reset-${tier}`);
        if (limit < 2 || remaining >= limit) {
          throw new Error(`Invalid or bypassed rate-limit tier: ${tier}`);
        }
        // The setup request consumes one slot. Short is a burst window; the
        // scenario starts after it resets. Longer windows reserve navigation.
        const required = tier === "short" ? limit - 1 : Math.min(32, limit - 1);
        // Nest expires EACH hit after its own TTL. Reset describes the key's
        // older window boundary, not when all recent hits disappear. Waiting
        // that boundary can leave the bucket almost full for another window.
        // One configured TTL of idle time releases all preceding hits; source
        // these durations from THROTTLER_TIERS, never duplicate them here.
        if (remaining < required)
          waitSeconds = Math.max(waitSeconds, Math.ceil(ttl / 1000));
      }
      ready = waitSeconds === 0;
      if (ready) waitSeconds = shortSeconds;
    }
    const waitMs = waitSeconds * 1000;
    if (now() + waitMs > deadline) {
      throw new Error(
        `Rate-budget setup exceeds ${maxWaitMs}ms bound (wait ${waitSeconds}s)`,
      );
    }
    if (!ready)
      log(
        `E2E admission: waiting ${waitSeconds}s for the real SSR rate budget`,
      );
    await sleep(waitMs);
    if (ready) return;
  }
}

// Shell entry point for CI steps that pace real requests on the same policy:
//   node scripts/ci/preprod-e2e-rate-budget.mjs --burst-window-seconds
// prints burstWindowSeconds(THROTTLER_TIERS); Node 24 strips the config's types.
// No top-level await: Playwright fixtures import this module, and a module
// with top-level await cannot be loaded through require(esm).
if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] !== "--burst-window-seconds") {
    console.error("usage: preprod-e2e-rate-budget.mjs --burst-window-seconds");
    process.exit(2);
  }
  import("../../backend/src/config/throttler-tiers.config.ts").then(
    ({ THROTTLER_TIERS }) => console.log(burstWindowSeconds(THROTTLER_TIERS)),
  );
}
