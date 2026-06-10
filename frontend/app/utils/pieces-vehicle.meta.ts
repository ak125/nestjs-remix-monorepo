/**
 * Meta tags builder pour la route R2 Produit
 * /pieces/:gamme/:marque/:modele/:type.html
 *
 * Genere title, description, OG, robots, canonical, Schema.org JSON-LD (Product + FAQPage)
 */

import { type MetaDescriptor } from "@remix-run/node";
import {
  buildHeroImagePreload,
  buildPiecesProductSchema,
} from "~/utils/seo/pieces-schema.utils";
import type { NoProductsData } from "~/components/pieces/NoProductsAlternatives";

const SITE = "AutoMecanik";

function buildSoft404Meta(data: NoProductsData): MetaDescriptor[] {
  const ctx = data.vehicleContext;
  const years =
    ctx.yearFrom && ctx.yearTo
      ? `${ctx.yearFrom}-${ctx.yearTo}`
      : ctx.yearFrom || ctx.yearTo;
  const vehicleSuffix =
    `${ctx.marqueName} ${ctx.modeleName} ${ctx.typeName}${years ? ` (${years})` : ""}`
      .replace(/\s+/g, " ")
      .trim();

  const title = `${data.gammeName} non référencé pour ${vehicleSuffix} — Alternatives | ${SITE}`;

  const ps = ctx.typePowerPs ? `${ctx.typePowerPs}ch ` : "";
  const fuel = ctx.typeFuel ? `${ctx.typeFuel} ` : "";
  const description =
    `Le ${data.gammeName.toLowerCase()} n'est pas référencé pour la ${ctx.marqueName} ${ctx.modeleName} ${ctx.typeName} ${ps}${fuel}${years ? `(${years})` : ""}. Découvrez les alternatives compatibles et les autres motorisations qui disposent de ce produit.`
      .replace(/\s+/g, " ")
      .trim();

  const itemList: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    url: string;
  }> = [];

  data.alternativeVehicles.slice(0, 6).forEach((v) => {
    const typeSlug = `${v.type_alias ?? v.type_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${v.type_id}`;
    itemList.push({
      "@type": "ListItem",
      position: itemList.length + 1,
      name: `${data.gammeName} pour ${v.marque_name} ${v.modele_name} ${v.type_name}`,
      url: `/pieces/${data.gammeAlias}-${data.gammeId}/${v.marque_alias}-${v.marque_id}/${v.modele_alias}-${v.modele_id}/${typeSlug}.html`,
    });
  });

  data.alternativeGammes.slice(0, 4).forEach((g) => {
    itemList.push({
      "@type": "ListItem",
      position: itemList.length + 1,
      name: `${g.pg_name} pour ${ctx.marqueName} ${ctx.modeleName} ${ctx.typeName}`,
      url: `/pieces/${g.pg_alias}-${g.pg_id}.html`,
    });
  });

  return [
    { title },
    { name: "description", content: description },
    { name: "robots", content: "noindex, follow" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `Alternatives ${data.gammeName} pour ${vehicleSuffix}`,
        itemListElement: itemList,
      },
    },
  ];
}

export function buildPiecesVehicleMeta(
  data: any,
  location: { pathname: string },
): MetaDescriptor[] {
  if (!data) {
    return [
      { title: "Pièces automobile" },
      { name: "description", content: "Catalogue de pièces détachées" },
    ];
  }

  // Page alternatives (0 produits) — noindex + meta contextuelle + JSON-LD ItemList
  if ("noProducts" in data && data.noProducts) {
    return buildSoft404Meta(data as NoProductsData);
  }

  // Type narrowing: apres les early returns, data est forcement le type complet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;

  // Construire URL canonique depuis les donnees RM V2 (pas location.pathname)
  // Evite les doublons canonical quand le slug URL != alias reel
  const canonicalUrl = d.canonicalPath
    ? `https://www.automecanik.com${d.canonicalPath}`
    : `https://www.automecanik.com${location.pathname}`;

  // Schema.org @graph - Extrait dans pieces-schema.utils.ts
  const productSchema = buildPiecesProductSchema({
    vehicle: d.vehicle,
    gamme: d.gamme,
    pieces: d.pieces,
    seo: { description: d.seo.description },
    minPrice: d.minPrice,
    maxPrice: d.maxPrice,
    count: d.count,
    oemRefs: d.oemRefs,
    oemRefsSeo: d.oemRefsSeo,
    crossSellingGammes: d.crossSellingGammes,
    canonicalUrl,
  });

  return [
    { title: d.seo.title },
    { name: "description", content: d.seo.description },
    { property: "og:title", content: d.seo.title },
    { property: "og:description", content: d.seo.description },
    { property: "og:url", content: canonicalUrl },
    // Robots: index si 2+ produits OU 1 produit avec qualite donnees suffisante,
    // ET (flag SEO_R2_SELLABLE_NOINDEX) au moins 1 produit vendable
    // (pri_dispo '1'|'2'|'3' → stock_status != OUT_OF_STOCK + prix). Flag OFF
    // (defaut) → clause vendabilite neutre → robots identique a l'existant.
    {
      name: "robots",
      content:
        (d.count >= 2 || (d.count === 1 && (d.dataQuality ?? 0) >= 50)) &&
        (!d.sellableGateEnabled || (d.sellableCount ?? 0) >= 1)
          ? "index, follow"
          : "noindex, follow",
    },

    // Canonical URL
    { tagName: "link", rel: "canonical", href: canonicalUrl },

    // Preconnect vers automecanik.com (imgproxy)
    {
      tagName: "link",
      rel: "preconnect",
      href: "https://www.automecanik.com",
    },

    // LCP Optimization V5: Preload hero vehicle image - Fonction extraite
    ...buildHeroImagePreload(d.vehicle, d.gamme),

    // Schema.org Product (rich snippets)
    ...(productSchema
      ? [
          {
            "script:ld+json": productSchema,
          },
        ]
      : []),

    // Schema.org FAQPage dans <head> pour rich snippets (SSR garanti)
    ...(d.faqItems && d.faqItems.length >= 2
      ? [
          {
            "script:ld+json": {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: d.faqItems
                .filter((item: { schema?: boolean }) => item.schema !== false)
                .map((item: { question: string; answer: string }) => ({
                  "@type": "Question",
                  name: item.question,
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: item.answer,
                  },
                })),
            },
          },
        ]
      : []),
  ];
}
