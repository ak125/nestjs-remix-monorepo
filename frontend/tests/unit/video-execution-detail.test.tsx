import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router";
import type * as ReactRouter from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import ExecutionDetail from "../../app/routes/admin.video-hub.executions.$executionLogId";

const state = vi.hoisted(() => ({
  execution: {} as Record<string, unknown>,
  pageData: undefined as Record<string, unknown> | undefined,
}));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useLoaderData: () =>
    state.pageData ?? {
      execution: state.execution,
      variants: [],
      error: null,
    },
  useFetcher: () => ({ state: "idle" }),
}));
vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrl: () => "http://backend",
}));
afterEach(() => {
  cleanup();
  state.pageData = undefined;
});

function show(outcome: string | undefined, observations: unknown = null) {
  state.execution = {
    id: 17,
    briefId: "brief-17",
    status: "completed",
    executionOutcome: outcome,
    renderOutputPath: "s3://media/master.mp4",
    renderMetadata: null,
    qualityFlags: [],
    gateResults: null,
    featureFlags: null,
    createdAt: "2026-10-19T00:00:00Z",
    qualityScore: null,
    postprocessVariants: observations,
    postprocessDurationMs: 50,
    srtS3Path: null,
  };
  return render(
    <MemoryRouter>
      <ExecutionDetail />
    </MemoryRouter>,
  );
}

describe("execution detail separates observations from approval", () => {
  it.each([undefined, "simulated", "disabled", "skipped", "failed", "unknown"])(
    "does not offer the artifact preview for %s despite a stored path",
    (outcome) => {
      show(outcome);
      expect(screen.queryByText("Output Video")).toBeNull();
    },
  );
  it("shows saved inspections without changing the unchecked render label", () => {
    show("rendered_unverified", [
      {
        name: "vertical",
        inspection: {
          checksumSha256: "abc123",
          video: { codec: "h264" },
          audio: [],
        },
      },
    ]);
    expect(screen.getByText("Rendu non vérifié")).toBeTruthy();
    expect(screen.queryByText("Rendu contrôlé")).toBeNull();
    expect(screen.getByText("Output Video")).toBeTruthy();
    expect(screen.getByText("Observations du post-traitement")).toBeTruthy();
    expect(
      screen.getByText(/ne constituent pas une approbation humaine/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voir" }));
    expect(screen.getByText(/abc123/)).toBeTruthy();
  });
  it("does not manufacture observations for historical rows", () => {
    show("rendered_unverified");
    expect(screen.queryByText("Observations du post-traitement")).toBeNull();
  });
});

describe("execution outcomes across the Video Hub", () => {
  it.each([undefined, { simulated: 2, rendered_unverified: 1 }])(
    "keeps legacy and qualified dashboard counts distinct: %j",
    async (byOutcome) => {
      const { default: Dashboard } =
        await import("../../app/routes/admin.video-hub._index");
      state.pageData = {
        stats: { total: 3, byStatus: { draft: 3 } },
        timeWindow: "24h",
        canaryPolicy: null,
        renderHealth: null,
        executionStats: {
          total: 3,
          byOutcome,
          avgDurationMs: null,
          engineDistribution: {},
          canary: {
            totalCanary: 0,
            totalFallback: 0,
            successRate: null,
            fallbackRate: null,
            topErrorCodes: {},
          },
          renderPerformance: {
            p50RenderDurationMs: null,
            p95RenderDurationMs: null,
            byEngine: {},
          },
        },
      };
      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>,
      );
      if (byOutcome) {
        expect(screen.getByText("Simulation: 2")).toBeTruthy();
        expect(screen.getByText("Rendu non vérifié: 1")).toBeTruthy();
      } else {
        expect(screen.getByText("Résultat indéterminé: 3")).toBeTruthy();
      }
      expect(screen.queryByText(/Rendu contrôlé:/)).toBeNull();
    },
  );

  it("shows completed simulations and legacy rows without claiming controlled renders", async () => {
    const { default: Executions } =
      await import("../../app/routes/admin.video-hub.executions._index");
    state.pageData = {
      total: 2,
      error: null,
      executions: ["simulated", undefined].map((executionOutcome, index) => ({
        id: index + 1,
        briefId: `synthetic-${index}`,
        videoType: "short",
        status: "completed",
        executionOutcome,
        engineName: null,
        durationMs: null,
        attemptNumber: 1,
        createdAt: "2026-01-01T00:00:00Z",
      })),
    };
    const router = createMemoryRouter([{ path: "/", element: <Executions /> }]);
    render(<RouterProvider router={router} />);
    expect(screen.getByText("Simulation")).toBeTruthy();
    expect(screen.getByText("Résultat indéterminé")).toBeTruthy();
    expect(screen.queryByText("Rendu contrôlé")).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Résultat" })).toBeTruthy();
    const status = screen.getByRole("combobox") as HTMLSelectElement;
    expect(status.querySelector("div")).toBeNull();
    expect(status.id).toBe("status");
    fireEvent.change(status, { target: { value: "completed" } });
    expect(status.value).toBe("completed");
    expect(new FormData(status.form!).get("status")).toBe("completed");
  });
});
