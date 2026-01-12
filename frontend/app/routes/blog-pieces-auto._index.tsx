import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
  type ActionFunctionArgs,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useFetcher,
  Form,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  BookOpen,
  Clock,
  Eye,
  ArrowRight,
  Search,
  Sparkles,
  TrendingUp,
  Star,
  ChevronRight,
  Calendar,
  Hash,
  ExternalLink,
  Share2,
  Bookmark,
  Wrench,
  Award,
  MessageCircle,
  Mail,
  CheckCircle2,
  Car,
  ShoppingCart,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";

// Blog Components
import { BlogNavigation } from "~/components/blog/BlogNavigation";
import { CompactBlogHeader } from "~/components/blog/CompactBlogHeader";
import { Error404 } from "~/components/errors/Error404";

// UI Components
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// Types améliorés
interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  alias?: string;
  pg_alias?: string | null; // Alias de la gamme pour URL legacy
  excerpt: string;
  content?: string;
  type: "advice" | "guide" | "constructeur" | "glossaire";
  featuredImage?: string;
  viewsCount: number;
  readingTime: number;
  publishedAt: string;
  updatedAt?: string;
  author?: {
    name: string;
    avatar?: string;
  };
  tags?: string[];
  difficulty?: "beginner" | "intermediate" | "advanced";
  isPopular?: boolean;
  isFeatured?: boolean;
}

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  articlesCount: number;
  color?: string;
  icon?: string;
}

interface BlogStats {
  totalArticles: number;
  totalViews: number;
  totalAdvice: number;
  totalGuides: number;
  totalConstructeurs?: number;
  totalGlossary?: number;
  avgReadingTime?: number;
}

interface LoaderData {
  blogData: {
    featured: BlogArticle[];
    recent: BlogArticle[];
    popular: BlogArticle[];
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

// Métadonnées SEO améliorées
export const meta: MetaFunction<typeof loader> = ({ data: _data }) => {
  const title = "Blog Automecanik - Conseils et Guides Auto Experts";
  const description =
    "Découvrez nos conseils d'experts, guides de réparation et actualités du monde automobile. Plus de 500 articles pratiques pour l'entretien de votre véhicule.";

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
    { property: "og:image", content: "/images/blog-og-image.jpg" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "robots", content: "index, follow" },
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
    featured: [],
    recent: [],
    popular: [],
    categories: [],
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
    // API call avec timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch("http://localhost:3000/api/blog/homepage", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Remix-Blog-Client/1.0",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const apiResponse = await response.json();
      if (apiResponse.success && apiResponse.data) {
        blogData = {
          ...apiResponse.data,
          success: true,
          lastUpdated: new Date().toISOString(),
        };
      }
    } else {
      console.warn(`API returned ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.warn(
      "Blog API error:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  return json<LoaderData>(
    {
      blogData,
      searchParams,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    },
  );
}

// Action pour interactions utilisateur
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const _articleId = formData.get("articleId");

  try {
    switch (actionType) {
      case "bookmark":
        return json({ success: true, message: "Article ajouté aux favoris" });
      case "share":
        return json({ success: true, message: "Article partagé" });
      default:
        return json({ success: false, error: "Action non reconnue" });
    }
  } catch (error) {
    return json(
      {
        success: false,
        error: "Erreur lors de l'action",
      },
      { status: 500 },
    );
  }
}

// Composant principal optimisé
export default function BlogIndex() {
  const { blogData, searchParams } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [searchQuery, setSearchQuery] = useState(searchParams.query || "");
  const [selectedType, setSelectedType] = useState(searchParams.type || "");
  const [_animatedStats, setAnimatedStats] = useState({
    articles: 0,
    advice: 0,
    guides: 0,
    views: 0,
  });

  // Animation des statistiques au chargement
  useEffect(() => {
    if (!blogData.stats) return;

    // L'API retourne stats avec overview, mais le type ne le reflète pas
    const stats = blogData.stats as any;
    const overview = stats.overview || stats;

    const duration = 2000; // 2 secondes
    const steps = 60;
    const interval = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      setAnimatedStats({
        articles: Math.floor((overview.totalArticles || 0) * progress),
        advice: Math.floor((overview.totalAdvice || 0) * progress),
        guides: Math.floor((overview.totalGuides || 0) * progress),
        views: Math.floor((overview.totalViews || 0) * progress),
      });

      if (currentStep >= steps) {
        clearInterval(timer);
        setAnimatedStats({
          articles: overview.totalArticles || 0,
          advice: overview.totalAdvice || 0,
          guides: overview.totalGuides || 0,
          views: overview.totalViews || 0,
        });
      }
    }, interval);

    return () => clearInterval(timer);
  }, [blogData.stats]);

  // Fonctions utilitaires optimisées
  const formatReadingTime = (minutes: number) => {
    if (minutes < 1) return "< 1 min";
    if (minutes > 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${minutes} min de lecture`;
  };

  const formatViews = (views: number) => {
    if (views > 1000000) return `${(views / 1000000).toFixed(1)}M vues`;
    if (views > 1000) return `${(views / 1000).toFixed(1)}k vues`;
    return `${views} vues`;
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      advice: "Conseil",
      guide: "Guide",
      constructeur: "Constructeur",
      glossaire: "Glossaire",
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case "beginner":
        return "success";
      case "intermediate":
        return "warning";
      case "advanced":
        return "error";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Articles filtrés
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Navigation Blog */}
      <BlogNavigation />

      {/* Breadcrumb */}
      <div className="container mx-auto px-4 pt-6">
        <PublicBreadcrumb items={[{ label: "Blog" }]} />
      </div>

      {/* Hero Compact */}
      <CompactBlogHeader
        title="Blog Automecanik"
        description={
          blogData.success && blogData.stats
            ? `${blogData.stats.totalArticles}+ articles • ${formatViews(blogData.stats.totalViews)} vues`
            : "Conseils d'experts et guides pratiques automobile"
        }
        stats={
          blogData.success && blogData.stats
            ? [
                {
                  icon: BookOpen,
                  value: blogData.stats.totalArticles,
                  label: "Articles",
                },
                {
                  icon: Sparkles,
                  value: blogData.stats.totalAdvice,
                  label: "Conseils",
                },
                {
                  icon: Star,
                  value: blogData.stats.totalGuides || 0,
                  label: "Guides",
                },
              ]
            : []
        }
        gradientFrom="from-blue-900"
        gradientTo="to-purple-900"
      />

      {/* Search Bar Section - Compact */}
      <section className="py-6 bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            {/* Barre de recherche */}
            <div className="bg-slate-50 rounded-xl p-4 border border-gray-200">
              <Form method="get" className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    name="q"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher des articles, guides, conseils..."
                    className="w-full pl-12 pr-4 py-4 rounded-xl border-0 text-gray-900 bg-white/90 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-lg"
                  />
                </div>

                <select
                  name="type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-6 py-4 rounded-xl border-0 text-gray-900 bg-white/90 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="">Tous les types</option>
                  <option value="advice">Conseils</option>
                  <option value="guide">Guides</option>
                  <option value="constructeur">Constructeurs</option>
                  <option value="glossaire">Glossaire</option>
                </select>

                <Button
                  type="submit"
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 px-8 py-4 rounded-xl text-lg font-semibold"
                >
                  <Search className="w-5 h-5 mr-2" />
                  Rechercher
                </Button>
              </Form>
            </div>
          </div>
        </div>
      </section>

      {/* Articles en vedette */}
      {blogData.featured && blogData.featured.length > 0 && (
        <section className="py-20 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 text-lg">
                <Star className="w-4 h-4 mr-2" />À la une
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Articles en vedette
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Nos contenus les plus appréciés par la communauté
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {blogData.featured.slice(0, 3).map((article, index) => (
                <div
                  key={article.id}
                  className="hover:-translate-y-2 transition-transform duration-300"
                >
                  <Card className="group h-full overflow-hidden border-0 bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500">
                    {article.featuredImage && (
                      <div className="h-56 relative overflow-hidden">
                        <img
                          src={article.featuredImage}
                          alt={article.title}
                          width={400}
                          height={224}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Featured
                          </Badge>
                        </div>
                      </div>
                    )}

                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge
                          variant="secondary"
                          className="bg-info/20 text-info hover:bg-primary/30"
                        >
                          {getTypeLabel(article.type)}
                        </Badge>
                        {article.difficulty && (
                          <Badge
                            className={getDifficultyColor(article.difficulty)}
                          >
                            {article.difficulty}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">
                        {article.title}
                      </CardTitle>
                    </CardHeader>

                    <CardContent>
                      <p className="text-gray-600 mb-4 line-clamp-3 leading-relaxed">
                        {article.excerpt}
                      </p>

                      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {formatReadingTime(article.readingTime)}
                          </div>
                          <div className="flex items-center">
                            <Eye className="w-4 h-4 mr-1" />
                            {formatViews(article.viewsCount)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Link
                          to={
                            article.pg_alias
                              ? `/blog-pieces-auto/conseils/${article.pg_alias}`
                              : `/blog-pieces-auto/article/${article.slug || article.alias}`
                          }
                          className="text-blue-600 hover:text-blue-800 font-semibold group-hover:underline inline-flex items-center"
                        >
                          Lire l'article
                          <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </Link>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="p-2 hover:bg-info/20"
                            onClick={() => {
                              fetcher.submit(
                                {
                                  actionType: "bookmark",
                                  articleId: article.id,
                                },
                                { method: "post" },
                              );
                            }}
                          >
                            <Bookmark className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="p-2 hover:bg-info/20"
                            onClick={() => {
                              if (navigator.share) {
                                navigator.share({
                                  title: article.title,
                                  url: article.pg_alias
                                    ? `/blog-pieces-auto/conseils/${article.pg_alias}`
                                    : `/blog/article/${article.slug || article.alias}`,
                                });
                              }
                            }}
                          >
                            <Share2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section Catégories Principales */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 text-lg">
              <Hash className="w-4 h-4 mr-2" />
              Nos Catégories
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Explorez nos contenus par thématique
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Guides complets, conseils d'experts et informations détaillées
            </p>
          </div>

          {/* 3 Catégories Principales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 max-w-6xl mx-auto">
            {/* Montage et Entretien */}
            <Link to="/blog-pieces-auto/conseils" className="group">
              <Card className="h-full border-2 border-orange-200 hover:border-orange-400 hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-orange-50 to-white overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-muted rounded-bl-full opacity-50" />
                <CardHeader className="relative">
                  <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-2xl p-4 w-16 h-16 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Wrench className="w-8 h-8" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                    Montage et Entretien
                  </CardTitle>
                  <p className="text-gray-600 mt-2">
                    Guides détaillés pour installer et entretenir vos pièces
                    auto
                  </p>
                </CardHeader>
                <CardContent className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <Badge className="bg-orange-100 text-orange-800 text-sm">
                      150+ guides
                    </Badge>
                    <ArrowRight className="w-5 h-5 text-orange-600 group-hover:translate-x-2 transition-transform" />
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-orange-500" />
                      Tutoriels pas à pas
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-orange-500" />
                      Conseils de pro
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-orange-500" />
                      Liste d'outils
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </Link>

            {/* Constructeurs */}
            <Link to="/blog-pieces-auto/auto" className="group">
              <Card className="h-full border-2 border-blue-200 hover:border-blue-400 hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-white overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-muted rounded-bl-full opacity-50" />
                <CardHeader className="relative">
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl p-4 w-16 h-16 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Car className="w-8 h-8" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    Constructeurs Automobile
                  </CardTitle>
                  <p className="text-gray-600 mt-2">
                    Histoire, modèles et spécificités de chaque marque
                  </p>
                </CardHeader>
                <CardContent className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <Badge className="bg-info/20 text-info text-sm">
                      35+ marques
                    </Badge>
                    <ArrowRight className="w-5 h-5 text-blue-600 group-hover:translate-x-2 transition-transform" />
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-blue-500" />
                      Histoire des marques
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-blue-500" />
                      Modèles emblématiques
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-blue-500" />
                      Fiches techniques
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </Link>

            {/* Guide d'Achat */}
            <Link to="/blog-pieces-auto/guide" className="group">
              <Card className="h-full border-2 border-green-200 hover:border-green-400 hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-green-50 to-white overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-success/10 rounded-bl-full opacity-50" />
                <CardHeader className="relative">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl p-4 w-16 h-16 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <ShoppingCart className="w-8 h-8" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-900 group-hover:text-green-600 transition-colors">
                    Guide d'Achat
                  </CardTitle>
                  <p className="text-gray-600 mt-2">
                    Conseils pour choisir les meilleures pièces au meilleur prix
                  </p>
                </CardHeader>
                <CardContent className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <Badge className="bg-success/20 text-success text-sm">
                      120+ guides
                    </Badge>
                    <ArrowRight className="w-5 h-5 text-green-600 group-hover:translate-x-2 transition-transform" />
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                      Comparatifs détaillés
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                      Rapport qualité/prix
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                      Marques recommandées
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Bouton "Tous les conseils" */}
          <div className="text-center">
            <Link to="/blog-pieces-auto/conseils">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-xl text-lg font-semibold group shadow-lg hover:shadow-xl transition-all"
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Tous les conseils par catégorie
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contenu principal avec tabs */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-slate-50">
        <div className="container mx-auto px-4">
          <Tabs defaultValue="popular" className="w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
              <div>
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  Découvrez nos contenus
                </h2>
                <p className="text-xl text-gray-600">
                  Articles, guides et conseils pour tous les niveaux
                </p>
              </div>

              <TabsList className="grid grid-cols-2 md:grid-cols-3 w-full md:w-auto">
                <TabsTrigger
                  value="popular"
                  className="flex items-center gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  Populaires
                </TabsTrigger>
                <TabsTrigger value="recent" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Récents
                </TabsTrigger>
                <TabsTrigger
                  value="categories"
                  className="flex items-center gap-2"
                >
                  <Hash className="w-4 h-4" />
                  Catégories
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Articles populaires */}
            <TabsContent value="popular" className="mt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredArticles.slice(0, 9).map((article, index) => (
                  <div
                    key={article.id}
                    className="hover:-translate-y-1 transition-transform duration-300"
                  >
                    <Card className="group h-full hover:shadow-xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm overflow-hidden">
                      {article.featuredImage && (
                        <div className="h-48 relative overflow-hidden">
                          <img
                            src={article.featuredImage}
                            alt={article.title}
                            width={400}
                            height={192}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {article.isPopular && (
                            <div className="absolute top-3 right-3">
                              <Badge className="bg-gradient-to-r from-pink-500 to-red-500 text-white">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                Populaire
                              </Badge>
                            </div>
                          )}
                        </div>
                      )}

                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between mb-3">
                          <Badge
                            variant="secondary"
                            className="bg-info/20 text-info"
                          >
                            {getTypeLabel(article.type)}
                          </Badge>
                          <div className="flex items-center text-sm text-gray-500">
                            <Eye className="w-4 h-4 mr-1" />
                            {formatViews(article.viewsCount)}
                          </div>
                        </div>
                        <CardTitle className="text-xl group-hover:text-blue-600 transition-colors line-clamp-2">
                          {article.title}
                        </CardTitle>
                      </CardHeader>

                      <CardContent>
                        <p className="text-gray-600 mb-4 line-clamp-3 leading-relaxed">
                          {article.excerpt}
                        </p>

                        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {formatReadingTime(article.readingTime)}
                          </div>
                          {article.publishedAt && (
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {new Date(article.publishedAt).toLocaleDateString(
                                "fr-FR",
                              )}
                            </div>
                          )}
                        </div>

                        <Link
                          to={
                            article.pg_alias
                              ? `/blog-pieces-auto/conseils/${article.pg_alias}`
                              : `/blog-pieces-auto/article/${article.slug || article.alias}`
                          }
                          className="text-blue-600 hover:text-blue-800 font-medium group-hover:underline inline-flex items-center"
                        >
                          Lire la suite
                          <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>

              {filteredArticles.length > 9 && (
                <div className="text-center mt-12">
                  <Link to="/blog-pieces-auto/popular">
                    <Button
                      size="lg"
                      variant="outline"
                      className="group px-8 py-4 text-lg"
                    >
                      Voir tous les articles populaires
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              )}
            </TabsContent>

            {/* Articles récents */}
            <TabsContent value="recent" className="mt-8">
              {blogData.recent && blogData.recent.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {blogData.recent.slice(0, 6).map((article, index) => (
                    <div
                      key={article.id}
                      className="hover:translate-x-1 transition-transform duration-200"
                    >
                      <Card className="group flex flex-row h-32 hover:shadow-lg transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm overflow-hidden">
                        {article.featuredImage && (
                          <div className="w-32 h-full relative overflow-hidden">
                            <img
                              src={article.featuredImage}
                              alt={article.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <div className="flex-1 p-4 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="secondary" className="text-xs">
                                {getTypeLabel(article.type)}
                              </Badge>
                            </div>
                            <h3 className="font-semibold line-clamp-2 group-hover:text-blue-600 transition-colors">
                              {article.title}
                            </h3>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>
                              {formatReadingTime(article.readingTime)}
                            </span>
                            <Link
                              to={
                                article.pg_alias
                                  ? `/blog-pieces-auto/conseils/${article.pg_alias}`
                                  : `/blog-pieces-auto/article/${article.slug || article.alias}`
                              }
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Lire →
                            </Link>
                          </div>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">
                    Aucun article récent disponible
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Catégories */}
            <TabsContent value="categories" className="mt-8">
              {blogData.categories && blogData.categories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {blogData.categories.map((category, index) => (
                    <div
                      key={category.id}
                      className="hover:-translate-y-1 hover:scale-105 transition-all duration-200"
                    >
                      <Link to={`/blog-pieces-auto/category/${category.slug}`}>
                        <Card className="group text-center h-full hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 hover:from-blue-50 hover:to-purple-50">
                          <CardHeader>
                            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold group-hover:scale-110 transition-transform duration-300">
                              {category.icon || category.name.charAt(0)}
                            </div>
                            <CardTitle className="text-xl group-hover:text-blue-600 transition-colors">
                              {category.name}
                            </CardTitle>
                            <p className="text-gray-600 mt-2 line-clamp-2">
                              {category.description}
                            </p>
                          </CardHeader>
                          <CardContent>
                            <div className="text-3xl font-bold text-blue-600 mb-2">
                              {category.articlesCount || 0}
                            </div>
                            <div className="text-gray-500 flex items-center justify-center">
                              articles disponibles
                              <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Hash className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">Aucune catégorie disponible</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Section Articles les Plus Consultés */}
      {blogData.popular && blogData.popular.length > 0 && (
        <section className="py-16 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-12">
                <div>
                  <Badge className="mb-4 bg-white/20 text-white backdrop-blur-sm px-6 py-2">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Les plus consultés
                  </Badge>
                  <h2 className="text-4xl font-bold mb-2">
                    Articles tendances
                  </h2>
                  <p className="text-blue-200 text-lg">
                    Découvrez les articles les plus populaires de notre
                    communauté
                  </p>
                </div>
                <Link to="/blog?tab=popular">
                  <Button
                    variant="outline"
                    className="hidden md:flex border-white/30 text-white hover:bg-white/10"
                  >
                    Voir tout
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {blogData.popular.slice(0, 3).map((article) => (
                  <Link
                    key={article.id}
                    to={
                      article.pg_alias
                        ? `/blog-pieces-auto/conseils/${article.pg_alias}`
                        : `/blog-pieces-auto/article/${article.slug || article.alias}`
                    }
                    className="group"
                  >
                    <Card className="h-full bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300 overflow-hidden">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge
                            variant="secondary"
                            className="bg-white/20 text-white border-white/30"
                          >
                            {getTypeLabel(article.type)}
                          </Badge>
                          <Badge className="bg-orange-500/90 text-white">
                            <Eye className="w-3 h-3 mr-1" />
                            {formatViews(article.viewsCount)}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-white mb-3 line-clamp-2 group-hover:text-blue-200 transition-colors text-lg">
                          {article.title}
                        </h3>
                        <p className="text-blue-200 text-sm line-clamp-2 mb-4">
                          {article.excerpt}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-blue-300">
                          <div className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {article.publishedAt
                              ? new Date(
                                  article.publishedAt,
                                ).toLocaleDateString("fr-FR", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "N/A"}
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

      {/* Newsletter et Call to Action */}
      <section className="py-20 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20" />

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="max-w-3xl mx-auto">
            <Mail className="w-16 h-16 mx-auto mb-6 animate-bounce" />
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ne manquez aucun article !
            </h2>
            <p className="text-xl mb-8 leading-relaxed text-white/90">
              Rejoignez{" "}
              <strong className="font-bold">
                plus de 10 000 passionnés d'automobile
              </strong>{" "}
              et recevez nos meilleurs conseils, guides exclusifs et actualités
              directement dans votre boîte mail.
            </p>

            {/* Newsletter form amélioré */}
            <div className="max-w-md mx-auto mb-8">
              <Form className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  placeholder="Votre adresse email"
                  className="flex-1 bg-white text-gray-900 border-0 shadow-lg py-6 text-lg"
                  required
                />
                <Button
                  type="submit"
                  size="lg"
                  className="bg-gray-900 hover:bg-black text-white px-8 py-6 text-lg font-bold shadow-2xl"
                >
                  <Mail className="w-5 h-5 mr-2" />
                  Je m'abonne
                </Button>
              </Form>
              <div className="flex items-center justify-center gap-6 mt-4 text-sm text-white/80">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Gratuit
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />1 email/semaine
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Sans spam
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 justify-center mt-8">
              <Link to="/contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-white border-2 border-white hover:bg-white hover:text-pink-600 px-8 py-4 rounded-xl text-lg font-semibold group"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Contacter nos experts
                  <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/catalogue">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-white to-blue-50 text-pink-600 hover:shadow-2xl px-8 py-4 rounded-xl text-lg font-semibold group"
                >
                  Explorer le catalogue
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
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
