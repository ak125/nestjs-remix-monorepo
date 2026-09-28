import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiagnosticResults } from "~/components/diagnostic-wizard/results/DiagnosticResults";
import { type WizardState } from "~/components/diagnostic-wizard/types";

afterEach(cleanup);

function renderResults(
  mode: string,
  pgId: number | undefined,
  slug = "Plaquette de frein",
  maintenancePgId = pgId,
  maintenanceSlug = slug,
) {
  const state: WizardState = {
    step: 3,
    vehicle: { brand: "Renault", model: "Clio" },
    systemScope: "freinage",
    symptomSlugs: ["bruit-freinage"],
    loading: false,
    error: null,
    result: {
      success: true,
      evidence_pack: {
        factual_inputs_confirmed: [],
        factual_inputs_missing: [],
        system_suspects: [],
        candidate_hypotheses: [],
        maintenance_links: [],
        risk_flags: [],
        allowed_claims: [],
        forbidden_claims_runtime: [],
        ui_block_inputs: {},
        catalog_guard: {
          ready_for_catalog: false,
          confidence_before_purchase: "medium",
          allowed_output_mode: mode,
          reason: "Controle necessaire",
          suggested_gammes: [
            {
              gamme_slug: slug,
              gamme_label: "Plaquettes de frein",
              pg_id: pgId as number,
              confidence: "medium",
            },
          ],
        },
        maintenance_recommendations: [
          {
            operation_slug: "controle-freins",
            operation_label: "Controle des freins",
            description: "Verifier les plaquettes",
            relevance: "primary",
            interval_km: "30000 km",
            interval_months: "24 mois",
            severity_if_overdue: "high",
            related_gamme_slug: maintenanceSlug,
            related_pg_id: maintenancePgId,
          },
        ],
      },
    },
  };
  render(<DiagnosticResults state={state} dispatch={vi.fn()} />);
}

describe("Diagnostic results catalogue links", () => {
  it("uses normalized aliases and IDs in both catalogue and maintenance links", () => {
    renderResults("catalog_family_with_caution", 402);
    expect(
      screen
        .getByRole("link", { name: /Plaquettes de frein/ })
        .getAttribute("href"),
    ).toBe("/pieces/plaquette-de-frein-402.html");
    expect(
      screen
        .getByRole("link", { name: "Voir les pièces" })
        .getAttribute("href"),
    ).toBe("/pieces/plaquette-de-frein-402.html");
  });

  it.each([
    [479, "liquide-de-frein"],
    [71, "kit-embrayage"],
  ])(
    "withholds a maintenance destination (%s, %s) that disagrees with the catalogue guard",
    (maintenanceId, maintenanceAlias) => {
      renderResults(
        "catalog_family_with_caution",
        71,
        "liquide-de-frein",
        maintenanceId,
        maintenanceAlias,
      );
      expect(
        screen.queryByRole("link", { name: "Voir les pièces" }),
      ).toBeNull();
      expect(screen.getAllByRole("link")).toHaveLength(1);
      expect(screen.getAllByRole("link")[0].getAttribute("href")).toBe(
        "/pieces/liquide-de-frein-71.html",
      );
      expect(screen.getByText("Controle des freins")).toBeTruthy();
    },
  );

  it("honors none for both blocks even with populated suggestions and maintenance", () => {
    renderResults("none", 402);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("Controle des freins")).toBeTruthy();
    expect(screen.getByText("Controle necessaire")).toBeTruthy();
  });

  it.each([undefined, 0, -1, 1.5, NaN])(
    "does not invent a destination for invalid gamme ID %s",
    (id) => {
      // Undefined is an intentionally incomplete API payload, despite its declared schema.
      renderResults("catalog_family_with_caution", id);
      expect(screen.queryAllByRole("link")).toHaveLength(0);
      expect(screen.getByText("Controle des freins")).toBeTruthy();
    },
  );

  it.each(["", "---", "null"])(
    "does not link a missing or malformed alias %s",
    (slug) => {
      renderResults("catalog_family_with_caution", 402, slug);
      expect(screen.queryAllByRole("link")).toHaveLength(0);
    },
  );
});
