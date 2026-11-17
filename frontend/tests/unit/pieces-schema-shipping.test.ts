import { describe, expect, it } from "vitest";

import { type PieceData } from "~/types/pieces-route.types";
import { buildPiecesVehicleMeta } from "~/utils/pieces-vehicle.meta";
import { type ShippingPolicyResult } from "~/utils/remix-application-port";
import { buildPiecesProductSchema } from "~/utils/seo/pieces-schema.utils";

/**
 * Page pièces par véhicule (R2), port déclaré dans le JSON-LD (mandat BJ).
 *
 * Les Product/Offer de la liste sont ceux que Google lit comme fiches de
 * marchand ; le Product principal porte un `AggregateOffer`. Chaque offre
 * déclare le port de la règle reçue du backend : forfait sous le seuil de
 * gratuité, 0 à partir du seuil (borne incluse), France (`FR`).
 * Le frontend ne porte aucune valeur : les tests passent la règle en entrée.
 */
const POLICY_BJ: ShippingPolicyResult = {
  flatFeeTTC: 9.9,
  freeShippingThresholdTTC: 100,
};

const CANONICAL =
  "https://www.automecanik.com/pieces/alternateur-4/audi-22/a4-iii-22042/2-5-tdi-18402.html";

const piece = (id: number, price: number): PieceData => ({
  id,
  name: `Alternateur ${id}`,
  price,
  priceFormatted: price.toFixed(2).replace(".", ","),
  brand: `Marque ${id}`,
  stock: "",
  reference: `REF-${id}`,
  image: `https://www.automecanik.com/img/rack-images/1/${id}.webp`,
});

const vehicle = {
  marque: "AUDI",
  modele: "A4 III",
  type: "2.5 TDI",
  typeId: 18402,
  marqueId: 22,
  modeleId: 22042,
};
const gamme = {
  id: 4,
  name: "Alternateur",
  alias: "alternateur",
  description: "",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = Record<string, any>;

const graph = (
  pieces: PieceData[],
  shippingPolicy: ShippingPolicyResult | null,
): Node[] =>
  (buildPiecesProductSchema({
    vehicle,
    gamme,
    pieces,
    seo: { description: "Alternateur pour AUDI A4 III 2.5 TDI" },
    count: pieces.length,
    canonicalUrl: CANONICAL,
    shippingPolicy,
    returnPolicy: null,
  })?.["@graph"] ?? []) as Node[];

const listOffers = (
  pieces: PieceData[],
  policy: ShippingPolicyResult | null,
): Node[] =>
  (
    graph(pieces, policy).find((n) => n["@type"] === "ItemList")
      ?.itemListElement ?? []
  ).map((entry: Node) => entry.item.offers);

const aggregate = (
  pieces: PieceData[],
  policy: ShippingPolicyResult | null,
): Node | undefined =>
  graph(pieces, policy).find((n) => n["@type"] === "Product")?.offers;

const rate = (offer: Node | undefined) =>
  offer?.shippingDetails?.shippingRate?.value;

describe("JSON-LD R2 — port de chaque Offer (fiches de marchand)", () => {
  it.each([
    [99.99, 9.9],
    [100, 0],
    [54.38, 9.9],
    [137, 0],
  ])("offre à %s € TTC → port %s €", (price, expected) => {
    const [offer] = listOffers([piece(1, price)], POLICY_BJ);
    expect(rate(offer)).toBe(expected);
  });

  it("chaque Offer de la liste porte shippingDetails", () => {
    const offers = listOffers(
      [piece(1, 12), piece(2, 99.99), piece(3, 100), piece(4, 480)],
      POLICY_BJ,
    );
    expect(offers).toHaveLength(4);
    for (const offer of offers) {
      expect(offer.shippingDetails).toMatchObject({
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", currency: "EUR" },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "FR",
        },
        deliveryTime: { "@type": "ShippingDeliveryTime" },
      });
    }
    expect(offers.map(rate)).toEqual([9.9, 9.9, 0, 0]);
  });

  it("le montant vient de la règle reçue, pas d'une valeur du frontend", () => {
    const autre: ShippingPolicyResult = {
      flatFeeTTC: 4.5,
      freeShippingThresholdTTC: 60,
    };
    expect(
      listOffers([piece(1, 59.99), piece(2, 60)], autre).map(rate),
    ).toEqual([4.5, 0]);
  });
});

describe("JSON-LD R2 — port de l'agrégat (extrait de produit)", () => {
  it("prix le plus bas sous le seuil → forfait", () => {
    expect(rate(aggregate([piece(1, 54.38), piece(2, 250)], POLICY_BJ))).toBe(
      9.9,
    );
  });

  it("toutes les offres au-dessus du seuil → port offert", () => {
    expect(rate(aggregate([piece(1, 100), piece(2, 250)], POLICY_BJ))).toBe(0);
  });
});

describe("JSON-LD R2 — règle de port indisponible", () => {
  it("aucun shippingDetails, ni sur l'agrégat ni sur les offres", () => {
    const pieces = [piece(1, 54.38), piece(2, 137)];
    expect(JSON.stringify(graph(pieces, null))).not.toContain(
      "shippingDetails",
    );
  });
});

describe("buildPiecesVehicleMeta — la règle du root loader atteint le JSON-LD", () => {
  const data = {
    vehicle,
    gamme,
    pieces: [piece(1, 99.99), piece(2, 100)],
    count: 2,
    seo: { title: "Alternateur AUDI A4 III", description: "Alternateur" },
    faqItems: [],
    canonicalPath:
      "/pieces/alternateur-4/audi-22/a4-iii-22042/2-5-tdi-18402.html",
  };

  const productGraph = (policy: ShippingPolicyResult | null) => {
    const meta = buildPiecesVehicleMeta(data, { pathname: "/x" }, policy, null);
    const ld = meta.find(
      (m) => "script:ld+json" in m && "@graph" in (m["script:ld+json"] as Node),
    ) as Node | undefined;
    return ld?.["script:ld+json"]["@graph"] as Node[];
  };

  it("offres de la liste : 9,90 € sous 100 €, 0 € à 100 €", () => {
    const list = productGraph(POLICY_BJ).find((n) => n["@type"] === "ItemList");
    expect(list?.itemListElement.map((e: Node) => rate(e.item.offers))).toEqual(
      [9.9, 0],
    );
  });

  it("sans règle : aucun port déclaré", () => {
    expect(JSON.stringify(productGraph(null))).not.toContain("shippingDetails");
  });
});
