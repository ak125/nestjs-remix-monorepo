import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  createMemoryRouter,
  createStaticHandler,
  createStaticRouter,
  RouterProvider,
  StaticRouterProvider,
} from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import MarketingLayout from "~/routes/admin.marketing";
import MarketingBriefsList, {
  loader as listLoader,
} from "~/routes/admin.marketing.briefs";
import * as detail from "~/routes/admin.marketing.briefs_.$id";

const id = "b2db752b-dc8c-45ec-8851-394307c5806a";
const path = `/admin/marketing/briefs/${id}`;
const brief = {
  id,
  agent_id: "local-business-agent",
  business_unit: "LOCAL",
  channel: "gbp",
  conversion_goal: "CALL",
  cta: "Appelez le magasin",
  target_segment: "Clients locaux",
  payload: {
    text: "Un conseil pour vos pièces",
    unsafe: "<img src=x onerror=alert(1)>",
  },
  coverage_manifest: {
    scope_requested: "Magasin",
    final_status: "REVIEW_REQUIRED",
  },
  brand_gate_level: "PASS",
  compliance_gate_level: "WARN",
  gate_summary: { blocking_issues: ["Contexte local à vérifier"] },
  status: "draft",
  reviewed_by: null,
  reviewed_at: null,
  approved_by: null,
  approved_at: null,
  published_at: null,
  social_post_id: null,
  actual_impressions: 0,
  actual_clicks: 0,
  actual_calls: 0,
  actual_visits: 0,
  actual_quotes: 0,
  actual_orders: 0,
  actual_revenue_cents: 0,
  performance_updated_at: null,
  ai_provider: null,
  ai_model: null,
  generation_prompt_hash: null,
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00.123456Z",
};
const response = (value = brief) =>
  Response.json({ success: true, data: value });

function routes() {
  // In the RED phase the route exists but has no data/workflow contract yet.
  expect(detail.loader).toBeTypeOf("function");
  expect(detail.action).toBeTypeOf("function");
  return [
    {
      id: "detail",
      path: "/admin/marketing/briefs/:id",
      loader: detail.loader,
      action: detail.action,
      Component: detail.default,
    },
  ];
}

async function query(init?: RequestInit, url = path) {
  const handler = createStaticHandler(routes());
  const context = await handler.query(
    new Request(`http://localhost${url}`, {
      ...init,
      headers: {
        Cookie: "session=admin",
        Origin: "http://localhost",
        ...init?.headers,
      },
    }),
  );
  if (!(context instanceof Response)) {
    render(
      <StaticRouterProvider
        router={createStaticRouter(handler.dataRoutes, context)}
        context={context}
      />,
    );
  }
  return context;
}

function post(status: string, extra: Record<string, string> = {}): RequestInit {
  return { method: "POST", body: new URLSearchParams({ status, ...extra }) };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("brief detail reads", () => {
  it("navigates from the actual list to detail under the marketing layout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith(`/${id}`)
            ? response()
            : Response.json({
                success: true,
                data: { items: [brief], total: 1, page: 1, limit: 50 },
              }),
        ),
      ),
    );
    // These route relationships are independently checked against app/routes.ts.
    const [detailRoute] = routes();
    const router = createMemoryRouter(
      [
        {
          path: "/admin/marketing",
          Component: MarketingLayout,
          children: [
            {
              path: "briefs",
              loader: listLoader,
              Component: MarketingBriefsList,
            },
            { ...detailRoute, path: "briefs/:id" },
          ],
        },
      ],
      { initialEntries: ["/admin/marketing/briefs"] },
    );
    render(<RouterProvider router={router} />);
    fireEvent.click(
      await screen.findByRole("link", { name: /Appelez le magasin/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "Contenu du brief" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Marketing" })).toBeTruthy();
    expect(screen.queryByText(/^1 brief/)).toBeNull();
    expect(router.state.location.pathname).toBe(path);
    router.dispose();
  });

  it("rejects an invalid id without calling the API", async () => {
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);
    expect(
      await query(undefined, "/admin/marketing/briefs/not-a-uuid"),
    ).toMatchObject({ statusCode: 400 });
    expect(transport).not.toHaveBeenCalled();
  });

  it("shows missing gates as unknown, never as PASS", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          ...brief,
          brand_gate_level: null,
          compliance_gate_level: null,
          gate_summary: null,
        } as unknown as typeof brief),
      ),
    );
    await query();
    expect(screen.getByText("Marque : Non renseigné")).toBeTruthy();
    expect(screen.getByText("Conformité : Non renseigné")).toBeTruthy();
    expect(screen.queryByText(/PASS/)).toBeNull();
  });
  it("renders content, gates, provenance and escaped untrusted content", async () => {
    const transport = vi.fn().mockResolvedValue(
      response({
        ...brief,
        reviewed_by: "reviewer@example.test",
        reviewed_at: "2026-10-01T11:00:00Z",
      }),
    );
    vi.stubGlobal("fetch", transport);
    const context = await query();
    expect(context).toMatchObject({ statusCode: 200 });
    expect(
      screen.getByRole("heading", { name: "Appelez le magasin" }),
    ).toBeTruthy();
    expect(screen.getByText(/Un conseil pour vos pièces/)).toBeTruthy();
    expect(screen.getByText(/Contexte local à vérifier/)).toBeTruthy();
    expect(screen.getByText(/reviewer@example.test/)).toBeTruthy();
    expect(screen.getByText(/REVIEW_REQUIRED/)).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: /Retour aux briefs/ })
        .getAttribute("href"),
    ).toBe("/admin/marketing/briefs");
    expect(transport).toHaveBeenCalledWith(
      `http://localhost/api/admin/marketing/briefs/${id}`,
      expect.objectContaining({ headers: { Cookie: "session=admin" } }),
    );
  });

  it.each([400, 401, 403, 404, 429, 500, 503])(
    "preserves GET HTTP %s with no actionable fake brief",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response("private backend detail", { status }),
          ),
      );
      expect(await query()).toMatchObject({ statusCode: status });
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Revoir" })).toBeNull();
      expect(screen.queryByText(/private backend/)).toBeNull();
    },
  );

  it.each([
    { success: false, data: brief },
    { success: true, data: null },
    {
      success: true,
      data: { ...brief, id: "00000000-0000-4000-8000-000000000001" },
    },
    { success: true, data: { ...brief, status: "unknown" } },
    { success: true, data: { ...brief, payload: [] } },
  ])("rejects malformed or mismatched GET success: %j", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    expect(await query()).toMatchObject({ statusCode: 502 });
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it.each(["invalid-json", "network"])(
    "shows %s failure without leaking details",
    async (failure) => {
      vi.stubGlobal(
        "fetch",
        failure === "network"
          ? vi.fn().mockRejectedValue(new Error("private upstream"))
          : vi.fn().mockResolvedValue(new Response("invalid-json")),
      );
      expect(await query()).toMatchObject({
        statusCode: failure === "network" ? 503 : 502,
      });
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.queryByText(/private upstream/)).toBeNull();
    },
  );
});

describe("human workflow", () => {
  it("rejects duplicate statuses before writing", async () => {
    const transport = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", transport);
    expect(
      await query({
        method: "POST",
        body: new URLSearchParams([
          ["status", "reviewed"],
          ["status", "approved"],
        ]),
      }),
    ).toMatchObject({ statusCode: 400 });
    expect(
      transport.mock.calls.every(([, init]) => init?.method !== "PATCH"),
    ).toBe(true);
  });

  it("rejects a malformed form without forwarding a mutation", async () => {
    const transport = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", transport);
    expect(
      await query({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    ).toMatchObject({ statusCode: 400 });
    expect(
      transport.mock.calls.every(([, init]) => init?.method !== "PATCH"),
    ).toBe(true);
  });

  it.each([
    ["draft", ["Revoir", "Archiver"]],
    ["reviewed", ["Approuver", "Archiver"]],
    ["approved", ["Déclarer publié", "Archiver"]],
    ["published", ["Archiver"]],
    ["archived", []],
  ])("offers only transitions from %s", async (status, labels) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(response({ ...brief, status: status as string })),
    );
    await query();
    expect(screen.queryAllByRole("button").map((b) => b.textContent)).toEqual(
      labels,
    );
  });

  it.each(["reviewed", "approved", "published", "archived"])(
    "PATCHes only status %s and preserves the cookie",
    async (status) => {
      const transport = vi
        .fn()
        .mockResolvedValue(response({ ...brief, status }));
      vi.stubGlobal("fetch", transport);
      const result = await query(
        post(status, {
          confirmed: "yes",
          reviewed_by: "forged",
          approved_by: "forged",
        }),
      );
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(303);
      expect((result as Response).headers.get("Location")).toBe(path);
      expect(transport).toHaveBeenCalledTimes(1);
      expect(transport).toHaveBeenCalledWith(
        `http://localhost/api/admin/marketing/briefs/${id}/status`,
        {
          method: "PATCH",
          headers: {
            Cookie: "session=admin",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );
    },
  );

  it.each(["published", "archived"])(
    "requires explicit confirmation for %s before writing",
    async (status) => {
      const transport = vi.fn().mockResolvedValue(response());
      vi.stubGlobal("fetch", transport);
      expect(await query(post(status))).toMatchObject({ statusCode: 400 });
      expect(
        transport.mock.calls.every(([, init]) => init?.method !== "PATCH"),
      ).toBe(true);
      expect(screen.getByRole("alert")).toBeTruthy();
    },
  );

  it.each(["draft", "unknown", ""])(
    "rejects invalid action %s before writing",
    async (status) => {
      const transport = vi.fn().mockResolvedValue(response());
      vi.stubGlobal("fetch", transport);
      expect(await query(post(status))).toMatchObject({ statusCode: 400 });
      expect(
        transport.mock.calls.every(([, init]) => init?.method !== "PATCH"),
      ).toBe(true);
    },
  );

  it.each([401, 403, 404, 409, 422, 429, 503])(
    "preserves PATCH refusal %s, without success or private details",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockImplementation((_url, init) =>
            Promise.resolve(
              init?.method === "PATCH"
                ? new Response("private backend detail", { status })
                : response(),
            ),
          ),
      );
      expect(await query(post("reviewed"))).toMatchObject({
        statusCode: status,
      });
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.queryByText(/private backend detail/)).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    },
  );

  it("explains local_canon_unvalidated using a public allowlisted message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation((_url, init) =>
          Promise.resolve(
            init?.method === "PATCH"
              ? Response.json(
                  { message: "local_canon_unvalidated" },
                  { status: 422 },
                )
              : response(),
          ),
        ),
    );
    await query(post("reviewed"));
    expect(screen.getByRole("alert").textContent).toMatch(
      /contexte local.*pas validé/i,
    );
  });

  it.each([
    "network",
    "invalid-json",
    "wrong-status",
    "wrong-id",
    "false-success",
  ])("never confirms an ambiguous PATCH %s", async (kind) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url, init) => {
        if (init?.method !== "PATCH") return Promise.resolve(response());
        if (kind === "network")
          return Promise.reject(new Error("private host"));
        if (kind === "invalid-json")
          return Promise.resolve(new Response("invalid"));
        return Promise.resolve(
          Response.json({
            success: kind !== "false-success",
            data: {
              ...brief,
              status: kind === "wrong-status" ? "draft" : "reviewed",
              id:
                kind === "wrong-id"
                  ? "00000000-0000-4000-8000-000000000001"
                  : id,
            },
          }),
        );
      }),
    );
    expect(await query(post("reviewed"))).toMatchObject({
      statusCode: kind === "network" ? 503 : 502,
    });
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("rejects a foreign-origin POST before forwarding an authenticated mutation", async () => {
    const transport = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", transport);
    expect(
      await query({
        ...post("reviewed"),
        headers: { Origin: "https://foreign.invalid" },
      }),
    ).toMatchObject({ statusCode: 403 });
    expect(
      transport.mock.calls.every(([, init]) => init?.method !== "PATCH"),
    ).toBe(true);
  });

  it("requires confirmation in the UI and disables all actions during a submission", async () => {
    let finish!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url, init) =>
        init?.method === "PATCH"
          ? new Promise<Response>((resolve) => {
              finish = resolve;
            })
          : Promise.resolve(response({ ...brief, status: "published" })),
      ),
    );
    const router = createMemoryRouter(routes(), {
      initialEntries: [path],
      hydrationData: {
        loaderData: {
          detail: { brief: { ...brief, status: "approved" }, error: null },
        },
      },
    });
    render(<RouterProvider router={router} />);
    const button = screen.getByRole("button", { name: "Déclarer publié" });
    const form = button.closest("form")!;
    const checkbox = form.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    )!;
    expect(checkbox.required).toBe(true);
    expect(form.checkValidity()).toBe(false);
    fireEvent.click(checkbox);
    expect(form.checkValidity()).toBe(true);
    fireEvent.submit(form);
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(true),
    );
    expect(
      screen
        .getAllByRole("button")
        .every((b) => (b as HTMLButtonElement).disabled),
    ).toBe(true);
    finish(response({ ...brief, status: "published" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Déclarer publié" }),
      ).toBeNull(),
    );
    expect(screen.getByText(/aucune publication automatique/i)).toBeTruthy();
    router.dispose();
  });
});
