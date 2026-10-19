import { describe, expect, it } from "vitest";
import {
  executionPresentation,
  hasRenderedArtifact,
} from "../../app/utils/video-execution";
describe("execution results presentation", () => {
  it.each([
    undefined,
    null,
    "completed",
    "success",
    "toString",
    "__proto__",
    {},
  ])("does not infer success from %s", (value) => {
    expect(executionPresentation(value).label).toBe("Résultat indéterminé");
    expect(hasRenderedArtifact(value)).toBe(false);
  });
  it.each([
    "disabled",
    "simulated",
    "skipped",
    "failed",
    "pending",
    "processing",
  ])("never offers an artifact for %s", (outcome) => {
    expect(hasRenderedArtifact(outcome)).toBe(false);
    expect(executionPresentation(outcome).className).not.toContain("green");
  });
  it("distinguishes unchecked renders from checked renders", () => {
    expect(executionPresentation("rendered_unverified").label).toBe(
      "Rendu non vérifié",
    );
    expect(
      executionPresentation("rendered_unverified").className,
    ).not.toContain("green");
    expect(hasRenderedArtifact("rendered_unverified")).toBe(true);
    expect(executionPresentation("rendered_checked").label).toBe(
      "Rendu contrôlé",
    );
  });
});
