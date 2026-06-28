/**
 * Tests de PARITÉ H1 R8 — `HeroSection` (route `constructeurs.$brand.$model.$type`).
 *
 * Objectif (plan rév.9, Track A, PR-D2) : prouver que le `<h1>` RÉELLEMENT RENDU par
 * le composant égale `buildR8H1Emitted(...)` au byte près. Les golden tests de #1178
 * vérifient le builder *isolé* ; ce fichier ferme le trou non couvert = le rendu réel
 * du composant == builder. Tant que c'est vert, brancher le frontend sur le builder
 * (rewire) ne change AUCUN byte émis ; et toute dérive future du JSX casse ce test.
 *
 * Verification-first : ces tests passent contre le JSX inline ACTUEL (pré-rewire) — si
 * l'un échoue, c'est que la byte-parité affirmée par #1178 ne tient pas dans le vrai
 * rendu, à corriger AVANT tout rewire.
 */

import { buildR8H1Emitted } from "@repo/seo-types";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { type VehicleData } from "~/components/vehicle/r8/r8.types";
import { HeroSection } from "~/components/vehicle/r8/sections/HeroSection";

/** Fixture R8 complète (tous les champs requis de `VehicleData`), surchargeable. */
function makeR8Vehicle(overrides: Partial<VehicleData> = {}): VehicleData {
  return {
    marque_id: 7,
    marque_alias: "renault",
    marque_name: "RENAULT",
    marque_name_meta: "Renault",
    marque_name_meta_title: "Renault",
    marque_logo: "renault.webp",
    marque_relfollow: 1,
    modele_id: 140004,
    modele_alias: "clio-iii",
    modele_name: "Clio III",
    modele_name_meta: "Clio III",
    modele_relfollow: 1,
    type_id: 34189,
    type_alias: "1-5-dci-90",
    type_name: "1.5 dCi 90",
    type_name_meta: "1.5 dCi 90",
    type_power_ps: "90",
    type_body: "Berline",
    type_fuel: "Diesel",
    type_month_from: "06",
    type_year_from: "2005",
    type_month_to: null,
    type_year_to: null,
    type_relfollow: 1,
    power: "90",
    date: "2005",
    ...overrides,
  };
}

/** Reproduit le mapping du call-site `HeroSection.tsx` vers le builder. */
function expectedH1(v: VehicleData): string {
  return buildR8H1Emitted({
    marqueName: v.marque_name,
    modeleName: v.modele_name,
    typeName: v.type_name,
    typePowerPs: v.type_power_ps,
    typeYearFrom: v.type_year_from,
    typeYearTo: v.type_year_to,
  });
}

describe("HeroSection R8 — parité <h1> rendu == buildR8H1Emitted", () => {
  it("rend exactement le builder (type_year_to null → « aujourd'hui »)", () => {
    const v = makeR8Vehicle({ type_year_to: null });
    const { container } = render(<HeroSection vehicle={v} />);
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toBe(expectedH1(v));
    // double-verrou : bytes concrets attendus
    expect(h1?.textContent).toBe(
      "RENAULT Clio III 1.5 dCi 90 90 ch de 2005 à aujourd'hui",
    );
  });

  it("rend exactement le builder (type_year_to défini)", () => {
    const v = makeR8Vehicle({ type_year_to: "2012" });
    const { container } = render(<HeroSection vehicle={v} />);
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toBe(expectedH1(v));
    expect(h1?.textContent).toBe(
      "RENAULT Clio III 1.5 dCi 90 90 ch de 2005 à 2012",
    );
  });

  it("un seul <h1> émis", () => {
    const { container } = render(
      <HeroSection vehicle={makeR8Vehicle()} />,
    );
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });
});
