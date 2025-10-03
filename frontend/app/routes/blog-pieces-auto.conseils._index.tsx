// app/routes/blog-pieces-auto.conseils._index.tsx
import * as React from "react";
import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { BookOpen, Calendar, Eye, Filter, ArrowRight, Tag, Sparkles } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

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
  "Freinage": { bg: "bg-red-50", border: "border-red-300", text: "text-red-800", gradient: "from-red-500 to-red-700", badge: "bg-red-100 text-red-800 border-red-300" },
  "Direction et liaison au sol": { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-800", gradient: "from-purple-500 to-purple-700", badge: "bg-purple-100 text-purple-800 border-purple-300" },
  "Embrayage": { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-800", gradient: "from-orange-500 to-orange-700", badge: "bg-orange-100 text-orange-800 border-orange-300" },
  "Courroie, galet, poulie et chaîne": { bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-900", gradient: "from-yellow-500 to-yellow-700", badge: "bg-yellow-100 text-yellow-900 border-yellow-300" },
  "Moteur": { bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-800", gradient: "from-slate-600 to-slate-800", badge: "bg-slate-100 text-slate-800 border-slate-300" },
  "Système d'alimentation": { bg: "bg-green-50", border: "border-green-300", text: "text-green-800", gradient: "from-green-500 to-green-700", badge: "bg-green-100 text-green-800 border-green-300" },
  "Refroidissement": { bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-800", gradient: "from-cyan-500 to-cyan-700", badge: "bg-cyan-100 text-cyan-800 border-cyan-300" },
  "Préchauffage et allumage": { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-900", gradient: "from-amber-500 to-amber-700", badge: "bg-amber-100 text-amber-900 border-amber-300" },
  "Echappement": { bg: "bg-gray-50", border: "border-gray-400", text: "text-gray-800", gradient: "from-gray-600 to-gray-800", badge: "bg-gray-100 text-gray-800 border-gray-400" },
  "Système électrique": { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-800", gradient: "from-blue-500 to-blue-700", badge: "bg-blue-100 text-blue-800 border-blue-300" },
  "Filtres": { bg: "bg-teal-50", border: "border-teal-300", text: "text-teal-800", gradient: "from-teal-500 to-teal-700", badge: "bg-teal-100 text-teal-800 border-teal-300" },
  "Climatisation": { bg: "bg-sky-50", border: "border-sky-300", text: "text-sky-800", gradient: "from-sky-500 to-sky-700", badge: "bg-sky-100 text-sky-800 border-sky-300" },
  "Eclairage": { bg: "bg-yellow-50", border: "border-yellow-400", text: "text-yellow-900", gradient: "from-yellow-400 to-yellow-600", badge: "bg-yellow-100 text-yellow-900 border-yellow-400" },
  "Transmission": { bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-800", gradient: "from-indigo-500 to-indigo-700", badge: "bg-indigo-100 text-indigo-800 border-indigo-300" },
  "Support moteur": { bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-800", gradient: "from-violet-500 to-violet-700", badge: "bg-violet-100 text-violet-800 border-violet-300" },
  "Accessoires": { bg: "bg-pink-50", border: "border-pink-300", text: "text-pink-800", gradient: "from-pink-500 to-pink-700", badge: "bg-pink-100 text-pink-800 border-pink-300" },
  "Amortisseur et suspension": { bg: "bg-fuchsia-50", border: "border-fuchsia-300", text: "text-fuchsia-800", gradient: "from-fuchsia-500 to-fuchsia-700", badge: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300" },
  "Turbo": { bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-800", gradient: "from-rose-500 to-rose-700", badge: "bg-rose-100 text-rose-800 border-rose-300" },
  "Autres": { bg: "bg-gray-50", border: "border-gray-300", text: "text-gray-800", gradient: "from-gray-500 to-gray-700", badge: "bg-gray-100 text-gray-800 border-gray-300" },
};

const FAMILY_ICONS: Record<string, string> = {
  "Freinage": "🛑", "Direction et liaison au sol": "🎯", "Embrayage": "⚙️", "Courroie, galet, poulie et chaîne": "🔗",
  "Moteur": "🏎️", "Système d'alimentation": "⛽", "Refroidissement": "❄️", "Préchauffage et allumage": "🔥",
  "Echappement": "💨", "Système électrique": "⚡", "Filtres": "🔍", "Climatisation": "🌡️", "Eclairage": "💡",
  "Transmission": "🔧", "Support moteur": "🏗️", "Accessoires": "🛠️", "Amortisseur et suspension": "🔵",
  "Turbo": "🚀", "Autres": "📦",
};

/* ===========================
   Image produit avec fallback
=========================== */
function ProductImage({
  pgAlias,
  title,
  category,
  icon,
  colors,
}: {
  pgAlias: string | null;
  title: string;
  category: string;
  icon: string;
  colors: { gradient: string; bg: string; text: string; border: string; badge: string };
}) {
  const [imageError, setImageError] = React.useState(false);
  const imageUrl = pgAlias ? `/gammes-produits/catalogue/${pgAlias}.webp` : null;

  if (!imageUrl || imageError) {
    return (
      <div className={`relative h-40 overflow-hidden bg-gradient-to-br ${colors.gradient} flex items-center justify-center`}>
        <div className="text-white text-center p-4">
          <div className="text-4xl mb-2">{icon}</div>
          <p className="text-xs font-medium opacity-90 line-clamp-2">{category}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-40 overflow-hidden bg-gray-100">
      <img
        src={imageUrl}
        alt={title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
        onError={() => setImageError(true)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  );
}

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

    const groupedArticles: CategoryGroup[] = data.data.families.map((family: any) => ({
      category: family.familyName as string,
      categorySlug: (family.familyName as string).toLowerCase().replace(/\s+/g, "-"),
      count: family.count as number,
      articles: (family.articles as BlogArticle[]).sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      ),
    }));

    const totalArticles: number = data.data.totalArticles ?? groupedArticles.reduce((s, g) => s + g.count, 0);
    const totalViews: number = data.data.families.reduce(
      (sum: number, family: any) => sum + (family.totalViews ?? 0),
      0
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
    { name: "keywords", content: "montage, entretien, conseil auto, réparation, mécanique, tutoriel" },
  ];
};

/* ===========================
   Page
=========================== */
export default function BlogConseilsIndex() {
  const { groupedArticles, familyGroups, totalArticles, stats } = useLoaderData<typeof loader>();

  const formatViews = (views: number) => {
    if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
    if (views >= 1_000) return `${(views / 1_000).toFixed(1)}k`;
    return `${views}`;
  };

  const getFamilyColor = (family: string) => FAMILY_COLORS[family] || FAMILY_COLORS["Autres"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white py-20 overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:32px_32px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 via-transparent to-transparent" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-2 text-blue-200 text-sm mb-6">
              <Link to="/" className="hover:text-white transition-colors">Accueil</Link>
              <span>/</span>
              <Link to="/blog" className="hover:text-white transition-colors">Blog</Link>
              <span>/</span>
              <span className="text-white font-medium">Montage et entretien</span>
            </div>

            <div className="text-center">
              <Badge className="mb-6 bg-white/20 text-white backdrop-blur-md px-6 py-2.5 border border-white/30 shadow-lg">
                <BookOpen className="w-4 h-4 mr-2" />
                Guides pratiques
              </Badge>

              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-100">
                Montage et entretien
              </h1>

              <p className="text-xl md:text-2xl text-blue-100 mb-12 max-w-3xl mx-auto leading-relaxed">
                Tous nos conseils d&apos;experts pour l&apos;entretien et la réparation de votre véhicule
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
                <div className="group relative p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                  <BookOpen className="w-8 h-8 mx-auto mb-3 text-blue-200 group-hover:text-white transition-colors" />
                  <div className="text-4xl font-bold mb-2 tabular-nums">{totalArticles}</div>
                  <div className="text-blue-200 text-sm font-medium uppercase tracking-wide">Articles</div>
                </div>
                <div className="group relative p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                  <Tag className="w-8 h-8 mx-auto mb-3 text-blue-200 group-hover:text-white transition-colors" />
                  <div className="text-4xl font-bold mb-2 tabular-nums">{stats.totalCategories}</div>
                  <div className="text-blue-200 text-sm font-medium uppercase tracking-wide">Catégories</div>
                </div>
                <div className="group relative p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                  <Eye className="w-8 h-8 mx-auto mb-3 text-blue-200 group-hover:text-white transition-colors" />
                  <div className="text-4xl font-bold mb-2 tabular-nums">{formatViews(stats.totalViews)}</div>
                  <div className="text-blue-200 text-sm font-medium uppercase tracking-wide">Vues totales</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky filters */}
      <section className="sticky top-0 z-40 bg-white/95 backdrop-blur-lg border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-600 flex-shrink-0">
              <Filter className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-semibold">Filtrer par catégorie :</span>
            </div>

            <div className="flex-1 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 pb-2">
                {groupedArticles.map((group, index) => {
                  const colors = getFamilyColor(group.category);
                  const icon = FAMILY_ICONS[group.category] || "📦";
                  return (
                    <button
                      key={group.categorySlug}
                      onClick={() => {
                        const el = document.getElementById(group.categorySlug);
                        if (!el) return;
                        const offset = 120;
                        const y = el.getBoundingClientRect().top + window.pageYOffset - offset;
                        window.scrollTo({ top: y, behavior: "smooth" });
                      }}
                      style={{ animationDelay: `${index * 30}ms` }}
                      className={`group relative px-4 py-2.5 rounded-xl ${colors.bg} border-2 ${colors.border} text-sm font-medium whitespace-nowrap transition-all duration-200 hover:shadow-lg hover:scale-105 cursor-pointer`}
                    >
                      <span className="mr-1.5">{icon}</span>
                      <span className={`${colors.text} font-semibold`}>{group.category}</span>
                      <Badge className={`ml-2 ${colors.badge}`}>{group.count}</Badge>
                    </button>
                  );
                })}
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
              groupedArticles.map((group, groupIndex) => {
                const colors = getFamilyColor(group.category);
                const icon = FAMILY_ICONS[group.category] || "📦";
                const groupViews = group.articles.reduce((s, a) => s + (a.viewsCount || 0), 0);

                return (
                  <div key={group.categorySlug} id={group.categorySlug} className="scroll-mt-28">
                    {/* Header */}
                    <div className="relative mb-10">
                      <div className={`flex items-center gap-4 p-6 rounded-2xl ${colors.bg} border-2 ${colors.border}`}>
                        <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-3xl`}>
                          {icon}
                        </div>
                        <div className="flex-1">
                          <h2 className={`text-3xl md:text-4xl font-bold ${colors.text} mb-1`}>{group.category}</h2>
                          <div className="flex items-center gap-3">
                            <Badge className={colors.badge}>{group.count} article{group.count > 1 ? "s" : ""}</Badge>
                            <span className="text-sm text-gray-500">•</span>
                            <span className={`text-sm font-medium ${colors.text}`}>{groupViews.toLocaleString()} vues</span>
                          </div>
                        </div>
                      </div>
                      <div className={`h-1.5 w-full bg-gradient-to-r ${colors.gradient} rounded-full mt-2`} />
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {group.articles.map((article) => (
                        <Link
                          key={article.id}
                          to={`/blog-pieces-auto/conseils/${article.pg_alias || article.slug}`}
                          className="group block"
                        >
                          <Card className="h-full hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-blue-400 bg-white">
                            <ProductImage
                              pgAlias={article.pg_alias}
                              title={article.title}
                              category={group.category}
                              icon={icon}
                              colors={colors}
                            />

                            <CardContent className="p-5">
                              <div className="flex items-center justify-between mb-3">
                                <Badge variant="secondary" className="text-xs">
                                  <span className="mr-1">{icon}</span>
                                  {group.category}
                                </Badge>
                                {article.viewsCount > 0 && (
                                  <div className="flex items-center gap-1 text-gray-500 text-xs">
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{formatViews(article.viewsCount)}</span>
                                  </div>
                                )}
                              </div>

                              <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors leading-tight">
                                {article.title}
                              </h3>

                              <p className="text-gray-600 text-sm line-clamp-3 mb-4">{article.excerpt}</p>

                              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>
                                    {new Date(article.publishedAt).toLocaleDateString("fr-FR", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 text-blue-600 font-semibold text-sm group-hover:gap-2 transition-all">
                                  <span>Lire</span>
                                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 text-xl">Aucun article disponible pour le moment</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:32px_32px]" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 mb-8">
              <Sparkles className="w-10 h-10" />
            </div>

            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">Besoin d&apos;aide pour votre véhicule ?</h2>
            <p className="text-xl md:text-2xl text-blue-100 mb-12 max-w-3xl mx-auto leading-relaxed">
              Nos experts vous conseillent pour l&apos;entretien et la réparation
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/contact" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-white text-blue-600 hover:bg-gray-100 transition-all px-8 py-6 text-lg font-semibold rounded-xl">
                  <span>Contacter nos experts</span>
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>

              <Link to="/catalogue" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-white text-white hover:bg-white hover:text-blue-600 transition-all px-8 py-6 text-lg font-semibold rounded-xl">
                  Voir le catalogue
                </Button>
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-blue-100">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /><span>Support 7j/7</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /><span>+10 000 clients satisfaits</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /><span>Livraison rapide</span></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
