import { describe, expect, it } from "vitest";

import { type PieceData } from "~/types/pieces-route.types";
import { buildPiecesVehicleMeta } from "~/utils/pieces-vehicle.meta";
import { buildPiecesProductSchema } from "~/utils/seo/pieces-schema.utils";
import { isSellable } from "~/utils/stock.utils";

/**
 * Page pièces par véhicule (R2), balisage des offres.
 *
 * Défaut relevé le 2026-11-11 : des articles affichés comme achetables
 * sortaient en `PreOrder`, des articles affichés « Indisponible » portaient
 * une offre à `price: 0`, et l'agrégat annonçait `InStock` en dur en comptant
 * les articles indisponibles. Le balisage suit désormais le prédicat des
 * cartes produit (`isSellable`) : une offre par article achetable, aucune
 * pour les autres.
 */
const CANONICAL =
  "https://www.automecanik.com/pieces/alternateur-4/audi-22/a4-iii-22042/2-5-tdi-18402.html";

const IN_STOCK = "https://schema.org/InStock";
const BACK_ORDER = "https://schema.org/BackOrder";

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

describe("balisage R2 — offres alignées sur l'affichage", () => {
  it("articles achetables sans statut remonté → offres InStock au prix affiché", () => {
    const pieces = [piece(1, 137), piece(2, 50), piece(3, 499)];

    expect(listOffers(pieces)).toEqual([
      {
        sku: "REF-1",
        "@type": "Offer",
        price: 137,
        priceCurrency: "EUR",
        availability: IN_STOCK,
      },
      {
        sku: "REF-2",
        "@type": "Offer",
        price: 50,
        priceCurrency: "EUR",
        availability: IN_STOCK,
      },
      {
        sku: "REF-3",
        "@type": "Offer",
        price: 499,
        priceCurrency: "EUR",
        availability: IN_STOCK,
      },
    ]);
    expect(node(pieces, "Product")?.offers).toMatchObject({
      "@type": "AggregateOffer",
      lowPrice: 50,
      highPrice: 499,
      offerCount: 3,
      availability: IN_STOCK,
    });
  });

  it("statuts en stock et stock limité → InStock", () => {
    const pieces = [piece(1, 40, "IN_STOCK"), piece(2, 60, "LOW_STOCK")];

    expect(listOffers(pieces).map((o: Node) => o.availability)).toEqual([
      IN_STOCK,
      IN_STOCK,
    ]);
    expect(node(pieces, "Product")?.offers.availability).toBe(IN_STOCK);
  });

  it("article sur commande → BackOrder, jamais PreOrder ; l'agrégat reste InStock s'il existe un article en stock", () => {
    const pieces = [piece(1, 40, "PREORDER"), piece(2, 60, "IN_STOCK")];

    expect(listOffers(pieces).map((o: Node) => o.availability)).toEqual([
      BACK_ORDER,
      IN_STOCK,
    ]);
    expect(node(pieces, "Product")?.offers).toMatchObject({
      offerCount: 2,
      availability: IN_STOCK,
    });
    expect(JSON.stringify(build(pieces))).not.toContain("PreOrder");
  });

  it("tous les articles sur commande → agrégat BackOrder", () => {
    const pieces = [piece(1, 40, "PREORDER"), piece(2, 60, "Sur commande")];

    expect(node(pieces, "Product")?.offers).toMatchObject({
      lowPrice: 40,
      highPrice: 60,
      offerCount: 2,
      availability: BACK_ORDER,
    });
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
      availability: IN_STOCK,
    });
    const json = JSON.stringify(build(pieces));
    expect(json).not.toContain('"price":0');
    expect(json).not.toContain('"lowPrice":0');
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
    const json = JSON.stringify(build(pieces));
    expect(json).not.toContain("Offer");
    expect(json).not.toContain("InStock");
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
    expect(
      listOffers(pieces).every((o: Node) => o.availability === IN_STOCK),
    ).toBe(true);
    expect(node(pieces, "Product")?.offers).toMatchObject({
      lowPrice: 50,
      highPrice: 499,
      offerCount: 9,
      availability: IN_STOCK,
    });
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
      availability: IN_STOCK,
    });
  });

  it("aucun article achetable → aucun Product dans la page", () => {
    expect(productOffers([piece(1, 0), piece(2, 0)])).toBeUndefined();
  });
});
