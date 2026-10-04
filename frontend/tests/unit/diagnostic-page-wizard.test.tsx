import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as diagnosticRoute from "~/routes/diagnostic";

vi.mock("~/services/api/enhanced-vehicle.api", () => ({
  enhancedVehicleApi: {
    getBrands: vi.fn().mockResolvedValue([]),
    getModels: vi.fn().mockResolvedValue([]),
  },
}));

const requested: string[] = [];

beforeEach(() => {
  requested.length = 0;
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      requested.push(input);
      if (input === "/api/diagnostic-engine/wizard-steps") {
        return { ok: true, json: async () => ({ entity_data: null }) };
      }
      if (input === "/api/diagnostic-engine/systems") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            systems: [
              { slug: "freinage", label: "Freinage", description: "Freins" },
            ],
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("/diagnostic — assistant diagnostic-engine, jamais le knowledge-graph", () => {
  it("n'a ni loader ni action serveur (l'API knowledge-graph est désactivée)", () => {
    expect(diagnosticRoute).not.toHaveProperty("loader");
    expect(diagnosticRoute).not.toHaveProperty("action");
  });

  it("garde le noindex et monte l'assistant sans appeler /api/knowledge-graph", async () => {
    expect(diagnosticRoute.meta()).toContainEqual({
      name: "robots",
      content: "noindex, nofollow",
    });

    const router = createMemoryRouter([
      { path: "/", Component: diagnosticRoute.default },
    ]);
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Diagnostic Auto" }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(requested).toContain("/api/diagnostic-engine/wizard-steps"),
    );
    expect(requested.some((url) => url.includes("knowledge-graph"))).toBe(
      false,
    );
    expect(screen.queryByText(/Erreur de chargement des symptômes/)).toBeNull();
  });
});
