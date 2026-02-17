/**
 * Route : /blog-pieces-auto/guide-achat/:slug
 * Affiche le détail d'un guide d'achat
 *
 * Exemple :
 * /blog-pieces-auto/guide-achat/pieces-auto-comment-s-y-retrouver
 *
 * Rôle SEO : R3 - BLOG
 * Intention : Comprendre comment choisir une pièce
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronDown,
  Eye,
  List,
  Sparkles,
} from "lucide-react";

// SEO Page Role (Phase 5 - Quasi-Incopiable)

// Utils

// UI Components
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { CompactBlogHeader } from "~/components/blog/CompactBlogHeader";
import { Error404 } from "~/components/errors/Error404";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { Alert } from "~/components/ui";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { stripHtmlForMeta } from "~/utils/seo-clean.utils";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R3_BLOG, {
    clusterId: "guide",
  }),
};

// Types
interface GuideSection {
  level: number; // 2 pour H2, 3 pour H3
  title: string;
  content: string;
  anchor?: string;
}

interface Guide {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  publishedAt: string;
  updatedAt: string;
  viewsCount: number;
  featuredImage?: string | null;
  sections: GuideSection[];
  relatedGuides?: Guide[];
}

interface RagArticle {
  title: string;
  content: string;
  score: number;
}

interface LoaderData {
  guide: Guide;
  ragArticles: RagArticle[];
}

/* ===========================
   Meta
=========================== */
export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data?.guide) {
    return [
      { title: "Guide non trouvé - Pièces Auto" },
      { name: "robots", content: "noindex" },
    ];
  }

  const { guide } = data;
  const cleanTitle = guide.title.replace(
    /^Guide achat de pièce auto:?\s*/i,
    "",
  );
  const canonicalUrl = `https://www.automecanik.com${location.pathname}`;

  const cleanExcerpt = stripHtmlForMeta(guide.excerpt);

  // TechArticle schema (pattern: blog-pieces-auto.article.$slug.tsx)
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "@id": canonicalUrl,
    headline: cleanTitle,
    description: cleanExcerpt,
    url: canonicalUrl,
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt || guide.publishedAt,
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
    articleSection: "Guides d'Achat",
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    ...(guide.viewsCount > 0 && {
      interactionStatistic: {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ReadAction",
        userInteractionCount: guide.viewsCount,
      },
    }),
  };

  // BreadcrumbList schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
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
        name: "Blog Pieces Auto",
        item: "https://www.automecanik.com/blog-pieces-auto",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Guides d'Achat",
        item: "https://www.automecanik.com/blog-pieces-auto/guide-achat",
      },
      {
        "@type": "ListItem",
        position: 4,
        name: cleanTitle,
      },
    ],
  };

  const result: any[] = [
    { title: `${cleanTitle} - Guide d'Achat Pièces Auto` },
    { name: "description", content: cleanExcerpt },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { name: "robots", content: "index, follow" },
    { property: "og:title", content: cleanTitle },
    { property: "og:description", content: cleanExcerpt },
    { property: "og:type", content: "article" },
    { property: "og:url", content: canonicalUrl },
    { property: "article:published_time", content: guide.publishedAt },
    { "script:ld+json": articleSchema },
    { "script:ld+json": breadcrumbSchema },
  ];

  // LCP OPTIMIZATION: Preload featured image
  if (guide.featuredImage) {
    result.push({
      tagName: "link",
      rel: "preload",
      as: "image",
      href: guide.featuredImage,
    });
  }

  return result;
};

/* ===========================
   Loader
=========================== */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Response("Slug manquant", { status: 400 });
  }

  try {
    const backendUrl = getInternalApiUrl("");

    // Charger le guide depuis l'API
    const res = await fetch(`${backendUrl}/api/blog/guides/slug/${slug}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      throw new Response("Guide non trouvé", { status: 404 });
    }

    const data = await res.json();

    if (!data?.success || !data.data) {
      throw new Response("Guide non trouvé", { status: 404 });
    }

    const guide = data.data as Guide;

    // RAG enrichment (non-blocking, 2s timeout)
    let ragArticles: RagArticle[] = [];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const ragRes = await fetch(
        `${backendUrl}/api/rag/section/guide-achat?q=${encodeURIComponent(guide.title)}&limit=3`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);
      if (ragRes.ok) {
        const ragData = await ragRes.json();
        ragArticles = ragData.results || [];
      }
    } catch {
      // RAG unavailable — page renders without enrichment
    }

    return json<LoaderData>({ guide, ragArticles });
  } catch (error) {
    logger.error("❌ Erreur chargement guide:", error);
    throw new Response("Guide non trouvé", { status: 404 });
  }
}

/* ===========================
   Component
=========================== */
export default function GuideDetailPage() {
  const { guide, ragArticles } = useLoaderData<typeof loader>();

  const cleanTitle = guide.title.replace(
    /^Guide achat de pièce auto:?\s*/i,
    "",
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatViews = (views: number) => {
    if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
    if (views >= 1_000) return `${(views / 1_000).toFixed(1)}k`;
    return views.toString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50">
      <BlogPiecesAutoNavigation />

      {/* Header */}
      <CompactBlogHeader
        title={cleanTitle}
        description={guide.excerpt}
        gradientFrom="from-green-600"
        gradientTo="to-emerald-600"
      />

      {/* Back Button */}
      <section className="py-4 border-b bg-white">
        <div className="container mx-auto px-4">
          <Link
            to="/blog-pieces-auto/guide-achat"
            className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux guides
          </Link>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Article Header */}
          <article className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
            {/* Featured Image */}
            {guide.featuredImage ? (
              <div className="relative h-64 md:h-96 overflow-hidden">
                <img
                  src={guide.featuredImage}
                  alt={cleanTitle}
                  width={800}
                  height={384}
                  className="w-full h-full object-cover"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
            ) : (
              <div className="relative h-64 bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <BookOpen className="w-32 h-32 text-white opacity-50" />
              </div>
            )}

            {/* Content */}
            <div className="p-8 md:p-12">
              {/* Badge */}
              <Badge className="mb-4 bg-success text-white border-0">
                <Sparkles className="w-3 h-3 mr-1" />
                Guide d'Achat
              </Badge>

              {/* Title */}
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                {cleanTitle}
              </h2>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-8 pb-8 border-b">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-green-600" />
                  <span>{formatDate(guide.publishedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-green-600" />
                  <span>{formatViews(guide.viewsCount)} vues</span>
                </div>
                {guide.sections?.length > 0 && (
                  <div className="flex items-center gap-2">
                    <List className="w-4 h-4 text-green-600" />
                    <span>{guide.sections.length} sections</span>
                  </div>
                )}
              </div>

              {/* Excerpt */}
              {guide.excerpt && (
                <Alert intent="success">
                  <p>{guide.excerpt}</p>
                </Alert>
              )}

              {/* Table of Contents (Sommaire) */}
              {guide.sections?.filter((s) => s.level === 2).length > 2 && (
                <nav className="bg-green-50/50 border border-green-200 rounded-xl p-5 my-8">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <List className="w-4 h-4 text-green-600" />
                    Sommaire
                  </h3>
                  <ol className="space-y-1.5 list-decimal list-inside text-sm">
                    {guide.sections
                      .filter((s) => s.level === 2)
                      .map((section, i) => (
                        <li key={i}>
                          <a
                            href={`#section-h2-${i}`}
                            className="text-green-700 hover:text-green-900 hover:underline transition-colors"
                            onClick={(e) => {
                              e.preventDefault();
                              document
                                .getElementById(`section-h2-${i}`)
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                            }}
                          >
                            {section.title}
                          </a>
                        </li>
                      ))}
                  </ol>
                </nav>
              )}

              {/* Main Content */}
              <HtmlContent
                html={guide.content}
                className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3 prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-green-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6"
                trackLinks={true}
              />

              {/* Sections */}
              {guide.sections &&
                guide.sections.length > 0 &&
                (() => {
                  let h2Index = -1;
                  return (
                    <div className="mt-12 space-y-6">
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        Détails du guide
                      </h2>

                      {guide.sections.map((section, index) => {
                        const isH2 = section.level === 2;
                        const isH3 = section.level === 3;

                        if (isH2) {
                          h2Index++;
                          return (
                            <Card
                              key={`section-${index}`}
                              id={`section-h2-${h2Index}`}
                              className="scroll-mt-24 border-2 border-green-100 hover:border-green-300 transition-colors"
                            >
                              <CardContent className="p-6">
                                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                  <span className="w-8 h-8 rounded-full bg-success text-white flex items-center justify-center text-sm font-bold">
                                    {h2Index + 1}
                                  </span>
                                  {section.title}
                                </h3>
                                <HtmlContent
                                  html={section.content}
                                  className="prose max-w-none text-gray-700"
                                  trackLinks={true}
                                />
                              </CardContent>
                            </Card>
                          );
                        } else if (isH3) {
                          return (
                            <div
                              key={`section-${index}`}
                              className="ml-12 border-l-4 border-green-200 pl-6 py-4"
                            >
                              <h4 className="text-lg font-semibold text-gray-900 mb-3">
                                {section.title}
                              </h4>
                              <HtmlContent
                                html={section.content}
                                className="prose max-w-none text-gray-700"
                                trackLinks={true}
                              />
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  );
                })()}
            </div>
          </article>

          {/* Related Guides */}
          {guide.relatedGuides && guide.relatedGuides.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Guides similaires
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {guide.relatedGuides.map((relatedGuide) => (
                  <Link
                    key={relatedGuide.id}
                    to={`/blog-pieces-auto/guide-achat/${relatedGuide.slug}`}
                    className="group"
                  >
                    <Card className="h-full hover:shadow-xl hover:border-green-300 transition-all">
                      <CardContent className="p-6">
                        <h3 className="font-bold text-gray-900 mb-2 group-hover:text-green-600 transition-colors">
                          {relatedGuide.title.replace(
                            /^Guide achat de pièce auto:?\s*/i,
                            "",
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {relatedGuide.excerpt}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* RAG — Aller plus loin (accordéon) */}
          {ragArticles && ragArticles.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-green-600" />
                Aller plus loin
              </h2>
              <div className="space-y-3">
                {ragArticles.map((article, idx) => (
                  <details
                    key={idx}
                    className="group border border-green-100 rounded-lg"
                  >
                    <summary className="p-4 font-medium text-gray-900 text-sm cursor-pointer hover:bg-green-50 transition-colors flex items-center justify-between">
                      {article.title}
                      <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="px-4 pb-4">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {article.content}
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Glossaire */}
          <div className="mt-8 flex items-center gap-2 text-sm">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            <Link
              to="/reference-auto"
              className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              Consulter le glossaire des pièces auto
            </Link>
          </div>

          {/* CTA */}
          <section className="mt-12 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-4">
              Besoin d'aide pour choisir ?
            </h2>
            <p className="text-green-100 mb-6 max-w-2xl mx-auto">
              Nos experts vous conseillent gratuitement pour trouver les
              meilleures pièces adaptées à votre véhicule
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button
                size="lg"
                className="bg-white text-green-600 hover:bg-success/20"
              >
                Contacter un expert
              </Button>
              <Link to="/blog-pieces-auto/guide-achat">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-white text-white hover:bg-white/10"
                >
                  Voir tous les guides
                </Button>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY (Requis pour HTML rendering au lieu de JSON)
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
