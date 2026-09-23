import { setTimeout } from "node:timers/promises";

function integer(headers, key) {
  const value = headers[key];
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error(`Missing or invalid rate-limit header: ${key}`);
  }
  return Number(value);
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
  const short = tiers.find(({ name }) => name === "short");
  if (
    !short ||
    tiers.some(
      ({ name, ttl }) => !name || !Number.isSafeInteger(ttl) || ttl <= 0,
    )
  ) {
    throw new Error("Rate-budget setup requires the configured numeric TTLs");
  }
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
      if (ready) waitSeconds = Math.ceil(short.ttl / 1000);
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
