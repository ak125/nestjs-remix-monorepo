import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode } from "react";
import type * as Router from "react-router";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "~/auth/unified.server";
import BriefsPage, { loader } from "~/routes/admin.marketing.briefs";

const state = vi.hoisted(() => ({ data: {} as unknown, submit: vi.fn() }));
vi.mock("react-router", async (original) => ({
  ...(await original<typeof Router>()),
  useLoaderData: () => state.data,
  useSubmit: () => state.submit,
  Form: ({ children }: { children: ReactNode }) => <form>{children}</form>,
}));
vi.mock("~/auth/unified.server", () => ({ requireAdmin: vi.fn() }));
vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrlFromRequest: (path: string) => `http://localhost${path}`,
}));
const args = () =>
  ({
    request: new Request("http://localhost/admin/marketing/briefs?unit=LOCAL", {
      headers: { Cookie: "fixture" },
    }),
    params: {},
    context: {},
  }) as Parameters<typeof loader>[0];
const page = { items: [], total: 0, page: 1, limit: 50 };
function response(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })),
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("brief read availability in existing route", () => {
  it("renders real rows and accessible native filters without invalid select children", async () => {
    response({
      success: true,
      data: {
        ...page,
        total: 1,
        items: [
          {
            id: "brief-1",
            agent_id: "agent",
            business_unit: "LOCAL",
            channel: "gbp",
            conversion_goal: "VISIT",
            cta: "Consulter le brief",
            target_segment: "local",
            brand_gate_level: null,
            status: "draft",
            created_at: "2026-10-14T10:00:00Z",
            reviewed_by: null,
            approved_by: null,
          },
        ],
      },
    });
    state.data = await loader(args());
    render(
      <MemoryRouter>
        <BriefsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Consulter le brief")).toBeTruthy();
    const unit = screen.getByRole("combobox", { name: "Unité commerciale" });
    expect(
      [...unit.children].every((child) => child.tagName === "OPTION"),
    ).toBe(true);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Statut du brief" }),
      { target: { value: "approved" } },
    );
    const submitted = state.submit.mock.calls[0][0] as FormData;
    expect(submitted.get("unit")).toBe("LOCAL");
    expect(submitted.get("status")).toBe("approved");
  });
  it("does not render zero or empty-state claims when the API fails", async () => {
    response({ message: "private database detail" }, 500);
    const data = await loader(args());
    expect(data.total).toBeNull();
    state.data = data;
    render(
      <MemoryRouter>
        <BriefsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert").textContent).toContain("indisponibles");
    expect(screen.queryByText(/0 brief/)).toBeNull();
    expect(screen.queryByText(/Aucun brief/)).toBeNull();
    expect(screen.queryByText(/Phase 1.5|private database detail/)).toBeNull();
  });
  it.each([
    { success: false, data: page },
    { success: true, data: { ...page, total: -1 } },
    { success: true, data: { ...page, items: [{ business_unit: "UNKNOWN" }] } },
  ])("refuses an invalid success envelope %#", async (body) => {
    response(body);
    const result = await loader(args());
    expect(result.error).toBeTruthy();
    expect(result.total).toBeNull();
  });
  it("shows a genuinely empty successful result without assuming agent activation", async () => {
    response({ success: true, data: page });
    state.data = await loader(args());
    render(
      <MemoryRouter>
        <BriefsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/0 brief/)).toBeTruthy();
    expect(screen.getByText(/Aucun brief/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/Phase 1.5/)).toBeNull();
  });
  it("does not expose transport errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("private internal hostname")),
    );
    const result = await loader(args());
    expect(result.total).toBeNull();
    expect(result.error).not.toContain("private internal hostname");
  });
  it("retains the admin guard before any API access", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.mocked(requireAdmin).mockRejectedValueOnce(
      new Response(null, { status: 403 }),
    );
    await expect(loader(args())).rejects.toMatchObject({ status: 403 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
