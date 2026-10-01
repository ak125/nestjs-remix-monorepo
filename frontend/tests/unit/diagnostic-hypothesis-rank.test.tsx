import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ResultHypotheses } from "~/components/diagnostic-wizard/results/ResultHypotheses";
import { type Hypothesis } from "~/components/diagnostic-wizard/types";

afterEach(cleanup);

const hypothesis = (id: string, score: number): Hypothesis => ({
  hypothesis_id: id,
  label: `Cause ${id}`,
  cause_type: "wear",
  relative_score: score,
  urgency: "moyenne",
  evidence_for: [],
  evidence_against: [],
  requires_verification: true,
});

describe("hypothesis ranks", () => {
  it("keeps the rank of secondary hypotheses readable on its light badge", () => {
    render(
      <ResultHypotheses
        hypotheses={[hypothesis("a", 70), hypothesis("b", 40)]}
      />,
    );
    const top = screen.getByText("1");
    const secondary = screen.getByText("2");
    expect(top.className).toContain("bg-blue-600");
    expect(top.className).toContain("text-white");
    expect(secondary.className).toContain("bg-gray-100");
    expect(secondary.className).not.toContain("text-white");
  });
});
