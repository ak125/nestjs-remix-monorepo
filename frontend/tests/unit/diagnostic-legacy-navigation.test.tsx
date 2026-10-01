import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import CalendrierEntretienPage, {
  loader as calendarLoader,
} from "~/routes/blog-pieces-auto.calendrier-entretien";
import DiagnosticPage from "~/routes/diagnostic";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderCalendar() {
  const router = createMemoryRouter([
    {
      path: "/",
      Component: CalendrierEntretienPage,
      loader: () => ({
        calendar: {
          type_id: null,
          current_km: 15000,
          fuel_type: null,
          schedule: [
            {
              rule_alias: "vidange-essence",
              rule_label: "Vidange essence",
              km_interval: 15000,
              month_interval: 12,
              maintenance_priority: "important",
              applies_to_fuel: "essence",
              km_remaining: 0,
              status: "overdue",
            },
          ],
          alerts: [],
          controles_mensuels: [],
        },
      }),
      HydrateFallback: () => null,
    },
  ]);
  return render(<RouterProvider router={router} />);
}

describe("Legacy diagnostic navigation without canonical gamme data", () => {
  it("keeps maintenance labels and intervals without treating a rule alias as a gamme", async () => {
    renderCalendar();
    const label = await screen.findByText("Vidange essence");
    expect(label.closest("a")).toBeNull();
    expect(label.closest("tr")?.textContent).toContain("1 an");
  });

  it("identifies generic intervals and the missing history without promising manufacturer applicability", async () => {
    renderCalendar();
    await screen.findByText("Vidange essence");
    expect(screen.getByText(/historique des interventions/i)).toBeTruthy();
    expect(screen.getByText(/applicabilité.*véhicule.*vérifiée/i)).toBeTruthy();
    expect(screen.queryByText(/en parfait etat/)).toBeNull();
  });

  it("preserves category labels and offers one honest general catalogue destination", async () => {
    const { container } = renderCalendar();
    await screen.findByText("Vidange essence");
    const cta = container.querySelector("#cta")!;
    expect(cta.textContent).toContain("Vidange & filtres");
    expect(cta.textContent).toContain("Amortisseurs");
    const links = cta.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe("Voir le catalogue de pièces");
    expect(links[0].getAttribute("href")).toBe("/#catalogue");
  });

  it("keeps diagnosed part labels without inventing gamme aliases or empty links", async () => {
    const router = createMemoryRouter([
      {
        path: "/",
        Component: DiagnosticPage,
        HydrateFallback: () => null,
        loader: () => ({
          observables: [
            {
              node_id: "obs",
              node_label: "Bruit au freinage",
              node_category: "freinage",
            },
          ],
          error: null,
        }),
        action: () => ({
          primaryFault: {
            faultId: "fault",
            faultLabel: "Usure possible",
            faultCategory: "freinage",
            score: 0.7,
            matchedObservables: [],
            actions: [],
            parts: [
              {
                partNodeId: "part1",
                partLabel: "Plaquettes de frein",
                gammeId: "402",
              },
              {
                partNodeId: "part2",
                partLabel: "Composant à vérifier",
                gammeId: "",
              },
            ],
          },
          faults: [],
          confidence: 0.7,
          explanation: "Controle recommande",
          matchedSymptoms: [],
          unmatchedSymptoms: [],
        }),
      },
    ]);
    render(<RouterProvider router={router} />);
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Analyser les symptômes" }),
    );
    for (const name of ["Plaquettes de frein", "Composant à vérifier"]) {
      expect((await screen.findByText(name)).closest("a")).toBeNull();
    }
    expect(screen.queryByText("Voir la gamme")).toBeNull();
  });
});

describe("Maintenance calendar source availability", () => {
  function renderWithRealLoader() {
    const router = createMemoryRouter([
      {
        path: "/",
        Component: CalendrierEntretienPage,
        loader: calendarLoader,
        HydrateFallback: () => null,
      },
    ]);
    render(<RouterProvider router={router} />);
  }

  it.each(["network rejection", "HTTP failure"])(
    "reports %s as unavailable instead of an empty calendar",
    async (failure) => {
      const fetchMock = vi.fn();
      if (failure === "network rejection")
        fetchMock.mockRejectedValue(new Error("offline"));
      else fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
      vi.stubGlobal("fetch", fetchMock);
      renderWithRealLoader();
      const error = await screen.findByText(
        /Calendrier temporairement indisponible/,
      );
      expect(error.closest('[role="alert"]')).not.toBeNull();
      expect(screen.queryByText(/en cours de population/)).toBeNull();
      expect(screen.queryByText(/Aucun intervalle/)).toBeNull();
      expect(screen.queryByRole("table")).toBeNull();
    },
  );

  it.each([
    [404, /Véhicule introuvable/],
    [400, /Paramètres du calendrier invalides/],
  ])(
    "reports a rejected request (HTTP %i) without calling it an outage",
    async (status, message) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(null, { status })),
      );
      renderWithRealLoader();
      const error = await screen.findByText(message);
      expect(error.closest('[role="alert"]')).not.toBeNull();
      expect(screen.queryByText(/temporairement indisponible/)).toBeNull();
      expect(screen.queryByRole("table")).toBeNull();
    },
  );

  it.each([
    null,
    {},
    { schedule: [], alerts: null, controles_mensuels: [] },
    { schedule: [{ rule_alias: "oil" }], alerts: [], controles_mensuels: [] },
    {
      schedule: [],
      alerts: [{ milestone_km: 10000, actions: null }],
      controles_mensuels: [],
    },
    { schedule: [], alerts: [], controles_mensuels: [{ element: "Oil" }] },
  ])(
    "reports malformed HTTP 200 payload %j as unavailable",
    async (payload) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify(
              payload === null
                ? null
                : {
                    type_id: null,
                    current_km: 0,
                    fuel_type: null,
                    ...payload,
                  },
            ),
            { status: 200 },
          ),
        ),
      );
      renderWithRealLoader();
      expect(
        await screen.findByText(/Calendrier temporairement indisponible/),
      ).toBeTruthy();
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.queryByText(/Unexpected Application Error/)).toBeNull();
    },
  );

  it("renders a valid nonempty API response while keeping its intervals generic", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type_id: 123,
            current_km: 80000,
            fuel_type: null,
            assessment_basis: "generic_intervals",
            applicability: "unverified",
            schedule: [
              {
                rule_alias: "oil",
                rule_label: "Vidange avec historique absent",
                km_interval: 15000,
                month_interval: 12,
                maintenance_priority: "important",
                applies_to_fuel: null,
                km_remaining: null,
                status: "unknown",
                status_reason: "maintenance_history_missing",
              },
            ],
            alerts: [
              {
                milestone_km: 30000,
                actions: [
                  {
                    rule_alias: "oil",
                    rule_label: "Vidange indicative",
                    km_interval: 15000,
                    maintenance_priority: "important",
                  },
                ],
              },
            ],
            controles_mensuels: [
              {
                element: "Contrôle visuel",
                icon: "Wrench",
                detail: "Repère documentaire",
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    renderWithRealLoader();
    expect(
      await screen.findByText("Vidange avec historique absent"),
    ).toBeTruthy();
    expect(screen.getByText("Vidange indicative")).toBeTruthy();
    expect(screen.getByText("Repère documentaire")).toBeTruthy();
    expect(screen.getByText("non précisé")).toBeTruthy();
    expect(
      screen.queryByText(/Calendrier temporairement indisponible/),
    ).toBeNull();
  });

  it("keeps empty and repeated query values for the backend to reject instead of silently repairing them", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await calendarLoader({
      request: new Request(
        "https://example.test/?current_km=&type_id=1&type_id=2",
      ),
      params: {},
      context: {},
    } as Parameters<typeof calendarLoader>[0]);
    const requestedUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestedUrl.searchParams.get("current_km")).toBe("");
    expect(requestedUrl.searchParams.getAll("type_id")).toEqual(["1", "2"]);
    expect(result.calendar).toBeNull();
  });

  it("reports unavailable monthly checks and an unknown mileage without hiding the intervals", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type_id: null,
            current_km: null,
            fuel_type: null,
            schedule: [
              {
                rule_alias: "oil",
                rule_label: "Vidange indicative",
                km_interval: 15000,
                month_interval: 12,
                maintenance_priority: "important",
                applies_to_fuel: null,
              },
            ],
            alerts: [],
            controles_mensuels: null,
          }),
          { status: 200 },
        ),
      ),
    );
    renderWithRealLoader();
    expect(await screen.findByText("Vidange indicative")).toBeTruthy();
    expect(
      screen.getByText("Contrôles mensuels indisponibles pour le moment."),
    ).toBeTruthy();
    expect(screen.queryByText("Aucun contrôle mensuel disponible.")).toBeNull();
    expect(
      screen.queryByText(/Calendrier temporairement indisponible/),
    ).toBeNull();
  });

  it("distinguishes a valid empty response without claiming no maintenance is necessary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type_id: null,
            current_km: 0,
            fuel_type: null,
            schedule: [],
            alerts: [],
            controles_mensuels: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    renderWithRealLoader();
    expect(
      await screen.findByText(/Aucun intervalle d.entretien disponible/),
    ).toBeTruthy();
    expect(screen.getByText(/Cela ne permet pas de conclure/)).toBeTruthy();
    expect(screen.getByText("Aucun contrôle mensuel disponible.")).toBeTruthy();
    expect(
      screen.queryByText(/Calendrier temporairement indisponible/),
    ).toBeNull();
    expect(screen.queryByText(/en cours de population/)).toBeNull();
  });
});
