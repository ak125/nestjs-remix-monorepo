import { cleanup, render, screen } from "@testing-library/react";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import MarketingBriefsList, { loader } from "~/routes/admin.marketing.briefs";

const brief = {
  id: "b2db752b-dc8c-45ec-8851-394307c5806a",
  agent_id: "local-business-agent",
  business_unit: "LOCAL",
  channel: "facebook",
  conversion_goal: "CALL",
  cta: "Appelez le magasin",
  target_segment: "Clients locaux",
  brand_gate_level: "PASS",
  status: "draft",
  created_at: "2026-10-01T10:00:00Z",
  reviewed_by: null,
  approved_by: null,
};
const empty = { items: [], total: 0, page: 1, limit: 50 };
const routes = [
  {
    id: "briefs",
    path: "/admin/marketing/briefs",
    loader,
    Component: MarketingBriefsList,
  },
];

async function loadAndRender(query = "") {
  const handler = createStaticHandler(routes);
  const context = await handler.query(
    new Request(`http://localhost/admin/marketing/briefs${query}`, {
      headers: { Cookie: "session=test-session" },
    }),
  );
  if (context instanceof Response) throw new Error("Unexpected redirect");
  render(
    <StaticRouterProvider
      router={createStaticRouter(handler.dataRoutes, context)}
      context={context}
    />,
  );
  return context;
}

function expectUnavailable() {
  expect(screen.getByRole("alert").textContent).toBeTruthy();
  expect(screen.queryByText(/^0 brief/)).toBeNull();
  expect(screen.queryByText(/Aucun brief pour ce filtre/)).toBeNull();
  expect(screen.queryByText(/__marketing_brief/)).toBeNull();
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("marketing briefs list error contract", () => {
  it.each([400, 401, 403, 429, 500, 503])(
    "preserves API HTTP %s without presenting an empty list",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response("private backend detail", { status }),
          ),
      );
      const context = await loadAndRender("?unit=LOCAL&status=draft");
      expect(context.statusCode).toBe(status);
      expectUnavailable();
      expect(screen.queryByText(/private backend detail/)).toBeNull();
    },
  );

  it("returns 503 for a transport failure without exposing exception details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("private host connection failed")),
    );
    const context = await loadAndRender();
    expect(context.statusCode).toBe(503);
    expectUnavailable();
    expect(screen.queryByText(/private host/)).toBeNull();
  });

  it("returns 502 for invalid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));
    expect((await loadAndRender()).statusCode).toBe(502);
    expectUnavailable();
  });

  it.each([
    { success: false, data: empty },
    { success: true },
    { success: true, data: { ...empty, items: null } },
    { success: true, data: { ...empty, total: -1 } },
    {
      success: true,
      data: { ...empty, items: [{ ...brief, business_unit: "UNKNOWN" }] },
    },
  ])("returns 502 for an invalid success payload: %j", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    expect((await loadAndRender()).statusCode).toBe(502);
    expectUnavailable();
  });

  it("retains a real empty success with HTTP 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ success: true, data: empty })),
    );
    const context = await loadAndRender();
    expect(context.statusCode).toBe(200);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/^0 brief/)).toBeTruthy();
    expect(screen.getByText(/Aucun brief pour ce filtre/)).toBeTruthy();
  });

  it("retains rows, filters, pagination and the authenticated cookie on success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          success: true,
          data: { items: [brief], total: 51, page: 2, limit: 50 },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const context = await loadAndRender("?unit=LOCAL&status=draft&page=2");
    expect(context.statusCode).toBe(200);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: /Appelez le magasin/ })
        .getAttribute("href"),
    ).toBe(`/admin/marketing/briefs/${brief.id}`);
    expect(screen.getByText(/^51 briefs/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost/api/admin/marketing/briefs?business_unit=LOCAL&status=draft&page=2&limit=50",
      { headers: { Cookie: "session=test-session" } },
    );
    expect(context.loaderData.briefs).toMatchObject({ page: 2, limit: 50 });
  });
});
