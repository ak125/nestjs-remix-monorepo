import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, Form } from "@remix-run/react";
import { BookOpen, Clock, Eye, ArrowRight, Search, Star } from 'lucide-react';
import { useState, useMemo } from "react";

// Métadonnées SEO optimisées
export const meta: MetaFunction = () => {
  const title = "Blog Automecanik - Conseils et Guides Auto Experts";
  const description = "Découvrez nos conseils d'experts, guides de réparation et actualités du monde automobile. Plus de 500 articles pratiques pour l'entretien de votre véhicule.";
  
  return [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: "blog automobile, conseils auto, guides réparation, entretien voiture, pièces auto, mécanique, diagnostic, tutoriel" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "index, follow" },
    { name: "author", content: "Automecanik - Experts Automobile" },
  ];
};

// Interfaces TypeScript
interface Article {
  id: string;
  title: string;
  excerpt: string;
  content?: string;
  type: 'CONSEIL' | 'GUIDE' | 'ACTUALITE' | 'TUTORIEL';
  category?: string;
  subcategory?: string;
  tags: string[];
  readingTime?: number;
  difficulty?: 'FACILE' | 'MOYEN' | 'DIFFICILE';
  views?: number;
  publishedAt: string;
  updatedAt?: string;
  author?: {
    name: string;
    expertise?: string;
  };
  featured?: boolean;
  imageUrl?: string;
  slug?: string;
  seoTitle?: string;
  seoDescription?: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  articleCount: number;
  slug: string;
  color?: string;
}

interface BlogStats {
  totalArticles: number;
  totalViews: number;
  totalAdvice: number;
  totalGuides: number;
}

interface BlogData {
  featured: Article[];
  recent: Article[];
  popular: Article[];
  categories: Category[];
  stats: BlogStats;
  success: boolean;
  lastUpdated: string;
}

// Loader optimisé avec gestion d'erreurs
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchParams = {
    query: url.searchParams.get('q') || undefined,
    type: url.searchParams.get('type') || undefined,
  };

  let blogData: BlogData = {
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

  return json({ 
    blogData, 
    searchParams 
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    }
  });
}

// Composant principal
export default function BlogIndex() {
  const { blogData, searchParams } = useLoaderData<typeof loader>();
  const [searchQuery, setSearchQuery] = useState(searchParams.query || '');
  const [selectedType, setSelectedType] = useState(searchParams.type || '');

  // Utilitaires pour les couleurs et badges
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'CONSEIL': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'GUIDE': return 'bg-green-100 text-green-800 border-green-200';
      case 'TUTORIEL': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ACTUALITE': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'FACILE': return 'text-green-600';
      case 'MOYEN': return 'text-yellow-600';
      case 'DIFFICILE': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Filtrage des articles
  const filteredArticles = useMemo(() => {
    let articles = [...blogData.recent, ...blogData.featured];
    
    if (searchQuery) {
      articles = articles.filter(article => 
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    if (selectedType) {
      articles = articles.filter(article => article.type === selectedType);
    }
    
    return articles;
  }, [blogData.recent, blogData.featured, searchQuery, selectedType]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Hero Section */}
      <section className="relative py-16 px-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Blog <span className="text-yellow-400">Automecanik</span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto leading-relaxed opacity-90">
              Votre source d'expertise automobile : conseils pratiques, guides détaillés et actualités du secteur
            </p>
            
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-2xl md:text-3xl font-bold text-yellow-400">
                  {blogData.stats.totalArticles}+
                </div>
                <div className="text-sm opacity-90">Articles</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-2xl md:text-3xl font-bold text-yellow-400">
                  {Math.round(blogData.stats.totalViews / 1000)}K+
                </div>
                <div className="text-sm opacity-90">Lectures</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-2xl md:text-3xl font-bold text-yellow-400">
                  {blogData.stats.totalAdvice}+
                </div>
                <div className="text-sm opacity-90">Conseils</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-2xl md:text-3xl font-bold text-yellow-400">
                  {blogData.stats.totalGuides}+
                </div>
                <div className="text-sm opacity-90">Guides</div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="max-w-2xl mx-auto">
            <Form method="get" className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="search"
                  name="q"
                  placeholder="Rechercher un article, un guide..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/95 backdrop-blur-sm text-gray-800 placeholder-gray-500 border-0 focus:ring-4 focus:ring-yellow-400/30 transition-all duration-300"
                />
              </div>
              <select
                name="type"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-6 py-4 rounded-xl bg-white/95 backdrop-blur-sm text-gray-800 border-0 focus:ring-4 focus:ring-yellow-400/30 transition-all duration-300"
              >
                <option value="">Tous les types</option>
                <option value="CONSEIL">Conseils</option>
                <option value="GUIDE">Guides</option>
                <option value="TUTORIEL">Tutoriels</option>
                <option value="ACTUALITE">Actualités</option>
              </select>
              <button
                type="submit"
                className="px-8 py-4 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold rounded-xl transition-all duration-300 hover:scale-105 active:scale-95"
              >
                Rechercher
              </button>
            </Form>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Articles en vedette */}
        {blogData.featured.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <Star className="h-6 w-6 text-yellow-500" />
              <h2 className="text-3xl font-bold text-gray-900">Articles en vedette</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {blogData.featured.slice(0, 3).map((article) => (
                <div
                  key={article.id}
                  className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 hover:border-blue-200 hover:-translate-y-2"
                >
                  {article.imageUrl && (
                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={article.imageUrl} 
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute top-4 left-4">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getTypeColor(article.type)}`}>
                          {article.type}
                        </span>
                      </div>
                      {article.featured && (
                        <div className="absolute top-4 right-4">
                          <Star className="h-5 w-5 text-yellow-500 fill-current" />
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{article.readingTime || 5} min</span>
                      </div>
                      {article.views && (
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>{article.views} vues</span>
                        </div>
                      )}
                      {article.difficulty && (
                        <span className={`font-medium ${getDifficultyColor(article.difficulty)}`}>
                          {article.difficulty}
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors duration-300 line-clamp-2">
                      {article.title}
                    </h3>
                    
                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {article.excerpt}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {article.tags.slice(0, 3).map((tag, index) => (
                        <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg">
                          {tag}
                        </span>
                      ))}
                    </div>
                    
                    <Link 
                      to={`/blog/${article.slug || article.id}`}
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold group-hover:translate-x-1 transition-all duration-300"
                    >
                      Lire l'article
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Articles récents */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-blue-600" />
              <h2 className="text-3xl font-bold text-gray-900">
                {searchQuery || selectedType ? 'Résultats de recherche' : 'Articles récents'}
              </h2>
              {(searchQuery || selectedType) && (
                <span className="text-lg text-gray-600">
                  ({filteredArticles.length} résultat{filteredArticles.length > 1 ? 's' : ''})
                </span>
              )}
            </div>
            
            {!searchQuery && !selectedType && (
              <Link 
                to="/blog/all" 
                className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-2 hover:translate-x-1 transition-all duration-300"
              >
                Voir tous les articles
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {(searchQuery || selectedType ? filteredArticles : blogData.recent).slice(0, 9).map((article) => (
              <div
                key={article.id}
                className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-blue-200 hover:-translate-y-1"
              >
                {article.imageUrl && (
                  <div className="relative h-40 overflow-hidden">
                    <img 
                      src={article.imageUrl} 
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-lg border ${getTypeColor(article.type)}`}>
                        {article.type}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-2 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{article.readingTime || 5} min</span>
                    </div>
                    {article.views && (
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        <span>{article.views}</span>
                      </div>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors duration-300 line-clamp-2">
                    {article.title}
                  </h3>
                  
                  <p className="text-gray-600 mb-3 text-sm line-clamp-2">
                    {article.excerpt}
                  </p>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {article.tags.slice(0, 2).map((tag, index) => (
                      <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <Link 
                    to={`/blog/${article.slug || article.id}`}
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm group-hover:translate-x-1 transition-all duration-300"
                  >
                    Lire la suite
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Catégories */}
        {blogData.categories.length > 0 && (
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Explorez par catégorie</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {blogData.categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/blog/category/${category.slug}`}
                  className="group bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-blue-200 hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-300">
                      {category.name}
                    </h3>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                  
                  {category.description && (
                    <p className="text-gray-600 text-sm mb-3">
                      {category.description}
                    </p>
                  )}
                  
                  <div className="text-sm text-blue-600 font-semibold">
                    {category.articleCount} article{category.articleCount > 1 ? 's' : ''}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
