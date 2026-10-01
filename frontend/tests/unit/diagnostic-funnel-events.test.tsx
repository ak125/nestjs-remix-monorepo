import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiagnosticWizard } from "~/components/diagnostic-wizard/DiagnosticWizard";
import { DiagnosticResults } from "~/components/diagnostic-wizard/results/DiagnosticResults";
import { type WizardState } from "~/components/diagnostic-wizard/types";
import { trackDiagnosticCompleted } from "~/utils/analytics";
import { emitFunnel } from "~/utils/funnel-beacon";

vi.mock("~/services/api/enhanced-vehicle.api", () => ({
  enhancedVehicleApi: {
    getBrands: vi.fn().mockResolvedValue([]),
    getModels: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("~/utils/funnel-beacon", () => ({
  emitFunnel: vi.fn(),
  getFunnelSessionId: () => "sid",
  getFunnelDevice: () => "desktop",
}));
vi.mock("~/utils/analytics", () => ({ trackDiagnosticCompleted: vi.fn() }));

const analyzeUrl = "/api/diagnostic-engine/analyze";
let analyzeResponse: unknown;

const catalogGuard = (mode = "catalog_family_with_caution") => ({
  ready_for_catalog: false,
  confidence_before_purchase: "medium",
  allowed_output_mode: mode,
  reason: "Controle necessaire",
  suggested_gammes: [
    {
      gamme_slug: "Plaquette de frein",
      gamme_label: "Plaquettes de frein",
      pg_id: 402,
      confidence: "medium" as const,
    },
  ],
});

const evidencePack = (extra = {}) => ({
  factual_inputs_confirmed: [],
  factual_inputs_missing: [],
  system_suspects: [],
  candidate_hypotheses: ["Plaquettes usees", "Disque voile"].map(
    (label, i) => ({
      hypothesis_id: `h${i}`,
      label,
      cause_type: "wear",
      relative_score: 50 - i * 10,
      urgency: "moyenne",
      evidence_for: [],
      evidence_against: [],
      requires_verification: true,
    }),
  ),
  maintenance_links: [],
  risk_flags: [],
  allowed_claims: [],
  forbidden_claims_runtime: [],
  ui_block_inputs: {},
  catalog_guard: catalogGuard(),
  ...extra,
});

const funnelEvents = (type: string) =>
  vi
    .mocked(emitFunnel)
    .mock.calls.map(([event]) => event)
    .filter((event) => event.event_type === type);

beforeEach(() => {
  localStorage.clear();
  vi.mocked(emitFunnel).mockClear();
  vi.mocked(trackDiagnosticCompleted).mockClear();
  analyzeResponse = { success: false, error: "Test response" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (input === analyzeUrl)
        return { ok: true, json: async () => analyzeResponse };
      if (input === "/api/diagnostic-engine/maintenance-operations")
        return {
          ok: true,
          json: async () => ({
            success: true,
            operations: [{ slug: "oil", label: "Vidange", description: null }],
          }),
        };
      if (input === "/api/diagnostic-engine/wizard-steps")
        return { ok: true, json: async () => ({}) };
      if (input === "/api/diagnostic-engine/systems")
        return {
          ok: true,
          json: async () => ({
            success: true,
            systems: [
              { slug: "freinage", label: "Freinage", description: "Freins" },
            ],
          }),
        };
      if (input === "/api/diagnostic-engine/symptoms?system=freinage")
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
      throw new Error(`Unexpected request: ${input}`);
    }),
  );
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function saveDraft(extra = {}) {
  localStorage.setItem(
    "diag-wizard-draft",
    JSON.stringify({
      step: 2,
      vehicle: { brand: "Renault", model: "Clio" },
      systemScope: "freinage",
      symptomSlugs: ["bruit-freinage"],
      savedAt: Date.now(),
      ...extra,
    }),
  );
}

async function submit(name: string) {
  const button = await screen.findByRole("button", { name });
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(button);
}

describe("diagnostic funnel: wizard start", () => {
  it("is sent once when the visitor leaves the vehicle step, not on the way back", async () => {
    render(<DiagnosticWizard />);
    expect(funnelEvents("diag_wizard_start")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    await screen.findByRole("button", { name: "Lancer le diagnostic" });
    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    fireEvent.click(await screen.findByRole("button", { name: "Suivant" }));
    await screen.findByRole("button", { name: "Lancer le diagnostic" });

    expect(funnelEvents("diag_wizard_start")).toEqual([
      {
        event_type: "diag_wizard_start",
        payload: { session_id: "sid", device: "desktop" },
      },
    ]);
  });
});

describe("diagnostic funnel: analysis completion", () => {
  it("reports a completed symptom analysis to the funnel and to GA4", async () => {
    analyzeResponse = { success: true, evidence_pack: evidencePack() };
    saveDraft();
    render(<DiagnosticWizard />);
    await submit("Lancer le diagnostic");
    await waitFor(() =>
      expect(funnelEvents("diag_analyze_complete")).toHaveLength(1),
    );

    expect(funnelEvents("diag_analyze_complete")[0].payload).toEqual({
      session_id: "sid",
      hypothesis_count: 2,
      has_suggested_gammes: true,
      vehicle_known: true,
    });
    expect(trackDiagnosticCompleted).toHaveBeenCalledWith({
      systemId: "freinage",
      symptomId: "bruit-freinage",
      resultsCount: 2,
    });
  });

  it("does not count catalogue suggestions the guard forbids", async () => {
    analyzeResponse = {
      success: true,
      evidence_pack: evidencePack({ catalog_guard: catalogGuard("none") }),
    };
    saveDraft({ vehicle: { brand: "", model: "" } });
    render(<DiagnosticWizard />);
    await submit("Lancer le diagnostic");
    await waitFor(() =>
      expect(funnelEvents("diag_analyze_complete")).toHaveLength(1),
    );

    expect(funnelEvents("diag_analyze_complete")[0].payload).toMatchObject({
      has_suggested_gammes: false,
      vehicle_known: false,
    });
  });

  it("reports nothing when the analysis fails", async () => {
    saveDraft();
    render(<DiagnosticWizard />);
    await submit("Lancer le diagnostic");
    await screen.findByText("Test response");

    expect(funnelEvents("diag_analyze_complete")).toHaveLength(0);
    expect(trackDiagnosticCompleted).not.toHaveBeenCalled();
  });

  it("keeps a maintenance check in the funnel but out of GA4 diagnostic_completed", async () => {
    analyzeResponse = {
      success: true,
      evidence_pack: evidencePack({
        analysis_kind: "maintenance",
        candidate_hypotheses: [],
        catalog_guard: { ...catalogGuard("none"), suggested_gammes: [] },
        maintenance_recommendations: [],
      }),
    };
    saveDraft({
      analysisMode: "maintenance",
      maintenanceRecords: [{ operation_slug: "oil" }],
    });
    render(<DiagnosticWizard />);
    await submit("Estimer les échéances");
    await waitFor(() =>
      expect(funnelEvents("diag_analyze_complete")).toHaveLength(1),
    );

    expect(funnelEvents("diag_analyze_complete")[0].payload).toMatchObject({
      hypothesis_count: 0,
      has_suggested_gammes: false,
    });
    expect(trackDiagnosticCompleted).not.toHaveBeenCalled();
  });
});

describe("diagnostic funnel: catalogue click-through", () => {
  function renderResults(maintenanceSlug = "Plaquette de frein") {
    const state: WizardState = {
      step: 3,
      vehicle: { brand: "Renault", model: "Clio" },
      systemScope: "freinage",
      symptomSlugs: ["bruit-freinage"],
      loading: false,
      error: null,
      result: {
        success: true,
        evidence_pack: {
          ...evidencePack(),
          candidate_hypotheses: [],
          maintenance_recommendations: [
            {
              operation_slug: "controle-freins",
              operation_label: "Controle des freins",
              description: "Verifier les plaquettes",
              relevance: "primary",
              interval_km: "30000 km",
              interval_months: "24 mois",
              severity_if_overdue: "high",
              related_gamme_slug: maintenanceSlug,
              related_pg_id: 402,
            },
          ],
        },
      },
    };
    render(<DiagnosticResults state={state} dispatch={vi.fn()} />);
  }

  const expectedClick = {
    event_type: "diag_gamme_cta_click",
    payload: {
      session_id: "sid",
      gamme_slug: "plaquette-de-frein",
      confidence: "medium",
    },
  };

  it("sends the canonical alias and confidence of a catalogue link", () => {
    renderResults();
    fireEvent.click(screen.getByRole("link", { name: /Plaquettes de frein/ }));
    expect(funnelEvents("diag_gamme_cta_click")).toEqual([expectedClick]);
  });

  it("sends the matching catalogue suggestion for a maintenance link", () => {
    renderResults("plaquette-de-frein");
    fireEvent.click(screen.getByRole("link", { name: "Voir les pièces" }));
    expect(funnelEvents("diag_gamme_cta_click")).toEqual([expectedClick]);
  });
});
