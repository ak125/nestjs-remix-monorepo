/**
 * Tests de PARITÉ H1 R2 — `PiecesHeader` (route `pieces.$gamme.$marque.$modele.$type`).
 *
 * Objectif (plan rév.9, Track A, PR-D2) : prouver que le `<h1>` RÉELLEMENT RENDU par
 * le composant égale `buildR2H1Emitted(...)` au byte près. Les golden tests de #1178
 * vérifient le builder *isolé* ; ce fichier ferme le trou non couvert = le rendu réel
 * (assemblage JSX `{a} {b}{" "}{c}…` avec `undefined→""`) == builder. Tant que c'est
 * vert, brancher le frontend sur le builder ne change AUCUN byte ; toute dérive du JSX
 * casse ce test.
 *
 * Verification-first : ces tests passent contre le JSX inline ACTUEL (pré-rewire).
 */

import { buildR2H1Emitted } from "@repo/seo-types";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PiecesHeader } from "~/components/pieces/PiecesHeader";
import {
  type GammeData,
  type VehicleData,
} from "~/types/pieces-route.types";

function makeR2Vehicle(overrides: Partial<VehicleData> = {}): VehicleData {
  return {
    marque: "renault",
    modele: "clio iii",
    type: "1.5 dCi 90",
    typeName: "1.5 dCi 90",
    typeId: 34189,
    marqueId: 7,
    modeleId: 140004,
    typePowerPs: 90,
    typeFuel: "Diesel",
    ...overrides,
  };
}

function makeGamme(overrides: Partial<GammeData> = {}): GammeData {
  return {
    id: 307,
    name: "Kit de distribution",
    alias: "kit-distribution",
    description: "",
    ...overrides,
  };
}

/** Reproduit le mapping du call-site `PiecesHeader.tsx` vers le builder. */
function expectedH1(opts: {
  vehicle: VehicleData;
  gamme: GammeData;
  compSwitch2?: readonly string[];
  prixPasCherText?: string;
}): string {
  const { vehicle, gamme, compSwitch2, prixPasCherText } = opts;
  return buildR2H1Emitted({
    gammeName: gamme.name,
    marque: vehicle.marque,
    modele: vehicle.modele,
    typeName: vehicle.typeName || vehicle.type,
    typePowerPs: vehicle.typePowerPs,
    typeFuel: vehicle.typeFuel,
    ctx: { typeId: vehicle.typeId, pgId: gamme.id },
    compSwitch2,
    literalFallback: prixPasCherText,
  });
}

describe("PiecesHeader R2 — parité <h1> rendu == buildR2H1Emitted", () => {
  it("rend exactement le builder — pool compSwitch2 (rotation déterministe)", () => {
    const vehicle = makeR2Vehicle();
    const gamme = makeGamme();
    const compSwitch2 = ["monter le kit de distribution"] as const;
    const { container } = render(
      <PiecesHeader
        vehicle={vehicle}
        gamme={gamme}
        count={24}
        compSwitch2={compSwitch2}
      />,
    );
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toBe(expectedH1({ vehicle, gamme, compSwitch2 }));
    // sanity : fragments stables présents (gamme + marque/modele uppercase + suffixe pool)
    expect(h1?.textContent).toContain("Kit de distribution");
    expect(h1?.textContent).toContain("RENAULT");
    expect(h1?.textContent).toContain("CLIO III");
    expect(h1?.textContent).toContain("monter le kit de distribution");
  });

  it("rend exactement le builder — fallback SEO_PRICE_VARIATIONS (compSwitch2 absent)", () => {
    const vehicle = makeR2Vehicle({ typeId: 70, modeleId: 11387 });
    const gamme = makeGamme({ id: 402, name: "Plaquette de frein" });
    const { container } = render(
      <PiecesHeader vehicle={vehicle} gamme={gamme} count={5} />,
    );
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toBe(expectedH1({ vehicle, gamme }));
  });

  it("rend exactement le builder — prixPasCherText legacy override", () => {
    const vehicle = makeR2Vehicle();
    const gamme = makeGamme();
    const prixPasCherText = "à prix discount";
    const { container } = render(
      <PiecesHeader
        vehicle={vehicle}
        gamme={gamme}
        count={3}
        prixPasCherText={prixPasCherText}
      />,
    );
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toBe(expectedH1({ vehicle, gamme, prixPasCherText }));
  });

  it("minPrice (PriceCard) n'altère pas le <h1>", () => {
    const vehicle = makeR2Vehicle();
    const gamme = makeGamme();
    const compSwitch2 = ["monter le kit de distribution"] as const;
    const { container } = render(
      <PiecesHeader
        vehicle={vehicle}
        gamme={gamme}
        count={24}
        minPrice={49.9}
        compSwitch2={compSwitch2}
      />,
    );
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toBe(expectedH1({ vehicle, gamme, compSwitch2 }));
  });

  it("un seul <h1> émis", () => {
    const { container } = render(
      <PiecesHeader vehicle={makeR2Vehicle()} gamme={makeGamme()} count={1} />,
    );
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });
});
