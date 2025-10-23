// app/routes/blog-pieces-auto.guides._index.tsx
import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { 
  BookOpen, 
  Clock,
  Eye, 
  Filter, 
  List,
  Sparkles,
  Tag
} from "lucide-react";
import * as React from "react";
import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { CompactBlogHeader } from "~/components/blog/CompactBlogHeader";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

/* ===========================
   Types
=========================== */
interface BlogGuide {
  id: string;
  type: string;
  title: string;
  slug: string;
  bg_alias: string | null;
  excerpt: string;
  publishedAt: string;
  viewsCount: number;
  featuredImage: string | null;
  h2Count?: number;
  h3Count?: number;
  readingTime?: number;
  tags?: string[];
}

interface GuideGroup {
  category: string;
  categorySlug: string;
  count: number;
  guides: BlogGuide[];
}

interface LoaderData {
  groupedGuides: GuideGroup[];
  allGuides: BlogGuide[];
  totalGuides: number;
  stats: {
    totalViews: number;
    totalCategories: number;
  };
}

/* ===========================
   Styles par catégorie
=========================== */
const CATEGORY_COLORS: Record<
  string,
  { bg: string; border: string; text: string; gradient: string; badge: string }
> = {
  "Freinage": { 
    bg: "bg-red-50", 
    border: "border-red-300", 
    text: "text-red-800", 
    gradient: "from-red-500 to-red-700", 
    badge: 'error', 
  },
  "Filtres": { 
    bg: "bg-yellow-50", 
    border: "border-yellow-300", 
    text: "text-yellow-900", 
    gradient: "from-yellow-500 to-yellow-700", 
    badge: "bg-yellow-100 text-yellow-900 border-yellow-300" 
  },
  "Amortisseurs": { 
    bg: "bg-purple-50", 
    border: "border-purple-300", 
    text: "text-purple-800", 
    gradient: "from-purple-500 to-purple-700", 
    badge: 'purple', 
  },
  "Batteries": { 
    bg: "bg-orange-50", 
    border: "border-orange-300", 
    text: "text-orange-800", 
    gradient: "from-orange-500 to-orange-700", 
    badge: 'orange', 
  },
  "Pneus": { 
    bg: "bg-slate-50", 
    border: "border-slate-300", 
    text: "text-slate-800", 
    gradient: "from-slate-600 to-slate-800", 
    badge: "bg-slate-100 text-slate-800 border-slate-300" 
  },
  "Échappement": { 
    bg: "bg-gray-50", 
    border: "border-gray-400", 
    text: "text-gray-800", 
    gradient: "from-gray-600 to-gray-800", 
    badge: "bg-gray-100 text-gray-800 border-gray-400" 
  },
  "Éclairage": { 
    bg: "bg-yellow-50", 
    border: "border-yellow-400", 
    text: "text-yellow-900", 
    gradient: "from-yellow-400 to-yellow-600", 
    badge: "bg-yellow-100 text-yellow-900 border-yellow-400" 
  },
  "Accessoires": { 
    bg: "bg-pink-50", 
    border: "border-pink-300", 
    text: "text-pink-800", 
    gradient: "from-pink-500 to-pink-700", 
    badge: "bg-pink-100 text-pink-800 border-pink-300" 
  },
  "Autres": { 
    bg: "bg-gray-50", 
    border: "border-gray-300", 
    text: "text-gray-800", 
    gradient: "from-gray-500 to-gray-700", 
    badge: "bg-gray-100 text-gray-800 border-gray-300" 
  },
};

const CATEGORY_ICONS: Record<string, string> = {
  "Freinage": "🛑",
  "Filtres": "🔍",
  "Amortisseurs": "🔧",
  "Batteries": "🔋",
  "Pneus": "🚗",
  "Échappement": "💨",
  "Éclairage": "💡",
  "Accessoires": "⭐",
  "Autres": "📚",
};

/* ===========================
   Loader
=========================== */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
    const res = await fetch(`${backendUrl}/api/blog/guides?limit=100&type=achat`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();

    let guides: BlogGuide[] = [];
    
    if (data?.success && data.data?.guides) {
      guides = data.data.guides as BlogGuide[];
      console.log(`✅ Chargé ${guides.length} guides d'achat`);
    } else {
      console.log("⚠️ Aucun guide trouvé dans la réponse API");
    }

    // Créer les catégories avec compteur basé sur les guides réels
    const categories = [
      { name: "Freinage", slug: "freinage", description: "Plaquettes, disques, étriers", keywords: ["frein", "plaquette", "disque", "etrier"] },
      { name: "Filtres", slug: "filtres", description: "Air, huile, habitacle, carburant", keywords: ["filtre", "air", "huile", "habitacle", "carburant"] },
      { name: "Amortisseurs", slug: "amortisseurs", description: "Avant, arrière, sport", keywords: ["amortisseur", "suspension"] },
      { name: "Batteries", slug: "batteries", description: "12V, Start&Stop, AGM", keywords: ["batterie", "start", "stop", "agm"] },
      { name: "Pneus", slug: "pneus", description: "Été, hiver, 4 saisons", keywords: ["pneu", "roue", "été", "hiver"] },
      { name: "Échappement", slug: "echappement", description: "Silencieux, catalyseur, ligne", keywords: ["echappement", "silencieux", "catalyseur", "pot"] },
      { name: "Éclairage", slug: "eclairage", description: "Ampoules, phares, LED", keywords: ["eclairage", "ampoule", "phare", "led", "feu"] },
      { name: "Accessoires", slug: "accessoires", description: "Tapis, housses, équipements", keywords: ["accessoire", "tapis", "housse"] },
    ];

    // Grouper les guides par catégorie
    const groupedGuides: GuideGroup[] = categories.map(cat => {
      const categoryGuides = guides.filter(guide => {
        const title = guide.title?.toLowerCase() || "";
        const slug = guide.slug?.toLowerCase() || "";
        return cat.keywords.some(keyword => title.includes(keyword) || slug.includes(keyword));
      });

      return {
        category: cat.name,
        categorySlug: cat.slug,
        count: categoryGuides.length,
        guides: categoryGuides,
      };
    });

    const totalGuides = guides.length;
    const totalViews = guides.reduce((sum, g) => sum + (g.viewsCount || 0), 0);

    return json<LoaderData>({
      groupedGuides,
      allGuides: guides,
      totalGuides,
      stats: {
        totalViews,
        totalCategories: categories.length,
      },
    });
  } catch (error) {
    console.error("❌ Erreur chargement guides:", error);
    return json<LoaderData>({
      groupedGuides: [],
      allGuides: [],
      totalGuides: 0,
      stats: { totalViews: 0, totalCategories: 0 },
    });
  }
};

/* ===========================
   Helpers
=========================== */
const getCategoryColor = (category: string) => {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS["Autres"];
};

/* ===========================
   Meta
=========================== */
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const count = data?.totalGuides ?? 0;
  return [
    { title: "Guide d'Achat Pièces Auto - Conseils d'Experts | Automecanik" },
    {
      name: "description",
      content: `Découvrez nos ${count} guides d'achat pour choisir les meilleures pièces auto. Comparatifs, conseils d'experts et recommandations pour faire le bon choix au meilleur prix.`,
    },
    { name: "keywords", content: "guide achat pièces auto, comparatif pièces, conseils achat, choisir pièces voiture, meilleures marques auto" },
  ];
};

/* ===========================
   Page
=========================== */
export default function BlogGuidesIndex() {
  const { groupedGuides, allGuides, totalGuides, stats } = useLoaderData<typeof loader>();

  const formatViews = (views: number) => {
    if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
    if (views >= 1_000) return `${(views / 1_000).toFixed(1)}k`;
    return views.toString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <BlogPiecesAutoNavigation />

      {/* Hero Section */}
      <CompactBlogHeader
        title="Guide d'Achat"
        description={`${totalGuides} guides pour faire les meilleurs choix • ${stats.totalViews.toLocaleString()} vues • ${stats.totalCategories} catégories`}
        gradientFrom="from-green-600"
        gradientTo="to-emerald-600"
        breadcrumb={[
          { label: "Accueil", href: "/" },
          { label: "Pièces Auto", href: "/blog-pieces-auto/conseils" },
          { label: "Guide d'Achat" },
        ]}
      />

      {/* Points clés */}
      <section className="py-8 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="flex flex-col items-center text-center bg-white/80 backdrop-blur rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full w-16 h-16 flex items-center justify-center mb-4">
                  <span className="text-2xl">💰</span>
                </div>
                <h4 className="font-bold text-gray-900 mb-2 text-lg">Rapport qualité/prix</h4>
                <p className="text-gray-600 text-sm">Comparatifs des meilleures marques à prix compétitifs</p>
              </div>
              <div className="flex flex-col items-center text-center bg-white/80 backdrop-blur rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full w-16 h-16 flex items-center justify-center mb-4">
                  <span className="text-2xl">🏆</span>
                </div>
                <h4 className="font-bold text-gray-900 mb-2 text-lg">Marques certifiées</h4>
                <p className="text-gray-600 text-sm">Sélection de fabricants reconnus et homologués</p>
              </div>
              <div className="flex flex-col items-center text-center bg-white/80 backdrop-blur rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full w-16 h-16 flex items-center justify-center mb-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <h4 className="font-bold text-gray-900 mb-2 text-lg">Compatibilité</h4>
                <p className="text-gray-600 text-sm">Vérification de l'adéquation avec votre véhicule</p>
              </div>
              <div className="flex flex-col items-center text-center bg-white/80 backdrop-blur rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full w-16 h-16 flex items-center justify-center mb-4">
                  <span className="text-2xl">📈</span>
                </div>
                <h4 className="font-bold text-gray-900 mb-2 text-lg">Tendances</h4>
                <p className="text-gray-600 text-sm">Innovations et nouvelles technologies du marché</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section Filtres */}
      <section className="py-12 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-full mb-3">
                <Filter className="w-5 h-5" />
                <span className="font-semibold">Par Catégorie</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Explorez par type de guide
              </h3>
              <p className="text-gray-600">
                Trouvez rapidement le guide adapté à votre projet
              </p>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {groupedGuides.map((group, index) => {
                const colors = getCategoryColor(group.category);
                const icon = CATEGORY_ICONS[group.category] || "📚";
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
                    style={{ animationDelay: `${index * 50}ms` }}
                    className={`group relative p-2.5 rounded-lg ${colors.bg} border-2 ${colors.border} transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer text-center`}
                  >
                    <div className={`text-2xl mb-1.5 transform group-hover:scale-110 transition-transform duration-200`}>
                      {icon}
                    </div>
                    <h4 className={`${colors.text} font-bold text-xs leading-tight line-clamp-2`}>
                      {group.category}
                    </h4>
                    <div className={`absolute inset-0 rounded-lg bg-gradient-to-br ${colors.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex items-center justify-center gap-8 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-green-600" />
                <span><strong className="text-gray-900">{totalGuides}</strong> guides disponibles</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-green-600" />
                <span><strong className="text-gray-900">{stats.totalViews.toLocaleString()}</strong> vues totales</span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-green-600" />
                <span><strong className="text-gray-900">{stats.totalCategories}</strong> catégories</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            {totalGuides > 0 ? (
              <div className="scroll-mt-28">
                <div className="relative mb-10">
                  <div className="flex items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-3xl">
                      📚
                    </div>
                    <div className="flex-1">
                      <h2 className="text-3xl md:text-4xl font-bold text-green-900 mb-1">Tous les guides d'achat</h2>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-success/20 text-success border-green-300">{totalGuides} guide{totalGuides > 1 ? "s" : ""}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full mt-2" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {allGuides.map((guide) => (
                      <Link
                        key={guide.id}
                        to={`/blog-pieces-auto/guide/${guide.bg_alias || guide.slug}`}
                        className="group block"
                      >
                        <Card className="h-full hover:shadow-2xl hover:shadow-green-100/50 transition-all duration-300 border-2 border-gray-100 hover:border-green-300 bg-white overflow-hidden group-hover:-translate-y-1">
                          <div className="flex flex-row h-full">
                            <div className="relative w-40 flex-shrink-0 overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-green-100">
                              {guide.featuredImage ? (
                                <img
                                  src={guide.featuredImage}
                                  alt={guide.title}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600">
                                  <BookOpen className="w-16 h-16 text-white" />
                                </div>
                              )}
                              <Badge className="absolute top-2 left-2 bg-green-600 text-white border-0 shadow-lg">
                                <Sparkles className="w-3 h-3 mr-1" />
                                Guide d'Achat
                              </Badge>
                            </div>

                            <CardContent className="flex-1 p-5">
                              <h3 className="text-lg font-bold text-gray-900 mb-3 line-clamp-3 group-hover:text-green-600 transition-colors leading-tight">
                                {guide.title.replace(/^Guide achat de pièce auto:?\s*/i, '')}
                              </h3>
                              
                              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                {guide.excerpt}
                              </p>

                              <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                                {guide.h2Count && (
                                  <div className="flex items-center gap-1">
                                    <List className="w-4 h-4" />
                                    <span>{guide.h2Count} sections</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <Eye className="w-4 h-4" />
                                  <span>{formatViews(guide.viewsCount || 0)}</span>
                                </div>
                                {guide.readingTime && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span>{guide.readingTime} min</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 hover:text-green-700 hover:bg-success/20 p-0 h-auto font-semibold border-none"
                                >
                                  Lire le guide →
                                </Button>
                              </div>
                            </CardContent>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
            ) : (
              <div className="text-center py-20">
                <BookOpen className="w-20 h-20 text-gray-300 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Aucun guide disponible</h3>
                <p className="text-gray-600 mb-8">Les guides d'achat seront bientôt disponibles</p>
                <Link to="/blog-pieces-auto/conseils">
                  <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                    Voir les conseils →
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Besoin de conseils personnalisés ?
          </h2>
          <p className="text-xl text-green-100 mb-8 max-w-2xl mx-auto">
            Nos experts vous aident à choisir les pièces adaptées à votre véhicule et votre budget
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-white text-green-600 hover:bg-success/20 font-semibold px-8"
            >
              Demander conseil
            </Button>
            <Link to="/blog-pieces-auto/conseils">
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white text-white hover:bg-white/10 font-semibold px-8"
              >
                Voir le catalogue
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
