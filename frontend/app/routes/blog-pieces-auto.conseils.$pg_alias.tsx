/**
 * Route legacy : /blog-pieces-auto/conseils/:pg_alias
 * Affiche l'article directement avec l'URL originale (pas de redirection)
 *
 * Exemple :
 * /blog-pieces-auto/conseils/alternateur
 * → Affiche l'article "Comment changer votre alternateur"
 *
 * Rôle SEO : R3 - BLOG
 * Intention : Comprendre comment installer/entretenir une pièce
 */

import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useNavigate,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Share2,
  Bookmark,
  Tag,
  BookOpen,
  Info,
  AlertTriangle,
  CheckCircle,
  Wrench,
  ShieldAlert,
  ClipboardCheck,
  Package,
  HelpCircle,
  ExternalLink,
  Settings,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

// SEO Page Role (Phase 5 - Quasi-Incopiable)

// Utils
import { ArticleNavigation } from "~/components/blog/ArticleNavigation";

// Components internes
import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { CompactBlogHeader } from "~/components/blog/CompactBlogHeader";

// Blog components
import CTAButton from "~/components/blog/CTAButton";
import { ScrollToTop } from "~/components/blog/ScrollToTop";
import { TableOfContents } from "~/components/blog/TableOfContents";
import VehicleCarousel from "~/components/blog/VehicleCarousel";
import { Error404 } from "~/components/errors/Error404";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";

// SEO Components - HtmlContent remplace dangerouslySetInnerHTML
import {
  trackArticleView,
  trackReadingTime,
  trackShareArticle,
  trackBookmark,
} from "~/utils/analytics";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { stripHtmlForMeta } from "~/utils/seo-clean.utils";
import { Badge } from "../components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R3_BLOG, {
    clusterId: "conseils",
  }),
};

// Analytics

// Types
interface CompatibleVehicle {
  type_id: number;
  type_alias: string;
  type_name: string;
  type_power: number;
  type_fuel: string;
  type_body: string;
  period: string;
  modele_id: number;
  modele_alias: string;
  modele_name: string;
  modele_pic: string | null;
  marque_id: number;
  marque_alias: string;
  marque_name: string;
  marque_logo: string | null;
  catalog_url: string;
}

interface _BlogArticle {
  id: string;
  title: string;
  slug: string;
  pg_alias?: string | null;
  /** Gamme product group ID (from DB) */
  pg_id?: number | null;
  excerpt: string;
  content: string;
  h1: string;
  h2: string;
  keywords: string[];
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  viewsCount: number;
  readingTime?: number;
  legacy_table?: string;
  featuredImage?: string | null;
  /** Wall/thumbnail image filename */
  wall?: string | null;
  sections: BlogSection[];
  cta_anchor?: string | null;
  cta_link?: string | null;
  relatedArticles?: _BlogArticle[];
  compatibleVehicles?: CompatibleVehicle[];
  seo_data: {
    meta_title: string;
    meta_description: string;
  };
}

interface BlogSection {
  level: 2 | 3;
  title: string;
  content: string;
  anchor: string;
  cta_anchor?: string | null;
  cta_link?: string | null;
  wall?: string | null;
}

interface GammeConseil {
  title: string;
  content: string;
  sectionType: string | null;
  order: number | null;
}

type ConseilArray = GammeConseil[];

// --- Section styles par type (Phase 2 - rendu typé S1-S8) ---

const SECTION_ICONS: Record<string, typeof Info> = {
  S1: Info,
  S2: AlertTriangle,
  S3: CheckCircle,
  S4_DEPOSE: Wrench,
  S4_REPOSE: Wrench,
  S5: ShieldAlert,
  S6: ClipboardCheck,
  S7: Package,
  S8: HelpCircle,
  META: ExternalLink,
};

const SECTION_STYLES: Record<
  string,
  { border: string; headerBg: string; label: string }
> = {
  S1: {
    border: "border-blue-200",
    headerBg: "bg-gradient-to-r from-blue-600 to-indigo-600",
    label: "Avant de commencer",
  },
  S2: {
    border: "border-amber-200",
    headerBg: "bg-gradient-to-r from-amber-500 to-orange-500",
    label: "Signes d'usure",
  },
  S3: {
    border: "border-emerald-300",
    headerBg: "bg-gradient-to-r from-emerald-600 to-green-600",
    label: "Compatibilité",
  },
  S4_DEPOSE: {
    border: "border-slate-200",
    headerBg: "bg-gradient-to-r from-slate-600 to-gray-700",
    label: "Démontage",
  },
  S4_REPOSE: {
    border: "border-slate-200",
    headerBg: "bg-gradient-to-r from-slate-600 to-gray-700",
    label: "Remontage",
  },
  S5: {
    border: "border-red-200",
    headerBg: "bg-gradient-to-r from-red-500 to-rose-500",
    label: "Erreurs à éviter",
  },
  S6: {
    border: "border-sky-200",
    headerBg: "bg-gradient-to-r from-sky-500 to-blue-500",
    label: "Vérification finale",
  },
  S7: {
    border: "border-green-200",
    headerBg: "bg-gradient-to-r from-green-600 to-emerald-600",
    label: "Pièces complémentaires",
  },
  S8: {
    border: "border-violet-200",
    headerBg: "bg-gradient-to-r from-violet-500 to-purple-500",
    label: "FAQ",
  },
  META: {
    border: "border-gray-200",
    headerBg: "bg-gradient-to-r from-gray-400 to-gray-500",
    label: "Articles associés",
  },
};

const DEFAULT_SECTION_STYLE = {
  border: "border-green-200",
  headerBg: "bg-gradient-to-r from-green-600 to-emerald-600",
  label: "Conseil",
};

function getSectionStyle(type: string | null) {
  if (!type) return DEFAULT_SECTION_STYLE;
  return SECTION_STYLES[type] || DEFAULT_SECTION_STYLE;
}

function SectionIcon({ type }: { type: string | null }) {
  const IconComponent = (type && SECTION_ICONS[type]) || Settings;
  return <IconComponent className="w-6 h-6" />;
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Loader
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { pg_alias } = params;

  if (!pg_alias) {
    return redirect("/blog-pieces-auto/conseils", 301);
  }

  // Timeout 15s pour éviter les erreurs 5xx
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const baseUrl = getInternalApiUrl("");
    const fetchHeaders = {
      cookie: request.headers.get("cookie") || "",
    };

    // 1️⃣ Essayer d'abord par slug (pour les liens depuis la liste)
    let article: _BlogArticle | null = null;
    const slugResponse = await fetch(
      `${baseUrl}/api/blog/article/${pg_alias}`,
      {
        headers: fetchHeaders,
        signal: controller.signal,
      },
    );

    if (slugResponse.ok) {
      const slugData = await slugResponse.json();
      // Route conseils = contenu __blog_advice uniquement
      // Ignorer les résultats __blog_guide (page guide-achat séparée)
      if (slugData?.data && slugData.data.legacy_table !== "__blog_guide") {
        article = slugData.data;
      }
    }

    // 2️⃣ Fallback par gamme (legacy URLs) → renvoie __blog_advice
    if (!article) {
      const gammeResponse = await fetch(
        `${baseUrl}/api/blog/article/by-gamme/${pg_alias}`,
        {
          headers: fetchHeaders,
          signal: controller.signal,
        },
      );

      if (gammeResponse.ok) {
        const gammeData = await gammeResponse.json();
        article = gammeData?.data || null;
      }
    }

    if (!article) {
      return redirect("/blog-pieces-auto/conseils", 301);
    }

    // Lancer les 3 fetches below-fold en parallele (promises, pas await)
    const adjacentPromise = fetch(
      `${baseUrl}/api/blog/article/${article.slug}/adjacent`,
      { headers: fetchHeaders, signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.data || { previous: null, next: null })
      .catch(() => ({ previous: null, next: null }));

    const seoSwitchesPromise = article.pg_id
      ? fetch(`${baseUrl}/api/blog/seo-switches/${article.pg_id}`, {
          headers: fetchHeaders,
          signal: controller.signal,
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d?.data || [])
          .catch(() => [])
      : Promise.resolve([]);

    const conseilPromise = article.pg_id
      ? fetch(`${baseUrl}/api/blog/conseil/${article.pg_id}`, {
          headers: fetchHeaders,
          signal: controller.signal,
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (d?.data || []) as ConseilArray)
          .catch(() => [] as ConseilArray)
      : Promise.resolve([] as ConseilArray);

    // CLS fix: await all 3 parallel fetches (localhost, ~50ms) to avoid layout shift
    const [adjacentData, seoSwitchesData, conseilData] = await Promise.all([
      adjacentPromise,
      seoSwitchesPromise,
      conseilPromise,
    ]);

    clearTimeout(timeoutId);
    return json({
      article,
      pg_alias,
      adjacentArticles: adjacentData,
      seoSwitches: seoSwitchesData,
      conseil: conseilData,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    // Propager les Response HTTP (404, etc.) telles quelles
    if (error instanceof Response) {
      throw error;
    }
    // Pour les vraies erreurs (réseau, parsing), rediriger plutôt que 500
    logger.error(
      `[Legacy URL] Error loading article for gamme: ${pg_alias}`,
      error,
    );
    return redirect("/blog-pieces-auto/conseils", 302);
  }
}

// Meta tags
export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data) {
    return [
      { title: "Article non trouvé" },
      { name: "robots", content: "noindex" },
    ];
  }

  const { article } = data;
  const canonicalUrl = `https://www.automecanik.com${location.pathname}`;
  const cleanDescription = stripHtmlForMeta(article.seo_data.meta_description);
  const cleanExcerpt = stripHtmlForMeta(article.excerpt);
  const title = article.seo_data.meta_title || article.h1 || article.title;

  // JSON-LD Schema Article — rich snippets Google
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": canonicalUrl,
    headline: title,
    description: cleanDescription,
    url: canonicalUrl,
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
    articleSection: "Conseils Auto",
    keywords: article.keywords.join(", "),
    ...(article.readingTime && { timeRequired: `PT${article.readingTime}M` }),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    ...(article.viewsCount > 0 && {
      interactionStatistic: {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ReadAction",
        userInteractionCount: article.viewsCount,
      },
    }),
  };

  const result: Array<Record<string, string | object>> = [
    { title },
    { name: "description", content: cleanDescription },
    { name: "keywords", content: article.keywords.join(", ") },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { name: "robots", content: "index, follow" },
    { name: "author", content: "Automecanik - Experts Automobile" },
    { property: "og:title", content: article.title },
    { property: "og:description", content: cleanExcerpt },
    { property: "og:type", content: "article" },
    { property: "og:url", content: canonicalUrl },
    {
      property: "og:image",
      content: "https://www.automecanik.com/images/og/blog-conseil.webp",
    },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "article:published_time", content: article.publishedAt },
    {
      property: "article:modified_time",
      content: article.updatedAt || article.publishedAt,
    },
    { property: "article:tag", content: article.keywords.join(", ") },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: cleanDescription },
    {
      name: "twitter:image",
      content: "https://www.automecanik.com/images/og/blog-conseil.webp",
    },
    // JSON-LD Schema Article
    { "script:ld+json": articleSchema },
  ];

  // LCP OPTIMIZATION: Preload featured image
  if (article.featuredImage) {
    result.push({
      tagName: "link",
      rel: "preload",
      as: "image",
      href: article.featuredImage,
    });
  }

  return result;
};

// Composant principal - Réutilise le même design que blog.article.$slug.tsx
export default function LegacyBlogArticle() {
  const data = useLoaderData<typeof loader>();
  const { article, pg_alias, adjacentArticles, seoSwitches, conseil } = data;
  const navigate = useNavigate();
  const [isBookmarked, setIsBookmarked] = useState(false);

  const s1Sections = conseil?.filter((c) => c.sectionType === "S1") ?? [];
  // Quand des sections conseil S1-S8 existent, elles remplacent les H2/H3 article (évite la duplication)
  const hasConseilSections =
    conseil &&
    conseil.filter((c) => c.sectionType && c.sectionType !== "META").length > 0;
  // SSR-safe: Use ref for startTime to avoid hydration mismatch
  const startTimeRef = useRef<number>(0);

  // Initialize startTime on client only
  useEffect(() => {
    startTimeRef.current = Date.now();
  }, []);

  // Calculer le temps de lecture (approximatif)
  const _readingTime = Math.ceil(
    (article.content.length +
      article.sections.reduce((acc, s) => acc + s.content.length, 0)) /
      1000,
  );

  // 🆕 Analytics tracking
  useEffect(() => {
    // Track vue d'article après 3 secondes (évite les bounces)
    const viewTimer = setTimeout(() => {
      trackArticleView(article.id, article.title);
    }, 3000);

    // Track temps de lecture au départ
    return () => {
      clearTimeout(viewTimer);
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (duration > 5) {
        trackReadingTime(article.id, duration, article.title);
      }
    };
  }, [article.id, article.title]);

  // Gérer le bookmark avec tracking
  const handleBookmark = () => {
    const newState = !isBookmarked;
    setIsBookmarked(newState);
    trackBookmark(article.id, newState ? "add" : "remove", article.title);
  };

  // Gérer le partage avec tracking
  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: article.title,
          text: article.excerpt,
          url: window.location.href,
        })
        .then(() => {
          trackShareArticle("native", article.id, article.title);
        });
    } else {
      navigator.clipboard.writeText(window.location.href);
      trackShareArticle("copy", article.id, article.title);
      toast.success("Lien copié !", {
        description: "Le lien de l'article a été copié",
        duration: 2000,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Navigation */}
      <BlogPiecesAutoNavigation />

      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <PublicBreadcrumb
            items={[
              { label: "Blog", href: "/blog-pieces-auto" },
              { label: "Conseils", href: "/blog-pieces-auto/conseils" },
              { label: article.title },
            ]}
          />
        </div>
      </div>

      {/* Header Compact */}
      <CompactBlogHeader
        title={article.h1}
        description={`Publié le ${new Date(article.publishedAt).toLocaleDateString("fr-FR")} • ${article.viewsCount.toLocaleString()} vues`}
        stats={[
          {
            icon: Eye,
            value: article.viewsCount.toLocaleString(),
            label: "Vues",
          },
          {
            icon: Clock,
            value: `${Math.ceil(article.content.split(" ").length / 200)} min`,
            label: "Lecture",
          },
        ]}
        gradientFrom="from-purple-600"
        gradientTo="to-pink-600"
      />

      <div className="container mx-auto px-4 max-w-6xl py-8">
        {/* Bouton retour */}
        <button
          onClick={() => navigate("/blog")}
          className="mb-6 px-4 py-2 bg-white hover:bg-gray-50 rounded-lg transition-all flex items-center gap-2 border border-gray-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium text-gray-700">Retour au blog</span>
        </button>

        {/* Featured Image */}
        {article.featuredImage && (
          <Card className="mb-8 border shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-gray-50 via-white to-gray-100 p-6 flex items-center justify-center">
                <img
                  src={article.featuredImage}
                  alt={article.title}
                  width={800}
                  height={256}
                  className="w-full h-64 object-contain drop-shadow-lg"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {article.tags.slice(0, 6).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="px-3 py-1 text-sm"
              >
                <Tag className="w-3 h-3 mr-1.5 inline" />
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Contenu Principal */}
      <div className="bg-gray-50 min-h-screen py-12">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Article - 3 colonnes (meilleure lecture) */}
            <article className="lg:col-span-3 order-2 lg:order-1">
              <Card className="shadow-xl border-0 overflow-hidden">
                <CardContent className="p-8 lg:p-12">
                  {/* Sections S1 — Informations / Avant de commencer (en haut de l'article) */}
                  {s1Sections.map((s1, idx) => (
                    <div
                      key={idx}
                      id={slugifyTitle(s1.title)}
                      className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200"
                    >
                      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Info className="w-6 h-6 text-blue-600" />
                        {s1.title}
                      </h2>
                      <HtmlContent
                        html={s1.content}
                        className="prose prose-lg max-w-none
                        prose-p:text-gray-700 prose-p:leading-relaxed
                        prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                        prose-strong:text-gray-900 prose-strong:font-semibold"
                        trackLinks={true}
                      />
                    </div>
                  ))}

                  {/* Contenu principal */}
                  <HtmlContent
                    html={article.content}
                    className="prose prose-lg max-w-none mb-8
                    prose-headings:text-gray-900 prose-headings:font-bold
                    prose-p:text-gray-700 prose-p:leading-relaxed
                    prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-gray-900 prose-strong:font-semibold
                    prose-ul:list-disc prose-ul:pl-6
                    prose-li:text-gray-700"
                    trackLinks={true}
                  />

                  {/* CTA Principal (après le contenu principal) */}
                  {article.cta_link && article.cta_anchor && (
                    <CTAButton
                      anchor={article.cta_anchor}
                      link={article.cta_link}
                    />
                  )}

                  {/* Sections H2/H3 de l'article (toujours affichées) */}
                  {article.sections.map((section, index) => (
                    <section key={index} id={section.anchor} className="mb-8">
                      {section.level === 2 ? (
                        <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500">
                          {section.title}
                        </h2>
                      ) : (
                        <h3 className="text-xl font-semibold text-gray-800 mb-3 ml-4">
                          {section.title}
                        </h3>
                      )}

                      {/* Image de la section (style moderne avec Card) */}
                      {section.wall && section.wall !== "no.jpg" && (
                        <Card
                          className="float-left mr-6 mb-4 overflow-hidden shadow-lg hover:shadow-xl transition-shadow border-2 border-gray-100"
                          style={{ width: "240px" }}
                        >
                          <CardContent className="p-0">
                            <img
                              src={`/upload/blog/guide/mini/${section.wall}`}
                              alt={section.title}
                              width={240}
                              height={176}
                              className="w-full object-cover aspect-[240/176]"
                              loading="lazy"
                            />
                          </CardContent>
                        </Card>
                      )}

                      <HtmlContent
                        html={section.content}
                        className={`prose prose-lg max-w-none ${section.level === 3 ? "ml-4" : ""}
                        prose-p:text-gray-700 prose-p:leading-relaxed
                        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                        prose-strong:font-semibold
                        prose-ul:list-disc prose-ul:pl-6
                        prose-li:text-gray-700`}
                        trackLinks={true}
                      />

                      {/* Clear float après l'image */}
                      {section.wall && section.wall !== "no.jpg" && (
                        <div className="clear-both" />
                      )}

                      {/* CTA de section (si présent) */}
                      {section.cta_link && section.cta_anchor && (
                        <CTAButton
                          anchor={section.cta_anchor}
                          link={section.cta_link}
                          className={section.level === 3 ? "ml-4" : ""}
                        />
                      )}
                    </section>
                  ))}

                  {/* Sections conseil S2-S8 (complètent les H2/H3 article) */}
                  {hasConseilSections &&
                    conseil
                      .filter(
                        (c) =>
                          c.sectionType &&
                          c.sectionType !== "S1" &&
                          c.sectionType !== "META",
                      )
                      .map((conseilItem, index) => {
                        const style = getSectionStyle(conseilItem.sectionType);
                        return (
                          <div
                            key={index}
                            id={slugifyTitle(conseilItem.title)}
                            className="mb-8"
                          >
                            <Card
                              className={`shadow-xl border-2 ${style.border} overflow-hidden`}
                            >
                              <CardHeader
                                className={`${style.headerBg} text-white`}
                              >
                                <CardTitle className="flex items-center gap-2 text-2xl">
                                  <SectionIcon type={conseilItem.sectionType} />
                                  {conseilItem.title}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-6">
                                <HtmlContent
                                  html={conseilItem.content}
                                  className="prose prose-lg max-w-none
                                    prose-headings:text-gray-900 prose-headings:font-bold
                                    prose-p:text-gray-700 prose-p:leading-relaxed
                                    prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                                    prose-strong:text-gray-900 prose-strong:font-semibold
                                    prose-ul:list-disc prose-ul:pl-6
                                    prose-ol:list-decimal prose-ol:pl-6
                                    prose-li:text-gray-700 prose-li:mb-2"
                                  trackLinks={true}
                                />
                              </CardContent>
                            </Card>
                          </div>
                        );
                      })}

                  {/* Actions */}
                  <hr className="my-4 border-gray-200" />
                  <div className="flex items-center justify-between mt-8">
                    <div className="flex gap-2">
                      <button
                        onClick={handleShare}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                        Partager
                      </button>
                      <button
                        onClick={handleBookmark}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        <Bookmark
                          className={`w-4 h-4 ${isBookmarked ? "fill-current" : ""}`}
                        />
                        {isBookmarked ? "Enregistré" : "Enregistrer"}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </article>

            {/* Véhicules Compatibles (Pleine largeur, après l'article) */}
            {article.compatibleVehicles &&
              article.compatibleVehicles.length > 0 && (
                <div className="lg:col-span-3 order-3">
                  <VehicleCarousel
                    vehicles={article.compatibleVehicles}
                    gamme={pg_alias}
                    seoSwitches={seoSwitches}
                  />
                </div>
              )}

            {/* Sidebar (1/3) - Sticky pour toujours visible */}
            <aside className="lg:col-span-1 order-1 lg:order-2">
              <div className="lg:sticky lg:top-20 space-y-6">
                {/* Table des matières — ordre DOM : S1 → article H2/H3 → S2-S8 */}
                {(article.sections.length > 0 ||
                  (conseil && conseil.length > 0)) && (
                  <TableOfContents
                    sections={
                      hasConseilSections
                        ? (conseil || [])
                            .filter(
                              (c) => c.sectionType && c.sectionType !== "META",
                            )
                            .map((c) => ({
                              level: 2 as const,
                              title: c.title,
                              anchor: slugifyTitle(c.title),
                            }))
                        : article.sections.map((s) => ({
                            level: s.level,
                            title: s.title,
                            anchor: s.anchor,
                          }))
                    }
                  />
                )}

                {/* Glossaire pièces auto */}
                <Card className="border-indigo-200 bg-indigo-50/50">
                  <div className="p-4">
                    <Link
                      to="/reference-auto"
                      className="flex items-center gap-3 group"
                    >
                      <div className="p-2 bg-indigo-100 rounded-lg shrink-0">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                          Glossaire pièces auto
                        </p>
                        <p className="text-xs text-gray-500">
                          138 définitions techniques
                        </p>
                      </div>
                    </Link>
                  </div>
                </Card>

                {/* Articles Croisés - "On vous propose" */}
                {article.relatedArticles &&
                  article.relatedArticles.length > 0 && (
                    <Card className="shadow-lg hover:shadow-xl transition-shadow">
                      <div className="p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          📰 On vous propose
                        </h3>
                        <div className="h-1 w-16 bg-primary rounded mb-4" />
                        <div className="space-y-3">
                          {article.relatedArticles.map((related) => (
                            <Link
                              key={related.id}
                              to={
                                related.pg_alias
                                  ? `/blog-pieces-auto/conseils/${related.pg_alias}`
                                  : `/blog-pieces-auto/article/${related.slug}`
                              }
                            >
                              <Card className="overflow-hidden hover:shadow-md transition-all group border-gray-200">
                                <div className="flex gap-3 p-3">
                                  {/* 🆕 Image mini optimisée - featured image si disponible */}
                                  {related.featuredImage ? (
                                    <img
                                      src={related.featuredImage}
                                      alt={related.title}
                                      className="w-20 h-16 object-cover rounded-md flex-shrink-0 border-2 border-gray-200 group-hover:scale-105 transition-transform"
                                      loading="lazy"
                                      width="80"
                                      height="64"
                                    />
                                  ) : related.wall &&
                                    related.wall !== "no.jpg" ? (
                                    <img
                                      src={`/upload/blog/guide/mini/${related.wall}`}
                                      alt={related.title}
                                      className="w-20 h-16 object-cover rounded-md flex-shrink-0 border-2 border-gray-200 group-hover:scale-105 transition-transform"
                                      loading="lazy"
                                      width="80"
                                      height="64"
                                    />
                                  ) : (
                                    <div className="w-20 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-md flex-shrink-0 flex items-center justify-center border-2 border-gray-200">
                                      <span className="text-xl">📄</span>
                                    </div>
                                  )}

                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-1">
                                      {related.title}
                                    </h4>
                                    <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                                      {related.excerpt}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      <Eye className="w-3 h-3" />
                                      <span>
                                        {related.viewsCount.toLocaleString()}{" "}
                                        vues
                                      </span>
                                      {/* 🆕 Date de publication */}
                                      {related.updatedAt && (
                                        <>
                                          <span>•</span>
                                          <Calendar className="w-3 h-3" />
                                          <span>
                                            {new Date(
                                              related.updatedAt,
                                            ).toLocaleDateString("fr-FR", {
                                              day: "2-digit",
                                              month: "2-digit",
                                              year: "numeric",
                                            })}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </Card>
                  )}
              </div>
            </aside>
          </div>

          {/* ⬅️➡️ Navigation entre articles (précédent/suivant) */}
          <div className="max-w-6xl mx-auto mt-8">
            <ArticleNavigation
              previous={adjacentArticles.previous}
              next={adjacentArticles.next}
            />
          </div>
        </div>
      </div>

      {/* 🆕 Bouton retour en haut */}
      <ScrollToTop />
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP avec composants
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
