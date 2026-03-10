/**
 * Route : /blog-pieces-auto
 * Index du Blog (R3 - BLOG/EXPERT) - Hub intent-driven
 *
 * Rôle SEO : R3 - BLOG
 * Intention : Comprendre un problème réel
 *
 * Architecture : Assemblage de composants extraits
 * - IntentHero (4 lanes intentionnelles)
 * - BlogSearchBar (recherche + filtres)
 * - PillarArticlesGrid (3 articles piliers)
 * - CategoriesSection (4 grandes catégories)
 * - ContentTabs (populaires / récents / catégories)
 * - NewsletterCTA
 * - ThemeExplorer (10 thèmes)
 * - BlogFAQ (5 questions + JSON-LD FAQPage)
 * - BlogInternalLinks (mini sitemap thématique)
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
  type ActionFunctionArgs,
} from "@remix-run/node";
import {
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { useState, useMemo } from "react";

// Blog Components
import {
  type BlogArticle,
  type BlogCategory,
  type BlogStats,
  getArticleUrl,
} from "~/components/blog/blog-helpers";
import { BlogFAQ, buildFAQJsonLd } from "~/components/blog/BlogFAQ";
import { BlogInternalLinks } from "~/components/blog/BlogInternalLinks";
import { BlogNavigation } from "~/components/blog/BlogNavigation";
import { BlogSearchBar } from "~/components/blog/BlogSearchBar";
import { CategoriesSection } from "~/components/blog/CategoriesSection";
import { ContentTabs } from "~/components/blog/ContentTabs";
import { DiagnosticSection } from "~/components/blog/DiagnosticSection";
import { EditorialTrust } from "~/components/blog/EditorialTrust";
import { IntentHero } from "~/components/blog/IntentHero";
import { NewsletterCTA } from "~/components/blog/NewsletterCTA";
import { PillarArticlesGrid } from "~/components/blog/PillarArticlesGrid";
import { QuickChecklist } from "~/components/blog/QuickChecklist";
import { ThemeExplorer } from "~/components/blog/ThemeExplorer";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";

// UI Components
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R3_BLOG, {
    clusterId: "blog",
    canonicalEntity: "blog-pieces-auto",
  }),
};

interface LoaderData {
  blogData: {
    featured: BlogArticle[];
    recent: BlogArticle[];
    popular: BlogArticle[];
    diagnostic: BlogArticle[];
    categories: BlogCategory[];
    stats: BlogStats;
    success: boolean;
    lastUpdated: string;
  };
  searchParams: {
    query?: string;
    category?: string;
    type?: string;
  };
}

// Métadonnées SEO — robots conditionnel pour éviter cannibalisation des filtres
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const title = "Blog Automecanik - Conseils et Guides Auto Experts";
  const description =
    "Diagnostiquer une panne, comprendre une pièce, réussir un montage, choisir la bonne référence. Plus de 500 articles pratiques pour l'entretien de votre véhicule.";

  const loaderData = data as LoaderData | undefined;
  const hasFilters =
    loaderData?.searchParams?.query || loaderData?.searchParams?.type;
  const robots = hasFilters ? "noindex, follow" : "index, follow";

  return [
    { title },
    { name: "description", content: description },
    {
      name: "keywords",
      content:
        "blog automobile, conseils auto, guides réparation, entretien voiture, pièces auto, mécanique, diagnostic, tutoriel",
    },
    {
      tagName: "link",
      rel: "canonical",
      href: "https://www.automecanik.com/blog-pieces-auto",
    },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    {
      property: "og:image",
      content: "https://www.automecanik.com/images/og/blog-conseil.webp",
    },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    {
      name: "twitter:image",
      content: "https://www.automecanik.com/images/og/blog-conseil.webp",
    },
    { name: "robots", content: robots },
    { name: "author", content: "Automecanik - Experts Automobile" },
  ];
};

// Loader optimisé avec gestion d'erreurs avancée
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchParams = {
    query: url.searchParams.get("q") || undefined,
    category: url.searchParams.get("category") || undefined,
    type: url.searchParams.get("type") || undefined,
  };

  let blogData = {
    featured: [] as BlogArticle[],
    recent: [] as BlogArticle[],
    popular: [] as BlogArticle[],
    diagnostic: [] as BlogArticle[],
    categories: [] as BlogCategory[],
    stats: {
      totalArticles: 0,
      totalViews: 0,
      totalAdvice: 0,
      totalGuides: 0,
    },
    success: false,
    lastUpdated: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      getInternalApiUrlFromRequest("/api/blog/homepage", request),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "Remix-Blog-Client/1.0",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const apiResponse = await response.json();
      if (apiResponse.success && apiResponse.data) {
        const raw = apiResponse.data;
        blogData = {
          featured: raw.featured ?? raw.sections?.pillars ?? [],
          recent: raw.recent ?? raw.sections?.recentUpdated ?? [],
          popular: raw.popular ?? raw.sections?.popularAllTime ?? [],
          diagnostic: raw.sections?.diagnostic ?? [],
          categories: raw.categories ?? [],
          stats: raw.stats ?? blogData.stats,
          success: true,
          lastUpdated: raw.lastUpdated ?? new Date().toISOString(),
        };
      }
    } else {
      logger.warn(`API returned ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    logger.warn({ err: error, url: request.url }, "Blog API error");
  }

  return json(
    { blogData, searchParams },
    {
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
      },
    },
  );
}

// Action pour interactions utilisateur
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  try {
    switch (actionType) {
      case "bookmark":
        return json({ success: true, message: "Article ajouté aux favoris" });
      case "share":
        return json({ success: true, message: "Article partagé" });
      default:
        return json({ success: false, error: "Action non reconnue" });
    }
  } catch {
    return json(
      { success: false, error: "Erreur lors de l'action" },
      { status: 500 },
    );
  }
}

// Composant principal — assemblage de sections
export default function BlogIndex() {
  const { blogData, searchParams } = useLoaderData<
    typeof loader
  >() as unknown as LoaderData;
  const [searchQuery, setSearchQuery] = useState(searchParams.query || "");
  const [selectedType, setSelectedType] = useState(searchParams.type || "");

  // Articles filtrés pour les tabs
  const filteredArticles = useMemo(() => {
    if (!blogData.popular) return [];
    return blogData.popular.filter((article) => {
      const matchesType = !selectedType || article.type === selectedType;
      const matchesSearch =
        !searchQuery ||
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [blogData.popular, selectedType, searchQuery]);

  // Fallback UI si API down
  if (!blogData.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <BlogNavigation />
        <div className="container mx-auto px-4 pt-6">
          <PublicBreadcrumb items={[{ label: "Blog" }]} />
        </div>
        <IntentHero />
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mx-auto max-w-3xl my-8 text-center">
          <p className="text-amber-800">
            Le contenu est temporairement indisponible. Explorez nos sections
            ci-dessous.
          </p>
        </div>
        <ThemeExplorer />
        <BlogFAQ />
        <BlogInternalLinks />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Navigation Blog */}
      <BlogNavigation />

      {/* Breadcrumb */}
      <div className="container mx-auto px-4 pt-6">
        <PublicBreadcrumb items={[{ label: "Blog" }]} />
      </div>

      {/* Hero Intent-Driven + 4 Lanes */}
      <IntentHero stats={blogData.stats ?? undefined} />

      {/* E-E-A-T : Notre méthode éditoriale */}
      <EditorialTrust />

      {/* Recherche + filtres */}
      <BlogSearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
      />

      {/* Diagnostiquer par symptôme (aimant SEO long-tail) */}
      <DiagnosticSection articles={blogData.diagnostic ?? []} />

      {/* Articles en vedette (3 piliers) */}
      <PillarArticlesGrid articles={blogData.featured ?? []} />

      {/* 4 Catégories principales */}
      <CategoriesSection />

      {/* Contenu principal avec tabs (populaires / récents / catégories) */}
      <ContentTabs
        filteredArticles={filteredArticles}
        recentArticles={blogData.recent ?? []}
        categories={blogData.categories ?? []}
      />

      {/* Newsletter et Call to Action */}
      <NewsletterCTA />

      {/* Explorer par thème (10 familles de pièces) */}
      <ThemeExplorer />

      {/* Checklist rapide (contenu actionnable) */}
      <QuickChecklist />

      {/* FAQ éditoriale (5 questions) + Schema.org FAQPage */}
      <BlogFAQ />

      {/* Internal linking SEO (mini sitemap thématique) */}
      <BlogInternalLinks />

      {/* JSON-LD : CollectionPage + ItemList + FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: "Blog Automecanik - Conseils et Guides Auto",
              url: "https://www.automecanik.com/blog-pieces-auto",
              description:
                "Diagnostiquer une panne, comprendre une pièce, réussir un montage, choisir la bonne référence.",
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: blogData.stats?.totalArticles ?? 0,
                itemListElement: (blogData.featured ?? [])
                  .slice(0, 9)
                  .map((article, i) => ({
                    "@type": "ListItem",
                    position: i + 1,
                    url:
                      article.canonicalUrl ??
                      `https://www.automecanik.com${getArticleUrl(article)}`,
                    name: article.title,
                  })),
              },
              breadcrumb: {
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Accueil",
                    item: "https://www.automecanik.com",
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Blog",
                    item: "https://www.automecanik.com/blog-pieces-auto",
                  },
                ],
              },
            },
            buildFAQJsonLd(),
          ]),
        }}
      />
    </div>
  );
}

// ERROR BOUNDARY
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
