/**
 * WIKI provenance on the hypothesis cards (ADR-035, INC-2026-013): a neutral
 * badge says what the WIKI documents behind each cause, only when the
 * provenance was read. No summary (flag OFF, stored session) or an unreadable
 * one shows no badge rather than a false one.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiagnosticResults } from "~/components/diagnostic-wizard/results/DiagnosticResults";
import { ResultHypotheses } from "~/components/diagnostic-wizard/results/ResultHypotheses";
import {
  type EvidencePack,
  type Hypothesis,
  type ProvenanceState,
  type ProvenanceSummary,
  type WizardState,
} from "~/components/diagnostic-wizard/types";

afterEach(cleanup);

const LABELS: Record<ProvenanceState, string> = {
  sourced: "Relation documentée (relue, sources archivées)",
  partial: "Relation partiellement documentée",
  unsourced: "Relation non encore documentée — à confirmer par un contrôle",
};

const wikiRef = {
  wiki_path: "gammes/batterie.md",
  gamme_slug: "batterie",
  relation_to_part: "direct_cause",
  diagnostic_safe: true,
};
const link = (linkId: number, documented: boolean) => ({
  link_id: linkId,
  symptom_slug: `symptome-${linkId}`,
  documented,
  wiki_refs: documented ? [wikiRef] : [],
});
const LINKS: Record<ProvenanceState, ReturnType<typeof link>[]> = {
  sourced: [link(11, true)],
  partial: [link(12, true), link(13, false)],
  unsourced: [link(14, false)],
};

// As the engine serves it: the state, plus the links and fiches behind it,
// which the results page does not show.
const hypothesis = (
  id: string,
  score: number,
  state?: ProvenanceState,
): Hypothesis => ({
  hypothesis_id: id,
  label: `Cause ${id}`,
  cause_type: "wear",
  relative_score: score,
  urgency: "moyenne",
  evidence_for: ["Symptôme déclaré"],
  evidence_against: [],
  requires_verification: true,
  ...(state ? { provenance: served(state) } : {}),
});
function served(state: ProvenanceState) {
  return { state, links: LINKS[state] };
}

const HYPOTHESES = [
  hypothesis("a", 73, "sourced"),
  hypothesis("b", 58, "partial"),
  hypothesis("c", 41, "unsourced"),
];
const AVAILABLE: ProvenanceSummary = {
  status: "available",
  counts: { sourced: 1, partial: 1, unsourced: 1 },
};

const badges = () =>
  Object.values(LABELS).filter((label) => screen.queryByText(label));

describe("hypothesis provenance badges", () => {
  it("label each hypothesis with its provenance when it was read", () => {
    render(
      <ResultHypotheses
        hypotheses={HYPOTHESES}
        provenanceSummary={AVAILABLE}
      />,
    );
    for (const label of Object.values(LABELS)) {
      expect(screen.getAllByText(label)).toHaveLength(1);
    }
  });

  it("keep the rank as the only number, and show the state only", () => {
    const { container } = render(
      <ResultHypotheses
        hypotheses={HYPOTHESES}
        provenanceSummary={AVAILABLE}
      />,
    );
    const text = container.textContent ?? "";
    expect(text.match(/\d+/g)).toEqual(["1", "2", "3"]);
    // Neither the links nor the fiches behind the state, nor a part role.
    for (const hidden of [
      "gammes/batterie.md",
      "batterie",
      "direct_cause",
      "symptome",
      "part_role",
    ]) {
      expect(text).not.toContain(hidden);
    }
  });

  it.each([
    ["no summary (flag OFF, stored session)", undefined],
    ["an unavailable provenance", { status: "unavailable" } as const],
  ])("show no provenance badge with %s", (_name, summary) => {
    render(
      <ResultHypotheses hypotheses={HYPOTHESES} provenanceSummary={summary} />,
    );
    expect(badges()).toEqual([]);
  });

  it("receive the summary of the evidence pack from the results page", () => {
    const evidence: EvidencePack = {
      factual_inputs_confirmed: [],
      factual_inputs_missing: [],
      system_suspects: [],
      candidate_hypotheses: HYPOTHESES,
      maintenance_links: [],
      risk_flags: [],
      catalog_guard: {
        ready_for_catalog: false,
        confidence_before_purchase: "low",
        allowed_output_mode: "none",
        reason: "Test",
        suggested_gammes: [],
      },
      allowed_claims: [],
      ui_block_inputs: {},
      provenance_summary: AVAILABLE,
    };
    const state: WizardState = {
      step: 4,
      vehicle: { brand: "Test", model: "Test" },
      systemScope: "electricite",
      symptomSlugs: [],
      result: { success: true, evidence_pack: evidence },
      loading: false,
      error: null,
    };
    render(<DiagnosticResults state={state} dispatch={vi.fn()} />);
    expect(badges()).toEqual(Object.values(LABELS));
  });
});
