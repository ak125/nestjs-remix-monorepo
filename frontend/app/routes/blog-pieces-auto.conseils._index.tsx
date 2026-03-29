// app/routes/blog-pieces-auto.conseils._index.tsx
/**
 * Route : /blog-pieces-auto/conseils
 * HUB SEO-First — Page d'orientation conseils auto
 *
 * Role SEO : R3 - BLOG HUB
 * Intention : Decouvrir categories, reparer, diagnostiquer, choisir
 * 8 sections : Hero → Comment utiliser → Categories → Guides essentiels
 *              → Par intention → Securite → FAQ → CTA
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { FAMILY_REGISTRY, findFamilyIdByKeyword } from "@repo/database-types";
import {
  Wrench,
  AlertTriangle,
  ShoppingCart,
  Eye,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Package,
} from "lucide-react";
import { useState } from "react";

import { ArticleCardEnhanced } from "~/components/blog/ArticleCardEnhanced";
import {
  type BlogArticle,
  getArticleUrl,
} from "~/components/blog/blog-helpers";
import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { getFamilyTheme } from "~/utils/family-theme";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

// ── Handle ──────────────────────────────────────────────

export const handle = {
  pageRole: createPageRoleMeta(PageRole.R3_BLOG, {
    clusterId: "conseils",
    canonicalEntity: "conseils-index",
  }),
};

// ── Types ───────────────────────────────────────────────

interface CategoryGroup {
  category: string;
  categorySlug: string;
  count: number;
  totalViews: number;
  articles: BlogArticle[];
  gammeLinks: Array<{ slug: string; name: string; pgId: number }>;
}

interface LoaderData {
  groupedArticles: CategoryGroup[];
  allArticles: BlogArticle[];
  totalArticles: number;
  stats: { totalViews: number; totalCategories: number };
}

// gammeLinks sont maintenant servies par le backend (advice-hierarchy API)

/** Lookup emoji par nom de famille via FAMILY_REGISTRY */
function getFamilyIcon(name: string): string {
  const id = findFamilyIdByKeyword(name);
  return id ? (FAMILY_REGISTRY[id]?.emoji ?? "\ud83d\udce6") : "\ud83d\udce6";
}

// ── FAQ data ────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "Quelle diff\u00e9rence entre un guide de montage et un guide de diagnostic\u00a0?",
    a: "Un guide de montage explique comment remplacer une pi\u00e8ce \u00e9tape par \u00e9tape. Un guide de diagnostic aide d\u2019abord \u00e0 identifier la cause probable d\u2019un sympt\u00f4me avant de remplacer.",
  },
  {
    q: "Comment \u00eatre s\u00fbr de la compatibilit\u00e9 d\u2019une pi\u00e8ce\u00a0?",
    a: "La compatibilit\u00e9 d\u00e9pend de la motorisation, de l\u2019ann\u00e9e, et parfois de variantes. Utilisez la recherche par v\u00e9hicule (marque/mod\u00e8le/motorisation) avant achat.",
  },
  {
    q: "Quels outils sont souvent n\u00e9cessaires\u00a0?",
    a: "Selon l\u2019intervention\u00a0: cl\u00e9s, douilles, cric/chandelles, tournevis, pinces. Chaque guide indique la liste d\u2019outillage recommand\u00e9e.",
  },
  {
    q: "Quand vaut-il mieux faire appel \u00e0 un professionnel\u00a0?",
    a: "Si l\u2019intervention touche la direction, le freinage, ou si un voyant s\u00e9curit\u00e9 reste allum\u00e9 apr\u00e8s r\u00e9paration.",
  },
  {
    q: "\u00c0 quelle fr\u00e9quence faut-il remplacer certaines pi\u00e8ces\u00a0?",
    a: "Cela d\u00e9pend du v\u00e9hicule, de l\u2019usage et des sympt\u00f4mes. Les guides donnent des rep\u00e8res g\u00e9n\u00e9raux et des signes d\u2019usure.",
  },
];

// ── Loader ──────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const backendUrl = getInternalApiUrl("");
    const res = await fetch(`${backendUrl}/api/blog/advice-hierarchy`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();

    if (!data?.success || !data.data?.families) {
      logger.error("Format de r\u00e9ponse inattendu:", data);
      return json<LoaderData>({
        groupedArticles: [],
        allArticles: [],
        totalArticles: 0,
        stats: { totalViews: 0, totalCategories: 0 },
      });
    }

    const allArticles: BlogArticle[] = [];
    const groupedArticles: CategoryGroup[] = data.data.families.map(
      (family: any) => {
        const articles = family.articles as BlogArticle[];
        allArticles.push(...articles);
        return {
          category: family.familyName as string,
          categorySlug: (family.familyName as string)
            .toLowerCase()
            .replace(/\s+/g, "-"),
          count: family.count as number,
          totalViews: family.totalViews ?? 0,
          articles,
          gammeLinks:
            (family.gammeLinks as Array<{
              slug: string;
              name: string;
              pgId: number;
            }>) || [],
        };
      },
    );

    const totalArticles: number =
      data.data.totalArticles ??
      groupedArticles.reduce((s, g) => s + g.count, 0);
    const totalViews: number = data.data.families.reduce(
      (sum: number, family: any) => sum + (family.totalViews ?? 0),
      0,
    );

    return json<LoaderData>({
      groupedArticles,
      allArticles,
      totalArticles,
      stats: {
        totalViews,
        totalCategories: groupedArticles.length,
      },
    });
  } catch (e) {
    logger.error("Erreur loader conseils:", e);
    return json<LoaderData>({
      groupedArticles: [],
      allArticles: [],
      totalArticles: 0,
      stats: { totalViews: 0, totalCategories: 0 },
    });
  }
};

// ── Meta ────────────────────────────────────────────────

export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  const count = data?.totalArticles ?? 0;
  const hasFilters = location?.search && location.search.length > 1;

  const tags = [
    {
      title:
        "Conseils & Guides Auto \u2014 R\u00e9parer, diagnostiquer, choisir la bonne pi\u00e8ce | Automecanik",
    },
    {
      name: "description",
      content: `Guides pratiques auto\u00a0: montage, diagnostic, choix de pi\u00e8ces. ${count} articles avec difficult\u00e9, outils, erreurs \u00e0 \u00e9viter. Pi\u00e8ces neuves compatibles.`,
    },
    {
      tagName: "link",
      rel: "canonical",
      href: "https://www.automecanik.com/blog-pieces-auto/conseils",
    },
    {
      property: "og:title",
      content:
        "Conseils & Guides Auto \u2014 R\u00e9parer, diagnostiquer, choisir | Automecanik",
    },
    {
      property: "og:description",
      content: `${count} guides pratiques auto\u00a0: montage, diagnostic, choix de pi\u00e8ces.`,
    },
    { property: "og:type", content: "website" },
    {
      property: "og:url",
      content: "https://www.automecanik.com/blog-pieces-auto/conseils",
    },
    {
      property: "og:image",
      content: "https://www.automecanik.com/images/og/blog-conseil.webp",
    },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:image",
      content: "https://www.automecanik.com/images/og/blog-conseil.webp",
    },
  ];

  // noindex for filtered URLs
  if (hasFilters) {
    tags.push({ name: "robots", content: "noindex, follow" });
  } else {
    tags.push({ name: "robots", content: "index, follow" });
  }

  return tags;
};

// ── Schema.org JSON-LD ──────────────────────────────────

function generateStructuredData(
  categories: CategoryGroup[],
  totalArticles: number,
) {
  const collectionPage = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Conseils & Guides Auto \u2014 R\u00e9parer, diagnostiquer, choisir la bonne pi\u00e8ce",
    description: `${totalArticles} guides pratiques auto\u00a0: montage, diagnostic, choix de pi\u00e8ces.`,
    url: "https://www.automecanik.com/blog-pieces-auto/conseils",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: categories.length,
      itemListElement: categories.map((cat, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: cat.category,
        url: `https://www.automecanik.com/blog-pieces-auto/conseils#${cat.categorySlug}`,
      })),
    },
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  const breadcrumb = {
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
        name: "Blog",
        item: "https://www.automecanik.com/blog-pieces-auto",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Conseils & Guides",
        item: "https://www.automecanik.com/blog-pieces-auto/conseils",
      },
    ],
  };

  return [collectionPage, faqPage, breadcrumb];
}

// ── Page ────────────────────────────────────────────────

export default function BlogConseilsIndex() {
  const { groupedArticles, allArticles, totalArticles, stats } =
    useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState<"useful" | "recent" | "popular">(
    "useful",
  );
  const [showAllCategories, setShowAllCategories] = useState(false);

  const structuredData = generateStructuredData(groupedArticles, totalArticles);

  // Top articles for "Guides essentiels" section
  const sortedByViews = [...allArticles].sort(
    (a, b) => (b.viewsCount || 0) - (a.viewsCount || 0),
  );
  const sortedByDate = [...allArticles].sort(
    (a, b) =>
      new Date(b.updatedAt || b.publishedAt).getTime() -
      new Date(a.updatedAt || a.publishedAt).getTime(),
  );

  // Featured categories (top 4 by article count)
  const sortedCategories = [...groupedArticles].sort(
    (a, b) => b.count - a.count,
  );
  const featuredCategories = sortedCategories.slice(0, 4);
  const otherCategories = showAllCategories ? sortedCategories.slice(4) : [];

  // Articles by content type
  const howtoArticles = allArticles.filter((a) => a.contentType === "HOWTO");
  const diagnosticArticles = allArticles.filter(
    (a) => a.contentType === "DIAGNOSTIC",
  );
  const buyingGuideArticles = allArticles.filter(
    (a) => a.contentType === "BUYING_GUIDE",
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30">
      {/* Schema.org JSON-LD */}
      {structuredData.map((sd, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(sd) }}
        />
      ))}

      {/* Navigation */}
      <BlogPiecesAutoNavigation />

      {/* ══════════════════════════════════════════════════
          SECTION 1 — Hero HUB d'intention
          ══════════════════════════════════════════════════ */}
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white py-16 lg:py-20">
        <div className="absolute inset-0 bg-[url('/images/og/blog-conseil.webp')] bg-cover bg-center opacity-10" />
        <div className="relative container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
              Conseils & Guides Auto &mdash; R&eacute;parer, diagnostiquer,
              choisir la bonne pi&egrave;ce
            </h1>
            <p className="text-lg text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
              Trouvez rapidement le bon guide selon votre besoin&nbsp;:
              r&eacute;parer (tutoriels pas &agrave; pas), diagnostiquer
              (sympt&ocirc;mes et causes), ou choisir la pi&egrave;ce
              (crit&egrave;res et comparatifs). Chaque article indique le niveau
              de difficult&eacute;, les outils n&eacute;cessaires et les erreurs
              &agrave; &eacute;viter pour r&eacute;ussir votre intervention. Et
              si vous souhaitez passer &agrave; l&rsquo;action, nous vous
              dirigeons vers les pi&egrave;ces compatibles (neuves)
              adapt&eacute;es &agrave; votre v&eacute;hicule.
            </p>

            {/* 3 CTA d'intention */}
            <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <Link
                to="?type=HOWTO"
                className="group flex flex-col items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-5 transition-all hover:bg-blue-600/30 hover:border-blue-400/50"
              >
                <Wrench className="h-8 w-8 text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-sm">
                  R&eacute;parer / Monter
                </span>
                <span className="text-xs text-gray-400">
                  Tutoriels pas &agrave; pas, outils, erreurs &agrave;
                  &eacute;viter
                </span>
              </Link>
              <Link
                to="?type=DIAGNOSTIC"
                className="group flex flex-col items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-5 transition-all hover:bg-orange-600/30 hover:border-orange-400/50"
              >
                <AlertTriangle className="h-8 w-8 text-orange-400 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-sm">
                  Diagnostiquer une panne
                </span>
                <span className="text-xs text-gray-400">
                  Sympt&ocirc;mes, causes, tests avant remplacement
                </span>
              </Link>
              <Link
                to="?type=BUYING_GUIDE"
                className="group flex flex-col items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-5 transition-all hover:bg-green-600/30 hover:border-green-400/50"
              >
                <ShoppingCart className="h-8 w-8 text-green-400 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-sm">
                  Choisir la bonne pi&egrave;ce
                </span>
                <span className="text-xs text-gray-400">
                  Crit&egrave;res, compatibilit&eacute;, comparatifs
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 2 — Comment utiliser ce hub
          ══════════════════════════════════════════════════ */}
      <section className="py-12 border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">
              Comment utiliser ce hub
            </h2>
            <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
              Vous h&eacute;sitez entre plusieurs articles&nbsp;? Commencez par
              votre cat&eacute;gorie (ex&nbsp;: Freinage), puis affinez selon
              votre objectif&nbsp;: montage, diagnostic ou achat. Les guides
              &laquo;&nbsp;montage&nbsp;&raquo; donnent des &eacute;tapes
              claires, les pages &laquo;&nbsp;diagnostic&nbsp;&raquo; aident
              &agrave; identifier une panne, et les &laquo;&nbsp;guides
              d&rsquo;achat&nbsp;&raquo; expliquent comment choisir la bonne
              pi&egrave;ce selon votre v&eacute;hicule.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="relative flex flex-col items-center text-center p-6 rounded-xl bg-white border border-gray-200 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xl mb-3">
                  1
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  Choisissez une cat&eacute;gorie
                </h3>
                <p className="text-sm text-gray-600">
                  Freinage, Filtration, Moteur&hellip;
                </p>
              </div>
              <div className="relative flex flex-col items-center text-center p-6 rounded-xl bg-white border border-gray-200 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xl mb-3">
                  2
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  Filtrez par besoin
                </h3>
                <p className="text-sm text-gray-600">
                  Dur&eacute;e, difficult&eacute;, type de guide
                </p>
              </div>
              <div className="relative flex flex-col items-center text-center p-6 rounded-xl bg-white border border-gray-200 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xl mb-3">
                  3
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  Passez &agrave; la pi&egrave;ce
                </h3>
                <p className="text-sm text-gray-600">
                  Liens vers gammes et catalogue
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 3 — Cat&eacute;gories principales
          ══════════════════════════════════════════════════ */}
      <section className="py-14 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Cat&eacute;gories principales
                </h2>
                <p className="text-gray-600 mt-1">
                  {stats.totalCategories} familles &middot; {totalArticles}{" "}
                  guides
                </p>
              </div>
            </div>

            {/* Featured 4 categories */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {featuredCategories.map((group) => {
                const theme = getFamilyTheme(group.category);
                const icon = getFamilyIcon(group.category);
                const topArticles = group.articles.slice(0, 3);

                return (
                  <div
                    key={group.categorySlug}
                    id={group.categorySlug}
                    className={`rounded-xl border-2 ${theme.border} ${theme.bg} p-6 scroll-mt-28`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">{icon}</span>
                      <div className="flex-1">
                        <h3 className={`text-xl font-bold ${theme.fgStrong}`}>
                          {group.category}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>
                            {group.count} article
                            {group.count > 1 ? "s" : ""}
                          </span>
                          <span>&middot;</span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {(group.totalViews || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Top 3 articles */}
                    <ul className="space-y-1.5 mb-4">
                      {topArticles.map((article) => (
                        <li key={article.id}>
                          <Link
                            to={getArticleUrl(article)}
                            className="text-sm text-gray-700 hover:text-primary hover:underline flex items-start gap-1.5"
                          >
                            <ArrowRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                            <span className="line-clamp-1">
                              {article.title}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>

                    {/* Gamme links (e-commerce) */}
                    {group.gammeLinks.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200/60">
                        <Package className="h-4 w-4 text-gray-400 mt-0.5" />
                        {group.gammeLinks.map((gamme) => (
                          <Link
                            key={gamme.slug}
                            to={`/blog-pieces-auto/conseils/${gamme.slug}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {gamme.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Other categories (compact) */}
            {sortedCategories.length > 4 && (
              <>
                {!showAllCategories ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowAllCategories(true)}
                    className="w-full gap-2"
                  >
                    Voir les {sortedCategories.length - 4} autres
                    cat&eacute;gories
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {otherCategories.map((group) => {
                      const icon = getFamilyIcon(group.category);
                      return (
                        <a
                          key={group.categorySlug}
                          href={`#${group.categorySlug}`}
                          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 hover:border-primary hover:shadow-sm transition-all"
                        >
                          <span className="text-xl">{icon}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {group.category}
                            </p>
                            <p className="text-xs text-gray-500">
                              {group.count} article
                              {group.count > 1 ? "s" : ""}
                            </p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 4 — Guides essentiels (onglets)
          ══════════════════════════════════════════════════ */}
      <section className="py-14 bg-gray-50/50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Guides essentiels
            </h2>
            <p className="text-gray-600 mb-6 max-w-2xl">
              Voici nos guides les plus consult&eacute;s et les plus utiles
              selon les retours des automobilistes&nbsp;: interventions
              fr&eacute;quentes, &eacute;tapes claires, outils
              n&eacute;cessaires et points de vigilance.
            </p>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {(
                [
                  { key: "useful", label: "Les plus utiles" },
                  { key: "recent", label: "Mis \u00e0 jour r\u00e9cemment" },
                  { key: "popular", label: "Les plus consult\u00e9s" },
                ] as const
              ).map((tab) => (
                <Button
                  key={tab.key}
                  variant={activeTab === tab.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* Articles grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(activeTab === "popular"
                ? sortedByViews
                : activeTab === "recent"
                  ? sortedByDate
                  : sortedByViews
              )
                .slice(0, 12)
                .map((article) => (
                  <ArticleCardEnhanced
                    key={article.id}
                    article={article}
                    compact
                  />
                ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 5 — Guides par intention
          ══════════════════════════════════════════════════ */}
      <section className="py-14 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-12">
            {/* 5A — Reparer / Monter */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Wrench className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    R&eacute;parer / Monter
                  </h2>
                  <p className="text-sm text-gray-600">
                    {howtoArticles.length} guides de montage
                  </p>
                </div>
              </div>
              <p className="text-gray-600 mb-5">
                Les guides de montage expliquent comment remplacer une
                pi&egrave;ce &eacute;tape par &eacute;tape&nbsp;:
                d&eacute;montage, remontage, contr&ocirc;les, essais, et erreurs
                &agrave; &eacute;viter.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {howtoArticles.slice(0, 8).map((article) => (
                  <ArticleCardEnhanced
                    key={article.id}
                    article={article}
                    compact
                  />
                ))}
              </div>
            </div>

            {/* 5B — Diagnostiquer */}
            {diagnosticArticles.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-orange-700" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Diagnostiquer une panne
                    </h2>
                    <p className="text-sm text-gray-600">
                      {diagnosticArticles.length} guides de diagnostic
                    </p>
                  </div>
                </div>
                <p className="text-gray-600 mb-5">
                  Les guides de diagnostic vous aident &agrave; identifier une
                  cause probable &agrave; partir de sympt&ocirc;mes (voyants,
                  bruits, fum&eacute;es, pertes de puissance), puis &agrave;
                  v&eacute;rifier avant remplacement.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {diagnosticArticles.slice(0, 8).map((article) => (
                    <ArticleCardEnhanced
                      key={article.id}
                      article={article}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 5C — Choisir */}
            {buyingGuideArticles.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-green-700" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Choisir la bonne pi&egrave;ce
                    </h2>
                    <p className="text-sm text-gray-600">
                      {buyingGuideArticles.length} guides d&rsquo;achat
                    </p>
                  </div>
                </div>
                <p className="text-gray-600 mb-5">
                  Les guides d&rsquo;achat expliquent comment choisir selon la
                  motorisation, la compatibilit&eacute;, la qualit&eacute;, et
                  l&rsquo;usage (ville, autoroute, charge, performance), pour
                  &eacute;viter les erreurs.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {buyingGuideArticles.slice(0, 8).map((article) => (
                    <ArticleCardEnhanced
                      key={article.id}
                      article={article}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 6 — S&eacute;curit&eacute; & bonnes pratiques
          ══════════════════════════════════════════════════ */}
      <section className="py-12 bg-amber-50/50 border-y border-amber-100">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck className="h-7 w-7 text-amber-700" />
              <h2 className="text-2xl font-bold text-gray-900">
                S&eacute;curit&eacute; & bonnes pratiques
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                "Travaillez sur sol plat, v\u00e9hicule s\u00e9curis\u00e9 (frein de parking, chandelles).",
                "Laissez refroidir les \u00e9l\u00e9ments chauds (moteur, \u00e9chappement, freins).",
                "Respectez les couples de serrage quand ils sont indiqu\u00e9s.",
                "Si un voyant s\u00e9curit\u00e9 persiste apr\u00e8s intervention, stop et diagnostic.",
                "En cas de doute (freinage/direction), faites v\u00e9rifier par un professionnel.",
                "Utilisez des pi\u00e8ces compatibles avec votre v\u00e9hicule et votre motorisation.",
              ].map((text, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg bg-white p-4 border border-amber-200/60"
                >
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 7 — FAQ
          ══════════════════════════════════════════════════ */}
      <section className="py-14 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
              Questions fr&eacute;quentes
            </h2>
            <div className="space-y-4">
              {FAQ_ITEMS.map((item, i) => (
                <details
                  key={i}
                  className="group rounded-lg border border-gray-200 bg-white"
                >
                  <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-medium text-gray-900 hover:bg-gray-50">
                    <span>{item.q}</span>
                    <ChevronDown className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 8 — CTA business
          ══════════════════════════════════════════════════ */}
      <section className="py-16 bg-gradient-to-r from-orange-600 to-red-600 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Besoin d&rsquo;aide pour une r&eacute;paration&nbsp;?
            </h2>
            <p className="text-xl mb-8 text-white/90">
              Nos experts sont l&agrave; pour vous conseiller sur le choix des
              pi&egrave;ces et les techniques de montage
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-white text-white hover:bg-white hover:text-orange-600 px-8 py-4 text-lg rounded-xl font-semibold"
                >
                  Contacter un expert
                </Button>
              </Link>
              <Link to="/pieces">
                <Button
                  size="lg"
                  className="bg-white text-orange-600 hover:bg-gray-100 px-8 py-4 text-lg rounded-xl font-semibold"
                >
                  Voir les pi&egrave;ces compatibles
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          All categories articles (full listing below fold)
          ══════════════════════════════════════════════════ */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-20">
            {groupedArticles.map((group) => {
              const theme = getFamilyTheme(group.category);
              const icon = getFamilyIcon(group.category);

              return (
                <div
                  key={group.categorySlug}
                  id={group.categorySlug}
                  className="scroll-mt-28"
                >
                  {/* Category header */}
                  <div
                    className={`flex items-center gap-4 p-5 rounded-xl ${theme.bg} border-2 ${theme.border} mb-6`}
                  >
                    <span className="text-3xl">{icon}</span>
                    <div className="flex-1">
                      <h2 className={`text-2xl font-bold ${theme.fgStrong}`}>
                        {group.category}
                      </h2>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Badge className={theme.badge}>
                          {group.count} article
                          {group.count > 1 ? "s" : ""}
                        </Badge>
                        {group.totalViews > 0 && (
                          <span>{group.totalViews.toLocaleString()} vues</span>
                        )}
                      </div>
                    </div>
                    {/* E-commerce links */}
                    {group.gammeLinks.length > 0 && (
                      <div className="hidden md:flex items-center gap-2">
                        {group.gammeLinks.map((gamme) => (
                          <Link
                            key={gamme.slug}
                            to={`/blog-pieces-auto/conseils/${gamme.slug}`}
                            className="text-xs font-medium bg-white/80 rounded-full px-3 py-1 text-primary hover:bg-white border border-gray-200 transition-colors"
                          >
                            {gamme.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Articles grid */}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {group.articles.map((article) => (
                      <ArticleCardEnhanced key={article.id} article={article} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Error Boundary ──────────────────────────────────────

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
