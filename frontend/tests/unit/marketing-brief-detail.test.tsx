import { cleanup, render, screen } from "@testing-library/react";
import { type ComponentType, type ReactNode } from "react";
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  MemoryRouter,
  RouterContextProvider,
} from "react-router";
import type * as Router from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "~/auth/unified.server";

const state = vi.hoisted(() => ({
  data: {} as unknown,
  result: undefined as unknown,
  navigation: "idle",
}));
vi.mock("react-router", async (original) => ({
  ...(await original<typeof Router>()),
  useLoaderData: () => state.data,
  useActionData: () => state.result,
  useNavigation: () => ({ state: state.navigation }),
  Form: ({ children, ...props }: { children: ReactNode }) => (
    <form {...props}>{children}</form>
  ),
}));
vi.mock("~/auth/unified.server", () => ({ requireAdmin: vi.fn() }));
vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrlFromRequest: (path: string) => `http://localhost${path}`,
}));

type DetailRoute = {
  default: ComponentType;
  loader: (args: LoaderFunctionArgs) => Promise<unknown>;
  action: (args: ActionFunctionArgs) => Promise<unknown>;
};
// Empty before the route exists: test discovery still works and names the missing behavior.
const modules = import.meta.glob<DetailRoute>(
  "../../app/routes/admin.marketing.briefs_.$id.tsx",
  { eager: true },
);
function route() {
  const value = Object.values(modules)[0];
  expect(value, "The brief detail route must exist").toBeDefined();
  return value;
}
const id = "56a0c18a-3b41-48fb-9879-6ae4bd5e349a";
const stamp = "2026-10-14T10:00:00.123456+00:00";
const row = {
  id,
  agent_id: "lead",
  business_unit: "ECOMMERCE",
  channel: "social_facebook",
  conversion_goal: "ORDER",
  cta: "Consulter les plaquettes compatibles",
  target_segment: "automobilistes",
  brand_gate_level: "PASS",
  compliance_gate_level: "WARN",
  status: "draft",
  created_at: stamp,
  updated_at: stamp,
  reviewed_by: null,
  reviewed_at: null,
  approved_by: null,
  approved_at: null,
  published_at: null,
  social_post_id: null,
  payload: { caption: "<script>example</script>" },
  coverage_manifest: { final_status: "REVIEW_REQUIRED" },
  gate_summary: { can_approve: true, blocking_issues: [] },
};
const envelope = (actions = ["reviewed", "archived"]) => ({
  success: true,
  data: row,
  review: { allowed_actions: actions, blocked_reason: null },
});
function args(method = "GET", body?: URLSearchParams): ActionFunctionArgs {
  return {
    request: new Request(`http://localhost/admin/marketing/briefs/${id}`, {
      method,
      headers: {
        Cookie: "fixture",
        ...(method === "POST" ? { Origin: "http://localhost" } : {}),
      },
      body,
    }),
    params: { id },
    context: new RouterContextProvider(),
    url: new URL(`http://localhost/admin/marketing/briefs/${id}`),
    pattern: "/admin/marketing/briefs/:id",
  };
}
function response(body: unknown, status = 200) {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
  state.result = undefined;
  state.navigation = "idle";
});

describe("brief consultation and decision route", () => {
  it("lists compatible existing content only for an approved brief and preserves both target versions", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...envelope(["archived"]),
            data: {
              ...row,
              status: "approved",
              approved_by: "owner",
              approved_at: stamp,
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 7,
                week_iso: "2026-W42",
                status: "generated",
                content_revision: 2,
                review_version: 4,
                source_brief: null,
                channels_list: ["facebook"],
                channels: { facebook: { caption: "Contenu à raccorder" } },
              },
              {
                id: 8,
                week_iso: "2026-W42",
                status: "published",
                content_revision: 1,
                review_version: 2,
                channels_list: ["facebook"],
                channels: { facebook: { caption: "Déjà publié" } },
              },
            ],
          }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const input = args();
    input.request = new Request(`${input.request.url}?week=2026-W42`);
    state.data = await route().loader(input);
    const Target = route().default;
    render(
      <MemoryRouter>
        <Target />
      </MemoryRouter>,
    );
    expect(screen.getByText("Contenu à raccorder")).toBeTruthy();
    expect(screen.queryByText("Déjà publié")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Raccorder le contenu #7" }),
    ).toBeTruthy();
    expect(
      document
        .querySelector('input[name="content_revision"]')
        ?.getAttribute("value"),
    ).toBe("2");
    expect(
      document
        .querySelector('input[name="review_version"]')
        ?.getAttribute("value"),
    ).toBe("4");
  });
  it("links via the atomic endpoint and redirects to the exact Social Hub content", async () => {
    const fetch = response({
      success: true,
      data: {
        id: 7,
        week_iso: "2026-W42",
        content_revision: 3,
        review_version: 5,
        source_brief: { brief: { id }, linked_content_revision: 3 },
      },
    });
    const result = await route().action(
      args(
        "POST",
        new URLSearchParams({
          intent: "link-social",
          post_id: "7",
          expected_updated_at: stamp,
          content_revision: "2",
          review_version: "4",
        }),
      ),
    );
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost/api/admin/marketing/briefs/${id}/social-content`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          post_id: 7,
          expected_updated_at: stamp,
          content_revision: 2,
          review_version: 4,
        }),
      }),
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe(
      "/admin/marketing/social-hub/posts?week=2026-W42&post_id=7",
    );
  });
  it.each([400, 409, 500])(
    "keeps failed association %s visible without redirect",
    async (status) => {
      response({ message: "private failure" }, status);
      const result = await route().action(
        args(
          "POST",
          new URLSearchParams({
            intent: "link-social",
            post_id: "7",
            expected_updated_at: stamp,
            content_revision: "2",
            review_version: "4",
          }),
        ),
      );
      expect(result).toMatchObject({
        error: expect.stringMatching(/refusé|changé|non confirmé/),
      });
      expect(JSON.stringify(result)).not.toContain("private failure");
    },
  );
  it("refuses forged actor and cross-origin associations before writing", async () => {
    const fetch = response({});
    const fields = {
      intent: "link-social",
      post_id: "7",
      expected_updated_at: stamp,
      content_revision: "2",
      review_version: "4",
    };
    expect(
      await route().action(
        args("POST", new URLSearchParams({ ...fields, actor: "forged" })),
      ),
    ).toMatchObject({ error: expect.any(String) });
    const input = args("POST", new URLSearchParams(fields));
    input.request.headers.set("Origin", "https://other.example");
    await expect(route().action(input)).rejects.toMatchObject({ status: 403 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("renders the stored brief, escaped payload, provenance and allowed review action", async () => {
    response(envelope());
    const target = route();
    state.data = await target.loader(args());
    render(
      <MemoryRouter>
        <target.default />
      </MemoryRouter>,
    );
    expect(screen.getByText(row.cta)).toBeTruthy();
    expect(screen.getByText(/<script>example<\/script>/)).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
    const button = screen.getByRole("button", { name: "Marquer comme revu" });
    const form = button.closest("form")!;
    expect(new FormData(form).get("expected_updated_at")).toBe(stamp);
    expect(
      screen.queryByRole("button", { name: "Approuver le brief" }),
    ).toBeNull();
    expect(
      screen
        .getByRole("link", { name: /Retour aux briefs/ })
        .getAttribute("href"),
    ).toBe("/admin/marketing/briefs");
  });
  it("shows the stored gate blocker without an approval action", async () => {
    response({
      ...envelope(["archived"]),
      data: {
        ...row,
        status: "reviewed",
        reviewed_by: "admin-42",
        reviewed_at: stamp,
      },
      review: {
        allowed_actions: ["archived"],
        blocked_reason: "Contrôles incomplets",
      },
    });
    const target = route();
    state.data = await target.loader(args());
    render(
      <MemoryRouter>
        <target.default />
      </MemoryRouter>,
    );
    expect(screen.getByText("Contrôles incomplets")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Approuver le brief" }),
    ).toBeNull();
    expect(screen.getByText(/admin-42/)).toBeTruthy();
  });
  it.each([404, 500])("distinguishes a %s detail failure", async (status) => {
    response({ message: "private detail" }, status);
    const target = route();
    state.data = await target.loader(args());
    render(
      <MemoryRouter>
        <target.default />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert").textContent).toMatch(
      status === 404 ? /introuvable/i : /indisponible/i,
    );
    expect(screen.queryByText(row.cta)).toBeNull();
    expect(screen.queryByText(/private detail/)).toBeNull();
  });
  it("rejects a malformed success payload", async () => {
    response({
      success: true,
      data: { id },
      review: { allowed_actions: ["approved"] },
    });
    const target = route();
    state.data = await target.loader(args());
    render(
      <MemoryRouter>
        <target.default />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/indisponible/i);
  });
  it("submits the exact displayed version with the session cookie, never a body actor", async () => {
    const fetch = response({
      success: true,
      data: {
        ...row,
        status: "reviewed",
        reviewed_by: "admin-42",
        reviewed_at: stamp,
      },
    });
    const result = await route().action(
      args(
        "POST",
        new URLSearchParams({ status: "reviewed", expected_updated_at: stamp }),
      ),
    );
    expect(result).toMatchObject({ error: null });
    expect(fetch.mock.calls[0][0]).toBe(
      `http://localhost/api/admin/marketing/briefs/${id}/status`,
    );
    const init = fetch.mock.calls[0][1];
    expect(init.method).toBe("PATCH");
    expect(init.headers.Cookie).toBe("fixture");
    expect(JSON.parse(init.body)).toEqual({
      status: "reviewed",
      expected_updated_at: stamp,
    });
  });
  it("keeps a conflict visible and does not claim success", async () => {
    response({ message: "private conflict" }, 409);
    const result = await route().action(
      args(
        "POST",
        new URLSearchParams({ status: "approved", expected_updated_at: stamp }),
      ),
    );
    expect(result).toMatchObject({
      error: expect.stringMatching(/modifié|recharg/i),
    });
    state.data = await (async () => {
      response(envelope(["approved"]));
      return route().loader(args());
    })();
    state.result = result;
    const Page = route().default;
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/modifié|recharg/i);
  });
  it("refuses cross-origin decisions before API access", async () => {
    const fetch = response(envelope());
    const input = args(
      "POST",
      new URLSearchParams({ status: "reviewed", expected_updated_at: stamp }),
    );
    input.request.headers.set("Origin", "https://other.example");
    await expect(route().action(input)).rejects.toMatchObject({ status: 403 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["loader", "action"] as const)(
    "guards %s before reading or writing",
    async (method) => {
      const fetch = response(envelope());
      vi.mocked(requireAdmin).mockRejectedValueOnce(
        new Response(null, { status: 403 }),
      );
      await expect(route()[method](args())).rejects.toMatchObject({
        status: 403,
      });
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("disables decisions while submitting", async () => {
    response(envelope());
    const target = route();
    state.data = await target.loader(args());
    state.navigation = "submitting";
    render(
      <MemoryRouter>
        <target.default />
      </MemoryRouter>,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Marquer comme revu",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
