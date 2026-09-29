/** Regression du contrat SQL : tnc_code contient le pays, tnc_cnit les identifiants.
 * Les agregats melangent les origines : ne pas qualifier tous les numeros de CNIT. */

import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PiecesCompatibilityInfo } from "~/components/pieces/PiecesCompatibilityInfo";
import { PiecesVehicleContent } from "~/components/pieces/PiecesVehicleContent";
import { type RmPageV2Response } from "~/services/api/rm-api.service";
import { buildVehicleData } from "~/utils/pieces-loader.utils";
import { mapRmV2ToLoaderData } from "~/utils/rm-mapper";

// Seuls les transports de mesure sont neutralisés ; le rendu R2 reste réel.
vi.mock("~/utils/funnel-beacon", () => ({
  emitFunnel: vi.fn(),
  getFunnelSessionId: () => "test-session",
  classifyReferrer: () => "direct",
}));
vi.mock("~/hooks/useSeoLinkTracking", () => ({
  useSeoLinkTracking: () => ({ trackClick: vi.fn(), trackImpression: vi.fn() }),
}));

/** Réponse RM V2 typée, avec un catalogue vide et deux origines de numérotation. */
function makeRmV2(): RmPageV2Response {
  return {
    success: true,
    filters: {
      brands: [],
      qualities: [],
      sides: [],
      price_range: { min: null, max: null },
    },
    validation: {
      valid: true,
      relationsCount: 0,
      dataQuality: {
        quality: 0,
        pieces_with_brand_percent: 0,
        pieces_with_image_percent: 0,
        pieces_with_price_percent: 0,
      },
    },
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
      preview: "",
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
  };
}

describe("R2 mapper — `mineCodesFormatted` (tnc_code = pays D/F) n'est plus propagé", () => {
  it("ne propage pas le pays et conserve les codes moteur et les identifiants", () => {
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

describe("R2 — references d'identification du catalogue", () => {
  const compatibility = { engines: [], years: "2005 - 2012", notes: [] };
  it("affiche les numeros disponibles avec un libelle neutre, sans code pays", () => {
    const props = {
      compatibility,
      vehicleName: "RENAULT Clio III",
      motorCodesFormatted: "K9K 766",
      mineCodesFormatted: "D, F",
      identificationCodesFormatted: "M10RENVP000A123, 3333161",
    };
    const { container } = render(<PiecesCompatibilityInfo {...props} />);
    expect(container.textContent).toContain("Références d’identification");
    expect(container.textContent).toContain("M10RENVP000A123, 3333161");
    expect(container.textContent).not.toMatch(/Type Mine|CNIT|D, F/);
  });

  it("conserve les references sans code moteur et sans phrase de compatibilite inventee", () => {
    const props = {
      compatibility,
      vehicleName: "RENAULT Clio III",
      identificationCodesFormatted: "0603AAA",
    };
    const { container } = render(<PiecesCompatibilityInfo {...props} />);
    expect(container.textContent).toContain("Références d’identification");
    expect(container.textContent).toContain("0603AAA");
    expect(container.textContent).not.toContain("Cette pièce est compatible");
    expect(container.textContent).not.toContain("Code(s) Moteur");
  });

  it("n'affiche aucune carte d'identification en l'absence de numeros", () => {
    const { container } = render(
      <PiecesCompatibilityInfo
        compatibility={compatibility}
        vehicleName="RENAULT Clio III"
      />,
    );
    expect(container.textContent).not.toContain("Références d’identification");
  });
});

// JSDOM ne fournit pas cette API navigateur utilisée par ScrollToTop.
beforeAll(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterAll(() => vi.unstubAllGlobals());

describe("R2 — transmission des identifiants jusqu'au rendu de la page", () => {
  it("buildVehicleData conserve les numeros sans propager le pays", () => {
    const vehicleInfo = {
      mineCodesFormatted: "D, F",
      cnitCodesFormatted: "0603AAA",
    };
    const vehicle = buildVehicleData({
      vehicleInfo,
      vehicleIds: { marqueId: 140, modeleId: 140004, typeId: 34189 },
      urlParams: {
        marqueAlias: "renault",
        modeleAlias: "clio-iii",
        typeAlias: "1-5-dci",
      },
    });
    expect(vehicle).not.toHaveProperty("mineCodesFormatted");
    expect(vehicle.cnitCodesFormatted).toBe("0603AAA");
  });

  it.each(["M10RENVP000A123, 3333161", null])(
    "rend la section réelle avec les identifiants RM %s",
    async (identifiants) => {
      const rm = makeRmV2();
      rm.vehicleInfo.cnitCodesFormatted = identifiants;
      const loaderData = mapRmV2ToLoaderData(rm);
      // Un ancien cache peut encore contenir le champ pays : le rendu doit l'ignorer.
      const data = {
        ...loaderData,
        voirAussiLinks: {
          gammeUrl: "/pieces/plaquette-de-frein-402.html",
          constructeurUrl: "/constructeurs/renault-140.html",
          modeleUrl: "/constructeurs/renault-140/clio-iii-140004.html",
          catalogueUrl: "/pieces/",
        },
        vehicle: { ...loaderData.vehicle, mineCodesFormatted: "D, F" },
      };
      const Stub = createRoutesStub([
        {
          path: "/",
          Component: PiecesVehicleContent,
          HydrateFallback: () => null,
          loader: () => data,
        },
      ]);
      const { container } = render(<Stub initialEntries={["/"]} />);
      await screen.findByRole("heading", {
        name: "Informations de compatibilité",
      });
      const section = container.querySelector("#compatibilite") as HTMLElement;
      if (identifiants) {
        expect(
          within(section).queryByText("Références d’identification"),
        ).not.toBeNull();
        expect(section.textContent).toContain(identifiants);
      } else {
        expect(
          within(section).queryByText("Références d’identification"),
        ).toBeNull();
      }
      expect(section.textContent).not.toMatch(/Type Mine|CNIT|D, F/);
    },
  );
});
