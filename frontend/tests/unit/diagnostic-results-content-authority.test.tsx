import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiagnosticResults } from "~/components/diagnostic-wizard/results/DiagnosticResults";
import { type WizardState } from "~/components/diagnostic-wizard/types";

afterEach(cleanup);

describe("Diagnostic content authority", () => {
  it.each(["L1", "L2", "L4"])(
    "ignores historical RAG facts even when tagged %s and retains the diagnostic",
    (truth_level) => {
      // An older API/session can still carry extra keys after the UI is updated.
      const legacyEvidence = {
        factual_inputs_confirmed: ["Signal reconnu"],
        factual_inputs_missing: ["Kilometrage inconnu"],
        system_suspects: ["Freinage"],
        candidate_hypotheses: [],
        maintenance_links: [],
        risk_flags: ["Risque de freinage"],
        risk_level: "critical" as const,
        safety_alert: "Arreter le vehicule",
        catalog_guard: {
          ready_for_catalog: false,
          confidence_before_purchase: "low",
          allowed_output_mode: "none",
          reason: "Controle requis",
          suggested_gammes: [],
        },
        allowed_claims: ["Controle professionnel recommande"],
        ui_block_inputs: {},
        rag_facts: [
          {
            evidence_type: "verification_support_evidence",
            content: "CONTENU RAG NON APPROUVE",
            source_file: "raw/fixture.md",
            truth_level,
          },
        ],
      };
      const state: WizardState = {
        step: 4,
        vehicle: { brand: "", model: "" },
        systemScope: "freinage",
        symptomSlugs: ["bruit"],
        loading: false,
        error: null,
        result: { success: true, evidence_pack: legacyEvidence },
      };
      render(<DiagnosticResults state={state} dispatch={vi.fn()} />);
      expect(screen.queryByText("CONTENU RAG NON APPROUVE")).toBeNull();
      expect(screen.queryByText("Documentation technique")).toBeNull();
      expect(screen.queryByText(/fait.*vérifié/)).toBeNull();
      expect(screen.getByText("Arreter le vehicule")).toBeTruthy();
      expect(screen.getByText("Risque de freinage")).toBeTruthy();
      expect(screen.getByText("Signal reconnu")).toBeTruthy();
      expect(screen.getByText("Controle requis")).toBeTruthy();
      expect(screen.getByText("Kilometrage inconnu")).toBeTruthy();
    },
  );
});
