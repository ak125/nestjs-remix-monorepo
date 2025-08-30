import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
  type ActionFunctionArgs,
} from "@remix-run/node";
import {
  useLoaderData,
  useSearchParams,
  Form,
  Link,
  useFetcher,
  useNavigation,
} from "@remix-run/react";
import {
  Wrench,
  Filter,
  Search,
  Clock,
  Eye,
  ArrowRight,
  BookOpen,
  Star,
  TrendingUp,
  Grid3X3,
  List,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Share2,
  Hash,
  Calendar,
} from "lucide-react";
import { useState } from "react";

// Types améliorés
interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  type: 'advice';
  viewsCount: number;
  readingTime: number;
  publishedAt: string;
  updatedAt?: string;
  keywords: string[];
  tags: string[];
  sections?: Array<{
    level: number;
    title: string;
    content: string;
    anchor: string;
  }>;
  seo_data?: {
    meta_title: string;
    meta_description: string;
    keywords: string[];
  };
  difficulty?: 'débutant' | 'intermédiaire' | 'expert';
  estimatedCost?: number;
  toolsRequired?: string[];
  isPopular?: boolean;
  isFeatured?: boolean;
}

interface Gamme {
  id: string | number;
  name: string;
  code: string;
  description?: string;
  articlesCount?: number;
  icon?: string;
}

interface LoaderData {
  articles: BlogArticle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  gammes: Gamme[];
  filters: {
    difficulty?: string[];
    sort?: string;
    gamme?: string;
    query?: string;
  };
  popularKeywords: Array<{ keyword: string; count: number }>;
  stats: {
    totalAdvice: number;
    totalViews: number;
    avgReadingTime: number;
  };
}

// Utilitaires
const cn = (...classes: (string | undefined | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

// Composants UI compatibles
const Button = ({ children, className = "", variant = "primary", size = "md", disabled = false, onClick, type }: {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) => {
  const baseClasses = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500"
  };
  
  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg"
  };
  
  return (
    <button
      type={type}
      className={cn(baseClasses, variants[variant], sizes[size], className)}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white rounded-lg border shadow-sm", className)}>
    {children}
  </div>
);

const CardHeader = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("p-6 pb-4", className)}>
    {children}
  </div>
);

const CardTitle = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h3 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>
    {children}
  </h3>
);

const CardContent = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("p-6 pt-0", className)}>
    {children}
  </div>
);

const Badge = ({ children, className = "", variant = "default", onClick }: { 
  children: React.ReactNode; 
  className?: string; 
  variant?: "default" | "secondary" | "outline";
  onClick?: () => void;
}) => {
  const variants = {
    default: "bg-blue-100 text-blue-800 border-blue-200",
    secondary: "bg-gray-100 text-gray-800 border-gray-200",
    outline: "border border-gray-300 text-gray-700"
  };
  
  return (
    <span 
      className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", variants[variant], className, onClick && "cursor-pointer hover:bg-opacity-80 transition-colors")}
      onClick={onClick}
    >
      {children}
    </span>
  );
};

// Métadonnées SEO avancées
export const meta: MetaFunction<typeof loader> = ({ data, params, location }) => {
  const { searchParams } = new URL(`http://localhost${location.search}`);
  const query = searchParams.get("q");
  const gamme = searchParams.get("gamme");
  const difficulty = searchParams.get("difficulty");
  
  let title = "Conseils & Astuces Auto - Guides d'Experts";
  let description = "Découvrez nos conseils d'experts pour l'entretien et la réparation de votre véhicule. Plus de 85 guides pratiques pour tous les niveaux.";
  
  if (query) {
    title = `Conseils "${query}" - Guides Auto`;
    description = `Trouvez les meilleurs conseils pour "${query}". Guides d'experts avec instructions détaillées.`;
  } else if (gamme) {
    title = `Conseils Gamme ${gamme} - Guides Spécialisés`;
    description = `Conseils spécialisés pour la gamme ${gamme}. Guides d'entretien et réparation.`;
  } else if (difficulty) {
    title = `Conseils ${difficulty} - Guides Auto par Niveau`;
    description = `Guides automobiles niveau ${difficulty}. Conseils adaptés à votre expertise.`;
  }

  const keywords = [
    "conseils auto", "guides réparation", "entretien voiture",
    "diagnostic panne", "tutoriel mécanique", "pièces auto",
    "maintenance véhicule", "réparation automobile"
  ];

  if (data?.popularKeywords) {
    keywords.push(...data.popularKeywords.slice(0, 5).map(k => k.keyword));
  }

  return [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: keywords.join(", ") },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:image", content: "/images/conseils-auto-og.jpg" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "robots", content: "index, follow" },
    { name: "author", content: "Automecanik - Experts Automobile" },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": title,
        "description": description,
        "url": `https://automecanik.com/blog/advice${location.search}`,
        "mainEntity": {
          "@type": "ItemList",
          "numberOfItems": data?.total || 85,
          "itemListElement": data?.articles?.slice(0, 10).map((article, index) => ({
            "@type": "Article",
            "position": index + 1,
            "name": article.title,
            "description": article.excerpt,
            "url": `https://automecanik.com/blog/article/${article.slug}`
          })) || []
        }
      }
    }
  ];
};

// Loader optimisé
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const gamme = url.searchParams.get("gamme");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "12");
  const difficulty = url.searchParams.getAll("difficulty");
  const sort = url.searchParams.get("sort") || "recent";
  const query = url.searchParams.get("q");

  try {
    const apiUrl = new URL("http://localhost:3000/api/blog/advice");
    apiUrl.searchParams.set("page", page.toString());
    apiUrl.searchParams.set("limit", limit.toString());
    
    if (gamme) apiUrl.searchParams.set("gamme", gamme);
    if (difficulty.length > 0) {
      difficulty.forEach(d => apiUrl.searchParams.append("difficulty", d));
    }
    if (sort) apiUrl.searchParams.set("sort", sort);
    if (query) apiUrl.searchParams.set("q", query);

    const [adviceResponse, statsResponse] = await Promise.all([
      fetch(apiUrl.toString(), {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      }),
      fetch("http://localhost:3000/api/blog/advice/stats", {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      }).catch(() => null),
    ]);

    let data: LoaderData = {
      articles: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      gammes: [
        { id: "entretien", name: "Entretien", code: "entretien", description: "Guides d'entretien", articlesCount: 25 },
        { id: "reparation", name: "Réparation", code: "reparation", description: "Guides de réparation", articlesCount: 30 },
        { id: "diagnostic", name: "Diagnostic", code: "diagnostic", description: "Guides de diagnostic", articlesCount: 15 },
        { id: "electrique", name: "Système Électrique", code: "electrique", description: "Électronique auto", articlesCount: 15 },
      ],
      filters: { difficulty, sort, gamme: gamme || undefined, query: query || undefined },
      popularKeywords: [
        { keyword: "freins", count: 42 },
        { keyword: "moteur", count: 38 },
        { keyword: "batterie", count: 31 },
        { keyword: "vidange", count: 28 },
        { keyword: "diagnostic", count: 25 },
        { keyword: "pneumatiques", count: 22 },
        { keyword: "climatisation", count: 19 },
        { keyword: "embrayage", count: 16 }
      ],
      stats: { totalAdvice: 85, totalViews: 62981, avgReadingTime: 5 },
    };

    if (adviceResponse.ok) {
      const adviceData = await adviceResponse.json();
      if (adviceData.success) {
        data = {
          ...data,
          articles: adviceData.data.articles || [],
          total: adviceData.data.total || 0,
          totalPages: adviceData.data.totalPages || 0,
        };
      }
    }

    if (statsResponse?.ok) {
      const statsData = await statsResponse.json();
      if (statsData.success) {
        data.stats = {
          totalAdvice: statsData.data.total || 85,
          totalViews: statsData.data.totalViews || 62981,
          avgReadingTime: statsData.data.avgReadingTime || 5,
        };
        data.popularKeywords = statsData.data.topKeywords?.slice(0, 10) || data.popularKeywords;
      }
    }

    return json(data, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600',
        'Vary': 'Accept-Encoding',
      },
    });

  } catch (error) {
    console.error('Erreur loader advice:', error);
    
    return json({
      articles: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      gammes: [],
      filters: { difficulty, sort, gamme: gamme || undefined, query: query || undefined },
      popularKeywords: [],
      stats: { totalAdvice: 85, totalViews: 62981, avgReadingTime: 5 },
    } as LoaderData);
  }
}

// Action pour interactions
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  try {
    switch (actionType) {
      case "bookmark":
        return json({ success: true, message: "Conseil ajouté aux favoris" });
      case "share":
        return json({ success: true, message: "Conseil partagé" });
      case "view":
        return json({ success: true, message: "Vue comptabilisée" });
      default:
        return json({ success: false, error: "Action non reconnue" });
    }
  } catch (error) {
    return json({ 
      success: false, 
      error: "Erreur lors de l'action" 
    }, { status: 500 });
  }
}

// Composant principal
export default function AdviceListPage() {
  const data = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const fetcher = useFetcher();

  // États locaux
  const [searchQuery, setSearchQuery] = useState(data.filters.query || "");
  const [selectedGamme, setSelectedGamme] = useState(data.filters.gamme || "");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string[]>(data.filters.difficulty || []);
  const [sortBy, setSortBy] = useState(data.filters.sort || "recent");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Utilitaires
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

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'débutant': return 'bg-green-100 text-green-800 border-green-200';
      case 'intermédiaire': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'expert': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDifficultyIcon = (difficulty?: string) => {
    switch (difficulty) {
      case 'débutant': return '🟢';
      case 'intermédiaire': return '🟡';
      case 'expert': return '🔴';
      default: return '⚪';
    }
  };

  // Gestion des filtres
  const handleSearch = (query: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (query) {
      newParams.set("q", query);
    } else {
      newParams.delete("q");
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const handleFilterChange = (key: string, value: string | string[]) => {
    const newParams = new URLSearchParams(searchParams);
    
    if (Array.isArray(value)) {
      newParams.delete(key);
      value.forEach(v => newParams.append(key, v));
    } else if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const isLoading = navigation.state === "loading";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header Section */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900 text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Titre principal */}
            <div className="mb-8">
              <div className="flex items-center justify-center mb-6">
                <Wrench className="w-12 h-12 mr-4 text-orange-400" />
                <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
                  Conseils & Astuces
                </h1>
              </div>
              <p className="text-xl md:text-2xl mb-8 leading-relaxed max-w-3xl mx-auto">
                Découvrez nos conseils d'experts pour l'entretien et la réparation de votre véhicule
              </p>
            </div>

            {/* Barre de recherche */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/20">
              <Form method="get" className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    name="q"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher des conseils, guides, astuces..."
                    className="w-full pl-12 pr-4 py-4 rounded-xl border-0 text-gray-900 bg-white/90 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-lg"
                  />
                </div>
                
                <select 
                  name="gamme"
                  value={selectedGamme}
                  onChange={(e) => {
                    setSelectedGamme(e.target.value);
                    handleFilterChange("gamme", e.target.value);
                  }}
                  className="w-full md:w-64 py-4 px-4 bg-white/90 border-0 text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Toutes les gammes</option>
                  {data.gammes.map((gamme) => (
                    <option key={gamme.id} value={gamme.code}>
                      {gamme.name} ({gamme.articlesCount})
                    </option>
                  ))}
                </select>

                <Button 
                  type="submit"
                  size="lg" 
                  disabled={isLoading}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 px-8 py-4 rounded-xl text-lg font-semibold"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Search className="w-5 h-5 mr-2" />
                  )}
                  Rechercher
                </Button>
              </Form>
            </div>

            {/* Statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <div className="text-center p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <BookOpen className="w-6 h-6 mx-auto mb-2 text-blue-200" />
                <div className="text-3xl font-bold text-white mb-1">
                  {data.stats.totalAdvice}+
                </div>
                <div className="text-blue-200 text-sm">Conseils</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <Eye className="w-6 h-6 mx-auto mb-2 text-blue-200" />
                <div className="text-3xl font-bold text-white mb-1">
                  {formatViews(data.stats.totalViews)}
                </div>
                <div className="text-blue-200 text-sm">Vues totales</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <Clock className="w-6 h-6 mx-auto mb-2 text-blue-200" />
                <div className="text-3xl font-bold text-white mb-1">
                  {data.stats.avgReadingTime}
                </div>
                <div className="text-blue-200 text-sm">min moyenne</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar avec filtres */}
          <aside className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Filtres principaux */}
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center">
                      <Filter className="w-5 h-5 mr-2" />
                      Filtres
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      className="lg:hidden"
                      onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    >
                      {isFiltersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className={cn("space-y-6", !isFiltersOpen && "hidden lg:block")}>
                  {/* Niveau de difficulté */}
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center">
                      <Star className="w-4 h-4 mr-2" />
                      Niveau de difficulté
                    </h3>
                    <div className="space-y-3">
                      {[
                        { value: "débutant", label: "Débutant", icon: "🟢" },
                        { value: "intermédiaire", label: "Intermédiaire", icon: "🟡" },
                        { value: "expert", label: "Expert", icon: "🔴" }
                      ].map((level) => (
                        <div key={level.value} className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id={level.value}
                            checked={selectedDifficulty.includes(level.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const newDifficulty = [...selectedDifficulty, level.value];
                                setSelectedDifficulty(newDifficulty);
                                handleFilterChange("difficulty", newDifficulty);
                              } else {
                                const newDifficulty = selectedDifficulty.filter(d => d !== level.value);
                                setSelectedDifficulty(newDifficulty);
                                handleFilterChange("difficulty", newDifficulty);
                              }
                            }}
                            className="rounded border-gray-300 focus:ring-blue-500"
                          />
                          <label 
                            htmlFor={level.value}
                            className="text-sm font-medium flex items-center cursor-pointer"
                          >
                            <span className="mr-2">{level.icon}</span>
                            {level.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <hr className="border-gray-200" />

                  {/* Gammes populaires */}
                  {data.gammes.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-4 flex items-center">
                        <Hash className="w-4 h-4 mr-2" />
                        Gammes populaires
                      </h3>
                      <div className="space-y-2">
                        {data.gammes.slice(0, 4).map((gamme) => (
                          <Button
                            key={gamme.id}
                            variant={selectedGamme === gamme.code ? "primary" : "outline"}
                            size="sm"
                            className="w-full justify-between text-left"
                            onClick={() => {
                              const newGamme = selectedGamme === gamme.code ? "" : gamme.code;
                              setSelectedGamme(newGamme);
                              handleFilterChange("gamme", newGamme);
                            }}
                          >
                            <span>{gamme.name}</span>
                            <Badge variant="secondary" className="ml-2">
                              {gamme.articlesCount}
                            </Badge>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <hr className="border-gray-200" />

                  {/* Mots-clés populaires */}
                  {data.popularKeywords.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-4 flex items-center">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Tendances
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {data.popularKeywords.slice(0, 8).map((keyword) => (
                          <Badge
                            key={keyword.keyword}
                            variant="outline"
                            className="cursor-pointer hover:bg-blue-50 transition-colors"
                            onClick={() => {
                              setSearchQuery(keyword.keyword);
                              handleSearch(keyword.keyword);
                            }}
                          >
                            #{keyword.keyword}
                            <span className="ml-1 text-xs text-gray-500">
                              {keyword.count}
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Guide rapide */}
              <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center text-blue-900">
                    <BookOpen className="w-5 h-5 mr-2" />
                    Guide rapide
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center text-sm">
                      <span className="mr-2">🟢</span>
                      <span><strong>Débutant:</strong> Outils de base requis</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="mr-2">🟡</span>
                      <span><strong>Intermédiaire:</strong> Expérience recommandée</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="mr-2">🔴</span>
                      <span><strong>Expert:</strong> Équipement professionnel</span>
                    </div>
                  </div>
                  <hr className="border-blue-200" />
                  <p className="text-xs text-gray-600">
                    💡 <strong>Astuce:</strong> Commencez par les guides débutant pour maîtriser les bases.
                  </p>
                </CardContent>
              </Card>
            </div>
          </aside>

          {/* Contenu principal */}
          <main className="lg:col-span-3">
            {/* Barre d'outils et résultats */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-col">
                <p className="text-gray-600 text-lg">
                  <strong>{data.total}</strong> conseil{data.total > 1 ? 's' : ''} trouvé{data.total > 1 ? 's' : ''}
                  {data.filters.query && (
                    <span className="ml-2">
                      pour "<span className="font-semibold text-blue-600">{data.filters.query}</span>"
                    </span>
                  )}
                </p>
                {data.filters.gamme && (
                  <p className="text-sm text-gray-500 mt-1">
                    Gamme: <Badge variant="secondary">{data.gammes.find(g => g.code === data.filters.gamme)?.name}</Badge>
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                {/* Mode d'affichage */}
                <div className="flex items-center border rounded-lg p-1 bg-white">
                  <Button
                    variant={viewMode === 'grid' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="px-3 py-2"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="px-3 py-2 ml-1"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>

                {/* Tri */}
                <select 
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    handleFilterChange("sort", e.target.value);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 w-48 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="recent">Plus récents</option>
                  <option value="popular">Plus populaires</option>
                  <option value="views">Plus vus</option>
                  <option value="difficulty_asc">Difficulté croissante</option>
                  <option value="difficulty_desc">Difficulté décroissante</option>
                  <option value="reading_time">Temps de lecture</option>
                </select>
              </div>
            </div>

            {/* Articles */}
            <div className={cn(
              "gap-6 mb-8",
              viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "space-y-6"
            )}>
              {data.articles.map((article) => (
                <div
                  key={article.id}
                  className="group hover:transform hover:-translate-y-1 hover:scale-[1.02] transition-all duration-200"
                >
                  {viewMode === 'grid' ? (
                    // Vue grille
                    <Card className="h-full group hover:shadow-xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm overflow-hidden">
                      <CardHeader>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                              <Wrench className="w-3 h-3 mr-1" />
                              Conseil
                            </Badge>
                            {article.difficulty && (
                              <Badge className={getDifficultyColor(article.difficulty)}>
                                {getDifficultyIcon(article.difficulty)} {article.difficulty}
                              </Badge>
                            )}
                          </div>
                          {article.isPopular && (
                            <Badge className="bg-gradient-to-r from-pink-500 to-red-500 text-white border-0">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              Populaire
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="group-hover:text-blue-600 transition-colors leading-tight">
                          {article.title}
                        </CardTitle>
                      </CardHeader>
                      
                      <CardContent>
                        <p className="text-gray-600 mb-4 leading-relaxed line-clamp-3">
                          {article.excerpt}
                        </p>
                        
                        {/* Tags */}
                        {article.keywords && article.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-4">
                            {article.keywords.slice(0, 3).map((keyword) => (
                              <Badge 
                                key={keyword} 
                                variant="outline" 
                                className="text-xs px-2 py-1"
                              >
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {formatReadingTime(article.readingTime)}
                            </div>
                            <div className="flex items-center">
                              <Eye className="w-4 h-4 mr-1" />
                              {formatViews(article.viewsCount)}
                            </div>
                          </div>
                          {article.publishedAt && (
                            <div className="flex items-center text-xs">
                              <Calendar className="w-3 h-3 mr-1" />
                              {new Date(article.publishedAt).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Link 
                            to={`/blog/article/${article.slug}`}
                            className="text-blue-600 hover:text-blue-800 font-semibold group-hover:underline inline-flex items-center"
                          >
                            Lire le guide
                            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                          </Link>
                          
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="p-2 hover:bg-blue-50"
                              onClick={() => {
                                fetcher.submit(
                                  { actionType: 'bookmark', articleId: article.id },
                                  { method: 'post' }
                                );
                              }}
                            >
                              <Bookmark className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="p-2 hover:bg-blue-50"
                              onClick={() => {
                                if (navigator.share) {
                                  navigator.share({
                                    title: article.title,
                                    url: `/blog/article/${article.slug}`
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
                  ) : (
                    // Vue liste
                    <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3">
                              <Badge className="bg-blue-100 text-blue-800">
                                <Wrench className="w-3 h-3 mr-1" />
                                Conseil
                              </Badge>
                              {article.difficulty && (
                                <Badge className={getDifficultyColor(article.difficulty)}>
                                  {getDifficultyIcon(article.difficulty)} {article.difficulty}
                                </Badge>
                              )}
                              {article.isPopular && (
                                <Badge className="bg-gradient-to-r from-pink-500 to-red-500 text-white border-0">
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                  Populaire
                                </Badge>
                              )}
                            </div>
                            
                            <h2 className="text-xl font-bold mb-3 group-hover:text-blue-600 transition-colors">
                              {article.title}
                            </h2>
                            
                            <p className="text-gray-600 mb-4 leading-relaxed line-clamp-2">
                              {article.excerpt}
                            </p>
                            
                            {/* Tags en liste */}
                            {article.keywords && article.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-4">
                                {article.keywords.slice(0, 5).map((keyword) => (
                                  <Badge 
                                    key={keyword} 
                                    variant="outline" 
                                    className="text-xs"
                                  >
                                    {keyword}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <div className="flex items-center">
                                  <Clock className="w-4 h-4 mr-1" />
                                  {formatReadingTime(article.readingTime)}
                                </div>
                                <div className="flex items-center">
                                  <Eye className="w-4 h-4 mr-1" />
                                  {formatViews(article.viewsCount)}
                                </div>
                                {article.publishedAt && (
                                  <div className="flex items-center">
                                    <Calendar className="w-4 h-4 mr-1" />
                                    {new Date(article.publishedAt).toLocaleDateString('fr-FR')}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="p-2 hover:bg-blue-50"
                                  onClick={() => {
                                    fetcher.submit(
                                      { actionType: 'bookmark', articleId: article.id },
                                      { method: 'post' }
                                    );
                                  }}
                                >
                                  <Bookmark className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="p-2 hover:bg-blue-50"
                                  onClick={() => {
                                    if (navigator.share) {
                                      navigator.share({
                                        title: article.title,
                                        url: `/blog/article/${article.slug}`
                                      });
                                    }
                                  }}
                                >
                                  <Share2 className="w-4 h-4" />
                                </Button>
                                <Link to={`/blog/article/${article.slug}`}>
                                  <Button>
                                    Lire le guide
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ))}
            </div>

            {/* État vide */}
            {data.articles.length === 0 && !isLoading && (
              <div className="text-center py-16">
                <Wrench className="w-16 h-16 mx-auto mb-6 text-gray-400" />
                <h3 className="text-xl font-semibold mb-4">Aucun conseil trouvé</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Aucun guide ne correspond à vos critères. 
                  Essayez de modifier vos filtres ou votre recherche.
                </p>
                <Button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedGamme("");
                    setSelectedDifficulty([]);
                    setSearchParams({});
                  }}
                >
                  Réinitialiser les filtres
                </Button>
              </div>
            )}

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="mt-12 flex justify-center">
                <div className="flex items-center gap-2">
                  {/* Pagination précédente */}
                  {data.page > 1 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set("page", (data.page - 1).toString());
                        setSearchParams(newParams);
                      }}
                      disabled={isLoading}
                    >
                      Précédent
                    </Button>
                  )}

                  {/* Numéros de pages */}
                  {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, data.page - 2) + i;
                    if (pageNum > data.totalPages) return null;
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={data.page === pageNum ? "primary" : "outline"}
                        onClick={() => {
                          const newParams = new URLSearchParams(searchParams);
                          newParams.set("page", pageNum.toString());
                          setSearchParams(newParams);
                        }}
                        disabled={isLoading}
                        className="w-10 h-10 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}

                  {/* Pagination suivante */}
                  {data.page < data.totalPages && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set("page", (data.page + 1).toString());
                        setSearchParams(newParams);
                      }}
                      disabled={isLoading}
                    >
                      Suivant
                    </Button>
                  )}
                </div>
                
                <div className="ml-8 text-sm text-gray-500 flex items-center">
                  Page {data.page} sur {data.totalPages}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-4">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-lg font-medium">Chargement des conseils...</span>
          </div>
        </div>
      )}

      <style>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
