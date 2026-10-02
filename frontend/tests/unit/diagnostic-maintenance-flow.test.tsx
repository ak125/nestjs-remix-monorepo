import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiagnosticWizard } from "~/components/diagnostic-wizard/DiagnosticWizard";
import { ResultMaintenance } from "~/components/diagnostic-wizard/results/ResultMaintenance";
vi.mock("~/services/api/enhanced-vehicle.api", () => ({
  enhancedVehicleApi: {
    getBrands: vi.fn().mockResolvedValue([]),
    getModels: vi.fn().mockResolvedValue([]),
  },
}));
const url = "/api/diagnostic-engine/analyze";
let response: unknown;
beforeEach(() => {
  localStorage.clear();
  response = { success: false, error: "Test response" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (input === url) return { ok: true, json: async () => response };
      if (input === "/api/diagnostic-engine/maintenance-operations")
        return {
          ok: true,
          json: async () => ({
            success: true,
            operations: [
              { slug: "oil", label: "Vidange", description: null },
              { slug: "fluid", label: "Liquide", description: null },
            ],
          }),
        };
      if (input === "/api/diagnostic-engine/wizard-steps")
        return { ok: true, json: async () => ({}) };
      if (input === "/api/diagnostic-engine/systems")
        return { ok: true, json: async () => ({ success: true, systems: [] }) };
      if (input.startsWith("/api/diagnostic-engine/symptoms"))
        return {
          ok: true,
          json: async () => ({ success: true, symptoms: [] }),
        };
      throw new Error(`Unexpected ${input}`);
    }),
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
const saved = (extra = {}) =>
  localStorage.setItem(
    "diag-wizard-draft",
    JSON.stringify({
      step: 2,
      analysisMode: "maintenance",
      vehicle: { brand: "", model: "", mileage_km: 10000 },
      maintenanceRecords: [
        {
          operation_slug: "oil",
          last_service_km: 0,
          last_service_date: "2025-01-01",
        },
        { operation_slug: "fluid" },
      ],
      savedAt: Date.now(),
      ...extra,
    }),
  );
describe("maintenance wizard integration", () => {
  it("enters maintenance without selecting a symptom and requires an operation", async () => {
    render(<DiagnosticWizard />);
    fireEvent.click(
      screen.getByRole("button", { name: "Vérifier mon entretien" }),
    );
    fireEvent.change(screen.getByLabelText("Kilométrage"), {
      target: { value: "0" },
    });
    expect(
      (screen.getByLabelText("Kilométrage") as HTMLInputElement).value,
    ).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    const oil = await screen.findByRole("checkbox", { name: "Vidange" });
    expect(
      (
        screen.getByRole("button", {
          name: "Estimer les échéances",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(oil);
    fireEvent.change(
      screen.getByLabelText("Kilométrage du dernier entretien — Vidange"),
      { target: { value: "0" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Estimer les échéances" }),
    );
    await screen.findByText("Test response");
    const call = vi.mocked(fetch).mock.calls.find(([input]) => input === url);
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      intent_type: "maintenance_check",
      vehicle_context: { mileage_km: 0 },
      usage_context: {
        maintenance_records: [{ operation_slug: "oil", last_service_km: 0 }],
      },
    });
  });
  it("restores independent histories and preserves unknown values after a failed submission", async () => {
    saved();
    render(<DiagnosticWizard />);
    await screen.findByRole("checkbox", { name: "Vidange" });
    const submit = screen.getByRole("button", {
      name: "Estimer les échéances",
    });
    await waitFor(() =>
      expect((submit as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(submit);
    await screen.findByText("Test response");
    const call = vi.mocked(fetch).mock.calls.find(([input]) => input === url);
    const body = JSON.parse(String(call?.[1]?.body));
    expect(body.signal_input).toBeUndefined();
    expect(body.system_scope).toBeUndefined();
    expect(body.usage_context.maintenance_records).toEqual([
      {
        operation_slug: "oil",
        last_service_km: 0,
        last_service_date: "2025-01-01",
      },
      { operation_slug: "fluid" },
    ]);
    expect(
      JSON.parse(localStorage.getItem("diag-wizard-draft")!).maintenanceRecords,
    ).toEqual(body.usage_context.maintenance_records);
  });
  it("does not send global service or hidden symptom information in maintenance mode", async () => {
    saved({
      lastServiceKm: 9999,
      usageProfile: "mixed",
      symptomSlugs: ["noise"],
      systemScope: "freinage",
    });
    render(<DiagnosticWizard />);
    const submit = await screen.findByRole("button", {
      name: "Estimer les échéances",
    });
    await waitFor(() =>
      expect((submit as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(submit);
    await screen.findByText("Test response");
    const body = JSON.parse(
      String(
        vi.mocked(fetch).mock.calls.find(([input]) => input === url)?.[1]?.body,
      ),
    );
    expect(Object.keys(body.usage_context)).toEqual(["maintenance_records"]);
    expect(body.signal_input).toBeUndefined();
  });
  it("renders a maintenance result with the history and generic deadlines, without diagnostic claims or purchase links", async () => {
    response = {
      success: true,
      session_id: null,
      evidence_pack: {
        analysis_kind: "maintenance",
        factual_inputs_confirmed: ["Compteur actuel : 10 000 km"],
        factual_inputs_missing: ["Applicabilité constructeur non vérifiée"],
        candidate_hypotheses: [],
        system_suspects: [],
        risk_flags: [],
        maintenance_links: [],
        allowed_claims: [],
        ui_block_inputs: {},
        catalog_guard: {
          allowed_output_mode: "none",
          suggested_gammes: [],
          reason: "Non vérifié",
        },
        maintenance_recommendations: [
          {
            operation_slug: "oil",
            operation_label: "Vidange",
            description: "",
            relevance: "selected",
            interval_km: "20 000 km",
            interval_months: "12 mois",
            severity_if_overdue: "moderate",
            overdue_status: "unknown",
            applicability: "unverified",
            last_service_km: 0,
            last_service_date: "2025-01-01",
            next_at_km: "20 000 km (estimation)",
            next_at_date: "2026-01-01 (estimation)",
          },
        ],
      },
    };
    saved();
    render(<DiagnosticWizard />);
    const submit = await screen.findByRole("button", {
      name: "Estimer les échéances",
    });
    await waitFor(() =>
      expect((submit as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(submit);
    await screen.findByText("Votre bilan entretien");
    expect(screen.queryByText(/affiner le diagnostic/i)).toBeNull();
    expect(screen.getByText("Limites et informations manquantes")).toBeTruthy();
    expect(screen.getByText("20 000 km (estimation)")).toBeTruthy();
    expect(screen.getByText("2026-01-01 (estimation)")).toBeTruthy();
    expect(screen.queryByText("Lié au symptôme")).toBeNull();
    expect(screen.queryByRole("link", { name: "Voir les pièces" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Copier le lien" })).toBeNull();
    expect(screen.queryByText(/hypothèse identifiée/i)).toBeNull();
  });
});

describe("maintenance status badges", () => {
  // Symptom-linked and selected operations share the same generic intervals.
  it.each([
    ["primary", "overdue", "Seuil indicatif dépassé"],
    ["related", "overdue", "Seuil indicatif dépassé"],
    ["selected", "overdue", "Seuil indicatif dépassé"],
    ["primary", "ok", "Sous les seuils indicatifs"],
    ["related", "unknown", "Informations insuffisantes"],
  ] as const)(
    "words a %s %s assessment as %s",
    (relevance, overdueStatus, label) => {
      render(
        <ResultMaintenance
          recommendations={[
            {
              operation_slug: "oil",
              operation_label: "Vidange",
              description: "",
              relevance,
              interval_km: "20 000 km",
              interval_months: "12 mois",
              severity_if_overdue: "high",
              overdue_status: overdueStatus,
              applicability: "unverified",
            },
          ]}
          maintenanceLinks={[]}
          allowedOutputMode="none"
          catalogGammes={[]}
        />,
      );
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.queryByText(/^(En retard|OK|Inconnu)$/)).toBeNull();
    },
  );
});
