/**
 * R2 — le code pays `tnc_code` (« D » / « F ») n'est JAMAIS rendu comme un « code mine ».
 *
 * Fait mesuré (lecture seule) : `rm_get_page_complete_v2` construit
 * `vehicleInfo.mineCodesFormatted` par `STRING_AGG(DISTINCT tnc_code)`. `tnc_code` ne
 * prend que deux valeurs, « D » (KBA) et « F » (Mines/CNIT) : c'est le pays de la
 * numérotation, pas un numéro. Avant ce correctif, `PiecesCompatibilityInfo` servait
 * « (code mine D, F) » dans le micro-bloc SSR et une carte « Type Mine / CNIT » = « D, F ».
 *
 * Ce fichier verrouille :
 *  - le mapper RM V2 → LoaderData ne propage plus `mineCodesFormatted` ;
 *  - le composant n'affiche plus ni la mention « code mine » ni la carte
 *    « Type Mine / CNIT », même si un appelant lui repassait l'ancienne prop ;
 *  - le code moteur reste affiché à l'identique.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PiecesCompatibilityInfo } from "~/components/pieces/PiecesCompatibilityInfo";
import { type RmPageV2Response } from "~/services/api/rm-api.service";
import { mapRmV2ToLoaderData } from "~/utils/rm-mapper";

/** Réponse RM V2 minimale : seuls les champs lus par `mapRmV2ToLoaderData`. */
function makeRmV2(): RmPageV2Response {
  return {
    products: [],
    grouped_pieces: [],
    count: 0,
    minPrice: 0,
    duration_ms: 1,
    cacheHit: false,
    oemRefs: [],
    crossSelling: [],
    gamme: {
      pg_id: 402,
      pg_name: "Plaquette de frein",
      pg_alias: "plaquette-de-frein",
      pg_pic: null,
      pg_ppa_id: null,
      pg_parent: null,
    },
    seo: {
      h1: "Plaquette de frein RENAULT Clio III",
      title: "Plaquette de frein RENAULT Clio III",
      description: "",
      content: "",
    },
    vehicleInfo: {
      typeId: 34189,
      typeName: "1.5 dCi",
      typeAlias: "1-5-dci",
      typePowerPs: "90",
      typePowerKw: "66",
      typeYearFrom: "2005",
      typeYearTo: "2012",
      typeBody: "Berline",
      typeFuel: "Diesel",
      typeEngine: "Diesel",
      typeLiter: "1.5",
      modeleId: 140004,
      modeleName: "Clio III",
      modeleAlias: "clio-iii",
      modelePic: null,
      marqueId: 140,
      marqueName: "RENAULT",
      marqueAlias: "renault",
      marqueLogo: null,
      motorCodesFormatted: "K9K 766",
      mineCodesFormatted: "D, F",
      cnitCodesFormatted: "M10RENVP000A123, 3333161",
    },
  } as unknown as RmPageV2Response;
}

describe("R2 mapper — `mineCodesFormatted` (tnc_code = pays D/F) n'est plus propagé", () => {
  it("`vehicle` ne porte plus `mineCodesFormatted` ; code moteur et CNIT inchangés", () => {
    const { vehicle } = mapRmV2ToLoaderData(makeRmV2());
    expect(vehicle).not.toHaveProperty("mineCodesFormatted");
    expect(vehicle.motorCodesFormatted).toBe("K9K 766");
    expect(vehicle.cnitCodesFormatted).toBe("M10RENVP000A123, 3333161");
  });
});

describe("R2 PiecesCompatibilityInfo — aucun « code mine » rendu", () => {
  const compatibility = {
    engines: ["K9K 766"],
    years: "2005 - 2012",
    notes: [],
  };

  it("ne rend ni « code mine D, F » ni la carte « Type Mine / CNIT », même si l'ancienne prop est passée", () => {
    // Appelant « legacy » qui repasserait encore la prop retirée : elle doit être ignorée.
    const legacyProps = {
      compatibility,
      vehicleName: "RENAULT Clio III",
      motorCodesFormatted: "K9K 766",
      mineCodesFormatted: "D, F",
    };
    const { container } = render(<PiecesCompatibilityInfo {...legacyProps} />);
    const text = container.textContent || "";
    expect(text).not.toMatch(/code mine/i);
    expect(text).not.toContain("Type Mine / CNIT");
    expect(text).not.toContain("D, F");
  });

  it("micro-bloc SSR : le code moteur reste servi à l'identique", () => {
    const { container } = render(
      <PiecesCompatibilityInfo
        compatibility={compatibility}
        vehicleName="RENAULT Clio III"
        motorCodesFormatted="K9K 766"
      />,
    );
    const micro = Array.from(container.querySelectorAll("p")).find((p) =>
      p.textContent?.startsWith("Cette pièce est compatible"),
    );
    expect(micro?.textContent).toBe(
      "Cette pièce est compatible avec votre RENAULT Clio III équipé du moteur K9K 766. Vérifiez la référence d'origine avant commande.",
    );
    expect(container.textContent).toContain("Code(s) Moteur");
  });

  it("sans code moteur : ni micro-bloc ni grille de codes", () => {
    const { container } = render(
      <PiecesCompatibilityInfo
        compatibility={compatibility}
        vehicleName="RENAULT Clio III"
      />,
    );
    expect(container.textContent).not.toContain("Cette pièce est compatible");
    expect(container.textContent).not.toContain("Code(s) Moteur");
  });
});
