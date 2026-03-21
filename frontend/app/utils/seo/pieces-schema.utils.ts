/**
 * Pieces Schema.org Utilities
 * Génère les schémas JSON-LD pour la page pièces
 */

import {
  type GammeData,
  type PieceData,
  type VehicleData,
} from "../../types/pieces-route.types";
import { ImageOptimizer } from "../image-optimizer";

// ✅ Migration /img/* : URLs absolues pour SEO schema JSON-LD
const SITE_URL = "https://www.automecanik.com";
function normalizeImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  // Si déjà URL complète, la retourner
  if (url.startsWith("http")) return url;
  // Si déjà URL /img/, la rendre absolue
  if (url.startsWith("/img/")) return `${SITE_URL}${url}`;
  // Convertir les chemins relatifs vers URLs absolues /img/*
  if (url.startsWith("/rack/"))
    return `${SITE_URL}/img/rack-images/${url.replace("/rack/", "")}`;
  if (url.startsWith("/upload/"))
    return `${SITE_URL}/img/uploads/${url.replace("/upload/", "")}`;
  if (url.startsWith("/")) return `${SITE_URL}/img/uploads/${url.substring(1)}`;
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
      .slice(0, 20)
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
  fetchPriority: "high";
  [key: string]: string; // Index signature pour compatibilité Remix meta
};

/**
 * Construit le meta tag de preload responsive pour l'image hero du véhicule
 * Utilisé dans la fonction meta() pour optimiser le LCP
 *
 * 🚀 LCP FIX: Utilise imgproxy pour srcSet identique à PiecesHeader.tsx
 * Le preload DOIT matcher exactement l'image réelle pour éviter double téléchargement
 *
 * @param vehicle - Données du véhicule (modelePic, marqueAlias, marque)
 * @returns Array avec le meta tag ou vide si pas d'image
 */
export function buildHeroImagePreload(
  vehicle: Pick<VehicleData, "modelePic" | "marqueAlias" | "marque">,
  gamme?: Pick<GammeData, "image" | "alias">,
): HeroImagePreloadMeta[] {
  let imagePath: string;

  if (vehicle.modelePic && vehicle.modelePic !== "no.webp") {
    const marqueSlug = vehicle.marqueAlias || vehicle.marque.toLowerCase();
    imagePath = `constructeurs-automobiles/marques-modeles/${marqueSlug}/${vehicle.modelePic}`;
  } else if (gamme?.image && gamme.image !== "no.webp") {
    // Fallback tier 2 : image gamme (pg_pic)
    imagePath = `articles/gammes-produits/catalogue/${gamme.image}`;
  } else {
    return [];
  }

  // 🚀 LCP FIX: Utiliser imgproxy pour srcSet identique à PiecesHeader.tsx
  const imageSrcSet = [200, 300, 380]
    .map(
      (w) =>
        `${ImageOptimizer.getOptimizedUrl(imagePath, { width: w, quality: 85 })} ${w}w`,
    )
    .join(", ");

  // sizes identique à PiecesHeader.tsx
  const imageSizes =
    "(max-width: 640px) 200px, (max-width: 1024px) 300px, 380px";

  // href = URL par défaut (380w) pour navigateurs sans support srcSet
  const defaultHref = ImageOptimizer.getOptimizedUrl(imagePath, {
    width: 380,
    quality: 85,
  });

  return [
    {
      tagName: "link",
      rel: "preload",
      as: "image",
      href: defaultHref,
      imageSrcSet,
      imageSizes,
      fetchPriority: "high",
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
      {
        "@type": "CollectionPage",
        "@id": canonicalUrl,
        name: `${gamme.name} ${vehicle.marque} ${vehicle.modele}`,
        url: canonicalUrl,
        mainEntity: { "@id": `${canonicalUrl}#list` },
        isPartOf: {
          "@type": "WebSite",
          "@id": "https://www.automecanik.com/#website",
          name: "AutoMecanik",
          url: "https://www.automecanik.com",
        },
      },
    ],
  };
}
