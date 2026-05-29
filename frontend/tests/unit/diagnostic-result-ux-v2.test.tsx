/**
 * PR-1a — Diagnostic Result UX v2 : tests des invariants
 *  - kill-switch DIAGNOSTIC_RESULT_UX_V2_ENABLED (rollback : flag OFF → rendu inchangé)
 *  - no-fake-confidence (risk_level absent → "À confirmer", jamais de verdict vert inventé)
 *  - bascule particulier/mécano (verbosité technique transmise à ResultHypotheses)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResultDrivability } from "~/components/diagnostic-wizard/results/ResultDrivability";
import { AudienceToggle } from "~/components/diagnostic-wizard/results/AudienceToggle";
import { ResultGarageReport } from "~/components/diagnostic-wizard/results/ResultGarageReport";
import { DiagnosticResults } from "~/components/diagnostic-wizard/results/DiagnosticResults";
import type {
  EvidencePack,
  WizardState,
  Hypothesis,
} from "~/components/diagnostic-wizard/types";

// Isole PR-1a : on stubbe les sous-blocs préexistants (testés ailleurs / hors scope).
// ResultHypotheses expose son prop `audience` pour vérifier le câblage de la bascule.
vi.mock("~/components/diagnostic-wizard/results/ResultSafety", () => ({
  ResultSafety: () => <div data-testid="safety" />,
}));
vi.mock("~/components/diagnostic-wizard/results/ResultSummary", () => ({
  ResultSummary: () => <div data-testid="summary" />,
}));
vi.mock("~/components/diagnostic-wizard/results/ResultHypotheses", () => ({
  ResultHypotheses: ({ audience }: { audience?: string }) => (
    <div data-testid="hypotheses" data-audience={audience} />
  ),
}));
vi.mock("~/components/diagnostic-wizard/results/ResultCatalog", () => ({
  ResultCatalog: () => <div data-testid="catalog" />,
}));
vi.mock("~/components/diagnostic-wizard/results/ResultMissing", () => ({
  ResultMissing: () => <div data-testid="missing" />,
}));
vi.mock("~/components/diagnostic-wizard/results/ResultDisclaimer", () => ({
  ResultDisclaimer: () => <div data-testid="disclaimer" />,
}));
vi.mock("~/components/diagnostic-wizard/results/ResultRagFacts", () => ({
  ResultRagFacts: () => <div data-testid="rag" />,
}));
vi.mock("~/components/diagnostic-wizard/results/ResultMaintenance", () => ({
  ResultMaintenance: () => <div data-testid="maintenance" />,
}));
vi.mock("~/components/diagnostic-wizard/results/IntentResolutionBlock", () => ({
  IntentResolutionBlock: () => <div data-testid="intent" />,
}));

const HYP: Hypothesis = {
  hypothesis_id: "h1",
  label: "Vanne EGR encrassée",
  cause_type: "component_fault",
  relative_score: 72,
  urgency: "haute",
  evidence_for: ["perte de puissance compatible"],
  evidence_against: [],
  verification_method: "Lire le code OBD",
  requires_verification: true,
};

function makeEvidencePack(over: Partial<EvidencePack> = {}): EvidencePack {
  return {
    factual_inputs_confirmed: ["Véhicule: Renault Clio"],
    factual_inputs_missing: ["Kilométrage non renseigné"],
    system_suspects: ["moteur"],
    candidate_hypotheses: [HYP],
    maintenance_links: [],
    risk_flags: [],
    safety_alert: undefined,
    risk_level: "low",
    catalog_guard: {
      ready_for_catalog: true,
      confidence_before_purchase: "medium",
      allowed_output_mode: "catalog_family_only",
      reason: "ok",
      suggested_gammes: [
        {
          gamme_slug: "vanne-egr",
          gamme_label: "Vanne EGR",
          pg_id: 123,
          confidence: "medium",
        },
      ],
    },
    maintenance_recommendations: [],
    rag_facts: [],
    allowed_claims: ["Un contrôle visuel est recommandé."],
    forbidden_claims_runtime: [],
    signal_quality: "medium",
    ui_block_inputs: {},
    ...over,
  };
}

function makeState(ep: EvidencePack): WizardState {
  return {
    step: 3,
    vehicle: {
      brand: "Renault",
      model: "Clio",
      year: 2015,
      mileage_km: 165000,
      fuel: "Diesel",
    },
    systemScope: "moteur",
    symptomSlugs: ["perte-puissance", "fumee-noire"],
    result: { success: true, session_id: "sess-1", evidence_pack: ep },
    loading: false,
    error: null,
  };
}

type EnvWindow = Window & { ENV?: { DIAGNOSTIC_RESULT_UX_V2_ENABLED?: boolean } };

function setFlag(enabled: boolean | undefined) {
  (window as unknown as EnvWindow).ENV =
    enabled === undefined ? {} : { DIAGNOSTIC_RESULT_UX_V2_ENABLED: enabled };
}

afterEach(() => {
  delete (window as unknown as EnvWindow).ENV;
});

describe("ResultDrivability — verdict & no-fake-confidence", () => {
  it("risk_level=critical → ne pas rouler", () => {
    render(<ResultDrivability riskLevel="critical" />);
    expect(screen.getByText("Puis-je rouler ?")).toBeTruthy();
    expect(screen.getByText("Ne roulez pas")).toBeTruthy();
  });

  it("risk_level=low → peut rouler", () => {
    render(<ResultDrivability riskLevel="low" />);
    expect(screen.getByText("Vous pouvez rouler")).toBeTruthy();
  });

  it('risk_level absent → "À confirmer" (jamais de verdict vert inventé)', () => {
    render(<ResultDrivability riskLevel={undefined} />);
    expect(screen.getByText("À confirmer")).toBeTruthy();
    expect(screen.queryByText("Vous pouvez rouler")).toBeNull();
  });
});

describe("AudienceToggle", () => {
  it("rend les deux niveaux et notifie le changement", () => {
    const onChange = vi.fn();
    render(<AudienceToggle value="particulier" onChange={onChange} />);
    expect(screen.getByText("Particulier")).toBeTruthy();
    const mecano = screen.getByText("Mécano");
    fireEvent.click(mecano);
    expect(onChange).toHaveBeenCalledWith("mecano");
  });
});

describe("ResultGarageReport — éphémère, copie", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("copie un rapport contenant véhicule + hypothèse", async () => {
    render(
      <ResultGarageReport
        vehicle={{ brand: "Renault", model: "Clio", fuel: "Diesel" }}
        symptomSlugs={["perte-puissance"]}
        hypotheses={[HYP]}
        suggestedGammes={[
          { gamme_slug: "vanne-egr", gamme_label: "Vanne EGR", pg_id: 1, confidence: "medium" },
        ]}
        missing={["Kilométrage non renseigné"]}
      />,
    );
    fireEvent.click(screen.getByText("Copier le rapport"));
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    expect(writeText).toHaveBeenCalledTimes(1);
    const payload = writeText.mock.calls[0][0] as string;
    expect(payload).toContain("Renault");
    expect(payload).toContain("Vanne EGR encrassée");
  });
});

describe("DiagnosticResults — kill-switch (rollback)", () => {
  it("flag OFF → blocs PR-1a absents, audience par défaut mécano", () => {
    setFlag(false);
    render(
      <DiagnosticResults state={makeState(makeEvidencePack())} dispatch={vi.fn()} />,
    );
    expect(screen.queryByText("Puis-je rouler ?")).toBeNull();
    expect(screen.queryByText("Rapport pour le garage")).toBeNull();
    expect(
      screen.getByTestId("hypotheses").getAttribute("data-audience"),
    ).toBe("mecano");
  });

  it("flag ON → verdict roulabilité + rapport garage + audience particulier", () => {
    setFlag(true);
    render(
      <DiagnosticResults state={makeState(makeEvidencePack())} dispatch={vi.fn()} />,
    );
    expect(screen.getByText("Puis-je rouler ?")).toBeTruthy();
    expect(screen.getByText("Rapport pour le garage")).toBeTruthy();
    expect(
      screen.getByTestId("hypotheses").getAttribute("data-audience"),
    ).toBe("particulier");
  });
});
