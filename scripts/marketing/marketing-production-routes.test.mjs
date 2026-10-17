// Run against an existing production build; session and API boundaries are synthetic.
// No application boot, real cookie, database, or external network is used.
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createRequestHandler, RouterContextProvider } from "react-router";

const originalFetch = globalThis.fetch;
const requests = [];
globalThis.fetch = async (input) => {
  const url = new URL(
    typeof input === "string" ? input : (input.url ?? String(input)),
  );
  assert.ok(
    ["127.0.0.1", "localhost"].includes(url.hostname),
    "Only the synthetic loopback API is admissible",
  );
  requests.push(url.pathname);
  return new Response(
    JSON.stringify({ success: true, data: {}, items: [], total: 0 }),
    { headers: { "Content-Type": "application/json" } },
  );
};
after(() => {
  globalThis.fetch = originalFetch;
});

const build = await import("../../frontend/build/server/index.js");
const expected = [
  "admin.marketing",
  "admin.marketing._index",
  "admin.marketing.backlinks",
  "admin.marketing.briefs",
  "admin.marketing.content-roadmap",
  "admin.marketing.social-hub.posts",
];
const makeContext = (user) =>
  build.entry.module.createAppLoadContext(
    {
      user,
      remixService: null,
      remixIntegration: null,
      cspNonce: "",
      serverObservability: null,
      remixApplicationPort: null,
    },
    () => new RouterContextProvider(),
  );
const admin = {
  id: "synthetic-admin",
  email: "admin@example.invalid",
  isAdmin: true,
  level: 7,
};
const member = {
  id: "synthetic-member",
  email: "member@example.invalid",
  level: 1,
};

test("production manifest includes only the selected protected marketing routes and preserves existing exceptions", () => {
  for (const name of expected)
    assert.ok(
      build.routes[`routes/${name}`],
      `Missing production route: ${name}`,
    );
  assert.ok(build.routes["routes/admin.video-hub"]);
  assert.ok(build.routes["routes/admin.command-center"]);
  const unexpected = Object.keys(build.routes).filter(
    (id) =>
      id.startsWith("routes/admin.") &&
      !expected.some((name) => id === `routes/${name}`) &&
      !id.startsWith("routes/admin.video-hub") &&
      id !== "routes/admin.command-center",
  );
  assert.deepEqual(unexpected, []);
});

for (const name of expected) {
  for (const [actor, destination] of [
    [null, "/login"],
    [member, "/unauthorized"],
  ]) {
    test(`built loader ${name} rejects ${actor ? "non-admin" : "anonymous"} before marketing API access`, async () => {
      const loader = build.routes[`routes/${name}`]?.module.loader;
      assert.equal(
        typeof loader,
        "function",
        `${name} needs a server loader guard`,
      );
      requests.length = 0;
      await assert.rejects(
        () =>
          loader({
            request: new Request("http://127.0.0.1/admin/marketing"),
            params: {},
            context: makeContext(actor),
          }),
        (error) =>
          error instanceof Response &&
          error.status === 302 &&
          error.headers.get("Location") === destination,
      );
      assert.equal(requests.length, 0);
    });
  }
}

const handler = createRequestHandler(build, "production");
for (const [actor, status, destination] of [
  [null, 302, "/login"],
  [member, 302, "/unauthorized"],
  [admin, 200, null],
]) {
  test(`production SSR marketing entry returns ${status} for ${actor?.id ?? "anonymous"}`, async () => {
    requests.length = 0;
    const response = await handler(
      new Request("http://127.0.0.1/admin/marketing", {
        headers: { "User-Agent": "marketing-contract-test" },
      }),
      makeContext(actor),
    );
    assert.equal(response.status, status);
    if (destination) {
      assert.equal(response.headers.get("Location"), destination);
      assert.ok(
        !requests.some((path) => path.startsWith("/api/admin/marketing")),
      );
    } else {
      assert.match(await response.text(), /Marketing/);
      assert.ok(
        requests.some((path) => path === "/api/admin/marketing/dashboard"),
      );
    }
  });
}
