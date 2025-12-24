/**
 * Pieces Schema.org Utilities
 * Génère les schémas JSON-LD pour la page pièces
 */

import { normalizeImageUrl } from "../image.utils";

import type { GammeData, PieceData, VehicleData } from "../../types/pieces-route.types";

interface SchemaParams {
  vehicle: VehicleData;
  gamme: GammeData;
  pieces: PieceData[];
  seo: { description: string };
  minPrice: number;
  maxPrice: number;
  count: number;
  oemRefs?: { oemRefs?: string[] };
  oemRefsSeo?: string[];
  crossSellingGammes?: Array<{ PG_NAME: string; PG_ALIAS: string; PG_ID: number }>;
  canonicalUrl: string;
}

/**
 * Génère le schéma Car pour le véhicule cible
 */
function buildCarSchema(vehicle: VehicleData, canonicalUrl: string) {
  return {
    "@type": "Car",
    "@id": `${canonicalUrl}#vehicle`,
    name: `${vehicle.marque} ${vehicle.modele} ${vehicle.typeName || vehicle.type}`,
    brand: { "@type": "Brand", name: vehicle.marque },
    model: vehicle.modele,
    vehicleConfiguration: vehicle.typeName || vehicle.type,
    ...(vehicle.typeDateStart && {
      vehicleModelDate: vehicle.typeDateStart,
    }),
    ...(vehicle.typeDateStart && {
      additionalProperty: [{
        "@type": "PropertyValue",
        name: "Période de production",
        value: vehicle.typeDateEnd
          ? `${vehicle.typeDateStart}-${vehicle.typeDateEnd}`
          : `depuis ${vehicle.typeDateStart}`,
      }],
    }),
  };
}

/**
 * Génère le schéma Product principal avec refs OEM
 */
function buildProductSchema(
  params: SchemaParams,
  firstPiece: PieceData,
  oemRefsArray: string[],
  relatedProducts: Array<{ "@type": string; name: string; url: string }>
) {
  const { vehicle, gamme, seo, minPrice, maxPrice, count, canonicalUrl } = params;

  return {
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    name: `${gamme.name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type}`,
    description: seo.description,
    url: canonicalUrl,
    image: firstPiece.image
      ? normalizeImageUrl(firstPiece.image.startsWith('http') ? firstPiece.image : `/rack/${firstPiece.image}`)
      : firstPiece.marque_logo
        ? normalizeImageUrl(`/upload/equipementiers-automobiles/${firstPiece.marque_logo}`)
        : `https://www.automecanik.com/images/gammes/${gamme.alias || 'default'}.webp`,
    ...(oemRefsArray[0] && { mpn: oemRefsArray[0] }),
    ...(firstPiece.reference && { sku: firstPiece.reference }),
    brand: { "@type": "Brand", name: firstPiece.brand },
    isAccessoryOrSparePartFor: { "@id": `${canonicalUrl}#vehicle` },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: minPrice,
      highPrice: maxPrice,
      offerCount: count,
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "Automecanik", url: "https://www.automecanik.com" },
    },
    additionalProperty: [
      ...oemRefsArray.slice(0, 15).map((ref, i) => ({
        "@type": "PropertyValue",
        name: i === 0 ? "Référence OEM" : "Référence compatible",
        value: ref,
      })),
    ].filter(p => p.value),
    ...(relatedProducts.length > 0 && { isRelatedTo: relatedProducts }),
  };
}

/**
 * Génère le schéma ItemList pour les produits
 */
function buildItemListSchema(
  pieces: PieceData[],
  gamme: GammeData,
  vehicle: VehicleData,
  count: number,
  canonicalUrl: string
) {
  return {
    "@type": "ItemList",
    "@id": `${canonicalUrl}#list`,
    name: `${gamme.name} pour ${vehicle.marque} ${vehicle.modele}`,
    numberOfItems: count,
    itemListElement: pieces
      .filter((piece) => piece.image || piece.marque_logo)
      .slice(0, 8)
      .map((piece, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Product",
          name: `${piece.name} ${piece.brand}`,
          url: `${canonicalUrl}#product-${piece.id}`,
          image: piece.image
            ? normalizeImageUrl(piece.image.startsWith('http') ? piece.image : `/rack/${piece.image}`)
            : normalizeImageUrl(`/upload/equipementiers-automobiles/${piece.marque_logo}`),
          ...(piece.reference && { sku: piece.reference }),
          brand: { "@type": "Brand", name: piece.brand },
          offers: {
            "@type": "Offer",
            price: piece.price,
            priceCurrency: "EUR",
            availability: piece.stock === "En stock" ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
          },
          isAccessoryOrSparePartFor: { "@id": `${canonicalUrl}#vehicle` },
        },
      })),
  };
}

/**
 * Génère le schéma complet @graph pour la page pièces
 */
export function buildPiecesProductSchema(params: SchemaParams) {
  const { vehicle, gamme, pieces, count, oemRefs, oemRefsSeo, crossSellingGammes, canonicalUrl } = params;

  const firstPiece = pieces[0];
  if (!firstPiece) return null;

  // Refs OEM
  const oemRefsArray = oemRefs?.oemRefs || oemRefsSeo || [];

  // Produits liés (cross-selling)
  const relatedProducts = crossSellingGammes?.slice(0, 3).map((g) => ({
    "@type": "Product",
    name: g.PG_NAME,
    url: `https://www.automecanik.com/pieces/${g.PG_ALIAS}-${g.PG_ID}.html`,
  })) || [];

  return {
    "@context": "https://schema.org",
    "@graph": [
      buildCarSchema(vehicle, canonicalUrl),
      buildProductSchema(params, firstPiece, oemRefsArray, relatedProducts),
      buildItemListSchema(pieces, gamme, vehicle, count, canonicalUrl),
    ],
  };
}
