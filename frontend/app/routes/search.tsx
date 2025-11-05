/**
 * 🔍 SEARCH ROUTE OPTIMISÉ v3.0 - Page de recherche principale améliorée
 * 
 * Fonctionnalités avancées:
 * - Recherche instantanée avec debounce
 * - Support multi-versions (V7/V8)
 * - Filtrage facetté intelligent
 * - Cache et performance optimisés
 * - Analytics et personnalisation
 * - Interface adaptative
 */

import { Badge } from "@fafa/ui";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams, useNavigate } from "@remix-run/react";
import { useState, useEffect } from "react";
import { NoResults } from "../components/search/NoResults";
import { SearchBar } from "../components/search/SearchBar";
import { SearchFilters } from "../components/search/SearchFilters";
import { SearchPagination } from "../components/search/SearchPagination";
import { SearchResultsEnhanced } from "../components/search/SearchResultsEnhanced";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";

// ===============================
// TYPES ET INTERFACES
// ===============================

interface SearchPageData {
  results: any | null;
  query: string;
  type: string;
  filters: Record<string, any>;
  version: 'v7' | 'v8';
  hasError: boolean;
  errorMessage?: string;
  performance: {
    loadTime: number;
    searchTime?: number;
    totalItems?: number;
  };
}

// ===============================
// LOADER FUNCTION - Optimisé
// ===============================

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams);
  
  // Extraction et validation des paramètres
  const query = searchParams.q?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const limit = Math.min(50, Math.max(10, parseInt(searchParams.limit || "20")));
  
  // Retour rapide si pas de requête
  if (!query) {
    return json<SearchPageData>({ 
      results: null, 
      query: "",
      type: "v8",
      version: "v8",
      filters: {},
      hasError: false,
      performance: {
        loadTime: Date.now() - startTime,
      }
    });
  }

  try {
    // ✅ APPEL DIRECT À L'ENDPOINT SEARCH-EXISTING (Enhanced avec tables PHP)
    const apiUrl = new URL('http://localhost:3000/api/search-existing/search');
    apiUrl.searchParams.set('query', query);
    apiUrl.searchParams.set('page', page.toString());
    apiUrl.searchParams.set('limit', limit.toString());
    
    // Ajouter filtres multi-valeurs (marque[], gamme[])
    const marqueValues = url.searchParams.getAll('marque');
    marqueValues.forEach(m => apiUrl.searchParams.append('marque', m));
    
    const gammeValues = url.searchParams.getAll('gamme');
    gammeValues.forEach(g => apiUrl.searchParams.append('gamme', g));
    
    // Autres filtres simples
    if (searchParams.priceMin) apiUrl.searchParams.set('priceMin', searchParams.priceMin);
    if (searchParams.priceMax) apiUrl.searchParams.set('priceMax', searchParams.priceMax);
    if (searchParams.inStock) apiUrl.searchParams.set('inStock', searchParams.inStock);
    
    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }
    
    const apiResponse = await response.json();
    
    // ✅ Extraire .data de la réponse encapsulée {success, data}
    const results = apiResponse.data || apiResponse;

    const loadTime = Date.now() - startTime;

    return json<SearchPageData>({ 
      results, 
      query,
      type: "v8",
      version: "v8",
      filters: searchParams,
      hasError: false,
      performance: {
        loadTime,
        searchTime: results?.executionTime || 0,
        totalItems: results?.total || 0,
      }
    });

  } catch (error) {
    console.error('Erreur lors de la recherche:', error);
    
    return json<SearchPageData>({
      results: null,
      query,
      type: "v8",
      version: "v8",
      filters: searchParams,
      hasError: true,
      errorMessage: error instanceof Error ? error.message : 'Erreur inconnue',
      performance: {
        loadTime: Date.now() - startTime,
      }
    });
  }
}

// ===============================
// COMPOSANT PRINCIPAL
// ===============================

export default function SearchPage() {
  const { 
    results, 
    query, 
    filters, 
    hasError, 
    errorMessage,
    performance 
  } = useLoaderData<typeof loader>();
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // États locaux pour l'interface
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [sortOption, setSortOption] = useState(searchParams.get('sort') || 'relevance');

  // Gestion du tri
  const handleSortChange = (newSort: string) => {
    setSortOption(newSort);
    const params = new URLSearchParams(searchParams);
    params.set('sort', newSort);
    params.set('page', '1'); // Reset à la première page
    navigate(`?${params.toString()}`, { replace: true });
  };

  // Sauvegarde des préférences dans localStorage
  useEffect(() => {
    localStorage.setItem('search_preferences', JSON.stringify({
      viewMode,
      sortOption,
    }));
  }, [viewMode, sortOption]);

  // Restauration des préférences
  useEffect(() => {
    try {
      const saved = localStorage.getItem('search_preferences');
      if (saved) {
        const prefs = JSON.parse(saved);
        setViewMode(prefs.viewMode || 'grid');
        setSortOption(prefs.sortOption || 'relevance');
      }
    } catch (error) {
      console.warn('Erreur lors du chargement des préférences:', error);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        
        {/* Breadcrumb */}
        <PublicBreadcrumb items={[{ label: "Recherche" }]} />
        
        {/* En-tête avec sélecteur de version */}
        <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Recherche</h1>
            {performance.totalItems !== undefined && (
              <Badge variant="info">
                {performance.totalItems.toLocaleString()} résultats
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Indicateur de performance */}
            <div className="text-xs text-gray-500">
              Chargement: {performance.loadTime}ms
              {performance.searchTime && ` • Recherche: ${performance.searchTime}ms`}
            </div>
          </div>
        </div>

        {/* Barre de recherche améliorée */}
        <div className="mb-6">
          <SearchBar 
            initialQuery={query}
            version="v8"
            placeholder="Rechercher une pièce, une référence, un véhicule..."
          />
        </div>

        {/* Gestion des erreurs */}
        {hasError && (
          <div className="mb-6 p-4 bg-destructive/5 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="text-red-600">⚠️</div>
              <div>
                <h3 className="font-semibold text-red-800">Erreur de recherche</h3>
                <p className="text-red-700 text-sm">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Zone de résultats */}
        {results && !hasError && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Sidebar des filtres */}
            <aside className={`lg:col-span-1 ${showFilters ? 'block' : 'hidden lg:block'}`}>
              <div className="sticky top-4">
                <SearchFilters 
                  facets={results.facets}
                  currentFilters={filters}
                  resultCount={results.total}
                  onFilterChange={(newFilters) => {
                    const params = new URLSearchParams();
                    Object.entries(newFilters).forEach(([key, value]) => {
                      if (value !== undefined && value !== null && value !== '') {
                        if (Array.isArray(value)) {
                          // Pour les arrays, ajouter chaque valeur séparément
                          value.forEach(v => params.append(key, String(v)));
                        } else {
                          params.set(key, String(value));
                        }
                      }
                    });
                    if (query) params.set('q', query);
                    navigate(`?${params.toString()}`);
                  }}
                />
              </div>
            </aside>

            {/* Zone principale des résultats */}
            <main className="lg:col-span-3">
              
              {/* En-tête des résultats */}
              <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold truncate">
                      {(results.total || 0).toLocaleString()} résultats pour "{query}"
                    </h2>
                    <div className="text-sm text-gray-600 mt-1 flex items-center gap-4">
                      <span>Recherche Enhanced</span>
                      <span>•</span>
                      <span>{results.executionTime || 0}ms</span>
                    </div>
                  </div>
                  
                  {/* Contrôles d'affichage */}
                  <div className="flex items-center gap-4">
                    
                    {/* Bouton toggle filtres (mobile) */}
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="lg:hidden px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
                    >
                      Filtres {showFilters ? '✕' : '☰'}
                    </button>
                    
                    {/* Mode d'affichage */}
                    <div className="flex rounded-md shadow-sm">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`px-3 py-2 text-sm ${
                          viewMode === 'grid' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        } rounded-l-md border border-gray-300`}
                        title="Vue en grille"
                      >
                        ⚏
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-2 text-sm ${
                          viewMode === 'list' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        } rounded-r-md border-l-0 border border-gray-300`}
                        title="Vue en liste"
                      >
                        ☰
                      </button>
                    </div>

                    {/* Sélecteur de tri */}
                    <select 
                      value={sortOption}
                      onChange={(e) => handleSortChange(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="relevance">Pertinence</option>
                      <option value="price_asc">Prix croissant</option>
                      <option value="price_desc">Prix décroissant</option>
                      <option value="name_asc">Nom A-Z</option>
                      <option value="name_desc">Nom Z-A</option>
                      <option value="date_desc">Plus récent</option>
                      <option value="popularity">Popularité</option>
                      <option value="rating">Note client</option>
                    </select>
                  </div>
                </div>

                {/* Suggestions intelligentes */}
                {results.suggestions && results.suggestions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">
                      Essayez aussi :
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {results.suggestions.map((suggestion: string, index: number) => (
                        <a
                          key={`${suggestion}-${index}`}
                          href={`?q=${encodeURIComponent(suggestion)}`}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm transition-colors duration-200"
                        >
                          {suggestion}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Résultats de recherche avec design amélioré */}
              <SearchResultsEnhanced 
                items={results.items}
                viewMode={viewMode}
                isCached={results.cached || false}
                executionTime={results.executionTime}
                onItemClick={(_item) => {
                  // Analytics: track click (à implémenter)
                  // if (results.sessionId) {
                  //   searchApi.trackEvent({
                  //     sessionId: results.sessionId,
                  //     event: 'result_click',
                  //     data: { itemId: item.id, position: item.position }
                  //   }).catch(console.error);
                  // }
                }}
              />

              {/* Pagination intelligente */}
              {results.total > (parseInt(searchParams.get('limit') || '20')) && (
                <div className="mt-8">
                  <SearchPagination 
                    current={parseInt(searchParams.get('page') || '1')}
                    total={Math.ceil(results.total / (parseInt(searchParams.get('limit') || '20')))}
                    onPageChange={(page) => {
                      const params = new URLSearchParams(searchParams);
                      params.set('page', page.toString());
                      navigate(`?${params.toString()}`);
                      
                      // Scroll vers le haut
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    showQuickJump={results.total > 200}
                  />
                </div>
              )}
            </main>
          </div>
        )}

        {/* Aucun résultat */}
        {results && results.total === 0 && !hasError && (
          <NoResults 
            query={query} 
            suggestions={results.suggestions}
            searchTips={[
              "Vérifiez l'orthographe de votre recherche",
              "Essayez des termes plus généraux",
              "Utilisez des synonymes ou termes alternatifs",
              "Retirez certains filtres pour élargir votre recherche"
            ]}
            onSuggestionClick={(suggestion) => {
              const params = new URLSearchParams();
              params.set('q', suggestion);
              navigate(`?${params.toString()}`);
            }}
          />
        )}

        {/* Message d'accueil (pas de recherche) */}
        {!query && !hasError && (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-2xl font-semibold mb-2">Recherchez des pièces automobiles</h2>
              <p className="text-gray-600 mb-6">
                Utilisez la barre de recherche ci-dessus pour trouver des pièces par référence, 
                véhicule compatible, ou description.
              </p>
              <div className="text-sm text-gray-500">
                <p>💡 <strong>Astuce :</strong> Essayez une recherche comme "filtre huile renault clio" ou "WL7129"</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
