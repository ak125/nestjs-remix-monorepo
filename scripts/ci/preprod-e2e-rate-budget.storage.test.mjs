import assert from "node:assert/strict";
import { test } from "node:test";
import { ThrottlerStorageService } from "@nestjs/throttler";
import { THROTTLER_TIERS } from "../../backend/src/config/throttler-tiers.config.ts";
import { waitForRateBudget } from "./preprod-e2e-rate-budget.mjs";

test("real Nest sliding counters recover within one configured TTL, independently of Reset", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
  const storage = new ThrottlerStorageService();
  t.after(() => storage.onApplicationShutdown());
  const medium = THROTTLER_TIERS.find(({ name }) => name === "medium");
  const hit = (tier) =>
    storage.increment(tier.name, tier.ttl, tier.limit, tier.ttl, tier.name);

  // Open a window, then generate recent traffic at five requests/second.
  // Reset reaches zero at t=60s, while most individual hits live until t=85–100s.
  await hit(medium);
  t.mock.timers.tick(25_000);
  for (let i = 0; i < 75; i++) {
    await hit(medium);
    t.mock.timers.tick(200);
  }
  const waits = [];
  const observations = [];
  await waitForRateBudget({
    tiers: THROTTLER_TIERS,
    probe: async () => {
      const headers = {};
      for (const tier of THROTTLER_TIERS) {
        const result = await hit(tier);
        assert.equal(
          result.isBlocked,
          false,
          "setup must not exhaust the real counter",
        );
        headers[`x-ratelimit-limit-${tier.name}`] = String(tier.limit);
        headers[`x-ratelimit-remaining-${tier.name}`] = String(
          tier.limit - result.totalHits,
        );
        headers[`x-ratelimit-reset-${tier.name}`] = String(result.timeToExpire);
      }
      observations.push(headers);
      return { status: 200, headers };
    },
    sleep: async (ms) => {
      waits.push(ms);
      t.mock.timers.tick(ms);
    },
    log: () => {},
  });
  assert.equal(observations[0]["x-ratelimit-reset-medium"], "20");
  assert.deepEqual(waits, [medium.ttl, 1000]);
  assert.equal(observations.length, 2);
  assert.equal(observations[1]["x-ratelimit-remaining-medium"], "99");
});
