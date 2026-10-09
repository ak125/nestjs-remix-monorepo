import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DiagnosticAutoIndex, { loader } from "~/routes/diagnostic-auto._index";
import { logger } from "~/utils/logger";

vi.mock("~/services/api/enhanced-vehicle.api", () => ({
  enhancedVehicleApi: {
    getBrands: vi.fn().mockResolvedValue([]),
    getModels: vi.fn().mockResolvedValue([]),
  },
}));

const UNAVAILABLE = [
  "Catégories de diagnostic temporairement indisponibles.",
  "Signes avant-coureurs temporairement indisponibles.",
  "Questions fréquentes temporairement indisponibles.",
];

const json = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200 });
const entry = (entity_data: unknown) =>
  json({ slug: "x", title: "x", entity_data, body: "" });

/** Hub wiki endpoints → response; everything else the page fetches is inert. */
function stubFetch(wiki: Record<string, () => Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const wikiEndpoint = Object.keys(wiki).find((endpoint) =>
        url.endsWith(`/api/diagnostic-engine/${endpoint}`),
      );
      if (wikiEndpoint) return wiki[wikiEndpoint]();
      if (url.endsWith("/api/seo/diagnostic/featured"))
        return json({ data: [] });
      if (url.endsWith("/wizard-steps")) return json({});
      if (url.endsWith("/systems")) return json({ success: true, systems: [] });
      if (url.endsWith("/api/seo/funnel/event"))
        return new Response(null, { status: 204 });
      throw new Error("Unexpected request " + url);
    }),
  );
}

const allWiki = (respond: () => Response) => ({
  "vocab-clusters": respond,
  signs: respond,
  faq: respond,
  "safety-config": respond,
});

function renderHub() {
  const router = createMemoryRouter([
    {
      path: "/",
      Component: DiagnosticAutoIndex,
      loader,
      HydrateFallback: () => null,
    },
  ]);
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.spyOn(logger, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Diagnostic hub wiki content availability", () => {
  it.each([
    ["HTTP 503", () => new Response(null, { status: 503 })],
    // Shape served before the backend answered 503: a 200 with an empty body.
    ["HTTP 200 with an empty body", () => new Response("", { status: 200 })],
  ])(
    "reports %s as unavailable instead of an empty section",
    async (_case, respond) => {
      stubFetch(allWiki(respond));
      renderHub();
      for (const text of UNAVAILABLE) {
        const alert = await screen.findByText(text);
        expect(alert.closest('[role="alert"]')).not.toBeNull();
      }
      expect(screen.queryByText(/en cours de population/)).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    },
  );

  it("logs the HTTP status of a failed wiki fetch", async () => {
    stubFetch(allWiki(() => new Response(null, { status: 503 })));
    renderHub();
    await screen.findByText(UNAVAILABLE[0]);
    expect(logger.error).toHaveBeenCalledWith(
      "[diagnostic-auto._index] fetch vocab-clusters failed: HTTP 503",
    );
  });

  it.each([
    ["vocab-clusters", { clusters: "freinage" }, UNAVAILABLE[0]],
    ["signs", { signs: {} }, UNAVAILABLE[1]],
    ["faq", { faq: null }, UNAVAILABLE[2]],
  ])(
    "reports a malformed %s payload as unavailable",
    async (endpoint, entityData, text) => {
      stubFetch({
        ...allWiki(() => entry({ clusters: [], signs: [], faq: [] })),
        [endpoint]: () => entry(entityData),
      });
      renderHub();
      expect(await screen.findByText(text)).toBeTruthy();
      expect(screen.getAllByText(/temporairement indisponibles/)).toHaveLength(
        1,
      );
    },
  );

  it("keeps a valid empty list distinct from unavailable content", async () => {
    stubFetch(allWiki(() => entry({ clusters: [], signs: [], faq: [] })));
    renderHub();
    expect(
      await screen.findByText("Liste de signes en cours de population."),
    ).toBeTruthy();
    expect(screen.getByText("FAQ en cours de population.")).toBeTruthy();
    expect(screen.queryByText(/temporairement indisponibles/)).toBeNull();
  });

  // ADR-035: no reliability percentage until one is calibrated on real outcomes.
  it("states no reliability percentage", async () => {
    stubFetch(allWiki(() => entry({ clusters: [], signs: [], faq: [] })));
    renderHub();
    await screen.findByText("FAQ en cours de population.");
    expect(document.body.textContent).not.toMatch(/fiabilit/i);
  });

  it("renders available wiki content", async () => {
    stubFetch({
      "vocab-clusters": () =>
        entry({
          clusters: [
            {
              id: "freinage",
              label: "Freinage",
              icon: "Disc3",
              description: "Disques et plaquettes",
              color: "from-red-500 to-red-700",
            },
          ],
          perception_icons: {},
        }),
      signs: () =>
        entry({
          signs: [
            {
              title: "Bruit au freinage",
              detail: "Grincement",
              cluster: "freinage",
              cluster_label: "freinage",
            },
          ],
        }),
      faq: () =>
        entry({
          faq: [{ question: "Pourquoi mes freins grincent ?", answer: "…" }],
        }),
      "safety-config": () => entry({ risk_levels: {} }),
    });
    renderHub();
    expect(await screen.findByText("Freinage")).toBeTruthy();
    expect(screen.getByText("Bruit au freinage")).toBeTruthy();
    expect(screen.getByText("Pourquoi mes freins grincent ?")).toBeTruthy();
    expect(screen.queryByText(/temporairement indisponibles/)).toBeNull();
    expect(screen.queryByText(/en cours de population/)).toBeNull();
  });
});
