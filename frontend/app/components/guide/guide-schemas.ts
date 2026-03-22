/**
 * guide-schemas.ts — Consolidated JSON-LD schema builder for R3 guide pages.
 * Produces Article, HowTo, FAQPage, BreadcrumbList schemas in one call.
 */

import {
  type GammeConseil,
  normalizeStepHtml,
} from "~/components/blog/conseil/section-config";

// --- Internal helpers ---

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

// --- HowTo from S4_DEPOSE ---

function parseHowTo(
  conseil: GammeConseil[] | null,
  articleTitle: string,
  canonicalUrl: string,
): Record<string, unknown> | null {
  if (!conseil) return null;

  const deposeSection = conseil.find((c) => c.sectionType === "S4_DEPOSE");
  if (!deposeSection) return null;

  const normalized = normalizeStepHtml(deposeSection.content);
  const liMatches = [...normalized.matchAll(/<li>(.*?)<\/li>/gi)];
  const steps = liMatches
    .map((m) => stripHtml(m[1]))
    .filter((t) => t.length > 5);

  if (steps.length < 2) return null;

  const totalMinutes = steps.length * 5;

  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: deposeSection.title || `Comment démonter : ${articleTitle}`,
    description: `Procédure de démontage étape par étape — ${articleTitle}`,
    url: canonicalUrl,
    totalTime: `PT${totalMinutes}M`,
    step: steps.map((text, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      text,
    })),
  };
}

// --- FAQPage from S8 ---

function parseFAQ(
  conseil: GammeConseil[] | null,
  canonicalUrl: string,
): Record<string, unknown> | null {
  if (!conseil) return null;

  const faqSections = conseil.filter((c) => c.sectionType === "S8");
  if (faqSections.length === 0) return null;

  const combined = faqSections.map((s) => s.content).join("\n");
  const cleaned = combined.replace(/#LinkGamme_\d+#/g, "");

  const qaRegex =
    /<details>\s*<summary>\s*<b>(.*?)<\/b>\s*<\/summary>\s*<p>(.*?)<\/p>\s*<\/details>/gi;
  const pairs: { q: string; a: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = qaRegex.exec(cleaned)) !== null) {
    const q = stripHtml(match[1]).trim();
    const a = stripHtml(match[2]).trim();
    if (q.length > 5 && a.length > 5) {
      pairs.push({ q, a });
    }
  }

  if (pairs.length < 3) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${canonicalUrl}#faq`,
    url: canonicalUrl,
    mainEntity: pairs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: {
        "@type": "Answer",
        text: a,
      },
    })),
  };
}

// --- Public API ---

export interface GuideSchemaArticle {
  title: string;
  h1?: string;
  meta_title?: string;
  meta_description: string;
  publishedAt: string;
  updatedAt?: string;
  keywords: string[];
  readingTime?: number;
  viewsCount?: number;
  featuredImage?: string;
  pg_alias?: string;
}

export interface GuideSchemaOutput {
  articleSchema: Record<string, unknown>;
  howToSchema: Record<string, unknown> | null;
  faqSchema: Record<string, unknown> | null;
  breadcrumbSchema: Record<string, unknown>;
}

export function buildGuideSchemas(
  article: GuideSchemaArticle,
  conseil: GammeConseil[] | null,
  canonicalUrl: string,
): GuideSchemaOutput {
  const title = article.meta_title || article.h1 || article.title;
  const description = article.meta_description;

  const articleSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": canonicalUrl,
    headline: title,
    description,
    url: canonicalUrl,
    inLanguage: "fr-FR",
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
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
    image: {
      "@type": "ImageObject",
      url:
        article.featuredImage ||
        "https://www.automecanik.com/images/og/blog-conseil.webp",
      width: 1200,
      height: 630,
    },
    articleSection: "Conseils Auto",
    keywords: article.keywords.join(", "),
    ...(article.readingTime && { timeRequired: `PT${article.readingTime}M` }),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    ...((article.viewsCount ?? 0) > 0 && {
      interactionStatistic: {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ReadAction",
        userInteractionCount: article.viewsCount,
      },
    }),
    ...(article.pg_alias && {
      relatedLink: `https://www.automecanik.com/pieces/${article.pg_alias}`,
    }),
  };

  const breadcrumbSchema = {
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
        name: "Conseils",
        item: "https://www.automecanik.com/blog-pieces-auto/conseils",
      },
      { "@type": "ListItem", position: 4, name: article.title },
    ],
  };

  return {
    articleSchema,
    howToSchema: parseHowTo(conseil, title, canonicalUrl),
    faqSchema: parseFAQ(conseil, canonicalUrl),
    breadcrumbSchema,
  };
}
