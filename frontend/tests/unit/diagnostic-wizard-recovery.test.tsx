import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiagnosticWizard } from "~/components/diagnostic-wizard/DiagnosticWizard";
vi.mock("~/services/api/enhanced-vehicle.api", () => ({
  enhancedVehicleApi: {
    getBrands: vi.fn().mockResolvedValue([]),
    getModels: vi.fn().mockResolvedValue([]),
  },
}));
const key = "diag-wizard-draft";
const analyze = "/api/diagnostic-engine/analyze";
const initialDraft = () => ({
  step: 2,
  vehicle: { brand: "Renault", model: "Clio", mileage_km: 0 },
  systemScope: "freinage",
  symptomSlugs: ["noise"],
  lastServiceKm: 0,
  savedAt: Date.now(),
});
const storeDraft = (extra = {}) =>
  localStorage.setItem(key, JSON.stringify({ ...initialDraft(), ...extra }));
let analyzeResponse: () => Promise<unknown>;
let symptomsResponse: () => Promise<unknown>;
function response(data: unknown, ok = true) {
  return { ok, json: async () => data };
}
const symptomPayload = {
  success: true,
  symptoms: [
    { slug: "noise", label: "Bruit", description: null, urgency: "moyenne" },
  ],
};
const evidence = {
  success: true,
  evidence_pack: {
    factual_inputs_confirmed: [],
    factual_inputs_missing: [],
    system_suspects: [],
    candidate_hypotheses: [],
    maintenance_links: [],
    risk_flags: [],
    catalog_guard: {
      ready_for_catalog: false,
      confidence_before_purchase: "low",
      allowed_output_mode: "none",
      reason: "",
      suggested_gammes: [],
    },
    allowed_claims: [],
    forbidden_claims_runtime: [],
    ui_block_inputs: {},
  },
};
beforeEach(() => {
  localStorage.clear();
  analyzeResponse = async () =>
    response({ success: false, error: "Analyse indisponible" });
  symptomsResponse = async () => response(symptomPayload);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === analyze) return analyzeResponse();
      if (url.endsWith("/wizard-steps")) return response({});
      if (url.endsWith("/systems"))
        return response({
          success: true,
          systems: [{ slug: "freinage", label: "Freinage", description: null }],
        });
      if (url.includes("/symptoms?")) return symptomsResponse();
      throw new Error("Unexpected request " + url);
    }),
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
async function submitButton() {
  const button = await screen.findByRole("button", {
    name: "Lancer le diagnostic",
  });
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  );
  return button;
}
describe("diagnostic draft survives failed and interrupted analysis", () => {
  it.each(["api", "network"] as const)(
    "preserves the draft after %s failure and restores it on reload",
    async (failure) => {
      if (failure === "network")
        analyzeResponse = async () => {
          throw new Error("offline");
        };
      storeDraft();
      const rendered = render(<DiagnosticWizard />);
      fireEvent.click(await submitButton());
      await screen.findByRole("alert");
      expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject(
        initialDraftFields(),
      );
      rendered.unmount();
      render(<DiagnosticWizard />);
      expect(await submitButton()).not.toBeNull();
      expect(
        screen
          .getByRole("checkbox", { name: /Bruit/ })
          .getAttribute("aria-checked"),
      ).toBe("true");
    },
  );
  it("keeps a resumable step-two draft while the request is pending", async () => {
    analyzeResponse = () => new Promise(() => {});
    storeDraft();
    render(<DiagnosticWizard />);
    fireEvent.click(await submitButton());
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some(([url]) => url === analyze)).toBe(
        true,
      ),
    );
    expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject(
      initialDraftFields(),
    );
  });
  it("restores a draft correctly under StrictMode effect replay", async () => {
    storeDraft();
    render(
      <StrictMode>
        <DiagnosticWizard />
      </StrictMode>,
    );
    fireEvent.click(await submitButton());
    await screen.findByRole("alert");
    const call = vi.mocked(fetch).mock.calls.find(([url]) => url === analyze);
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      vehicle_context: { brand: "Renault", model: "Clio", mileage_km: 0 },
      usage_context: { last_service_km: 0 },
    });
  });
  it("clears a diagnostic draft only after a successful result", async () => {
    analyzeResponse = async () => response(evidence);
    storeDraft();
    render(<DiagnosticWizard />);
    fireEvent.click(await submitButton());
    await screen.findByRole("button", { name: "Nouveau diagnostic" });
    await waitFor(() => expect(localStorage.getItem(key)).toBeNull());
  });
});
function initialDraftFields() {
  return {
    step: 2,
    vehicle: { brand: "Renault", model: "Clio", mileage_km: 0 },
    systemScope: "freinage",
    symptomSlugs: ["noise"],
    lastServiceKm: 0,
  };
}
describe("draft validation protects the restored wizard", () => {
  it.each([
    { savedAt: undefined },
    { savedAt: Date.now() + 600000 },
    { savedAt: Date.now() - 8 * 24 * 3600 * 1000 },
    { vehicle: "invalid" },
    { vehicle: { brand: {}, model: "" } },
    { symptomSlugs: "noise" },
    { step: -1 },
    { step: 1.5 },
    { lastServiceKm: -1 },
    { vehicle: { brand: "", model: "", mileage_km: -1 } },
    { analysisMode: "unknown" },
    {
      maintenanceRecords: [{ operation_slug: "oil", last_service_km: "wrong" }],
    },
  ])("rejects corrupt or expired draft: %j", async (extra) => {
    storeDraft(extra);
    render(<DiagnosticWizard />);
    expect(
      await screen.findByRole("heading", { name: "Identifiez votre véhicule" }),
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Lancer le diagnostic" }),
    ).toBeNull();
  });
});
describe("wizard waits for valid selections and a single step transition", () => {
  it("blocks a restored selection until its catalog is loaded", async () => {
    let resolve!: (value: unknown) => void;
    symptomsResponse = () =>
      new Promise((yes) => {
        resolve = yes;
      });
    storeDraft();
    render(<DiagnosticWizard />);
    const button = await screen.findByRole("button", {
      name: "Lancer le diagnostic",
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolve(response(symptomPayload)));
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false),
    );
  });
  it.each(["unavailable", "missing"] as const)(
    "blocks a restored %s symptom selection",
    async (kind) => {
      symptomsResponse = async () =>
        response(
          kind === "missing" ? { success: true, symptoms: [] } : symptomPayload,
          kind !== "unavailable",
        );
      storeDraft();
      render(<DiagnosticWizard />);
      const button = await screen.findByRole("button", {
        name: "Lancer le diagnostic",
      });
      await screen.findByText(
        kind === "missing"
          ? "Aucun symptôme disponible pour ce système."
          : "Impossible de charger les symptômes pour ce système.",
      );
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
      expect(vi.mocked(fetch).mock.calls.some(([url]) => url === analyze)).toBe(
        false,
      );
    },
  );
  it("does not skip the symptom step after two rapid Next clicks", async () => {
    render(<DiagnosticWizard />);
    const button = screen.getByRole("button", { name: "Suivant" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(
      await screen.findByRole("button", { name: "Lancer le diagnostic" }),
    ).not.toBeNull();
    expect(screen.queryByText("Aucun résultat disponible.")).toBeNull();
  });
});
