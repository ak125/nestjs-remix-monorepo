import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiagnosticWizard } from "~/components/diagnostic-wizard/DiagnosticWizard";

// Mandat GE: the vehicle chosen with the site's shared selector (cookie
// `selected_vehicle`) must reach the analysis without being entered again.
// Clio III 1.2 16V exists in 65 ch (19047) and 75 ch (19045) under one name.
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

function setSiteVehicle(vehicle: Record<string, unknown>) {
  document.cookie = `selected_vehicle=${encodeURIComponent(
    JSON.stringify(vehicle),
  )}; path=/`;
}

function siteClio(typeId: number) {
  return {
    marque_id: 140,
    marque_name: "RENAULT",
    marque_alias: "renault",
    modele_id: 140004,
    modele_name: "CLIO III",
    modele_alias: "clio-iii",
    type_id: typeId,
    type_name: "1.2 16V",
    type_alias: "1-2-16v",
    selected_at: "2026-11-27T22:00:00.000Z",
  };
}

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
  document.cookie = "selected_vehicle=; path=/; max-age=0";
  vi.unstubAllGlobals();
});

async function submitAndReadVehicle() {
  const next = screen.getByRole("button", { name: /Suivant/ });
  await waitFor(() => expect((next as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(next);
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

describe("DiagnosticWizard and the vehicle chosen on the site", () => {
  it.each([
    [19047, "65 ch"],
    [19045, "75 ch"],
  ])(
    "opens on site type %s and sends it without re-entry",
    async (typeId, power) => {
      setSiteVehicle(siteClio(typeId));
      render(<DiagnosticWizard />);

      // The driver sees which motorisation is used before going on.
      await screen.findByRole("button", {
        name: new RegExp(`^1\\.2 16V · ${power} · Essence`),
      });

      expect(await submitAndReadVehicle()).toEqual({
        type_id: typeId,
        brand: "RENAULT",
        model: "CLIO III",
        engine: `1.2 16V ${power}`,
        fuel: "essence",
      });
    },
  );

  it("keeps the vehicle of a draft in progress", async () => {
    setSiteVehicle(siteClio(19047));
    localStorage.setItem(
      "diag-wizard-draft",
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        step: 1,
        vehicle: {
          brand: "RENAULT",
          brandId: 140,
          model: "CLIO III",
          modelId: 140004,
          typeId: 19045,
          typeName: "1.2 16V",
          engine: "1.2 16V 75 ch",
          fuel: "essence",
        },
      }),
    );
    render(<DiagnosticWizard />);
    await screen.findByRole("button", { name: /^1\.2 16V · 75 ch/ });

    expect(await submitAndReadVehicle()).toMatchObject({ type_id: 19045 });
  });

  it("drops a site motorisation the model does not list", async () => {
    setSiteVehicle(siteClio(55555));
    render(<DiagnosticWizard />);
    await screen.findByRole("button", { name: /^CLIO III/ });
    await screen.findByRole("button", {
      name: "Sélectionner une motorisation",
    });

    expect(await submitAndReadVehicle()).toEqual({
      brand: "RENAULT",
      model: "CLIO III",
    });
  });

  it("ignores a site cookie without a type id", async () => {
    const { type_id: _omitted, ...withoutType } = siteClio(19047);
    setSiteVehicle(withoutType);
    render(<DiagnosticWizard />);

    expect(
      await screen.findByRole("button", { name: "Sélectionner une marque" }),
    ).toBeTruthy();
  });
});
