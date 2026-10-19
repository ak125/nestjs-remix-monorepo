import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type * as ReactRouter from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import ExecutionDetail from "../../app/routes/admin.video-hub.executions.$executionLogId";

const state = vi.hoisted(() => ({ execution: {} as Record<string, unknown> }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useLoaderData: () => ({
    execution: state.execution,
    variants: [],
    error: null,
  }),
  useFetcher: () => ({ state: "idle" }),
}));
vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrl: () => "http://backend",
}));
afterEach(() => cleanup());

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
