/**
 * Pieces Schema.org Utilities
 * Génère les schémas JSON-LD pour la page pièces
 */

import {
  type GammeData,
  type PieceData,
  type VehicleData,
} from "../../types/pieces-route.types";

// Helper inline pour normaliser les URLs d'images (remplace image.utils.ts)
const SUPABASE_STORAGE =
  "https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public";
function normalizeImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/rack/"))
    return `${SUPABASE_STORAGE}/rack-images/${url.replace("/rack/", "")}`;
  if (url.startsWith("/upload/"))
    return `${SUPABASE_STORAGE}/uploads/${url.replace("/upload/", "")}`;
  if (url.startsWith("/"))
    return `${SUPABASE_STORAGE}/uploads/${url.substring(1)}`;
  return url;
}

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
  crossSellingGammes?: Array<{
    PG_NAME: string;
    PG_ALIAS: string;
    PG_ID: number;
  }>;
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
      additionalProperty: [
        {
          "@type": "PropertyValue",
          name: "Période de production",
          value: vehicle.typeDateEnd
            ? `${vehicle.typeDateStart}-${vehicle.typeDateEnd}`
            : `depuis ${vehicle.typeDateStart}`,
        },
      ],
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
  relatedProducts: Array<{ "@type": string; name: string; url: string }>,
) {
  const { vehicle, gamme, seo, minPrice, maxPrice, count, canonicalUrl } =
    params;

  return {
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    name: `${gamme.name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type}`,
    description: seo.description,
    url: canonicalUrl,
    image: firstPiece.image
      ? normalizeImageUrl(
          firstPiece.image.startsWith("http")
            ? firstPiece.image
            : `/rack/${firstPiece.image}`,
        )
      : firstPiece.marque_logo
        ? normalizeImageUrl(
            `/upload/equipementiers-automobiles/${firstPiece.marque_logo}`,
          )
        : `https://www.automecanik.com/images/gammes/${gamme.alias || "default"}.webp`,
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
      seller: {
        "@type": "Organization",
        name: "Automecanik",
        url: "https://www.automecanik.com",
      },
    },
    additionalProperty: [
      ...oemRefsArray.slice(0, 15).map((ref, i) => ({
        "@type": "PropertyValue",
        name: i === 0 ? "Référence OEM" : "Référence compatible",
        value: ref,
      })),
    ].filter((p) => p.value),
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
  canonicalUrl: string,
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
            ? normalizeImageUrl(
                piece.image.startsWith("http")
                  ? piece.image
                  : `/rack/${piece.image}`,
              )
            : normalizeImageUrl(
                `/upload/equipementiers-automobiles/${piece.marque_logo}`,
              ),
          ...(piece.reference && { sku: piece.reference }),
          brand: { "@type": "Brand", name: piece.brand },
          offers: {
            "@type": "Offer",
            price: piece.price,
            priceCurrency: "EUR",
            availability:
              piece.stock === "En stock"
                ? "https://schema.org/InStock"
                : "https://schema.org/PreOrder",
          },
          isAccessoryOrSparePartFor: { "@id": `${canonicalUrl}#vehicle` },
        },
      })),
  };
}

// URL de base Supabase pour les images (sans transformation, $0)
const SUPABASE_BASE_URL =
  "https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads";

/**
 * Interface pour les meta tags de preload image responsive
 * Utilise imageSrcSet + imageSizes pour que le navigateur choisisse la bonne taille
 * @see https://web.dev/articles/preload-responsive-images
 */
export type HeroImagePreloadMeta = {
  tagName: "link";
  rel: "preload";
  as: "image";
  href: string;
  imageSrcSet: string; // ✅ React camelCase (pas imagesrcset)
  imageSizes: string; // ✅ React camelCase (pas imagesizes)
  fetchpriority: "high";
  [key: string]: string; // Index signature pour compatibilité Remix meta
};

/**
 * Construit le meta tag de preload responsive pour l'image hero du véhicule
 * Utilisé dans la fonction meta() pour optimiser le LCP
 *
 * 🚀 Utilise imageSrcSet + imageSizes pour matcher le srcSet de l'image
 * Le navigateur choisit automatiquement la bonne taille selon le viewport
 *
 * @param vehicle - Données du véhicule (modelePic, marqueAlias, marque)
 * @returns Array avec le meta tag ou vide si pas d'image
 */
export function buildHeroImagePreload(
  vehicle: Pick<VehicleData, "modelePic" | "marqueAlias" | "marque">,
): HeroImagePreloadMeta[] {
  if (!vehicle.modelePic || vehicle.modelePic === "no.webp") {
    return [];
  }

  const marqueSlug = vehicle.marqueAlias || vehicle.marque.toLowerCase();
  const baseUrl = `${SUPABASE_BASE_URL}/constructeurs-automobiles/marques-concepts/${marqueSlug}/${vehicle.modelePic}`;

  // srcSet responsive identique à PiecesHeader.tsx (lignes 211-215)
  const imageSrcSet = [
    `${baseUrl}?width=200&quality=80&t=31536000 200w`,
    `${baseUrl}?width=300&quality=85&t=31536000 300w`,
    `${baseUrl}?width=380&quality=85&t=31536000 380w`,
  ].join(", ");

  // sizes identique à PiecesHeader.tsx (ligne 216)
  const imageSizes =
    "(max-width: 640px) 200px, (max-width: 1024px) 300px, 380px";

  return [
    {
      tagName: "link",
      rel: "preload",
      as: "image",
      href: "", // Vide pour éviter double téléchargement Safari (web.dev recommandation)
      imageSrcSet,
      imageSizes,
      fetchpriority: "high",
    },
  ];
}

/**
 * Génère le schéma complet @graph pour la page pièces
 */
export function buildPiecesProductSchema(params: SchemaParams) {
  const {
    vehicle,
    gamme,
    pieces,
    count,
    oemRefs,
    oemRefsSeo,
    crossSellingGammes,
    canonicalUrl,
  } = params;

  const firstPiece = pieces[0];
  if (!firstPiece) return null;

  // Refs OEM
  const oemRefsArray = oemRefs?.oemRefs || oemRefsSeo || [];

  // Produits liés (cross-selling)
  const relatedProducts =
    crossSellingGammes?.slice(0, 3).map((g) => ({
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
