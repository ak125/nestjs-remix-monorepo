"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  createGateway,
  planRequest,
  validateConfig,
} = require("./preprod-readonly-gateway.cjs");
const config = { url: "https://project.supabase.co", key: "anon-test-key" };
const response = (status = 200, text = '{"ok":true}', headers = {}) =>
  new Response(status === 302 ? null : text, { status, headers });
async function open(fetchImpl) {
  const server = createGateway({ config, fetchImpl });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
async function use(fetchImpl, fn) {
  const g = await open(fetchImpl);
  try {
    return await fn(g);
  } finally {
    await new Promise((r) => g.server.close(r));
  }
}
test("config is fixed to an https Supabase origin", () => {
  assert.throws(() =>
    validateConfig({ url: "http://x.supabase.co", key: "x" }),
  );
  assert.throws(() => validateConfig({ url: "https://evil.test", key: "x" }));
  assert.equal(validateConfig(config).origin, "https://project.supabase.co");
});
test("mutations are blocked before fetch", async () => {
  let calls = 0;
  await use(
    async () => {
      calls++;
      return response();
    },
    async ({ base }) => {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"])
        assert.equal(
          (
            await fetch(`${base}/rest/v1/blog`, {
              method,
              body: method === "POST" ? "{}" : undefined,
            })
          ).status,
          405,
        );
      assert.equal(calls, 0);
    },
  );
});
test("allowed POST RPC becomes encoded GET", async () => {
  let got;
  await use(
    async (url, init) => {
      got = { url, init };
      return response();
    },
    async ({ base }) =>
      assert.equal(
        (
          await fetch(`${base}/rest/v1/rpc/get_catalog`, {
            method: "POST",
            body: JSON.stringify({
              id: 42,
              ids: [1, "a,b"],
              filter: { ok: true },
            }),
          })
        ).status,
        200,
      ),
  );
  const u = new URL(got.url);
  assert.equal(got.init.method, "GET");
  assert.equal(u.searchParams.get("ids"), '{"1","a,b"}');
  assert.equal(u.searchParams.get("filter"), '{"ok":true}');
});
test("forged URL and forbidden services never fetch", async () => {
  let calls = 0;
  await use(
    async () => {
      calls++;
      return response();
    },
    async ({ base }) => {
      for (const path of [
        "//evil.test/rest/v1/a",
        "/auth/v1/token",
        "/storage/v1/object/a",
        "/rest/v1/%2e%2e/auth",
      ])
        assert.equal((await fetch(`${base}${path}`)).status, 405);
      assert.equal(calls, 0);
    },
  );
});
test("uses public profile and approved count only", async () => {
  let headers;
  await use(
    async (_, init) => {
      headers = init.headers;
      return response();
    },
    async ({ base }) =>
      fetch(`${base}/rest/v1/blog`, {
        headers: {
          Authorization: "Bearer forged",
          Prefer: "count=exact,return=representation",
          "X-App-Key": "forged",
        },
      }),
  );
  assert.equal(headers["Accept-Profile"], "public");
  assert.equal(headers.Prefer, "count=exact");
  assert.equal(headers.Authorization, "Bearer anon-test-key");
  assert.equal(headers["X-App-Key"], undefined);
});
test("redirects are refused and Location is never forwarded", async () => {
  await use(
    async () => response(302, "", { location: "https://evil.test" }),
    async ({ base }) => {
      const r = await fetch(`${base}/rest/v1/blog`);
      assert.equal(r.status, 502);
      assert.equal(r.headers.get("location"), null);
      assert.equal((await r.json()).code, "PREPROD_UPSTREAM_REDIRECT_REFUSED");
    },
  );
});
test("upstream failures and audit omit query payloads", async () => {
  await use(
    async () => {
      throw new TypeError("down");
    },
    async ({ base }) => {
      assert.equal(
        (await fetch(`${base}/rest/v1/blog?secret=not-recorded`)).status,
        502,
      );
      const audit = await (await fetch(`${base}/__audit`)).json();
      assert.equal(audit.errors, 1);
      assert.equal(audit.events[0].path, "/rest/v1/blog");
      assert.doesNotMatch(JSON.stringify(audit.events), /not-recorded/);
    },
  );
});
test("concurrency is capped at twelve with audit evidence", async () => {
  let release;
  const wait = new Promise((r) => (release = r));
  await use(
    async () => {
      await wait;
      return response();
    },
    async ({ base }) => {
      const pending = Array.from({ length: 12 }, () =>
        fetch(`${base}/rest/v1/blog`),
      );
      await new Promise((r) => setTimeout(r, 25));
      assert.equal((await fetch(`${base}/rest/v1/blog`)).status, 503);
      release();
      await Promise.all(pending);
      const audit = await (await fetch(`${base}/__audit`)).json();
      assert.equal(audit.reads, 12);
      assert.equal(audit.blocked, 1);
      assert.equal(audit.active, 0);
      assert.ok(audit.events.length <= 200);
      assert.equal(audit.upstreamMethods.GET, 12);
    },
  );
});
test("HEAD has no body and explicit RM read RPC is permitted", () => {
  const c = validateConfig(config);
  assert.equal(planRequest(c, "HEAD", "/rest/v1/blog", "").method, "HEAD");
  assert.equal(
    planRequest(c, "GET", "/rest/v1/rpc/rm_get_page_complete_v2", "").method,
    "GET",
  );
});

test("persistent gateway stays available after 4000 reads and bounds its audit ring", async () => {
  await use(
    async () => response(),
    async ({ base, server }) => {
      server.audit.reads = 4000;
      server.audit.events = Array.from({ length: 200 }, () => ({
        status: 200,
      }));
      assert.equal((await fetch(`${base}/rest/v1/blog`)).status, 200);
      assert.equal(server.audit.reads, 4001);
      assert.equal(server.audit.events.length, 200);
    },
  );
});

test("absolute URLs and mixed dot-segment traversals fail closed", () => {
  for (const raw of [
    "https://evil.test/rest/v1/blog",
    "/a/%2e./rest/v1/blog",
    "/a/.%2e/rest/v1/blog",
  ]) {
    assert.throws(() => planRequest(validateConfig(config), "GET", raw));
  }
});

test("HEAD response is forwarded without reading an upstream body", async () => {
  await use(
    async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-range": "0-0/42" }),
      arrayBuffer() {
        throw Error("HEAD body must not be read");
      },
    }),
    async ({ base }) => {
      const r = await fetch(`${base}/rest/v1/blog`, { method: "HEAD" });
      assert.equal(r.status, 200);
      assert.equal(await r.text(), "");
      assert.equal(r.headers.get("content-range"), "0-0/42");
    },
  );
});
