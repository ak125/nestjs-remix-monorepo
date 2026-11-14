import { describe, expect, it } from "vitest";

import { type PieceData } from "~/types/pieces-route.types";
import { buildPiecesVehicleMeta } from "~/utils/pieces-vehicle.meta";
import { buildPiecesProductSchema } from "~/utils/seo/pieces-schema.utils";
import { isSellable } from "~/utils/stock.utils";

/**
 * Page pièces par véhicule (R2), balisage des offres.
 *
 * Défaut relevé le 2026-11-11 : des articles affichés « Indisponible »
 * portaient une offre à `price: 0`, et l'agrégat comptait les articles
 * indisponibles. Le balisage suit désormais le prédicat des cartes produit
 * (`isSellable`) : une offre par article achetable, aucune pour les autres.
 *
 * Décision de l'owner du 2026-11-12 : le balisage ne publie pas la
 * disponibilité des stocks. Aucune offre ne porte `availability`, et aucune
 * valeur schema.org de disponibilité n'apparaît dans le JSON-LD.
 */
const CANONICAL =
  "https://www.automecanik.com/pieces/alternateur-4/audi-22/a4-iii-22042/2-5-tdi-18402.html";

const AVAILABILITY_VALUES = [
  "InStock",
  "OutOfStock",
  "PreOrder",
  "BackOrder",
  "LimitedAvailability",
  "SoldOut",
  "Discontinued",
  "InStoreOnly",
  "OnlineOnly",
];

const piece = (
  id: number,
  price: number,
  stockStatus?: string,
  extra: Partial<PieceData> = {},
): PieceData => ({
  id,
  name: `Alternateur ${id}`,
  price,
  priceFormatted: price.toFixed(2).replace(".", ","),
  brand: `Marque ${id}`,
  stock: "",
  ...(stockStatus !== undefined && { stockStatus }),
  reference: `REF-${id}`,
  image: `https://www.automecanik.com/img/rack-images/1/${id}.webp`,
  ...extra,
});

const build = (pieces: PieceData[]) =>
  buildPiecesProductSchema({
    vehicle: {
      marque: "AUDI",
      modele: "A4 III",
      type: "2.5 TDI",
      typeId: 18402,
      marqueId: 22,
      modeleId: 22042,
    },
    gamme: {
      id: 4,
      name: "Alternateur",
      alias: "alternateur",
      description: "",
    },
    pieces,
    seo: { description: "Alternateur pour AUDI A4 III 2.5 TDI" },
    count: pieces.length,
    canonicalUrl: CANONICAL,
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = Record<string, any>;

const graph = (pieces: PieceData[]): Node[] =>
  (build(pieces)?.["@graph"] ?? []) as Node[];
const node = (pieces: PieceData[], type: string) =>
  graph(pieces).find((n) => n["@type"] === type);
const listOffers = (pieces: PieceData[]) =>
  (node(pieces, "ItemList")?.itemListElement ?? []).map((entry: Node) => ({
    sku: entry.item.sku,
    ...entry.item.offers,
  }));

/** Le JSON-LD sérialisé ne contient aucune disponibilité. */
const expectNoAvailability = (pieces: PieceData[]) => {
  const json = JSON.stringify(build(pieces));
  expect(json).not.toContain('"availability"');
  for (const value of AVAILABILITY_VALUES) {
    expect(json).not.toContain(`schema.org/${value}`);
  }
};

describe("balisage R2 — offres alignées sur l'affichage, sans disponibilité", () => {
  it("articles achetables sans statut remonté → offres au prix affiché, sans disponibilité", () => {
    const pieces = [piece(1, 137), piece(2, 50), piece(3, 499)];

    expect(listOffers(pieces)).toEqual([
      { sku: "REF-1", "@type": "Offer", price: 137, priceCurrency: "EUR" },
      { sku: "REF-2", "@type": "Offer", price: 50, priceCurrency: "EUR" },
      { sku: "REF-3", "@type": "Offer", price: 499, priceCurrency: "EUR" },
    ]);
    const aggregate = node(pieces, "Product")?.offers;
    expect(aggregate).toMatchObject({
      "@type": "AggregateOffer",
      lowPrice: 50,
      highPrice: 499,
      offerCount: 3,
    });
    expect(aggregate).not.toHaveProperty("availability");
    expectNoAvailability(pieces);
  });

  it.each([
    ["en stock", "IN_STOCK"],
    ["stock limité", "LOW_STOCK"],
    ["sur commande", "PREORDER"],
    ["sur commande (libellé)", "Sur commande"],
    ["en stock (libellé)", "En stock"],
  ])("statut %s → offre publiée, aucune disponibilité", (_label, status) => {
    const pieces = [piece(1, 40, status), piece(2, 60, "IN_STOCK")];

    expect(listOffers(pieces)).toHaveLength(2);
    for (const offer of listOffers(pieces)) {
      expect(offer).not.toHaveProperty("availability");
    }
    expect(node(pieces, "Product")?.offers).not.toHaveProperty("availability");
    expectNoAvailability(pieces);
  });

  it("tous les articles sur commande → agrégat au prix affiché, sans disponibilité", () => {
    const pieces = [piece(1, 40, "PREORDER"), piece(2, 60, "Sur commande")];

    expect(node(pieces, "Product")?.offers).toMatchObject({
      lowPrice: 40,
      highPrice: 60,
      offerCount: 2,
    });
    expectNoAvailability(pieces);
  });

  it("article indisponible → aucune offre, aucun prix à zéro, hors du compte de l'agrégat", () => {
    const pieces = [
      piece(1, 137, "IN_STOCK"),
      piece(2, 0, "OUT_OF_STOCK"),
      piece(3, 0),
      piece(4, 89, "OUT_OF_STOCK"),
    ];

    expect(listOffers(pieces).map((o: Node) => o.sku)).toEqual(["REF-1"]);
    expect(node(pieces, "Product")?.offers).toMatchObject({
      lowPrice: 137,
      highPrice: 137,
      offerCount: 1,
    });
    const json = JSON.stringify(build(pieces));
    expect(json).not.toContain('"price":0');
    expect(json).not.toContain('"lowPrice":0');
    expectNoAvailability(pieces);
  });

  it("statut inconnu ou prix inexploitable → traité comme l'affichage, sans offre", () => {
    const pieces = [
      piece(1, 137),
      piece(2, 99, "STATUT_INCONNU"),
      piece(3, Number.NaN),
      piece(4, -5),
    ];

    expect(listOffers(pieces).map((o: Node) => o.sku)).toEqual(["REF-1"]);
    expect(node(pieces, "Product")?.offers.offerCount).toBe(1);
  });

  it("aucun article achetable → ni Product ni liste d'offres, véhicule et page conservés", () => {
    const pieces = [piece(1, 0, "OUT_OF_STOCK"), piece(2, 0)];
    const types = graph(pieces).map((n) => n["@type"]);

    expect(types).toEqual(["Car", "CollectionPage"]);
    expect(node(pieces, "CollectionPage")).not.toHaveProperty("mainEntity");
    expect(JSON.stringify(build(pieces))).not.toContain("Offer");
    expectNoAvailability(pieces);
  });

  it("aucun article → pas de schéma", () => {
    expect(build([])).toBeNull();
  });

  it("premier article indisponible → le Product décrit le premier article achetable", () => {
    const pieces = [piece(1, 0, "OUT_OF_STOCK"), piece(2, 75, "IN_STOCK")];
    const product = node(pieces, "Product");

    expect(product?.sku).toBe("REF-2");
    expect(product?.brand).toEqual({ "@type": "Brand", name: "Marque 2" });
    expect(node(pieces, "CollectionPage")?.mainEntity).toEqual({
      "@id": `${CANONICAL}#list`,
    });
  });

  it("chaque article porte une offre si et seulement si sa carte est achetable", () => {
    const pieces = [
      piece(1, 137),
      piece(2, 0),
      piece(3, 60, "PREORDER"),
      piece(4, 89, "OUT_OF_STOCK"),
      piece(5, 12, "LOW_STOCK"),
      piece(6, 45, "En stock"),
      piece(7, 45, "Rupture"),
    ];
    const offered = new Set(listOffers(pieces).map((o: Node) => o.sku));

    for (const p of pieces) {
      expect(offered.has(p.reference)).toBe(isSellable(p.price, p.stockStatus));
    }
    expectNoAvailability(pieces);
  });

  it("page témoin (9 articles achetables, 2 indisponibles) → 9 offres, de 50 à 499 €", () => {
    const pieces = [
      ...[499, 137, 171, 184, 194, 230, 257, 329, 50].map((price, i) =>
        piece(i + 1, price),
      ),
      piece(10, 0),
      piece(11, 0),
    ];

    expect(listOffers(pieces)).toHaveLength(9);
    expect(node(pieces, "Product")?.offers).toMatchObject({
      lowPrice: 50,
      highPrice: 499,
      offerCount: 9,
    });
    expectNoAvailability(pieces);
  });
});

describe("buildPiecesVehicleMeta — JSON-LD de la page pièces", () => {
  const data = (pieces: PieceData[]) => ({
    vehicle: {
      marque: "AUDI",
      modele: "A4 III",
      type: "2.5 TDI",
      typeId: 18402,
      marqueId: 22,
      modeleId: 22042,
    },
    gamme: {
      id: 4,
      name: "Alternateur",
      alias: "alternateur",
      description: "",
    },
    pieces,
    count: pieces.length,
    // Bornes du loader, calculées sur tous les articles : le balisage ne les
    // lit plus, un article indisponible à 0 € ne peut plus devenir `lowPrice`.
    minPrice: 0,
    maxPrice: 499,
    seo: { title: "Alternateur AUDI A4 III", description: "Alternateur" },
    faqItems: [],
    canonicalPath:
      "/pieces/alternateur-4/audi-22/a4-iii-22042/2-5-tdi-18402.html",
  });

  const productOffers = (pieces: PieceData[]) => {
    const meta = buildPiecesVehicleMeta(data(pieces), { pathname: "/x" });
    const ld = meta.find(
      (m) => "script:ld+json" in m && "@graph" in (m["script:ld+json"] as Node),
    ) as Node | undefined;
    const product = (ld?.["script:ld+json"]["@graph"] as Node[]).find(
      (n) => n["@type"] === "Product",
    );
    return product?.offers;
  };

  it("l'agrégat vient des articles achetables, pas des bornes du loader", () => {
    expect(
      productOffers([piece(1, 137), piece(2, 0), piece(3, 50)]),
    ).toMatchObject({
      lowPrice: 50,
      highPrice: 137,
      offerCount: 2,
    });
  });

  it("le JSON-LD de la page ne publie aucune disponibilité", () => {
    const meta = buildPiecesVehicleMeta(
      data([piece(1, 137, "IN_STOCK"), piece(2, 60, "PREORDER")]),
      { pathname: "/x" },
    );
    const json = JSON.stringify(meta);
    expect(json).not.toContain('"availability"');
    for (const value of AVAILABILITY_VALUES) {
      expect(json).not.toContain(`schema.org/${value}`);
    }
  });

  it("aucun article achetable → aucun Product dans la page", () => {
    expect(productOffers([piece(1, 0), piece(2, 0)])).toBeUndefined();
  });
});
