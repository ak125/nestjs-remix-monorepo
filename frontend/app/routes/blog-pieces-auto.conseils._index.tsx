// app/routes/blog-pieces-auto.conseils._index.tsx
/**
 * Route : /blog-pieces-auto/conseils
 * Liste des conseils de montage et entretien par famille
 *
 * Rôle SEO : R3 - BLOG
 * Intention : Trouver des conseils pratiques
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
import { BookOpen, Calendar, Eye, Filter, ArrowRight, Tag } from "lucide-react";
import * as React from "react";

// SEO Page Role (Phase 5 - Quasi-Incopiable)

import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { CompactBlogHeader } from "~/components/blog/CompactBlogHeader";
import { Error404 } from "~/components/errors/Error404";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R3_BLOG, {
    clusterId: "conseils",
    canonicalEntity: "conseils-index",
  }),
};

/* ===========================
   Types
=========================== */
interface BlogArticle {
  id: string;
  type: string;
  title: string;
  slug: string;
  pg_alias: string | null;
  excerpt: string;
  publishedAt: string;
  viewsCount: number;
  featuredImage: string | null;
  tags?: string[];
}

interface CategoryGroup {
  category: string;
  categorySlug: string;
  count: number;
  articles: BlogArticle[];
}

interface FamilyGroup {
  family: string;
  categories: CategoryGroup[];
  totalArticles: number;
  totalViews: number;
}

interface LoaderData {
  groupedArticles: CategoryGroup[];
  familyGroups: FamilyGroup[]; // laissé pour compat éventuelle
  totalArticles: number;
  stats: {
    totalViews: number;
    totalCategories: number;
  };
}

/* ===========================
   Styles par famille
=========================== */
const FAMILY_COLORS: Record<
  string,
  { bg: string; border: string; text: string; gradient: string; badge: string }
> = {
  Freinage: {
    bg: "bg-destructive/5",
    border: "border-red-300",
    text: "text-red-800",
    gradient: "from-red-500 to-red-700",
    badge: "error",
  },
  "Direction et liaison au sol": {
    bg: "bg-purple-50",
    border: "border-purple-300",
    text: "text-purple-800",
    gradient: "from-purple-500 to-purple-700",
    badge: "purple",
  },
  Embrayage: {
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-800",
    gradient: "from-orange-500 to-orange-700",
    badge: "orange",
  },
  "Courroie, galet, poulie et chaîne": {
    bg: "bg-warning/5",
    border: "border-yellow-300",
    text: "text-yellow-900",
    gradient: "from-yellow-500 to-yellow-700",
    badge: "bg-warning/15 text-yellow-900 border-yellow-300",
  },
  Moteur: {
    bg: "bg-slate-50",
    border: "border-slate-300",
    text: "text-slate-800",
    gradient: "from-slate-600 to-slate-800",
    badge: "bg-slate-100 text-slate-800 border-slate-300",
  },
  "Système d'alimentation": {
    bg: "bg-success/5",
    border: "border-green-300",
    text: "text-green-800",
    gradient: "from-green-500 to-green-700",
    badge: "success",
  },
  Refroidissement: {
    bg: "bg-cyan-50",
    border: "border-cyan-300",
    text: "text-cyan-800",
    gradient: "from-cyan-500 to-cyan-700",
    badge: "bg-cyan-100 text-cyan-800 border-cyan-300",
  },
  "Préchauffage et allumage": {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-900",
    gradient: "from-amber-500 to-amber-700",
    badge: "bg-amber-100 text-amber-900 border-amber-300",
  },
  Echappement: {
    bg: "bg-gray-50",
    border: "border-gray-400",
    text: "text-gray-800",
    gradient: "from-gray-600 to-gray-800",
    badge: "bg-gray-100 text-gray-800 border-gray-400",
  },
  "Système électrique": {
    bg: "bg-primary/5",
    border: "border-blue-300",
    text: "text-blue-800",
    gradient: "from-blue-500 to-blue-700",
    badge: "info",
  },
  Filtres: {
    bg: "bg-teal-50",
    border: "border-teal-300",
    text: "text-teal-800",
    gradient: "from-teal-500 to-teal-700",
    badge: "bg-teal-100 text-teal-800 border-teal-300",
  },
  Climatisation: {
    bg: "bg-sky-50",
    border: "border-sky-300",
    text: "text-sky-800",
    gradient: "from-sky-500 to-sky-700",
    badge: "bg-sky-100 text-sky-800 border-sky-300",
  },
  Eclairage: {
    bg: "bg-warning/5",
    border: "border-yellow-400",
    text: "text-yellow-900",
    gradient: "from-yellow-400 to-yellow-600",
    badge: "bg-warning/15 text-yellow-900 border-yellow-400",
  },
  Transmission: {
    bg: "bg-indigo-50",
    border: "border-indigo-300",
    text: "text-indigo-800",
    gradient: "from-indigo-500 to-indigo-700",
    badge: "bg-indigo-100 text-indigo-800 border-indigo-300",
  },
  "Support moteur": {
    bg: "bg-violet-50",
    border: "border-violet-300",
    text: "text-violet-800",
    gradient: "from-violet-500 to-violet-700",
    badge: "bg-violet-100 text-violet-800 border-violet-300",
  },
  Accessoires: {
    bg: "bg-pink-50",
    border: "border-pink-300",
    text: "text-pink-800",
    gradient: "from-pink-500 to-pink-700",
    badge: "bg-pink-100 text-pink-800 border-pink-300",
  },
  "Amortisseur et suspension": {
    bg: "bg-fuchsia-50",
    border: "border-fuchsia-300",
    text: "text-fuchsia-800",
    gradient: "from-fuchsia-500 to-fuchsia-700",
    badge: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
  },
  Turbo: {
    bg: "bg-rose-50",
    border: "border-rose-300",
    text: "text-rose-800",
    gradient: "from-rose-500 to-rose-700",
    badge: "bg-rose-100 text-rose-800 border-rose-300",
  },
  Autres: {
    bg: "bg-gray-50",
    border: "border-gray-300",
    text: "text-gray-800",
    gradient: "from-gray-500 to-gray-700",
    badge: "bg-gray-100 text-gray-800 border-gray-300",
  },
};

const FAMILY_ICONS: Record<string, string> = {
  Freinage: "🛑",
  "Direction et liaison au sol": "🎯",
  Embrayage: "⚙️",
  "Courroie, galet, poulie et chaîne": "🔗",
  Moteur: "🏎️",
  "Système d'alimentation": "⛽",
  Refroidissement: "❄️",
  "Préchauffage et allumage": "🔥",
  Echappement: "💨",
  "Système électrique": "⚡",
  Filtres: "🔍",
  Climatisation: "🌡️",
  Eclairage: "💡",
  Transmission: "🔧",
  "Support moteur": "🏗️",
  Accessoires: "🛠️",
  "Amortisseur et suspension": "🔵",
  Turbo: "🚀",
  Autres: "📦",
};
/* ===========================
   Loader
=========================== */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
    const res = await fetch(`${backendUrl}/api/blog/advice-hierarchy`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();

    if (!data?.success || !data.data?.families) {
      console.error("Format de réponse inattendu:", data);
      return json<LoaderData>({
        groupedArticles: [],
        familyGroups: [],
        totalArticles: 0,
        stats: { totalViews: 0, totalCategories: 0 },
      });
    }

    const groupedArticles: CategoryGroup[] = data.data.families.map(
      (family: any) => ({
        category: family.familyName as string,
        categorySlug: (family.familyName as string)
          .toLowerCase()
          .replace(/\s+/g, "-"),
        count: family.count as number,
        // Garder l'ordre de l'API (trié par mc_sort dans le backend)
        articles: family.articles as BlogArticle[],
      }),
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
      familyGroups: [], // pas de sous-groupement dans cette version
      totalArticles,
      stats: {
        totalViews,
        totalCategories: groupedArticles.length,
      },
    });
  } catch (e) {
    console.error("Erreur loader conseils:", e);
    return json<LoaderData>({
      groupedArticles: [],
      familyGroups: [],
      totalArticles: 0,
      stats: { totalViews: 0, totalCategories: 0 },
    });
  }
};

/* ===========================
   Meta
=========================== */
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const count = data?.totalArticles ?? 0;
  return [
    { title: "Montage et entretien - Conseils auto | Automecanik" },
    {
      name: "description",
      content: `Découvrez nos ${count} conseils d'experts pour l'entretien et la réparation de votre véhicule. Guides pratiques sur tous les systèmes automobiles.`,
    },
    {
      name: "keywords",
      content:
        "montage, entretien, conseil auto, réparation, mécanique, tutoriel",
    },
    {
      tagName: "link",
      rel: "canonical",
      href: "https://www.automecanik.com/blog-pieces-auto/conseils",
    },
    { name: "robots", content: "index, follow" },
  ];
};

/* ===========================
   Page
=========================== */
export default function BlogConseilsIndex() {
  const { groupedArticles, totalArticles, stats } =
    useLoaderData<typeof loader>();

  const formatViews = (views: number) => {
    if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
    if (views >= 1_000) return `${(views / 1_000).toFixed(1)}k`;
    return `${views}`;
  };

  const getFamilyColor = (family: string) =>
    FAMILY_COLORS[family] || FAMILY_COLORS["Autres"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50">
      {/* Navigation */}
      <BlogPiecesAutoNavigation />

      {/* Hero Compact */}
      <CompactBlogHeader
        title="Montage et Entretien"
        description={`${totalArticles} guides pratiques • ${stats.totalCategories} catégories • ${formatViews(stats.totalViews)} vues`}
        stats={[
          { icon: BookOpen, value: totalArticles, label: "Guides" },
          { icon: Tag, value: stats.totalCategories, label: "Catégories" },
          { icon: Eye, value: formatViews(stats.totalViews), label: "Vues" },
        ]}
        gradientFrom="from-orange-900"
        gradientTo="to-red-900"
      />

      {/* Points clés */}
      <section className="py-8 bg-gradient-to-r from-orange-50 to-red-50 border-b border-orange-100">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex items-start bg-white/80 backdrop-blur rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold mr-4 flex-shrink-0 text-lg">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2 text-lg">
                    Instructions détaillées
                  </h4>
                  <p className="text-gray-600 text-sm">
                    Étapes claires avec photos et schémas explicatifs pour
                    chaque intervention
                  </p>
                </div>
              </div>
              <div className="flex items-start bg-white/80 backdrop-blur rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold mr-4 flex-shrink-0 text-lg">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2 text-lg">
                    Outils nécessaires
                  </h4>
                  <p className="text-gray-600 text-sm">
                    Liste complète du matériel requis pour réussir le montage de
                    vos pièces
                  </p>
                </div>
              </div>
              <div className="flex items-start bg-white/80 backdrop-blur rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold mr-4 flex-shrink-0 text-lg">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2 text-lg">
                    Conseils d'experts
                  </h4>
                  <p className="text-gray-600 text-sm">
                    Astuces professionnelles et recommandations pour un montage
                    réussi
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section Filtres Améliorée */}
      <section className="py-12 bg-gradient-to-br from-orange-50 via-white to-red-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {/* En-tête */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-2 rounded-full mb-3">
                <Filter className="w-5 h-5" />
                <span className="font-semibold">Par Catégorie</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Explorez par type d'intervention
              </h3>
              <p className="text-gray-600">
                Trouvez rapidement le guide adapté à votre besoin
              </p>
            </div>

            {/* Grille de filtres */}
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {groupedArticles.map((group, index) => {
                const colors = getFamilyColor(group.category);
                const icon = FAMILY_ICONS[group.category] || "📦";
                return (
                  <button
                    key={group.categorySlug}
                    onClick={() => {
                      // 🚀 LCP Fix: scrollIntoView + CSS scroll-margin (évite getBoundingClientRect)
                      document
                        .getElementById(group.categorySlug)
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                    style={{ animationDelay: `${index * 50}ms` }}
                    className={`group relative p-2.5 rounded-lg ${colors.bg} border-2 ${colors.border} transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer text-center`}
                  >
                    {/* Icône */}
                    <div
                      className={`text-2xl mb-1.5 transform group-hover:scale-110 transition-transform duration-200`}
                    >
                      {icon}
                    </div>

                    {/* Nom de la catégorie */}
                    <h4
                      className={`${colors.text} font-bold text-xs leading-tight line-clamp-2`}
                    >
                      {group.category}
                    </h4>

                    {/* Effet de survol */}
                    <div
                      className={`absolute inset-0 rounded-lg bg-gradient-to-br ${colors.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Statistiques */}
            <div className="mt-8 flex items-center justify-center gap-8 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-orange-600" />
                <span>
                  <strong className="text-gray-900">{totalArticles}</strong>{" "}
                  guides disponibles
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-orange-600" />
                <span>
                  <strong className="text-gray-900">
                    {stats.totalViews.toLocaleString()}
                  </strong>{" "}
                  vues totales
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-orange-600" />
                <span>
                  <strong className="text-gray-900">
                    {stats.totalCategories}
                  </strong>{" "}
                  catégories
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto space-y-24">
            {groupedArticles.length > 0 ? (
              groupedArticles.map((group, _groupIndex) => {
                const colors = getFamilyColor(group.category);
                const icon = FAMILY_ICONS[group.category] || "📦";
                const groupViews = group.articles.reduce(
                  (s, a) => s + (a.viewsCount || 0),
                  0,
                );

                return (
                  <div
                    key={group.categorySlug}
                    id={group.categorySlug}
                    className="scroll-mt-28"
                  >
                    {/* Header */}
                    <div className="relative mb-10">
                      <div
                        className={`flex items-center gap-4 p-6 rounded-2xl ${colors.bg} border-2 ${colors.border}`}
                      >
                        <div
                          className={`w-16 h-16 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-3xl`}
                        >
                          {icon}
                        </div>
                        <div className="flex-1">
                          <h2
                            className={`text-3xl md:text-4xl font-bold ${colors.text} mb-1`}
                          >
                            {group.category}
                          </h2>
                          <div className="flex items-center gap-3">
                            <Badge className={colors.badge}>
                              {group.count} article{group.count > 1 ? "s" : ""}
                            </Badge>
                            <span className="text-sm text-gray-500">•</span>
                            <span
                              className={`text-sm font-medium ${colors.text}`}
                            >
                              {groupViews.toLocaleString()} vues
                            </span>
                          </div>
                        </div>
                      </div>
                      <div
                        className={`h-1.5 w-full bg-gradient-to-r ${colors.gradient} rounded-full mt-2`}
                      />
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {group.articles.map((article) => (
                        <Link
                          key={article.id}
                          to={`/blog-pieces-auto/conseils/${article.pg_alias || article.slug}`}
                          className="group block"
                        >
                          <Card className="h-full hover:shadow-2xl hover:shadow-blue-100/50 transition-all duration-300 border-2 border-gray-100 hover:border-blue-300 bg-white overflow-hidden group-hover:-translate-y-1">
                            {/* Layout horizontal: image à gauche + contenu à droite */}
                            <div className="flex flex-row h-full">
                              {/* Image à gauche - fixe 160px */}
                              <div className="relative w-40 flex-shrink-0 overflow-hidden bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
                                {article.featuredImage ? (
                                  <img
                                    src={article.featuredImage}
                                    alt={article.title}
                                    className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div
                                    className={`h-full flex items-center justify-center bg-gradient-to-br ${colors.gradient}`}
                                  >
                                    <span className="text-5xl opacity-50 drop-shadow-sm">
                                      {icon}
                                    </span>
                                  </div>
                                )}

                                {/* Nom de la pièce en bas avec glassmorphism */}
                                {article.pg_alias && (
                                  <div className="absolute bottom-0 left-0 right-0 p-2">
                                    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-md shadow-lg px-2.5 py-1.5 text-center">
                                      <p className="text-xs font-bold text-gray-900 truncate capitalize">
                                        {article.pg_alias.replace(/-/g, " ")}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Contenu à droite */}
                              <CardContent className="p-5 flex-1 flex flex-col min-w-0">
                                {/* Header avec vues */}
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <h3 className="font-bold text-lg text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors leading-tight flex-1">
                                    {article.title}
                                  </h3>
                                  {article.viewsCount > 0 && (
                                    <Badge
                                      variant="secondary"
                                      className="flex items-center gap-1.5 text-xs font-semibold bg-primary/5 text-blue-700 border-blue-200 flex-shrink-0 px-2.5 py-1"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>
                                        {formatViews(article.viewsCount)}
                                      </span>
                                    </Badge>
                                  )}
                                </div>

                                {/* Description */}
                                <p className="text-muted-foreground text-sm line-clamp-2 mb-4 leading-relaxed">
                                  {article.excerpt}
                                </p>

                                {/* Footer avec design amélioré */}
                                <div className="flex items-center justify-between pt-3 border-t-2 border-gray-100 mt-auto">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                    <div className="p-1 bg-gray-100 rounded-md">
                                      <Calendar className="w-3.5 h-3.5 text-gray-600" />
                                    </div>
                                    <span>
                                      {new Date(
                                        article.publishedAt,
                                      ).toLocaleDateString("fr-FR", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 text-primary font-bold text-sm group-hover:gap-3 transition-all">
                                    <span>Lire l'article</span>
                                    <div className="p-1 bg-primary/5 rounded-md group-hover:bg-info/20 transition-colors">
                                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 text-xl">
                  Aucun article disponible pour le moment
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA - Design orange moderne */}
      <section className="py-16 bg-gradient-to-r from-orange-600 to-red-600 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              Besoin d'aide pour une réparation ?
            </h3>
            <p className="text-xl mb-8 text-white/90">
              Nos experts sont là pour vous conseiller sur le choix des pièces
              et les techniques de montage
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
              <Link to="/blog-pieces-auto/auto">
                <Button
                  size="lg"
                  className="bg-white text-orange-600 hover:bg-gray-100 px-8 py-4 text-lg rounded-xl font-semibold"
                >
                  Voir les pièces
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
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
