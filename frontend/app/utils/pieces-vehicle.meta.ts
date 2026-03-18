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

  // Page alternatives (0 produits) — noindex
  if ("noProducts" in data && data.noProducts) {
    return [
      { title: `${data.gammeName} - Non disponible | AutoMecanik` },
      {
        name: "description",
        content: `${data.gammeName} pour ${data.vehicleLabel}. Découvrez nos alternatives disponibles.`,
      },
      { name: "robots", content: "noindex, follow" },
    ];
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
    // Robots: index si 2+ produits, OU si 1 produit avec qualite donnees suffisante
    // Pages 2+ produits ont ~300 mots SSR (FAQ, guide, compatibilite)
    {
      name: "robots",
      content:
        d.count >= 2 || (d.count === 1 && (d.dataQuality ?? 0) >= 50)
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
