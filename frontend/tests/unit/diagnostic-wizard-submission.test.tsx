import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiagnosticWizard } from "~/components/diagnostic-wizard/DiagnosticWizard";

vi.mock("~/services/api/enhanced-vehicle.api", () => ({
  enhancedVehicleApi: {
    getBrands: vi.fn().mockResolvedValue([]),
    getModels: vi.fn().mockResolvedValue([]),
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
        return {
          ok: true,
          json: async () => ({
            entity_data: {
              steps: [
                { id: 1, label: "Vehicule", description: "Vehicule" },
                { id: 2, label: "Symptome", description: "Symptome" },
                { id: 3, label: "Diagnostic", description: "Diagnostic" },
              ],
              loading_steps: ["Analyse"],
            },
          }),
        };
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

describe("DiagnosticWizard submission from a restored draft", () => {
  it.each([
    {
      name: "service mileage without a usage profile",
      lastServiceKm: 120000,
      mileage: 140000,
      usageProfile: undefined,
      expectedUsage: { last_service_km: 120000 },
    },
    {
      name: "zero service mileage without a usage profile",
      lastServiceKm: 0,
      mileage: 10000,
      usageProfile: undefined,
      expectedUsage: { last_service_km: 0 },
    },
    {
      name: "zero vehicle and service mileages with a profile",
      lastServiceKm: 0,
      mileage: 0,
      usageProfile: "mixte",
      expectedUsage: { usage_profile: "mixte", last_service_km: 0 },
    },
    {
      name: "profile without an invented service mileage",
      lastServiceKm: undefined,
      mileage: 20000,
      usageProfile: "urbain",
      expectedUsage: { usage_profile: "urbain" },
    },
    {
      name: "absent optional values without inventing zero",
      lastServiceKm: undefined,
      mileage: undefined,
      usageProfile: undefined,
      expectedUsage: undefined,
    },
  ])(
    "preserves $name in the API request",
    async ({ lastServiceKm, mileage, usageProfile, expectedUsage }) => {
      localStorage.setItem(
        "diag-wizard-draft",
        JSON.stringify({
          step: 2,
          vehicle: { brand: "Renault", model: "Clio", mileage_km: mileage },
          lastServiceKm,
          usageProfile,
          systemScope: "freinage",
          symptomSlugs: ["bruit-freinage"],
          savedAt: Date.now(),
        }),
      );

      render(<DiagnosticWizard />);
      const submit = await screen.findByRole("button", {
        name: "Lancer le diagnostic",
      });
      await waitFor(() =>
        expect((submit as HTMLButtonElement).disabled).toBe(false),
      );
      fireEvent.click(submit);
      await waitFor(() =>
        expect(screen.getByRole("alert").textContent).toContain(
          "Test response",
        ),
      );

      const request = vi
        .mocked(fetch)
        .mock.calls.find(([url]) => url === analyzeUrl);
      expect(request?.[1]?.method).toBe("POST");
      const body = JSON.parse(String(request?.[1]?.body));
      expect(body.vehicle_context).toEqual({
        brand: "Renault",
        model: "Clio",
        ...(mileage === undefined ? {} : { mileage_km: mileage }),
      });
      expect(body.usage_context).toEqual(expectedUsage);
      expect(body.signal_input).toEqual({
        primary_signal: "bruit-freinage",
        signal_mode: "symptom_slugs",
      });
    },
  );
});
