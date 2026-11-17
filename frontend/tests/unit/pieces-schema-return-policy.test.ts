import { describe, expect, it } from "vitest";

import { type PieceData } from "~/types/pieces-route.types";
import { buildPiecesVehicleMeta } from "~/utils/pieces-vehicle.meta";
import {
  type ReturnPolicyResult,
  type ShippingPolicyResult,
} from "~/utils/remix-application-port";
import { buildMerchantReturnPolicy } from "~/utils/seo/pieces-schema-commerce.constants";
import { buildPiecesProductSchema } from "~/utils/seo/pieces-schema.utils";

/**
 * Page pièces par véhicule (R2), politique de retour déclarée dans le JSON-LD
 * (mandat BJ, décision du 17/11/2026 22:13). Chaque offre qui déclare un port
 * déclare aussi la politique de retour reçue du backend. Le frontend ne porte
 * aucune valeur : les tests passent la règle en entrée.
 */
const RETOURS_BJ: ReturnPolicyResult = {
  country: "FR",
  returnWindowDays: 30,
  returnMethod: "by_mail",
  returnFeesPaidBy: "customer",
  returnFeesWaivedFor: ["item_defect", "seller_error"],
  refundMethod: "original_payment_method",
};

const PORT_BJ: ShippingPolicyResult = {
  flatFeeTTC: 9.9,
  freeShippingThresholdTTC: 100,
};

const ATTENDU = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "FR",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 30,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
  itemDefectReturnFees: "https://schema.org/FreeReturn",
};

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
  returnPolicy: ReturnPolicyResult | null,
  shippingPolicy: ShippingPolicyResult | null = PORT_BJ,
): Node[] =>
  (buildPiecesProductSchema({
    vehicle,
    gamme,
    pieces,
    seo: { description: "Alternateur pour AUDI A4 III 2.5 TDI" },
    count: pieces.length,
    canonicalUrl:
      "https://www.automecanik.com/pieces/alternateur-4/audi-22/a4-iii-22042/2-5-tdi-18402.html",
    shippingPolicy,
    returnPolicy,
  })?.["@graph"] ?? []) as Node[];

const allOffers = (g: Node[]): Node[] => [
  g.find((n) => n["@type"] === "Product")?.offers,
  ...(g.find((n) => n["@type"] === "ItemList")?.itemListElement ?? []).map(
    (e: Node) => e.item.offers,
  ),
];

describe("buildMerchantReturnPolicy — traduction schema.org", () => {
  it("30 jours, envoi postal, frais client, pièce défectueuse retournée gratuitement", () => {
    expect(buildMerchantReturnPolicy(RETOURS_BJ)).toEqual(ATTENDU);
  });

  it("ne déclare ni refundType ni moyen de remboursement (aucune propriété schema.org)", () => {
    const declare = buildMerchantReturnPolicy(RETOURS_BJ);
    expect(declare).not.toHaveProperty("refundType");
    expect(JSON.stringify(declare)).not.toMatch(/payment|seller_error/i);
  });

  it("le délai vient de la règle reçue", () => {
    expect(
      buildMerchantReturnPolicy({ ...RETOURS_BJ, returnWindowDays: 45 })
        .merchantReturnDays,
    ).toBe(45);
  });

  it("sans exception « pièce défectueuse », pas d'itemDefectReturnFees", () => {
    expect(
      buildMerchantReturnPolicy({
        ...RETOURS_BJ,
        returnFeesWaivedFor: ["seller_error"],
      }),
    ).not.toHaveProperty("itemDefectReturnFees");
  });
});

describe("JSON-LD R2 — chaque offre avec port porte hasMerchantReturnPolicy", () => {
  it("agrégat et offres de la liste", () => {
    const offers = allOffers(
      graph([piece(1, 54.38), piece(2, 137)], RETOURS_BJ),
    );
    expect(offers).toHaveLength(3);
    for (const offer of offers) {
      expect(offer.shippingDetails).toBeDefined();
      expect(offer.hasMerchantReturnPolicy).toEqual(ATTENDU);
    }
  });

  it("politique de retour indisponible : aucune politique déclarée, port inchangé", () => {
    const offers = allOffers(graph([piece(1, 54.38), piece(2, 137)], null));
    for (const offer of offers) {
      expect(offer.shippingDetails).toBeDefined();
      expect(offer).not.toHaveProperty("hasMerchantReturnPolicy");
    }
  });

  it("plus de valeur en dur : aucun délai de 14 jours", () => {
    expect(JSON.stringify(graph([piece(1, 54.38)], RETOURS_BJ))).not.toContain(
      '"merchantReturnDays":14',
    );
  });
});

describe("buildPiecesVehicleMeta — la règle du root loader atteint le JSON-LD", () => {
  const data = {
    vehicle,
    gamme,
    pieces: [piece(1, 99.99)],
    count: 1,
    seo: { title: "Alternateur AUDI A4 III", description: "Alternateur" },
    faqItems: [],
    canonicalPath:
      "/pieces/alternateur-4/audi-22/a4-iii-22042/2-5-tdi-18402.html",
  };

  it("offre de la liste : politique de retour reçue", () => {
    const meta = buildPiecesVehicleMeta(
      data,
      { pathname: "/x" },
      PORT_BJ,
      RETOURS_BJ,
    );
    const ld = meta.find(
      (m) => "script:ld+json" in m && "@graph" in (m["script:ld+json"] as Node),
    ) as Node;
    const list = (ld["script:ld+json"]["@graph"] as Node[]).find(
      (n) => n["@type"] === "ItemList",
    );
    expect(
      list?.itemListElement[0].item.offers.hasMerchantReturnPolicy,
    ).toEqual(ATTENDU);
  });
});
