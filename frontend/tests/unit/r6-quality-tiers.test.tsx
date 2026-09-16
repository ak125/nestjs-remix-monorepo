import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { R6QualityTiersTable } from "~/components/blog/guide-achat/R6QualityTiersTable";

afterEach(cleanup);
const tier = {
  tier_id: "oe",
  label: "Origine",
  description: "Application documentée.",
  available: true,
};
describe("R6 quality comparison", () => {
  it("renders a valid comparison", () => {
    render(<R6QualityTiersTable tiers={[tier]} gammeName="Filtre à huile" />);
    expect(screen.getByText("Origine")).toBeTruthy();
    expect(screen.getByText("Application documentée.")).toBeTruthy();
  });
  it("retains the section anchor and explains missing comparative information", () => {
    const { container } = render(
      <R6QualityTiersTable
        tiers={[]}
        gammeName="Filtre à huile"
        reviewRequired
      />,
    );
    expect(container.querySelector("#niveaux-qualite")).toBeTruthy();
    expect(
      screen.getByText(
        "Les informations comparatives ne sont pas disponibles pour cette gamme.",
      ),
    ).toBeTruthy();
  });
  it("does not present stale cards when the server marks the section for review", () => {
    render(
      <R6QualityTiersTable
        tiers={[tier]}
        gammeName="Filtre à huile"
        reviewRequired
      />,
    );
    expect(screen.queryByText("Origine")).toBeNull();
  });
});
