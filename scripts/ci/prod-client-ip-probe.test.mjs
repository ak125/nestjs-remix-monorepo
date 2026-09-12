import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { assertCaddyConfig, probeRateLimit } from "./prod-client-ip-probe.mjs";

test("Caddy proof requires both the exact Git file and explicit client IP source", () => {
  const bytes = Buffer.from("candidate");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const adapted = {
    apps: {
      http: { servers: { srv0: { client_ip_headers: ["Cf-Connecting-Ip"] } } },
    },
  };
  assert.equal(
    assertCaddyConfig(bytes, `${hash}  /etc/caddy/Caddyfile`, adapted),
    hash,
  );
  assert.throws(() => assertCaddyConfig(bytes, "wrong", adapted), /differs/);
  for (const headers of [
    undefined,
    ["X-Forwarded-For"],
    ["Cf-Connecting-Ip", "X-Forwarded-For"],
  ]) {
    assert.throws(
      () =>
        assertCaddyConfig(bytes, hash, {
          apps: { http: { servers: { srv0: { client_ip_headers: headers } } } },
        }),
      /must use only/,
    );
  }
  assert.throws(() => assertCaddyConfig(bytes, hash, {}), /must use only/);
});

function responses(values, status = 200, limit = "100") {
  return async () =>
    new Response("", {
      status,
      headers: {
        ...(limit === null ? {} : { "x-ratelimit-limit-medium": limit }),
        ...(values.length
          ? { "x-ratelimit-remaining-medium": values.shift() }
          : {}),
      },
    });
}

test("probe requires one shared bucket for both forwarded IP variations", async () => {
  const headers = [];
  const mock = responses(["99", "98"]);
  const result = await probeRateLimit(
    "http://test.invalid/",
    (url, options) => {
      headers.push(options.headers);
      return mock(url, options);
    },
  );
  assert.deepEqual(result, { requests: 2, limit: 100, remaining: [99, 98] });
  assert.notEqual(headers[0]["X-Forwarded-For"], headers[1]["X-Forwarded-For"]);
  assert.equal(headers[0]["CF-Connecting-IP"], headers[1]["CF-Connecting-IP"]);
});

test("probe rejects missing limiter headers, errors, invalid counters and changing buckets", async () => {
  for (const fake of [
    responses([], 200, null),
    responses(["99"], 500),
    responses(["99"], 200, "30"),
    responses(["bogus"]),
    responses(["100"]),
    responses(["99", "99"]),
    responses(["99", ""]),
  ]) {
    await assert.rejects(probeRateLimit("http://test.invalid/", fake));
  }
});
