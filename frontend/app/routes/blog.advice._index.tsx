import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams, useNavigation } from "@remix-run/react";
import React, { useState, useMemo } from 'react';
import { BlogNavigation } from "~/components/blog/BlogNavigation";

interface AdviceArticle {
  id: string;
  type: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  h1: string;
  h2: string;
  keywords: string[];
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  viewsCount: number;
  readingTime: number;
  sections: Array<{
    level: number;
    title: string;
    content: string;
    anchor: string;
  }>;
  legacy_id: number;
  legacy_table: string;
  seo_data: {
    meta_title: string;
    meta_description: string;
    keywords: string[];
  };
}

interface LoaderData {
  articles: AdviceArticle[];
  total: number;
  page: number;
  totalPages: number;
  success: boolean;
  search: string;
  category: string;
  categories: string[];
  featuredArticles: AdviceArticle[];
  popularTags: Array<{ name: string; count: number }>;
  stats: {
    totalViews: number;
    avgReadingTime: number;
    totalArticles: number;
  };
  error?: string;
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const search = data?.search || '';
  const total = data?.total || 0;
  
  const title = search 
    ? `Conseils Automobiles - Recherche "${search}" (${total} résultats)`
    : "Conseils Automobiles Expert - Guides d'Entretien et Réparation Auto";
    
  const description = search
    ? `Découvrez ${total} conseils d'experts pour "${search}". Guides complets d'entretien et réparation automobile.`
    : "Plus de 85 conseils d'experts automobiles. Guides détaillés pour l'entretien, la réparation et le diagnostic de votre véhicule.";
    
  return [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: "conseils automobile, entretien voiture, réparation auto, diagnostic panne, guide mécanique" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = 12;
    const search = url.searchParams.get('search')?.trim() || '';
    const category = url.searchParams.get('category')?.trim() || '';
    
    // API call to localhost for internal monorepo communication
    const apiUrl = `http://localhost:3000/api/blog/advice?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`;
    
    const [mainResponse, statsResponse] = await Promise.allSettled([
      fetch(apiUrl),
      fetch('http://localhost:3000/api/blog/advice/stats')
    ]);

    if (mainResponse.status === 'rejected' || !mainResponse.value.ok) {
      throw new Error('API call failed');
    }

    const data = await mainResponse.value.json();
    
    // Get stats (optional)
    let stats = { totalViews: 0, avgReadingTime: 3, totalArticles: data.data?.total || 0 };
    if (statsResponse.status === 'fulfilled' && statsResponse.value.ok) {
      try {
        const statsData = await statsResponse.value.json();
        if (statsData.success) {
          stats = { ...stats, ...statsData.data };
        }
      } catch (e) {
        // Stats are optional, continue without them
      }
    }

    if (!data.success) {
      throw new Error('API returned unsuccessful response');
    }

    // Extract unique categories and popular tags from articles
    const articles = data.data?.articles || [];
    const categories = [...new Set(articles.flatMap((article: AdviceArticle) => article.tags))].slice(0, 10);
    
    // Get popular tags with counts
    const tagCounts = new Map<string, number>();
    articles.forEach((article: AdviceArticle) => {
      article.tags?.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    
    const popularTags = Array.from(tagCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Featured articles (highest view count)
    const featuredArticles = [...articles]
      .sort((a: AdviceArticle, b: AdviceArticle) => b.viewsCount - a.viewsCount)
      .slice(0, 3);

    const endTime = Date.now();
    console.log(`[PERF] Advice loader completed in ${endTime - startTime}ms`);

    return json({
      articles,
      total: data.data?.total || 0,
      page: data.data?.page || 1,
      totalPages: data.data?.totalPages || 1,
      search,
      category,
      categories,
      featuredArticles,
      popularTags,
      stats,
      success: true
    });
  } catch (error) {
    console.error('[ERROR] Advice loader failed:', error);
    return json({
      articles: [],
      total: 0,
      page: 1,
      totalPages: 1,
      search: '',
      category: '',
      categories: [],
      featuredArticles: [],
      popularTags: [],
      stats: { totalViews: 0, avgReadingTime: 3, totalArticles: 0 },
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Optimized UI Components
const Card: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
  hover?: boolean;
}> = ({ children, className, hover = false }) => (
  <article className={`
    bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden
    ${hover ? 'hover:shadow-lg hover:border-gray-200 transition-all duration-300 hover:-translate-y-1' : ''}
    ${className || ''}
  `}>
    {children}
  </article>
);

const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <header className={`px-6 py-4 border-b border-gray-50 ${className || ''}`}>
    {children}
  </header>
);

const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`px-6 py-4 ${className || ''}`}>
    {children}
  </div>
);

const CardTitle: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
  level?: 'h1' | 'h2' | 'h3';
}> = ({ children, className, level = 'h3' }) => {
  const Component = level;
  return (
    <Component className={`font-bold text-gray-900 leading-tight ${className || ''}`}>
      {children}
    </Component>
  );
};

const Badge: React.FC<{ 
  children: React.ReactNode; 
  variant?: 'default' | 'secondary' | 'success' | 'warning';
  size?: 'sm' | 'md';
}> = ({ children, variant = 'default', size = 'sm' }) => {
  const variants = {
    default: 'bg-primary/5 text-blue-700 border-blue-200',
    secondary: 'bg-gray-50 text-gray-700 border-gray-200',
    success: 'bg-success/5 text-green-700 border-green-200',
    warning: 'bg-warning/5 text-yellow-700 border-yellow-200'
  };
  
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm'
  };
  
  return (
    <span className={`
      inline-flex items-center rounded-full border font-medium
      ${variants[variant]} ${sizes[size]}
    `}>
      {children}
    </span>
  );
};

const Button: React.FC<{ 
  children: React.ReactNode; 
  variant?: 'default' | 'outline' | 'ghost'; 
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}> = ({ children, variant = 'default', size = 'md', onClick, disabled, className, type = 'button' }) => {
  const baseClasses = `
    inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `;
  
  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 shadow-sm',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100',
    ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
  };
  
  const sizes = {
    sm: 'h-9 px-4 text-sm',
    md: 'h-10 px-5 text-sm',
    lg: 'h-12 px-6 text-base'
  };

  return (
    <button 
      type={type}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className || ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

const Input: React.FC<{
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  'aria-label'?: string;
}> = ({ type = 'text', placeholder, value, onChange, className, 'aria-label': ariaLabel }) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    aria-label={ariaLabel || placeholder}
    className={`
      w-full h-10 px-4 rounded-lg border border-gray-300 bg-white
      text-gray-900 placeholder-gray-500
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
      transition-colors duration-200
      ${className || ''}
    `}
  />
);

const LoadingSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${className || 'h-6 w-6'}`} />
);

// SVG Icons
const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'h-4 w-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const FilterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'h-4 w-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
  </svg>
);

const WrenchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'h-4 w-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'h-4 w-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const EyeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'h-4 w-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const BookOpenIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'h-4 w-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

export default function AdviceIndex() {
  const data = useLoaderData<LoaderData>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(data.search || '');
  const [selectedCategory, setSelectedCategory] = useState(data.category || '');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const isLoading = navigation.state === 'loading';

  // Memoized filtered articles for client-side instant filtering
  const displayedArticles = useMemo(() => {
    if (!data.articles) return [];
    
    let filtered = [...data.articles];
    
    // Client-side search for better UX (in addition to server-side)
    if (searchTerm && searchTerm !== data.search) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(article => 
        article.title.toLowerCase().includes(searchLower) ||
        article.excerpt.toLowerCase().includes(searchLower) ||
        article.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    return filtered;
  }, [data.articles, searchTerm, data.search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim() === data.search) return;
    
    const newParams = new URLSearchParams(searchParams);
    if (searchTerm.trim()) {
      newParams.set('search', searchTerm.trim());
    } else {
      newParams.delete('search');
    }
    newParams.delete('page');
    setSearchParams(newParams);
  };

  const handleCategoryChange = (category: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (category && category !== 'all') {
      newParams.set('category', category);
    } else {
      newParams.delete('category');
    }
    newParams.delete('page');
    setSelectedCategory(category);
    setSearchParams(newParams);
    setIsFiltersOpen(false);
  };

  const handlePageChange = (page: number) => {
    if (page === data.page) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams);
    
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = data.search || data.category;

  if (!data.success) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-2xl mx-auto text-center">
            <CardContent className="py-12">
              <div className="mb-4">
                <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-600 text-2xl">⚠</span>
                </div>
                <CardTitle level="h2" className="text-xl text-red-800 mb-2">
                  Erreur de chargement
                </CardTitle>
                <p className="text-gray-600 mb-6">
                  Nous ne parvenons pas à charger les conseils automobiles pour le moment.
                  {data.error && <span className="block mt-2 text-sm">Erreur: {data.error}</span>}
                </p>
                <Button onClick={() => window.location.reload()}>
                  Réessayer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Blog */}
      <BlogNavigation />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center mb-6">
              <WrenchIcon className="h-12 w-12 text-yellow-400 mr-4" />
              <h1 className="text-4xl md:text-5xl font-bold">
                Conseils Automobiles Expert
              </h1>
            </div>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Plus de {data.stats.totalArticles} guides détaillés pour l'entretien, 
              la réparation et le diagnostic de votre véhicule
            </p>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-100">{data.stats.totalArticles}</div>
                <div className="text-blue-200">Conseils disponibles</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-100">{Math.round(data.stats.avgReadingTime)}min</div>
                <div className="text-blue-200">Temps de lecture moyen</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-100">{data.popularTags.length}</div>
                <div className="text-blue-200">Catégories</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="py-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search Input */}
                <div className="flex-1 relative">
                  <Input
                    placeholder="Rechercher un conseil (ex: frein, embrayage, moteur...)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-12"
                    aria-label="Recherche de conseils automobiles"
                  />
                  <button
                    type="submit"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={isLoading}
                  >
                    {isLoading ? <LoadingSpinner className="h-5 w-5" /> : <SearchIcon className="h-5 w-5" />}
                  </button>
                </div>
                
                {/* Filter Toggle (Mobile) */}
                <div className="lg:hidden">
                  <Button
                    variant="outline"
                    onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                  >
                    <FilterIcon className="mr-2" />
                    Filtres
                  </Button>
                </div>
              </div>
              
              {/* Category Filters */}
              <div className={`${isFiltersOpen ? 'block' : 'hidden'} lg:block`}>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={!selectedCategory ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleCategoryChange('')}
                  >
                    Tous
                  </Button>
                  {data.popularTags.slice(0, 8).map((tag) => (
                    <Button
                      key={tag.name}
                      variant={selectedCategory === tag.name ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleCategoryChange(tag.name)}
                    >
                      {tag.name} ({tag.count})
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Active Filters */}
              {hasActiveFilters && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <span className="text-sm text-gray-600">Filtres actifs:</span>
                  {data.search && (
                    <Badge variant="default">
                      Recherche: "{data.search}"
                    </Badge>
                  )}
                  {data.category && (
                    <Badge variant="default">
                      Catégorie: {data.category}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="ml-auto"
                  >
                    Effacer les filtres
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            {data.total} conseil{data.total > 1 ? 's' : ''} trouvé{data.total > 1 ? 's' : ''}
            {data.search && ` pour "${data.search}"`}
          </p>
          {data.totalPages > 1 && (
            <p className="text-sm text-gray-500">
              Page {data.page} sur {data.totalPages}
            </p>
          )}
        </div>

        {/* Featured Articles (only on first page without filters) */}
        {data.page === 1 && !hasActiveFilters && data.featuredArticles.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Conseils les plus populaires</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {data.featuredArticles.map((article, index) => (
                <Card key={article.id} hover className="relative">
                  <div className="absolute top-4 left-4 z-10">
                    <Badge variant="warning" size="sm">
                      #{index + 1} Populaire
                    </Badge>
                  </div>
                  
                  <CardHeader className="pt-12">
                    <CardTitle className="text-lg line-clamp-2">
                      {article.title}
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {article.excerpt}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                      <span><ClockIcon className="inline h-3 w-3 mr-1" />{article.readingTime} min</span>
                      <span><EyeIcon className="inline h-3 w-3 mr-1" />{article.viewsCount.toLocaleString()} vues</span>
                    </div>
                    
                    <Link
                      to={`/blog/advice/${article.slug}`}
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium text-sm group"
                    >
                      Lire le guide complet
                      <span className="ml-1 group-hover:translate-x-0.5 transition-transform">→</span>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Articles Grid */}
        {displayedArticles.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {displayedArticles.map((article) => (
                <Card key={article.id} hover className="h-full flex flex-col">
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="default">
                        <WrenchIcon className="h-3 w-3 mr-1" />
                        Conseil
                      </Badge>
                    </div>
                    <CardTitle className="text-lg line-clamp-2 mb-2">
                      {article.title}
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-1">
                      {article.excerpt}
                    </p>
                    
                    <div className="space-y-4">
                      {/* Tags */}
                      {article.tags && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {article.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="secondary" size="sm">
                              {tag}
                            </Badge>
                          ))}
                          {article.tags.length > 3 && (
                            <Badge variant="secondary" size="sm">
                              +{article.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Meta info */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span><ClockIcon className="inline h-3 w-3 mr-1" />{article.readingTime} min de lecture</span>
                        <span><EyeIcon className="inline h-3 w-3 mr-1" />{article.viewsCount.toLocaleString()} vues</span>
                      </div>

                      {/* Read more button */}
                      <Link
                        to={`/blog/advice/${article.slug}`}
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium text-sm group"
                      >
                        Lire le conseil complet
                        <span className="ml-1 group-hover:translate-x-0.5 transition-transform">→</span>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    disabled={data.page <= 1 || isLoading}
                    onClick={() => handlePageChange(data.page - 1)}
                  >
                    {isLoading ? <LoadingSpinner className="h-4 w-4 mr-2" /> : null}
                    Précédent
                  </Button>
                  
                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(7, data.totalPages) }, (_, i) => {
                      let page;
                      if (data.totalPages <= 7) {
                        page = i + 1;
                      } else if (data.page <= 4) {
                        page = i + 1;
                      } else if (data.page >= data.totalPages - 3) {
                        page = data.totalPages - 6 + i;
                      } else {
                        page = data.page - 3 + i;
                      }
                      
                      return (
                        <Button
                          key={page}
                          variant={data.page === page ? "default" : "outline"}
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handlePageChange(page)}
                          className="min-w-[2.5rem]"
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button 
                    variant="outline" 
                    disabled={data.page >= data.totalPages || isLoading}
                    onClick={() => handlePageChange(data.page + 1)}
                  >
                    Suivant
                    {isLoading ? <LoadingSpinner className="h-4 w-4 ml-2" /> : null}
                  </Button>
                </div>
                
                <p className="text-sm text-gray-500">
                  Page {data.page} sur {data.totalPages}
                </p>
              </div>
            )}
          </>
        ) : (
          /* No Results */
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpenIcon className="h-8 w-8 text-gray-400" />
              </div>
              <CardTitle level="h3" className="text-xl mb-4">
                Aucun conseil trouvé
              </CardTitle>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {hasActiveFilters 
                  ? "Essayez de modifier vos critères de recherche ou parcourez tous nos conseils."
                  : "Il semble qu'il n'y ait aucun conseil disponible pour le moment."
                }
              </p>
              {hasActiveFilters && (
                <Button onClick={clearFilters}>
                  Voir tous les conseils
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
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
        `
      }} />
    </div>
  );
}
