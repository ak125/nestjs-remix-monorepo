import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { type ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SocialHubPostsPage, {
  ErrorBoundary,
  loader,
} from "~/routes/admin.marketing.social-hub.posts";

const fixture = vi.hoisted(() => ({
  post: {} as Record<string, unknown>,
  revalidate: vi.fn(),
  loaderData: null as null | Awaited<ReturnType<typeof loader>>,
  routeError: {} as Record<string, unknown>,
}));
vi.mock("react-router", () => ({
  useLoaderData: () =>
    fixture.loaderData ?? {
      posts: [fixture.post],
      total: 1,
      filters: { week: "2026-W42", status: "" },
      pipeline: null,
    },
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useRevalidator: () => ({ revalidate: fixture.revalidate }),
  useRouteError: () => fixture.routeError,
  isRouteErrorResponse: (error: { status?: number }) =>
    typeof error?.status === "number",
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrlFromRequest: (path: string) =>
    `https://internal.test${path}`,
}));
vi.mock("~/components/admin/patterns/AdminDataTable", () => ({
  AdminDataTable: ({
    data,
    columns,
  }: {
    data: Record<string, unknown>[];
    columns: {
      key: string;
      render?: (v: unknown, row: Record<string, unknown>) => ReactNode;
    }[];
  }) => (
    <div>
      {columns.find((c) => c.key === "updated_at")?.render?.(null, data[0])}
    </div>
  ),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
const hash = "a".repeat(64);
const read = () => ({ ok: true, json: async () => ({ data: fixture.post }) });
beforeEach(() => {
  fixture.loaderData = null;
  fixture.post = {
    id: 7,
    week_iso: "2026-W42",
    day_of_week: 1,
    slot_label: "conseil",
    primary_channel: "facebook",
    channels_list: ["facebook", "youtube"],
    status: "gate_passed",
    content_revision: 2,
    review_version: 3,
    channels: {
      facebook: { caption: "Conseils", hashtags: [], format: "post" },
      youtube: {
        title: "Conseils",
        description: "Entretien",
        tags: [],
        format: "short",
      },
    },
    channel_reviews: {
      facebook: {
        content_revision: 2,
        state: "gate_passed",
        actor: "42",
        decided_at: "2026-10-16T12:00:00Z",
      },
    },
    publications: {},
  };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => {
      throw new Error("Unexpected network attempt");
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});
const open = () => {
  render(<SocialHubPostsPage />);
  fireEvent.click(screen.getByRole("button", { name: "Revoir par canal" }));
  expect(document.body.textContent).not.toContain("\ufffd");
};
describe("social channel review screen (local JSDOM, no browser/session proof)", () => {
  it.each([
    [403, "Accès interdit"],
    [503, "Service indisponible"],
  ])("renders a local error screen for HTTP %s", (status, title) => {
    fixture.routeError = { status, data: "Social Hub indisponible" };
    render(<ErrorBoundary />);
    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Revoir par canal" }),
    ).toBeNull();
    expect(document.querySelectorAll("html")).toHaveLength(1);
  });
  it("submits exact displayed channel and versions, without a body actor", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: fixture.post }),
      } as Response)
      .mockResolvedValueOnce(read() as Response);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Approuver facebook" }));
    fireEvent.click(screen.getByRole("button", { name: "Approuver" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/admin/marketing/social/posts/7/approve");
    expect(JSON.parse(String(init?.body))).toEqual({
      channel: "facebook",
      content_revision: 2,
      review_version: 3,
    });
  });
  it("cannot approve a stale channel gate", () => {
    fixture.post.content_revision = 3;
    open();
    expect(
      (
        screen.getByRole("button", {
          name: "Approuver facebook",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("declares an HTTPS URL with the approved hash and reloads after conflict without retry", async () => {
    fixture.post.channel_reviews = {
      facebook: {
        content_revision: 2,
        state: "approved",
        approved_content_hash: hash,
        actor: "42",
        decided_at: "2026-10-16T12:00:00Z",
      },
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ message: "conflict" }),
      } as Response)
      .mockResolvedValueOnce(read() as Response);
    open();
    fireEvent.change(screen.getByLabelText(/URL HTTPS/), {
      target: { value: "https://www.facebook.com/posts/123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer la publication" }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual(
      {
        channel: "facebook",
        content_revision: 2,
        review_version: 3,
        approved_content_hash: hash,
        url: "https://www.facebook.com/posts/123",
      },
    );
    expect(vi.mocked(fetch).mock.calls[1][1]?.cache).toBe("no-store");
  });
  it("displays recorded proof and prevents changing that channel", () => {
    fixture.post.publications = {
      facebook: {
        url: "https://www.facebook.com/posts/123",
        declared_by: "42",
        declared_at: "2026-10-16T12:00:00Z",
      },
    };
    open();
    expect(
      screen
        .getByRole("link", { name: "Voir la publication déclarée" })
        .getAttribute("href"),
    ).toBe("https://www.facebook.com/posts/123");
    expect(
      (
        screen.getByRole("button", {
          name: "Rejeter facebook",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Enregistrer la publication" }),
    ).toBeNull();
  });
});

const pipeline = {
  plan_exists: true,
  plan_status: "draft",
  plan_slots: 5,
  posts: {
    total: 1,
    draft: 0,
    generated: 1,
    gate_passed: 0,
    gate_failed: 0,
    approved: 0,
    published: 0,
  },
};
const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
const load = (query = "?week=2026-W42") =>
  loader({
    request: new Request(
      `https://admin.test/admin/marketing/social-hub/posts${query}`,
    ),
    url: new URL(`https://admin.test/admin/marketing/social-hub/posts${query}`),
    pattern: "/admin/marketing/social-hub/posts",
    params: {},
    context: { get: vi.fn(), set: vi.fn() },
  });
describe("social hub loading and campaign calendar", () => {
  it("unwraps the pipeline response and enables copy and gate actions", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ data: [fixture.post], total: 1 }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: pipeline }));
    fixture.loaderData = await load();
    expect(fixture.loaderData.pipeline).toEqual(pipeline);
    render(<SocialHubPostsPage />);
    expect(screen.getByText("Total: 1")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Copy",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      (
        screen.getByRole("button", {
          name: "Gates",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
  it.each(["http", "network", "json", "shape"])(
    "does not disguise a %s read failure as an empty list",
    async (failure) => {
      const broken =
        failure === "http"
          ? jsonResponse({}, 503)
          : failure === "json"
            ? new Response("not json")
            : jsonResponse({ error: "unavailable" });
      if (failure === "network")
        vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
      else vi.mocked(fetch).mockResolvedValueOnce(broken);
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ success: true, data: pipeline }),
      );
      await expect(load()).rejects.toMatchObject({ status: 503 });
    },
  );
  it("keeps real posts visible with a warning when only pipeline status is unavailable", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ data: [fixture.post], total: 1 }))
      .mockResolvedValueOnce(jsonResponse({}, 503));
    fixture.loaderData = await load();
    expect(fixture.loaderData.posts).toHaveLength(1);
    render(<SocialHubPostsPage />);
    expect(screen.getByRole("alert").textContent).toContain(
      "Statut du pipeline indisponible",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Copy",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
  it.each([
    ["2027-01-01T12:00:00Z", "2026-W53"],
    ["2025-12-29T12:00:00Z", "2026-W01"],
    ["2026-10-18T22:30:00Z", "2026-W43"],
    ["2026-10-25T22:30:00Z", "2026-W43"],
    ["2026-10-25T23:30:00Z", "2026-W44"],
  ])("uses the Paris ISO week at %s", async (instant, week) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(instant));
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ data: [], total: 0 }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: pipeline }));
    expect((await load("")).filters.week).toBe(week);
  });
});
describe("review refresh failures", () => {
  it("keeps decisions blocked if a conflict cannot be reloaded", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: "conflict" }, 409))
      .mockRejectedValueOnce(new Error("read failed"));
    open();
    fireEvent.click(screen.getByRole("button", { name: "Rejeter facebook" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Recharger le contenu",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Rejeter facebook",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("does not reopen a closed preview when a pending refresh arrives", async () => {
    let resolveRead!: (value: Response) => void;
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ data: { can_approve: true } }))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRead = resolve;
          }),
      );
    open();
    fireEvent.click(screen.getByRole("button", { name: "Contrôler facebook" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await act(async () => {
      resolveRead(read() as Response);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("blocks another decision after an uncertain result until explicit reload succeeds", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("response lost"));
    open();
    fireEvent.click(screen.getByRole("button", { name: "Rejeter facebook" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(
      (
        screen.getByRole("button", {
          name: "Rejeter facebook",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.mocked(fetch).mockResolvedValueOnce(read() as Response);
    fireEvent.click(
      screen.getByRole("button", { name: "Recharger le contenu" }),
    );
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Rejeter facebook",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("does not report a successful decision from a malformed HTTP 200 response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ success: false }));
    open();
    fireEvent.click(screen.getByRole("button", { name: "Rejeter facebook" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(
      (
        screen.getByRole("button", {
          name: "Rejeter facebook",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
