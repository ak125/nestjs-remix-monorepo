import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminControlPlane from "~/routes/admin.control-plane";

const state = vi.hoisted(() => ({ summary: {} }));
vi.mock("react-router", () => ({ useLoaderData: () => state.summary }));
vi.mock("~/auth/unified.server", () => ({ requireAdmin: vi.fn() }));
vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrlFromRequest: vi.fn(),
}));
vi.mock("~/utils/meta-helpers", () => ({ createNoIndexMeta: vi.fn() }));

afterEach(cleanup);

function fixture(degraded: boolean, count: number | null) {
  state.summary = {
    generatedAt: "2026-09-11T00:05:00.000Z",
    degraded,
    repo: {
      counts: { files: 2843, db: 307, rpc: 259 },
      domainCount: 17,
      ownershipGaps: 1576,
    },
    wip: {
      degraded,
      generatedAt: "2026-09-10T23:51:04.435Z",
      prCount: count,
      zombies: count,
      stacks: count,
      topStale: [],
    },
  };
}

describe("Control Plane WIP availability", () => {
  it.each([null, 0])(
    "shows unavailable even when a degraded cache contains %s",
    (count) => {
      fixture(true, count);
      render(<AdminControlPlane />);
      expect(screen.getAllByText("Indisponible")).toHaveLength(3);
      expect(screen.queryByText("0")).toBeNull();
      expect(screen.getByText("307")).toBeTruthy();
      expect(screen.getByText("Données WIP indisponibles")).toBeTruthy();
      expect(screen.getByText(/Dernière tentative de collecte/)).toBeTruthy();
    },
  );

  it("shows zero only for a valid empty collection and identifies its collection time", () => {
    fixture(false, 0);
    const { container } = render(<AdminControlPlane />);
    const section = screen
      .getByRole("heading", { name: "WIP (PRs ouvertes)" })
      .closest("section")!;
    expect(within(section).getAllByText("0")).toHaveLength(3);
    expect(screen.queryByText("Indisponible")).toBeNull();
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe(
      "2026-09-10T23:51:04.435Z",
    );
    expect(screen.getByText(/sans actualisation automatique/)).toBeTruthy();
  });
});
