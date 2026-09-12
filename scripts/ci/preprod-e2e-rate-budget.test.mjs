import assert from "node:assert/strict";
import { test } from "node:test";
import { waitForRateBudget } from "./preprod-e2e-rate-budget.mjs";

function response(overrides = {}) {
  const headers = {};
  for (const [tier, limit, reset] of [
    ["short", 15, 1],
    ["medium", 100, 60],
    ["long", 2000, 3600],
    ["payment_callback", 100, 60],
  ]) {
    headers[`x-ratelimit-limit-${tier}`] = String(limit);
    headers[`x-ratelimit-remaining-${tier}`] = String(limit - 1);
    headers[`x-ratelimit-reset-${tier}`] = String(reset);
  }
  return { status: 200, headers: { ...headers, ...overrides } };
}

function harness(responses) {
  let now = 0;
  let probes = 0;
  const waits = [];
  return {
    options: {
      probe: async () => {
        assert.ok(probes < responses.length, "unexpected setup request");
        return responses[probes++];
      },
      now: () => now,
      sleep: async (ms) => {
        waits.push(ms);
        now += ms;
      },
      log: () => {},
    },
    waits,
    probes: () => probes,
  };
}

test("ready budget resets only the short window before returning to the test", async () => {
  const h = harness([response()]);
  await waitForRateBudget(h.options);
  assert.deepEqual(h.waits, [1000]);
  assert.equal(h.probes(), 1);
});

test("near-exhausted minute budget waits for the server reset, then rechecks", async () => {
  const h = harness([
    response({
      "x-ratelimit-remaining-medium": "20",
      "x-ratelimit-reset-medium": "17",
    }),
    response(),
  ]);
  await waitForRateBudget(h.options);
  assert.deepEqual(h.waits, [17_000, 1000]);
});

test("all longer tiers participate, including the globally configured callback tier", async () => {
  const h = harness([
    response({
      "x-ratelimit-remaining-payment_callback": "31",
      "x-ratelimit-reset-payment_callback": "23",
    }),
    response(),
  ]);
  await waitForRateBudget(h.options);
  assert.deepEqual(h.waits, [23_000, 1000]);
});

test("setup 429 waits for the named tier rather than the generic error-page header", async () => {
  const h = harness([
    {
      status: 429,
      headers: { "retry-after-medium": "13", "retry-after": "60" },
    },
    response(),
  ]);
  await waitForRateBudget(h.options);
  assert.deepEqual(h.waits, [13_000, 1000]);
});

test("hourly exhaustion fails within the setup bound instead of sleeping for an hour", async () => {
  const h = harness([response({ "x-ratelimit-remaining-long": "20" })]);
  await assert.rejects(waitForRateBudget(h.options), /exceeds 75000ms bound/);
  assert.deepEqual(h.waits, []);
});

test("repeated competing traffic cannot make admission unbounded", async () => {
  const blocked = { status: 429, headers: { "retry-after-medium": "60" } };
  const h = harness([blocked, blocked]);
  await assert.rejects(waitForRateBudget(h.options), /exceeds 75000ms bound/);
  assert.deepEqual(h.waits, [60_000]);
});

for (const status of [301, 400, 500, 503]) {
  test(`HTTP ${status} is a failure, with no retry`, async () => {
    const h = harness([{ status, headers: {} }]);
    await assert.rejects(
      waitForRateBudget(h.options),
      new RegExp(`HTTP ${status}`),
    );
    assert.equal(h.probes(), 1);
    assert.deepEqual(h.waits, []);
  });
}

test("missing headers cannot silently pass an exempted client", async () => {
  const h = harness([{ status: 200, headers: {} }]);
  await assert.rejects(waitForRateBudget(h.options), /Missing or invalid/);
});

test("malformed limiter values fail instead of yielding a NaN wait", async () => {
  const h = harness([response({ "x-ratelimit-reset-medium": "NaN" })]);
  await assert.rejects(waitForRateBudget(h.options), /Missing or invalid/);
});

test("429 without a named window fails instead of hiding unknown throttling", async () => {
  const h = harness([{ status: 429, headers: { "retry-after": "60" } }]);
  await assert.rejects(waitForRateBudget(h.options), /without a named/);
});

test("transport failures propagate without a hidden retry", async () => {
  await assert.rejects(
    waitForRateBudget({
      probe: async () => {
        throw new Error("connection reset");
      },
    }),
    /connection reset/,
  );
});
