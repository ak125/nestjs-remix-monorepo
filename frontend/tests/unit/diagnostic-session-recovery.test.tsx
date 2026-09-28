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
const id = "12345678-1234-4123-8123-123456789abc";
const key = "diag-wizard-draft";
const endpoint = `/api/diagnostic-engine/sessions/${id}`;
const stored = () => ({
  success: true,
  session: {
    id,
    created_at: "2026-09-20T12:30:00+00:00",
    result: {
      evidence_pack: {
        factual_inputs_confirmed: ["Véhicule de la session"],
        factual_inputs_missing: ["Limite enregistrée"],
        system_suspects: [],
        candidate_hypotheses: [],
        maintenance_links: [],
        risk_flags: [],
        safety_alert: "Alerte sauvegardée : ne pas rouler",
        risk_level: "critical",
        catalog_guard: {
          ready_for_catalog: false,
          confidence_before_purchase: "low",
          allowed_output_mode: "none",
          reason: "Sécurité",
          suggested_gammes: [],
        },
        allowed_claims: [],
        forbidden_claims_runtime: [],
        ui_block_inputs: {},
      },
    },
  },
});
const response = (data: unknown, ok = true) => ({ ok, json: async () => data });
let load: () => Promise<unknown>;
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(
    { preserved: true },
    "",
    `/diagnostic-auto?session=${id}&source=test#assistant`,
  );
  load = async () => response(stored());
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === endpoint) return load();
      if (url.endsWith("/wizard-steps")) return response({});
      if (url.endsWith("/systems"))
        return response({ success: true, systems: [] });
      throw new Error(`Unexpected request ${url}`);
    }),
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});
describe("saved diagnostic links", () => {
  it.each([false, true])(
    "loads the saved result without analyzing or replacing a local draft (StrictMode=%s)",
    async (strict) => {
      const draft = JSON.stringify({
        step: 2,
        vehicle: { brand: "Autre", model: "Véhicule" },
        systemScope: "freinage",
        symptomSlugs: ["noise"],
        savedAt: Date.now(),
      });
      localStorage.setItem(key, draft);
      render(
        strict ? (
          <StrictMode>
            <DiagnosticWizard />
          </StrictMode>
        ) : (
          <DiagnosticWizard />
        ),
      );
      expect(await screen.findByText("Véhicule de la session")).toBeTruthy();
      expect(
        screen.getByText("Alerte sauvegardée : ne pas rouler"),
      ).toBeTruthy();
      expect(screen.getByText("Limite enregistrée")).toBeTruthy();
      expect(screen.getByText(/Résultat enregistré le/)).toBeTruthy();
      expect(screen.getByText(/aucune réévaluation/)).toBeTruthy();
      expect(localStorage.getItem(key)).toBe(draft);
      expect(
        vi
          .mocked(fetch)
          .mock.calls.some(([url]) => String(url).endsWith("/analyze")),
      ).toBe(false);
      expect(screen.queryByText("Aucun résultat disponible.")).toBeNull();
    },
  );
  it.each(["missing", "unavailable", "network", "malformed", "wrong-session"])(
    "shows a clear %s failure without resuming another draft",
    async (kind) => {
      load = async () => {
        if (kind === "network") throw new Error("offline");
        if (kind === "missing")
          return response({ success: false, error: "Session introuvable." });
        if (kind === "malformed")
          return response({ success: true, session: null });
        if (kind === "wrong-session")
          return response({
            ...stored(),
            session: {
              ...stored().session,
              id: "87654321-1234-4123-8123-123456789abc",
            },
          });
        return response({}, false);
      };
      render(<DiagnosticWizard />);
      expect(await screen.findByRole("alert")).toBeTruthy();
      expect(screen.queryByText("Véhicule de la session")).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Réessayer l'analyse" }),
      ).toBeNull();
      expect(
        screen.getByRole("button", { name: "Réessayer le chargement" }),
      ).toBeTruthy();
    },
  );
  it.each([
    "invalid",
    "",
    "../admin",
    "//example.invalid",
    "https://example.invalid/session",
    "12345678-1234-4123-8123-123456789abc/../admin",
    "12345678-1234-4123-8123-123456789abc?redirect=/admin",
    "12345678-1234-4123-8123-123456789abc#fragment",
    "%2e%2e%2fadmin",
    "12345678-1234-4123-8123-123456789abc\n",
  ])(
    "rejects an invalid URL identifier %j without a session request",
    async (value) => {
      window.history.replaceState({}, "", `/diagnostic-auto?session=${encodeURIComponent(value)}`);
      render(<DiagnosticWizard />);
      await screen.findByRole("alert");
      expect(
        vi
          .mocked(fetch)
          .mock.calls.some(([url]) => String(url).includes("/sessions/")),
      ).toBe(false);
    },
  );
  it("copies the identifier of the reopened session", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<DiagnosticWizard />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Copier le lien" }),
    );
    await screen.findByText("Lien copie");
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/diagnostic-auto?session=${id}`,
    );
  });
  it("retries a failed read and preserves the stored result", async () => {
    load = async () => response({}, false);
    render(<DiagnosticWizard />);
    const retry = await screen.findByRole("button", {
      name: "Réessayer le chargement",
    });
    load = async () => response(stored());
    fireEvent.click(retry);
    await screen.findByText("Véhicule de la session");
  });
  it("starts a new diagnostic without retaining the saved session URL or accepting a late response", async () => {
    let resolve!: (value: unknown) => void;
    load = () =>
      new Promise((yes) => {
        resolve = yes;
      });
    render(<DiagnosticWizard />);
    await waitFor(() =>
      expect(
        vi.mocked(fetch).mock.calls.some(([url]) => url === endpoint),
      ).toBe(true),
    );
    fireEvent.click(screen.getByRole("button", { name: "Nouveau diagnostic" }));
    await screen.findByRole("heading", { name: "Identifiez votre véhicule" });
    expect(window.location.search).toBe("?source=test");
    expect(window.location.hash).toBe("#assistant");
    expect(window.history.state).toEqual({ preserved: true });
    await act(async () => resolve(response(stored())));
    expect(screen.queryByText("Véhicule de la session")).toBeNull();
  });
});
