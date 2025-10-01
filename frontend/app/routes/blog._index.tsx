import { 
  json, 
  type LoaderFunctionArgs, 
  type MetaFunction,
  type ActionFunctionArgs 
} from "@remix-run/node";
import { 
  Link, 
  useLoaderData, 
  useFetcher, 
  Form 
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
  User,
  Hash,
  ExternalLink,
  Share2,
  Bookmark
} from 'lucide-react';
import { useState, useMemo } from "react";

// UI Components
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// Types améliorés
interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  alias?: string;
  excerpt: string;
  content?: string;
  type: 'advice' | 'guide' | 'constructeur' | 'glossaire';
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
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
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
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const title = "Blog Automecanik - Conseils et Guides Auto Experts";
  const description = "Découvrez nos conseils d'experts, guides de réparation et actualités du monde automobile. Plus de 500 articles pratiques pour l'entretien de votre véhicule.";
  
  return [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: "blog automobile, conseils auto, guides réparation, entretien voiture, pièces auto, mécanique, diagnostic, tutoriel" },
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
    query: url.searchParams.get('q') || undefined,
    category: url.searchParams.get('category') || undefined,
    type: url.searchParams.get('type') || undefined,
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

    const response = await fetch('http://localhost:3000/api/blog/homepage', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Remix-Blog-Client/1.0',
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
    console.warn('Blog API error:', error instanceof Error ? error.message : 'Unknown error');
  }

  return json<LoaderData>({ 
    blogData, 
    searchParams 
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    }
  });
}

// Action pour interactions utilisateur
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get('actionType');
  const articleId = formData.get('articleId');

  try {
    switch (actionType) {
      case 'bookmark':
        return json({ success: true, message: 'Article ajouté aux favoris' });
      case 'share':
        return json({ success: true, message: 'Article partagé' });
      default:
        return json({ success: false, error: 'Action non reconnue' });
    }
  } catch (error) {
    return json({ 
      success: false, 
      error: 'Erreur lors de l\'action' 
    }, { status: 500 });
  }
}

// Composant principal optimisé
export default function BlogIndex() {
  const { blogData, searchParams } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [searchQuery, setSearchQuery] = useState(searchParams.query || '');
  const [selectedType, setSelectedType] = useState(searchParams.type || '');

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
      advice: 'Conseil',
      guide: 'Guide',
      constructeur: 'Constructeur',
      glossaire: 'Glossaire'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Articles filtrés
  const filteredArticles = useMemo(() => {
    if (!blogData.popular) return [];
    
    return blogData.popular.filter(article => {
      const matchesType = !selectedType || article.type === selectedType;
      const matchesSearch = !searchQuery || 
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesType && matchesSearch;
    });
  }, [blogData.popular, selectedType, searchQuery]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Hero Section Améliorée */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900 text-white py-24">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/90 to-purple-900/90" />
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <svg viewBox="0 0 100 20" className="w-full h-full">
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
              Blog Automecanik
            </h1>
            <p className="text-xl md:text-2xl mb-8 leading-relaxed max-w-3xl mx-auto">
              Conseils d'experts, guides pratiques et actualités pour prendre soin de votre véhicule. 
              Votre référence automobile depuis 2020.
            </p>

            {/* Barre de recherche améliorée */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/20">
              <Form method="get" className="flex flex-col md:flex-row gap-4">
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

            {/* Statistiques animées */}
            {blogData.success && blogData.stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
                {[
                  { label: 'Articles', value: blogData.stats.totalArticles, icon: BookOpen },
                  { label: 'Conseils', value: blogData.stats.totalAdvice, icon: Sparkles },
                  { label: 'Guides', value: blogData.stats.totalGuides, icon: Star },
                  { label: 'Vues', value: blogData.stats.totalViews, icon: Eye, format: true },
                ].map((stat, index) => (
                  <div
                    key={stat.label}
                    className="text-center p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:scale-105 transition-transform duration-200"
                  >
                    <stat.icon className="w-6 h-6 mx-auto mb-2 text-blue-200" />
                    <div className="text-3xl font-bold text-white mb-1">
                      {stat.format && stat.value > 1000 
                        ? formatViews(stat.value)
                        : `${stat.value}+`
                      }
                    </div>
                    <div className="text-blue-200 text-sm">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Articles en vedette */}
      {blogData.featured && blogData.featured.length > 0 && (
        <section className="py-20 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 text-lg">
                <Star className="w-4 h-4 mr-2" />
                À la une
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
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
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
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                          {getTypeLabel(article.type)}
                        </Badge>
                        {article.difficulty && (
                          <Badge className={getDifficultyColor(article.difficulty)}>
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
                          to={article.pg_alias ? `/blog-pieces-auto/conseils/${article.pg_alias}` : `/blog/article/${article.slug || article.alias}`}
                          className="text-blue-600 hover:text-blue-800 font-semibold group-hover:underline inline-flex items-center"
                        >
                          Lire l'article
                          <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
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
                            variant="ghost"
                            size="sm"
                            className="p-2 hover:bg-blue-50"
                            onClick={() => {
                              if (navigator.share) {
                                navigator.share({
                                  title: article.title,
                                  url: article.pg_alias ? `/blog-pieces-auto/conseils/${article.pg_alias}` : `/blog/article/${article.slug || article.alias}`
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

      {/* Contenu principal avec tabs */}
      <section className="py-20">
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
                <TabsTrigger value="popular" className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Populaires
                </TabsTrigger>
                <TabsTrigger value="recent" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Récents
                </TabsTrigger>
                <TabsTrigger value="categories" className="flex items-center gap-2">
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
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
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
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
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
                              {new Date(article.publishedAt).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                        </div>
                        
                        <Link 
                          to={`/blog/article/${article.slug || article.alias}`}
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
                  <Link to="/blog/popular">
                    <Button size="lg" variant="outline" className="group px-8 py-4 text-lg">
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
                            <span>{formatReadingTime(article.readingTime)}</span>
                            <Link 
                              to={`/blog/article/${article.slug || article.alias}`}
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
                  <p className="text-gray-600">Aucun article récent disponible</p>
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
                      <Link to={`/blog/category/${category.slug}`}>
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

      {/* Newsletter et Call to Action */}
      <section className="py-20 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Restez informé de nos derniers articles
          </h2>
          <p className="text-xl mb-12 max-w-3xl mx-auto leading-relaxed">
            Recevez nos derniers conseils d'experts, guides pratiques et actualités 
            directement dans votre boîte mail. Plus de 10 000 professionnels nous font confiance.
          </p>
          
          {/* Newsletter form */}
          <div className="max-w-md mx-auto mb-12">
            <Form className="flex gap-3">
              <Input
                type="email"
                placeholder="Votre adresse email"
                className="flex-1 bg-white/90 text-gray-900 border-0"
                required
              />
              <Button 
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 px-6"
              >
                S'abonner
              </Button>
            </Form>
            <p className="text-xs text-blue-200 mt-2">
              Pas de spam, désabonnement en un clic
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link to="/contact">
              <Button 
                size="lg" 
                variant="outline" 
                className="text-white border-2 border-white hover:bg-white hover:text-purple-600 px-8 py-4 rounded-xl text-lg font-semibold group"
              >
                <User className="w-5 h-5 mr-2" />
                Contacter nos experts
                <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/catalogue">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 px-8 py-4 rounded-xl text-lg font-semibold group"
              >
                Explorer le catalogue
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
