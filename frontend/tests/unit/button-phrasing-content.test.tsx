/**
 * A <button> only accepts phrasing content: no <div>, no <p>. The diagnostic
 * wizard's clickable cards nested both, through their own markup and through
 * <Badge>, whose root was a <div> (upstream shadcn renders a <span>).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultHypotheses } from "~/components/diagnostic-wizard/results/ResultHypotheses";
import { StepSymptom } from "~/components/diagnostic-wizard/steps/StepSymptom";
import {
  type Hypothesis,
  type ProvenanceState,
  type WizardState,
} from "~/components/diagnostic-wizard/types";
import { Badge } from "~/components/ui/badge";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const blockInsideButtons = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("button")).flatMap((button) =>
    Array.from(button.querySelectorAll("div, p"), (el) => el.tagName),
  );

describe("phrasing content inside buttons", () => {
  it("Badge renders an inline span root", () => {
    render(<Badge>Principal</Badge>);
    expect(screen.getByText("Principal").tagName).toBe("SPAN");
  });

  it("system radios and symptom checkboxes hold no div or p", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.includes("systems")
            ? {
                success: true,
                systems: [
                  {
                    slug: "filtration",
                    label: "Filtration",
                    description: "Huile, air, carburant",
                  },
                ],
              }
            : {
                success: true,
                symptoms: [
                  {
                    slug: "voyant_huile",
                    label: "Voyant huile",
                    description: "Le voyant reste allumé",
                    urgency: "critique",
                  },
                ],
              },
      })),
    );
    const state: WizardState = {
      step: 2,
      vehicle: { brand: "Test", model: "Test" },
      systemScope: "filtration",
      symptomSlugs: ["voyant_huile"],
      result: null,
      loading: false,
      error: null,
    };
    const { container } = render(
      <StepSymptom state={state} dispatch={vi.fn()} />,
    );
    await screen.findByRole("checkbox", {
      name: "Voyant huile — Urgence critique",
    });
    // Both descriptions and the primary badge still render.
    expect(screen.getByText("Huile, air, carburant")).toBeTruthy();
    expect(screen.getByText("Principal")).toBeTruthy();
    expect(screen.getByText("Le voyant reste allumé")).toBeTruthy();
    expect(blockInsideButtons(container)).toEqual([]);
  });

  it("hypothesis headers hold no div or p, provenance badge included, and show no score", () => {
    const hypothesis = (
      id: string,
      score: number,
      state: ProvenanceState,
    ): Hypothesis => ({
      hypothesis_id: id,
      label: `Cause ${id}`,
      cause_type: "wear",
      relative_score: score,
      urgency: "moyenne",
      evidence_for: ["Symptôme déclaré"],
      evidence_against: [],
      requires_verification: true,
      provenance: { state },
    });
    const { container } = render(
      <ResultHypotheses
        hypotheses={[
          hypothesis("a", 73, "sourced"),
          hypothesis("b", 41, "unsourced"),
        ]}
        provenanceSummary={{
          status: "available",
          counts: { sourced: 1, partial: 0, unsourced: 1 },
        }}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    // The provenance badge sits in the header, inside the button.
    expect(buttons[0].textContent).toContain("Relation documentée");
    expect(buttons[1].textContent).toContain("à confirmer par un contrôle");
    expect(screen.queryByText(/\/100/)).toBeNull();
    expect(blockInsideButtons(container)).toEqual([]);
  });
});
