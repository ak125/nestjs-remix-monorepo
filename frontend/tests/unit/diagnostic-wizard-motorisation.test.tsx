import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiagnosticWizard } from "~/components/diagnostic-wizard/DiagnosticWizard";
import { toEngineFuel } from "~/components/diagnostic-wizard/hooks/use-diagnostic-vehicle-selector";

// Two Clio III engines share the name and alias "1.2 16V"; only the type_id,
// the power and the years tell them apart.
const clioTypes = [
  {
    type_id: 19045,
    type_name: "1.2 16V",
    type_alias: "1-2-16v",
    type_fuel: "Essence",
    type_power_ps: 75,
    year_from: 2005,
    year_to: 2014,
    modele_id: 140004,
  },
  {
    type_id: 19047,
    type_name: "1.2 16V",
    type_alias: "1-2-16v",
    type_fuel: "Essence",
    type_power_ps: 65,
    year_from: 2005,
    year_to: 2014,
    modele_id: 140004,
  },
  {
    type_id: 99001,
    type_name: "1.2 TCe",
    type_alias: "1-2-tce",
    type_fuel: "Essence/GPL",
    type_power_ps: 100,
    year_from: 2009,
    modele_id: 140004,
  },
];

vi.mock("~/services/api/enhanced-vehicle.api", () => ({
  enhancedVehicleApi: {
    getBrands: vi
      .fn()
      .mockResolvedValue([
        { marque_id: 140, marque_name: "RENAULT", marque_alias: "renault" },
      ]),
    getModels: vi.fn().mockResolvedValue([
      {
        modele_id: 140004,
        modele_name: "CLIO III",
        modele_alias: "clio-iii",
      },
    ]),
    getTypes: vi.fn(async () => clioTypes),
  },
}));

const analyzeUrl = "/api/diagnostic-engine/analyze";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (input === analyzeUrl) {
        return {
          ok: true,
          json: async () => ({ success: false, error: "Test response" }),
        };
      }
      if (input === "/api/diagnostic-engine/wizard-steps") {
        return { ok: false, json: async () => null };
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
      if (input === "/api/diagnostic-engine/symptoms?system=freinage") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            symptoms: [
              {
                slug: "bruit-freinage",
                label: "Bruit au freinage",
                description: "Bruit",
                urgency: "moyenne",
              },
            ],
          }),
        };
      }
      throw new Error(`Unexpected request: ${input}`);
    }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

async function choose(trigger: string | RegExp, option: string) {
  const button = await screen.findByRole("button", { name: trigger });
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(button);
  fireEvent.click(await screen.findByRole("button", { name: option }));
}

async function submitAndReadVehicle() {
  fireEvent.click(screen.getByRole("button", { name: /Suivant/ }));
  fireEvent.click(await screen.findByRole("radio", { name: /Freinage/ }));
  fireEvent.click(
    await screen.findByRole("checkbox", { name: /Bruit au freinage/ }),
  );
  const submit = screen.getByRole("button", { name: /Lancer le diagnostic/ });
  await waitFor(() =>
    expect((submit as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(submit);
  await waitFor(() =>
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => url === analyzeUrl),
    ).toBe(true),
  );
  const request = vi
    .mocked(fetch)
    .mock.calls.find(([url]) => url === analyzeUrl);
  return JSON.parse(String(request?.[1]?.body)).vehicle_context;
}

async function chooseClio() {
  render(<DiagnosticWizard />);
  await choose("Sélectionner une marque", "RENAULT");
  await choose("Sélectionner un modèle", "CLIO III");
}

describe("DiagnosticWizard motorisation", () => {
  it.each([
    [19045, "1.2 16V 75 ch"],
    [19047, "1.2 16V 65 ch"],
  ])(
    "sends type_id %s for one of two engines sharing a name",
    async (typeId, engine) => {
      await chooseClio();
      const power = engine.split(" ").slice(-2).join(" ");
      await choose(
        "Sélectionner une motorisation",
        `1.2 16V · ${power} · Essence · 2005–2014`,
      );

      expect(await submitAndReadVehicle()).toEqual({
        type_id: typeId,
        brand: "RENAULT",
        model: "CLIO III",
        engine,
        fuel: "essence",
      });
    },
  );

  it("keeps the fuel unknown when the catalogue names no single engine fuel", async () => {
    await chooseClio();
    await choose(
      "Sélectionner une motorisation",
      "1.2 TCe · 100 ch · Essence/GPL · 2009–…",
    );

    expect(await submitAndReadVehicle()).toEqual({
      type_id: 99001,
      brand: "RENAULT",
      model: "CLIO III",
      engine: "1.2 TCe 100 ch",
    });
  });

  it("drops the motorisation when the model is chosen again", async () => {
    await chooseClio();
    await choose(
      "Sélectionner une motorisation",
      "1.2 16V · 65 ch · Essence · 2005–2014",
    );
    // The selected trigger's name also holds its clear button.
    await choose(/^CLIO III/, "CLIO III");

    expect(await submitAndReadVehicle()).toEqual({
      brand: "RENAULT",
      model: "CLIO III",
    });
  });

  it("asks for a model before listing motorisations", async () => {
    render(<DiagnosticWizard />);
    const trigger = await screen.findByRole("button", {
      name: "Sélectionner une motorisation",
    });
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("toEngineFuel", () => {
  it.each([
    ["Essence", "essence"],
    ["Diesel", "diesel"],
    [" Électrique ", "electrique"],
    ["GPL", "gpl"],
    ["Essence/GPL", undefined],
    ["Gaz naturel", undefined],
    ["", undefined],
    [undefined, undefined],
  ])("maps %s to %s", (label, fuel) => {
    expect(toEngineFuel(label)).toBe(fuel);
  });
});
