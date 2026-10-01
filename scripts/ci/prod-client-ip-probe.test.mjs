import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { assertCaddyConfig, probeRateLimit } from "./prod-client-ip-probe.mjs";

function applicationProxy() {
  return {
    handler: "reverse_proxy",
    upstreams: [{ dial: "monorepo_prod:3000" }],
    headers: {
      request: {
        set: Object.fromEntries(
          ["Cf-Connecting-Ip", "X-Forwarded-For", "X-Real-Ip"].map((header) => [
            header,
            ["{http.vars.client_ip}"],
          ]),
        ),
      },
    },
  };
}

// As `caddy adapt` emits `handle @observability { respond 404 }`.
function observabilityNotFound(group) {
  return {
    ...(group === undefined ? {} : { group }),
    match: [{ path: ["/api/observability", "/api/observability/*"] }],
    handle: [
      {
        handler: "subroute",
        routes: [
          { handle: [{ handler: "static_response", status_code: 404 }] },
        ],
      },
    ],
  };
}

test("Caddy proof requires both the exact Git file and explicit client IP source", () => {
  const bytes = Buffer.from("candidate");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const adapted = {
    apps: {
      http: {
        servers: {
          srv0: {
            client_ip_headers: ["Cf-Connecting-Ip"],
            routes: [observabilityNotFound(), { handle: [applicationProxy()] }],
          },
        },
      },
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

test("Caddy proof rejects any application route that forwards a forged client identity", () => {
  const bytes = Buffer.from("candidate");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const config = (handle) => ({
    apps: {
      http: {
        servers: {
          srv0: {
            client_ip_headers: ["Cf-Connecting-Ip"],
            routes: [observabilityNotFound(), { handle }],
          },
        },
      },
    },
  });
  for (const header of ["Cf-Connecting-Ip", "X-Forwarded-For", "X-Real-Ip"]) {
    for (const value of [
      undefined,
      ["{http.request.header.Cf-Connecting-Ip}"],
      ["{http.request.remote.host}"],
    ]) {
      const unsafe = applicationProxy();
      unsafe.headers.request.set[header] = value;
      assert.throws(
        () =>
          assertCaddyConfig(
            bytes,
            hash,
            config([
              applicationProxy(),
              { handler: "subroute", routes: [{ handle: [unsafe] }] },
            ]),
          ),
        /normalize all three/,
      );
    }
  }
  assert.throws(
    () => assertCaddyConfig(bytes, hash, config([])),
    /normalize all three/,
  );
});

test("Caddy proof requires a 404 for /api/observability/* ahead of every application proxy", () => {
  const bytes = Buffer.from("candidate");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const servers = (routes, errors) => ({
    apps: {
      http: {
        servers: {
          srv0: {
            client_ip_headers: ["Cf-Connecting-Ip"],
            routes,
            ...(errors ? { errors: { routes: errors } } : {}),
          },
        },
      },
    },
  });
  // Shaped like the adapted Caddyfile: host route, subroute, handle group.
  const site = (...routes) => ({
    match: [{ host: ["www.example.test"] }],
    handle: [{ handler: "subroute", routes }],
    terminal: true,
  });
  const proxied = (match, group) => ({
    ...(group === undefined ? {} : { group }),
    match,
    handle: [
      { handler: "subroute", routes: [{ handle: [applicationProxy()] }] },
    ],
  });
  const assets = proxied([{ path: ["/build/*"] }], "group1");
  const privateRoutes = proxied([{ path: ["/api/*"] }], "group1");
  const fallback = { handle: [applicationProxy()] };
  const variant = (change) => {
    const route = observabilityNotFound("group1");
    change(route);
    return servers([site(route, assets, privateRoutes, fallback)]);
  };

  for (const adapted of [
    servers([
      site(observabilityNotFound("group1"), assets, privateRoutes, fallback),
    ]),
    servers([site(observabilityNotFound(), assets, privateRoutes, fallback)]),
    // `respond @observability 404`
    servers([
      site(
        {
          match: [{ path: ["/api/observability", "/api/observability/*"] }],
          handle: [{ handler: "static_response", status_code: 404 }],
        },
        fallback,
      ),
    ]),
    // Error routes never run for that path: a static 404 is not an error.
    servers(
      [site(observabilityNotFound("group1"), privateRoutes, fallback)],
      [{ handle: [applicationProxy()] }],
    ),
  ]) {
    assert.equal(assertCaddyConfig(bytes, hash, adapted), hash);
  }

  for (const [adapted, error] of [
    [servers([site(assets, privateRoutes, fallback)]), /found 0/],
    [
      servers([
        site(observabilityNotFound(), observabilityNotFound(), fallback),
      ]),
      /found 2/,
    ],
    [
      variant((route) => {
        route.handle[0].routes[0].handle[0].status_code = 403;
      }),
      /found 0/,
    ],
    [
      variant((route) => {
        route.handle[0].routes[0].handle[0].body = "Not found";
      }),
      /found 0/,
    ],
    [
      variant((route) => {
        route.handle[0].routes[0].handle.unshift({
          handler: "headers",
          response: { set: { "Cache-Control": ["no-store"] } },
        });
      }),
      /found 0/,
    ],
    [
      variant((route) => {
        route.match = [{ path: ["/api/observability/*"] }];
      }),
      /found 0/,
    ],
    [
      variant((route) => {
        route.match[0].method = ["GET"];
      }),
      /found 0/,
    ],
    [
      variant((route) => {
        route.handle[0].routes[0].match = [
          { path: ["/api/observability/metrics"] },
        ];
      }),
      /found 0/,
    ],
    [
      servers([
        site(
          {
            group: "group1",
            match: [{ path: ["/sitemaps/*"] }],
            handle: [{ handler: "file_server" }],
          },
          observabilityNotFound("group1"),
          fallback,
        ),
      ]),
      /first in its handle group/,
    ],
    [
      servers([
        site(assets, privateRoutes, observabilityNotFound("group1"), fallback),
      ]),
      /first in its handle group/,
    ],
    [
      servers([
        site(
          proxied([{ path: ["/build/*"] }]),
          observabilityNotFound(),
          fallback,
        ),
      ]),
      /come after/,
    ],
    [servers([site(fallback, observabilityNotFound())]), /come after/],
    [
      servers([
        site(observabilityNotFound("group1"), fallback),
        {
          match: [{ host: ["other.example.test"] }],
          handle: [applicationProxy()],
        },
      ]),
      /come after/,
    ],
  ]) {
    assert.throws(() => assertCaddyConfig(bytes, hash, adapted), error);
  }
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
