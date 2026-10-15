import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { type ReactNode } from "react";
import { MemoryRouter } from "react-router";
import type * as ReactRouter from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import SocialHubPostsPage from "~/routes/admin.marketing.social-hub.posts";
import { type SocialBriefSource } from "~/services/api/marketing-briefs.api";

const state = vi.hoisted(() => ({
  posts: [
    {
      id: 7,
      source_brief: null as SocialBriefSource | null,
      week_iso: "2026-W42",
      day_of_week: 1,
      slot_label: "conseil",
      primary_channel: "facebook",
      channels_list: ["facebook", "instagram"],
      channels: {
        facebook: {
          caption: "Texte Facebook validé",
          hashtags: [],
          format: "post",
        },
        instagram: {
          caption: "Texte Instagram non validé",
          hashtags: [],
          format: "post",
        },
      },
      content_revision: 2,
      review_version: 3,
      channel_reviews: {
        facebook: {
          content_revision: 2,
          state: "gate_passed",
          actor: "42",
          decided_at: "2026-10-14T00:00:00Z",
        },
      },
      status: "gate_passed",
    },
  ],
  reload: vi.fn(),
  selectedPostId: null as number | null,
}));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useLoaderData: () => ({
    posts: state.posts,
    total: 1,
    filters: { week: "2026-W42", status: "" },
    pipeline: null,
    selectedPostId: state.selectedPostId,
  }),
  useSearchParams: () => [new URLSearchParams(), state.reload],
}));
vi.mock("~/auth/unified.server", () => ({ requireAdmin: vi.fn() }));
vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrlFromRequest: vi.fn(),
}));
vi.mock("~/components/admin/patterns/DashboardShell", () => ({
  DashboardShell: ({
    children,
    filters,
  }: {
    children: ReactNode;
    filters?: ReactNode;
  }) => (
    <div>
      {filters}
      {children}
    </div>
  ),
  KpiGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("~/components/admin/patterns/AdminDataTable", () => ({
  AdminDataTable: ({
    data,
    columns,
  }: {
    data: typeof state.posts;
    columns: Array<{
      render: (value: unknown, row: (typeof state.posts)[number]) => ReactNode;
    }>;
  }) => (
    <div>
      {data.map((row) => (
        <div key={row.id}>{columns[columns.length - 1]?.render(null, row)}</div>
      ))}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  state.selectedPostId = null;
});
describe("network review UI", () => {
  it("opens the selected content directly and reviews its current revision", () => {
    state.selectedPostId = 7;
    render(<SocialHubPostsPage />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Texte Facebook validé")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Approuver facebook/i }),
    ).toBeTruthy();
  });
  it("shows the preserved brief source and follows current content after revalidation", () => {
    const original = state.posts[0];
    state.selectedPostId = 7;
    state.posts[0] = {
      ...original,
      source_brief: {
        brief: {
          id: "56a0c18a-3b41-48fb-9879-6ae4bd5e349a",
          cta: "Source approuvée",
          approved_by: "owner",
          approved_at: "2026-10-14T10:00:00Z",
        },
        linked_content_revision: 2,
        linked_by: "admin-42",
        linked_at: "2026-10-14T11:00:00Z",
      },
    };
    try {
      const view = render(
        <MemoryRouter>
          <SocialHubPostsPage />
        </MemoryRouter>,
      );
      expect(
        screen
          .getByRole("link", { name: "Consulter le brief approuvé" })
          .getAttribute("href"),
      ).toBe("/admin/marketing/briefs/56a0c18a-3b41-48fb-9879-6ae4bd5e349a");
      expect(
        screen.getByText(/Raccordé à la version 2 par admin-42/),
      ).toBeTruthy();
      state.posts[0] = {
        ...state.posts[0],
        content_revision: 3,
        review_version: 4,
        channel_reviews: {
          facebook: {
            ...original.channel_reviews.facebook,
            content_revision: 3,
            state: "generated",
          },
        },
      };
      view.rerender(
        <MemoryRouter>
          <SocialHubPostsPage />
        </MemoryRouter>,
      );
      expect(
        screen.getByRole("button", { name: /Approuver facebook/i }),
      ).toHaveProperty("disabled", true);
      expect(
        screen.getByRole("heading", { name: /Post #7 · version 3/ }),
      ).toBeTruthy();
    } finally {
      state.posts[0] = original;
    }
  });
  it("mounts preparation in the approved network preview only", async () => {
    const original = state.posts[0];
    state.posts[0] = {
      ...original,
      channel_reviews: {
        facebook: { ...original.channel_reviews.facebook, state: "approved" },
      },
    };
    try {
      render(<SocialHubPostsPage />);
      fireEvent.click(
        screen.getByRole("button", { name: "Examiner par réseau" }),
      );
      expect(
        screen.getByRole("heading", {
          name: "Préparation de publication · facebook",
        }),
      ).toBeTruthy();
      expect(screen.getByLabelText("Nom du compte")).toBeTruthy();
      const tab = screen.getByRole("tab", { name: "INSTAGRAM" });
      fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
      fireEvent.click(tab);
      expect(screen.queryByLabelText("Nom du compte")).toBeNull();
      expect(
        screen.getByText(/Approuvez le contenu de ce réseau/),
      ).toBeTruthy();
    } finally {
      state.posts[0] = original;
    }
  });
  it("labels downloads as editorial preparation and keeps publication prerequisites visible", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    try {
      render(<SocialHubPostsPage />);
      expect(
        screen.getByText(/Les exports contiennent les textes approuvés/),
      ).toBeTruthy();
      fireEvent.click(
        screen.getByRole("button", {
          name: "Exporter la préparation Facebook",
        }),
      );
      expect(open).toHaveBeenCalledWith(
        "/api/admin/marketing/social/export?week=2026-W42&channel=facebook",
        "_blank",
        "noopener,noreferrer",
      );
    } finally {
      open.mockRestore();
    }
  });
  it("keeps legacy rows without revision unavailable for approval", () => {
    const original = state.posts[0];
    state.posts[0] = {
      ...original,
      content_revision: undefined,
      review_version: undefined,
      channel_reviews: {},
    } as any;
    try {
      render(<SocialHubPostsPage />);
      fireEvent.click(
        screen.getByRole("button", { name: "Examiner par réseau" }),
      );
      expect(
        (
          screen.getByRole("button", {
            name: "Approuver facebook",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    } finally {
      state.posts[0] = original;
    }
  });
  it("shows exact network/version confirmation and sends its counters without actor", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<SocialHubPostsPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Examiner par réseau" }),
    );
    expect(screen.getByText(/Post #7 · version 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approuver facebook" }));
    expect(
      screen.getByText("Approuver facebook · version 2 du post #7 ?"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Approuver$/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/admin/marketing/social/posts/7/approve",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      channel: "facebook",
      content_revision: 2,
      review_version: 3,
    });
    await waitFor(() => expect(state.reload).toHaveBeenCalled());
  }, 30000);

  it("does not enable approval of an unchecked secondary network", () => {
    render(<SocialHubPostsPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Examiner par réseau" }),
    );
    const tab = screen.getByRole("tab", { name: "INSTAGRAM" });
    fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
    fireEvent.click(tab);
    expect(
      (
        screen.getByRole("button", {
          name: "Approuver instagram",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
