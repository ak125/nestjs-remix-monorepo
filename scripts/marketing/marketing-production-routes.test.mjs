// Run against an existing production build; session and API boundaries are synthetic.
// No application boot, real cookie, database, or external network is used.
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createRequestHandler, RouterContextProvider } from "react-router";

const originalFetch = globalThis.fetch;
const requests = [];
let briefStatus = 200;
const briefId = "56a0c18a-3b41-48fb-9879-6ae4bd5e349a";
const stamp = "2026-10-14T10:00:00.123456+00:00";
let detail = {
  id: briefId,
  agent_id: "lead",
  business_unit: "ECOMMERCE",
  channel: "social_facebook",
  conversion_goal: "ORDER",
  cta: "Consulter les plaquettes compatibles",
  target_segment: "automobilistes",
  status: "draft",
  brand_gate_level: "PASS",
  compliance_gate_level: "WARN",
  payload: { caption: "Texte de test" },
  coverage_manifest: { final_status: "REVIEW_REQUIRED" },
  gate_summary: { can_approve: true, blocking_issues: [] },
  created_at: stamp,
  updated_at: stamp,
  reviewed_by: null,
  reviewed_at: null,
  approved_by: null,
  approved_at: null,
  published_at: null,
  social_post_id: null,
};
const decisions = [];
let socialStatus = 200;
let socialPost = {
  id: 7,
  week_iso: "2026-W42",
  day_of_week: 1,
  slot_label: "conseil",
  primary_channel: "facebook",
  channels_list: ["facebook"],
  channels: {
    facebook: {
      caption: "Contenu social à raccorder",
      hashtags: [],
      format: "post",
    },
  },
  status: "generated",
  content_revision: 2,
  review_version: 4,
  channel_reviews: {},
  source_brief: null,
};
globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" ? input : (input.url ?? String(input)),
  );
  assert.ok(
    ["127.0.0.1", "localhost"].includes(url.hostname),
    "Only the synthetic loopback API is admissible",
  );
  requests.push(url.pathname);
  if (
    url.pathname === "/api/admin/marketing/social/posts/7" &&
    socialStatus === 0
  )
    throw new Error("Synthetic transport failure");
  if (url.pathname === "/api/admin/marketing/social/posts/7")
    return Response.json({ data: socialPost }, { status: socialStatus });
  if (url.pathname === "/api/admin/marketing/social/posts")
    return Response.json({ data: [socialPost], total: 1 });
  if (
    url.pathname === `/api/admin/marketing/briefs/${briefId}/social-content`
  ) {
    assert.equal(init.method, "POST");
    assert.equal(
      new Headers(init.headers).get("Cookie"),
      "synthetic-session=fixture",
    );
    assert.deepEqual(JSON.parse(init.body), {
      post_id: 7,
      expected_updated_at: detail.updated_at,
      content_revision: 2,
      review_version: 4,
    });
    socialPost = {
      ...socialPost,
      content_revision: 3,
      review_version: 5,
      source_brief: {
        brief: { ...detail },
        linked_by: "synthetic-admin",
        linked_at: stamp,
        linked_content_revision: 3,
      },
    };
    detail = { ...detail, social_post_id: 7 };
    return Response.json({ success: true, data: socialPost }, { status: 201 });
  }
  if (url.pathname === `/api/admin/marketing/briefs/${briefId}/status`) {
    assert.equal(init.method, "PATCH");
    const body = JSON.parse(init.body);
    decisions.push({ body, cookie: new Headers(init.headers).get("Cookie") });
    assert.deepEqual(body, { status: "reviewed", expected_updated_at: stamp });
    detail = {
      ...detail,
      status: "reviewed",
      reviewed_by: "synthetic-admin",
      reviewed_at: stamp,
      updated_at: "2026-10-14T12:00:00Z",
    };
    return Response.json({ success: true, data: detail });
  }
  if (url.pathname === `/api/admin/marketing/briefs/${briefId}`) {
    return Response.json({
      success: true,
      data: detail,
      review: {
        allowed_actions: [
          detail.status === "draft" ? "reviewed" : "approved",
          "archived",
        ],
        blocked_reason: null,
      },
    });
  }
  if (url.pathname === "/api/admin/marketing/briefs") {
    return new Response(
      JSON.stringify(
        briefStatus === 200
          ? { success: true, data: { items: [], total: 0, page: 1, limit: 50 } }
          : { message: "private fixture detail" },
      ),
      {
        status: briefStatus,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
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
  "admin.marketing.briefs_.$id",
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
test("production detail renders inside Marketing, independently of the list layout", async () => {
  const route = build.routes["routes/admin.marketing.briefs_.$id"];
  assert.equal(route.parentId, "routes/admin.marketing");
  const response = await handler(
    new Request(`http://127.0.0.1/admin/marketing/briefs/${briefId}`),
    makeContext(admin),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const html = await response.text();
  assert.match(html, /Consulter les plaquettes compatibles/);
  assert.match(html, /Marquer comme revu/);
  assert.doesNotMatch(html, /Aucun brief pour ce filtre/);
});
test("production detail action forwards the displayed version and SSR reads back the decision", async () => {
  const response = await handler(
    new Request(`http://127.0.0.1/admin/marketing/briefs/${briefId}`, {
      method: "POST",
      headers: {
        Origin: "http://127.0.0.1",
        Cookie: "synthetic-session=fixture",
      },
      body: new URLSearchParams({
        status: "reviewed",
        expected_updated_at: stamp,
      }),
    }),
    makeContext(admin),
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Décision enregistrée/);
  assert.match(html, /Approuver le brief/);
  assert.match(html, /synthetic-admin/);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].cookie, "synthetic-session=fixture");
});
for (const actor of [null, member]) {
  test(`built detail action rejects ${actor ? "non-admin" : "anonymous"} before API access`, async () => {
    requests.length = 0;
    await assert.rejects(
      () =>
        build.routes["routes/admin.marketing.briefs_.$id"].module.action({
          request: new Request(
            `http://127.0.0.1/admin/marketing/briefs/${briefId}`,
            { method: "POST" },
          ),
          params: { id: briefId },
          context: makeContext(actor),
        }),
      (error) => error instanceof Response && error.status === 302,
    );
    assert.equal(requests.length, 0);
  });
}
for (const apiStatus of [200, 500]) {
  test(`production briefs SSR distinguishes API ${apiStatus} from an empty result`, async () => {
    briefStatus = apiStatus;
    try {
      const request = new Request("http://127.0.0.1/admin/marketing/briefs");
      const result = await build.routes[
        "routes/admin.marketing.briefs"
      ].module.loader({ request, params: {}, context: makeContext(admin) });
      assert.equal(result.total, apiStatus === 200 ? 0 : null);
      const response = await handler(request, makeContext(admin));
      assert.equal(response.status, 200);
      const html = await response.text();
      if (apiStatus === 200) assert.match(html, /Aucun brief pour ce filtre/);
      else {
        assert.match(html, /Données des briefs indisponibles/);
        assert.doesNotMatch(
          html,
          /Aucun brief pour ce filtre|private fixture detail/,
        );
      }
      assert.doesNotMatch(html, /Phase 1\.5/);
    } finally {
      briefStatus = 200;
    }
  });
}
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

test("built approved brief form selects existing version and redirects to its Social Hub review", async () => {
  const original = { ...detail };
  try {
    detail = {
      ...detail,
      status: "approved",
      approved_by: "owner",
      approved_at: stamp,
    };
    const url = `http://127.0.0.1/admin/marketing/briefs/${briefId}`;
    const view = await handler(
      new Request(`${url}?week=2026-W42`),
      makeContext(admin),
    );
    assert.equal(view.status, 200);
    const html = await view.text();
    assert.match(html, /Raccorder le contenu/);
    assert.match(html, /Contenu social à raccorder/);
    const result = await handler(
      new Request(url, {
        method: "POST",
        headers: {
          Origin: "http://127.0.0.1",
          Cookie: "synthetic-session=fixture",
        },
        body: new URLSearchParams({
          intent: "link-social",
          post_id: "7",
          expected_updated_at: detail.updated_at,
          content_revision: "2",
          review_version: "4",
        }),
      }),
      makeContext(admin),
    );
    assert.equal(result.status, 302);
    assert.equal(
      result.headers.get("Location"),
      "/admin/marketing/social-hub/posts?week=2026-W42&post_id=7",
    );
    const read = await handler(new Request(url), makeContext(admin));
    assert.match(await read.text(), /social-hub\/posts\?post_id=7/);
  } finally {
    detail = original;
  }
});
test("built Social Hub resolves linked ID to its actual week and opens exact current version", async () => {
  const loader =
    build.routes["routes/admin.marketing.social-hub.posts"].module.loader;
  const call = (query) =>
    loader({
      request: new Request(
        `http://127.0.0.1/admin/marketing/social-hub/posts?${query}`,
      ),
      context: makeContext(admin),
      params: {},
    });
  const redirect = await call("post_id=7&week=2025-W01&status=published");
  assert.equal(redirect.status, 302);
  assert.equal(
    redirect.headers.get("Location"),
    "/admin/marketing/social-hub/posts?week=2026-W42&post_id=7",
  );
  const data = await call("post_id=7&week=2026-W42");
  assert.equal(data.selectedPostId, 7);
  assert.equal(data.posts[0].content_revision, 3);
  assert.equal(data.posts[0].source_brief.brief.id, briefId);
});
for (const status of [0, 404, 503])
  test(`built Social Hub keeps target failure ${status} distinct`, async () => {
    socialStatus = status;
    try {
      await assert.rejects(
        () =>
          build.routes["routes/admin.marketing.social-hub.posts"].module.loader(
            {
              request: new Request(
                "http://127.0.0.1/admin/marketing/social-hub/posts?post_id=7",
              ),
              context: makeContext(admin),
              params: {},
            },
          ),
        (error) =>
          error instanceof Response && error.status === (status || 503),
      );
    } finally {
      socialStatus = 200;
    }
  });
test("built Social Hub rejects malformed target before API access", async () => {
  requests.length = 0;
  await assert.rejects(
    () =>
      build.routes["routes/admin.marketing.social-hub.posts"].module.loader({
        request: new Request(
          "http://127.0.0.1/admin/marketing/social-hub/posts?post_id=7junk",
        ),
        context: makeContext(admin),
        params: {},
      }),
    (error) => error instanceof Response && error.status === 400,
  );
  assert.equal(requests.length, 0);
});
