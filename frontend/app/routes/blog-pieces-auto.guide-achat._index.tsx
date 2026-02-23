// app/routes/blog-pieces-auto.guide-achat._index.tsx
/**
 * Route : /blog-pieces-auto/guide-achat
 * Hub editorial des guides d'achat pieces auto
 *
 * Role SEO : R3 - BLOG
 * Architecture : Editorial Hub adaptatif (hero + cross-link conseils)
 * - 1-3 guides : hero editorial + liste
 * - 4-8 guides : featured + grid 2 cols
 * - 9+  guides : auto-categorisation dynamique
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
  ArrowRight,
  BookOpen,
  Car,
  Clock,
  Eye,
  List,
  Sparkles,
} from "lucide-react";
import { useMemo } from "react";
import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { CompactBlogHeader } from "~/components/blog/CompactBlogHeader";
import { Error404 } from "~/components/errors/Error404";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { stripHtmlForMeta } from "~/utils/seo-clean.utils";

/* ===========================
   Handle — PageRole SEO
=========================== */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R3_BLOG, {
    clusterId: "guide-index",
    canonicalEntity: "guide-index",
  }),
};

/* ===========================
   Types
=========================== */
interface BlogGuide {
  id: string;
  type: string;
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: string;
  viewsCount: number;
  featuredImage: string | null;
  h2Count?: number;
  h3Count?: number;
  readingTime?: number;
  keywords?: string[];
  tags?: string[];
}

interface AdviceSummary {
  id: string;
  title: string;
  slug: string;
  pg_alias: string | null;
  excerpt: string;
  viewsCount: number;
  publishedAt: string;
}

interface LoaderData {
  guides: BlogGuide[];
  relatedAdvice: AdviceSummary[];
  totalAdvice: number;
}

/* ===========================
   Loader
=========================== */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const backendUrl = getInternalApiUrl("");

  const [guidesResult, adviceResult] = await Promise.allSettled([
    fetch(`${backendUrl}/api/blog/guides?limit=300&type=achat`, {
      headers: { "Content-Type": "application/json" },
    }),
    fetch(`${backendUrl}/api/blog/advice?limit=8&page=1`, {
      headers: { "Content-Type": "application/json" },
    }),
  ]);

  // Parse guides
  let guides: BlogGuide[] = [];
  try {
    if (guidesResult.status === "fulfilled" && guidesResult.value.ok) {
      const data = await guidesResult.value.json();
      if (data?.success && data.data?.guides) {
        guides = data.data.guides as BlogGuide[];
      }
    }
  } catch (e) {
    logger.error("Erreur parsing guides:", e);
  }

  // Parse advice
  let relatedAdvice: AdviceSummary[] = [];
  let totalAdvice = 0;
  try {
    if (adviceResult.status === "fulfilled" && adviceResult.value.ok) {
      const data = await adviceResult.value.json();
      if (data?.success && data.data?.articles) {
        relatedAdvice = (data.data.articles as AdviceSummary[]).slice(0, 8);
        totalAdvice = data.data.total ?? relatedAdvice.length;
      }
    }
  } catch (e) {
    logger.error("Erreur parsing advice:", e);
  }

  // Tri par date la plus recente en premier (hero = plus recent)
  guides.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  logger.log(
    `Guides: ${guides.length}, Conseils: ${relatedAdvice.length}/${totalAdvice}`,
  );

  return json<LoaderData>({ guides, relatedAdvice, totalAdvice });
};

/* ===========================
   Meta + Structured Data
=========================== */
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const count = data?.guides?.length ?? 0;
  const canonicalUrl =
    "https://www.automecanik.com/blog-pieces-auto/guide-achat";

  const description =
    count > 0
      ? `${count} guide${count > 1 ? "s" : ""} d'achat pour bien choisir vos pieces auto. Comparatifs, marques recommandees et conseils d'experts mecaniciens.`
      : "Guides d'achat pour choisir vos pieces auto. Comparatifs, conseils d'experts et recommandations.";

  // CollectionPage + ItemList + BreadcrumbList
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": canonicalUrl,
        name: "Guides d'Achat Pieces Auto",
        description,
        url: canonicalUrl,
        mainEntity: { "@id": `${canonicalUrl}#list` },
        breadcrumb: { "@id": `${canonicalUrl}#breadcrumb` },
        publisher: {
          "@type": "Organization",
          name: "Automecanik",
          url: "https://www.automecanik.com",
        },
      },
      {
        "@type": "ItemList",
        "@id": `${canonicalUrl}#list`,
        name: "Guides d'Achat Pieces Auto",
        numberOfItems: count,
        itemListElement: (data?.guides || []).map((guide, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: guide.title.replace(/^Guide achat de piece auto:?\s*/i, ""),
          url: `${canonicalUrl}/${guide.slug}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
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
          },
        ],
      },
    ],
  };

  return [
    { title: "Guides d'Achat Pieces Auto - Conseils d'Experts | Automecanik" },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { name: "robots", content: "index, follow" },
    { property: "og:title", content: "Guides d'Achat Pieces Auto" },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonicalUrl },
    {
      property: "og:image",
      content: "https://www.automecanik.com/images/og/guide-achat.webp",
    },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:title",
      content: "Guides d'Achat Pieces Auto",
    },
    { name: "twitter:description", content: description },
    {
      name: "twitter:image",
      content: "https://www.automecanik.com/images/og/guide-achat.webp",
    },
    { "script:ld+json": schema },
  ];
};

/* ===========================
   Helpers
=========================== */
const formatViews = (views: number) => {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}k`;
  return views.toString();
};

const cleanGuideTitle = (title: string) =>
  title.replace(/^Guide achat de piece auto:?\s*/i, "");

/* ===========================
   Guides épinglés (routes statiques hors DB)
=========================== */
const PINNED_GUIDES: BlogGuide[] = [
  {
    id: "pinned-selecteur-vehicule",
    type: "achat",
    title: "Selecteur de vehicule pieces auto : comment trouver la bonne piece",
    slug: "comment-utiliser-selecteur-vehicule-pieces-auto",
    excerpt:
      "4 methodes pour identifier votre vehicule et trouver les pieces compatibles : immatriculation, code VIN, selection manuelle ou reference OEM.",
    publishedAt: "2026-02-01T00:00:00Z",
    viewsCount: 0,
    featuredImage: null,
    h2Count: 8,
    readingTime: 12,
    keywords: [
      "selecteur vehicule",
      "trouver piece auto",
      "immatriculation",
      "code VIN",
    ],
    tags: ["Outils", "Selecteur vehicule"],
  },
];

/* ===========================
   Page
=========================== */
export default function BlogGuidesIndex() {
  const { guides, relatedAdvice, totalAdvice } = useLoaderData<typeof loader>();

  // Fusionner guides épinglés (routes statiques) + guides API, dedup par slug
  const apiSlugs = new Set(guides.map((g) => g.slug));
  const uniquePinned = PINNED_GUIDES.filter((p) => !apiSlugs.has(p.slug));
  const allGuides = [...guides, ...uniquePinned];

  const featuredGuide = allGuides[0] ?? null;
  const otherGuides = allGuides.slice(1);

  // Séparer guides produit (familles) et guides outils (transversaux)
  const toolGuides = otherGuides.filter((g) => g.tags?.[0] === "Outils");
  const productGuides = otherGuides.filter((g) => g.tags?.[0] !== "Outils");

  // Groupement par famille (tags[0] = nom famille : Freinage, Eclairage, etc.)
  const groupedGuides = useMemo(() => {
    const groups: Record<string, BlogGuide[]> = {};
    productGuides.forEach((guide) => {
      const family = guide.tags?.[0] || "Autres";
      if (!groups[family]) groups[family] = [];
      groups[family].push(guide);
    });
    return Object.entries(groups).sort(([, a], [, b]) => b.length - a.length);
  }, [productGuides]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50">
      <BlogPiecesAutoNavigation />

      {/* Header */}
      <CompactBlogHeader
        title="Guides d'Achat"
        description="Conseils d'experts pour choisir vos pieces auto"
        gradientFrom="from-green-600"
        gradientTo="to-emerald-600"
      />

      {/* Hero Guide (le plus recent) */}
      {featuredGuide && (
        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <Link
                to={`/blog-pieces-auto/guide-achat/${featuredGuide.slug}`}
                className="group block"
              >
                <Card className="overflow-hidden border-2 border-gray-100 hover:border-green-300 hover:shadow-2xl hover:shadow-green-100/50 transition-all duration-300 group-hover:-translate-y-1">
                  <div className="flex flex-col md:flex-row">
                    {/* Image */}
                    <div className="relative md:w-80 h-48 md:h-auto flex-shrink-0 overflow-hidden">
                      {featuredGuide.featuredImage ? (
                        <img
                          src={featuredGuide.featuredImage}
                          alt={cleanGuideTitle(featuredGuide.title)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full min-h-[200px] bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                          <BookOpen className="w-20 h-20 text-white/60" />
                        </div>
                      )}
                      <Badge className="absolute top-3 left-3 bg-success text-white border-0 shadow-lg">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Guide d'Achat
                      </Badge>
                    </div>

                    {/* Content */}
                    <CardContent className="flex-1 p-6 md:p-8 flex flex-col justify-center">
                      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 group-hover:text-green-600 transition-colors leading-tight">
                        {cleanGuideTitle(featuredGuide.title)}
                      </h2>

                      <p className="text-gray-600 mb-5 line-clamp-3 leading-relaxed">
                        {stripHtmlForMeta(featuredGuide.excerpt)}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-5">
                        {featuredGuide.h2Count != null &&
                          featuredGuide.h2Count > 0 && (
                            <div className="flex items-center gap-1.5">
                              <List className="w-4 h-4 text-green-600" />
                              <span>{featuredGuide.h2Count} sections</span>
                            </div>
                          )}
                        <div className="flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-green-600" />
                          <span>
                            {formatViews(featuredGuide.viewsCount || 0)} vues
                          </span>
                        </div>
                        {featuredGuide.readingTime != null &&
                          featuredGuide.readingTime > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-green-600" />
                              <span>{featuredGuide.readingTime} min</span>
                            </div>
                          )}
                      </div>

                      <div>
                        <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold">
                          Lire le guide
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Guides pratiques (outils transversaux) */}
      {toolGuides.length > 0 && (
        <section className="py-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-y border-blue-100">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Car className="w-5 h-5 text-blue-600" />
                Guides pratiques
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {toolGuides.map((guide) => (
                  <Link
                    key={guide.id}
                    to={`/blog-pieces-auto/guide-achat/${guide.slug}`}
                    className="group block"
                  >
                    <Card className="h-full hover:shadow-xl hover:shadow-blue-100/50 transition-all duration-300 border border-blue-200 hover:border-blue-400 group-hover:-translate-y-0.5 bg-white">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                            <Car className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 mb-1.5 group-hover:text-blue-600 transition-colors leading-tight">
                              {cleanGuideTitle(guide.title)}
                            </h4>
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                              {stripHtmlForMeta(guide.excerpt)}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              {guide.h2Count != null && guide.h2Count > 0 && (
                                <div className="flex items-center gap-1">
                                  <List className="w-3.5 h-3.5" />
                                  <span>{guide.h2Count} sections</span>
                                </div>
                              )}
                              {guide.readingTime != null &&
                                guide.readingTime > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{guide.readingTime} min</span>
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Guides par famille */}
      {groupedGuides.map(([family, familyGuides], famIdx) => (
        <section
          key={family}
          className={`py-10 ${famIdx % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-green-600" />
                {family}
                <span className="text-sm font-normal text-gray-500">
                  ({familyGuides.length} guide
                  {familyGuides.length > 1 ? "s" : ""})
                </span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {familyGuides.map((guide) => (
                  <Link
                    key={guide.id}
                    to={`/blog-pieces-auto/guide-achat/${guide.slug}`}
                    className="group block"
                  >
                    <Card className="h-full hover:shadow-xl hover:shadow-green-100/50 transition-all duration-300 border border-gray-100 hover:border-green-300 group-hover:-translate-y-0.5">
                      <div className="flex flex-row h-full">
                        <div className="relative w-36 flex-shrink-0 overflow-hidden">
                          {guide.featuredImage ? (
                            <img
                              src={guide.featuredImage}
                              alt={cleanGuideTitle(guide.title)}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full min-h-[140px] bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                              <BookOpen className="w-12 h-12 text-white/60" />
                            </div>
                          )}
                        </div>

                        <CardContent className="flex-1 p-4">
                          <h4 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-green-600 transition-colors leading-tight">
                            {cleanGuideTitle(guide.title)}
                          </h4>

                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {stripHtmlForMeta(guide.excerpt)}
                          </p>

                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            {guide.h2Count != null && guide.h2Count > 0 && (
                              <div className="flex items-center gap-1">
                                <List className="w-3.5 h-3.5" />
                                <span>{guide.h2Count} sections</span>
                              </div>
                            )}
                            {guide.readingTime != null &&
                              guide.readingTime > 0 && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{guide.readingTime} min</span>
                                </div>
                              )}
                            <div className="flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" />
                              <span>{formatViews(guide.viewsCount || 0)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* Etat vide */}
      {guides.length === 0 && (
        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Les guides d'achat arrivent bientot
            </h3>
            <p className="text-gray-600 mb-6">
              En attendant, consultez nos conseils d'experts
            </p>
            <Link to="/blog-pieces-auto/conseils">
              <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                Voir les conseils
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* Conseils associes — cross-linking avec les 85 articles advice */}
      {relatedAdvice.length > 0 && (
        <section className="py-12 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">
                    Conseils d'experts automobile
                  </h3>
                  <p className="text-gray-600">
                    {totalAdvice} articles de montage et entretien
                  </p>
                </div>
                <Link
                  to="/blog-pieces-auto/conseils"
                  className="hidden sm:inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Voir tous les conseils
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {relatedAdvice.map((advice) => (
                  <Link
                    key={advice.id}
                    to={`/blog-pieces-auto/conseils/${advice.pg_alias || advice.slug}`}
                    className="group block"
                  >
                    <Card className="h-full hover:shadow-lg transition-all duration-200 border border-gray-100 hover:border-blue-200 group-hover:-translate-y-0.5">
                      <CardContent className="p-4">
                        <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors leading-snug">
                          {advice.title}
                        </h4>
                        <p className="text-xs text-gray-500 line-clamp-1 mb-3">
                          {stripHtmlForMeta(advice.excerpt)}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Eye className="w-3 h-3" />
                          <span>{formatViews(advice.viewsCount || 0)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Mobile link */}
              <div className="mt-6 text-center sm:hidden">
                <Link to="/blog-pieces-auto/conseils">
                  <Button
                    variant="outline"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    Voir les {totalAdvice} conseils
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA Final */}
      <section className="py-14 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Besoin de conseils personnalises ?
          </h2>
          <p className="text-green-100 mb-6 max-w-xl mx-auto">
            Nos experts vous aident a choisir les pieces adaptees a votre
            vehicule
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/blog-pieces-auto/conseils">
              <Button
                size="lg"
                className="bg-white text-green-600 hover:bg-green-50 font-semibold px-6"
              >
                Explorer les conseils
              </Button>
            </Link>
            <Link to="/blog-pieces-auto/auto">
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white text-white hover:bg-white/10 font-semibold px-6"
              >
                Pieces par constructeur
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ===========================
   Error Boundary
=========================== */
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
