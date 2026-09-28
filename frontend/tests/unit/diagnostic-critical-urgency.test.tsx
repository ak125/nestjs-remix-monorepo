import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiagnosticResults } from "~/components/diagnostic-wizard/results/DiagnosticResults";
import { StepSymptom } from "~/components/diagnostic-wizard/steps/StepSymptom";
import { type WizardState } from "~/components/diagnostic-wizard/types";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const base: WizardState = {
  step: 2,
  vehicle: { brand: "Test", model: "Test" },
  systemScope: "filtration",
  symptomSlugs: [],
  result: null,
  loading: false,
  error: null,
};
function Picker() {
  const [state, setState] = useState(base);
  return (
    <StepSymptom
      state={state}
      dispatch={(action) => {
        if (action.type === "ADD_SYMPTOM")
          setState({
            ...state,
            symptomSlugs: [...state.symptomSlugs, action.payload],
          });
      }}
    />
  );
}
function mockCatalog(urgency: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("systems")
          ? {
              success: true,
              systems: [
                { slug: "filtration", label: "Filtration", description: null },
              ],
            }
          : {
              success: true,
              symptoms: [
                {
                  slug: "voyant_huile",
                  label: "Voyant huile",
                  description: null,
                  urgency,
                },
              ],
            },
    })),
  );
}
describe("critical urgency in the diagnostic wizard", () => {
  it("loads and selects a critical symptom with its explicit urgency label", async () => {
    mockCatalog("critique");
    render(<Picker />);
    const symptom = await screen.findByRole("checkbox", {
      name: "Voyant huile — Urgence critique",
    });
    fireEvent.click(symptom);
    await waitFor(() =>
      expect(symptom.getAttribute("aria-checked")).toBe("true"),
    );
    expect(screen.queryByText(/Impossible de charger/)).toBeNull();
  });
  it("continues to reject an unknown urgency instead of hiding it", async () => {
    mockCatalog("inconnue");
    render(<Picker />);
    expect(
      await screen.findByText(/Impossible de charger les symptômes/),
    ).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
  it.each([{ flags: [] }, { flags: ["Urgence critique : Voyant huile"] }])(
    "shows critical safety and no purchase link with $flags",
    ({ flags: riskFlags }) => {
      const state: WizardState = {
        ...base,
        step: 3,
        result: {
          success: true,
          evidence_pack: {
            factual_inputs_confirmed: [],
            factual_inputs_missing: [
              "Réponses complémentaires non interprétées : elles ne modifient ni les hypothèses ni le niveau de risque de cette analyse.",
            ],
            system_suspects: [],
            candidate_hypotheses: [
              {
                hypothesis_id: "filtre_huile_colmate",
                label: "Filtre à huile colmaté",
                cause_type: "wear",
                relative_score: 55,
                urgency: "critique",
                evidence_for: ["Voyant"],
                evidence_against: [],
                requires_verification: true,
              },
            ],
            maintenance_links: [],
            risk_flags: riskFlags,
            risk_level: "critical",
            safety_alert:
              "Immédiat — ne pas rouler. Contrôle professionnel nécessaire.",
            catalog_guard: {
              ready_for_catalog: false,
              allowed_output_mode: "none",
              confidence_before_purchase: "low",
              reason: "Sécurité",
              suggested_gammes: [],
            },
            allowed_claims: [],
            forbidden_claims_runtime: [],
            ui_block_inputs: {},
          },
        },
      };
      render(<DiagnosticResults state={state} dispatch={vi.fn()} />);
      expect(screen.getByRole("alert").textContent).toMatch(/ne pas rouler/);
      expect(screen.getByText("critique")).toBeTruthy();
      expect(
        screen.getByText("Limites et informations manquantes"),
      ).toBeTruthy();
      expect(
        screen.getByText(/Réponses complémentaires non interprétées/),
      ).toBeTruthy();
      expect(
        screen.queryByText(
          "Ces informations permettraient d'affiner le diagnostic :",
        ),
      ).toBeNull();
      expect(screen.queryAllByRole("link")).toHaveLength(0);
    },
  );
});
