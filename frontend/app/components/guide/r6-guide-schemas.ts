/**
 * r6-guide-schemas.ts — JSON-LD schema builder for R6 Guide d'Achat pages.
 * Produces Article, FAQPage, BreadcrumbList schemas.
 * No HowTo (R6 has no step-by-step instructions).
 */

import { type R6GuidePage, type R6FaqItem } from "~/types/r6-guide.types";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#?\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface R6GuideSchemaOutput {
  articleSchema: Record<string, unknown>;
  faqSchema: Record<string, unknown> | null;
  breadcrumbSchema: Record<string, unknown>;
}

export function buildR6GuideSchemas(
  page: R6GuidePage,
  faq: R6FaqItem[],
  canonicalUrl: string,
): R6GuideSchemaOutput {
  const title = page.metaTitle || page.title;
  const description = stripHtml(page.metaDescription);

  const articleSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": canonicalUrl,
    headline: title,
    description,
    url: canonicalUrl,
    inLanguage: "fr-FR",
    dateModified: page.updatedAt,
    author: {
      "@type": "Organization",
      name: "Automecanik",
      url: "https://www.automecanik.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Automecanik",
      url: "https://www.automecanik.com",
      logo: {
        "@type": "ImageObject",
        url: "https://www.automecanik.com/logo-navbar.webp",
      },
    },
    image:
      page.featuredImage ||
      "https://www.automecanik.com/images/og/guide-achat.webp",
    articleSection: "Guides d'Achat",
    ...(page.readingTime && { timeRequired: `PT${page.readingTime}M` }),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
  };

  // FAQ schema — directly from typed R6FaqItem[] (no HTML parsing)
  const faqSchema: Record<string, unknown> | null =
    faq.length >= 3
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map(({ question, answer }) => ({
            "@type": "Question",
            name: question,
            acceptedAnswer: {
              "@type": "Answer",
              text: stripHtml(answer),
            },
          })),
        }
      : null;

  const breadcrumbSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: "https://www.automecanik.com/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: "https://www.automecanik.com/blog-pieces-auto",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Guides d'Achat",
        item: "https://www.automecanik.com/blog-pieces-auto/guide-achat",
      },
      { "@type": "ListItem", position: 4, name: page.title },
    ],
  };

  return { articleSchema, faqSchema, breadcrumbSchema };
}
