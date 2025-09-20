/**
 * 🔍 SEARCH API SERVICE - Version Enterprise v3.0
 * 
 * Service client pour interfacer avec le SearchService backend optimisé
 * Compatible avec toutes les fonctionnalités v3.0
 */

import { useState, useEffect, useCallback } from 'react';

export interface SearchParams {
  query: string;
  type?: 'v7' | 'v8' | 'text' | 'vin' | 'mine' | 'reference' | 'instant';
  filters?: {
    brandId?: number;
    categoryId?: number;
    priceMin?: number;
    priceMax?: number;
    inStock?: boolean;
    compatibility?: {
      make?: string;
      model?: string;
      year?: number;
      engine?: string;
    };
  };
  sort?: {
    field: 'relevance' | 'price' | 'name' | 'date';
    order: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    limit: number;
  };
  options?: {
    highlight?: boolean;
    facets?: boolean;
    suggestions?: boolean;
    useAI?: boolean;
    fuzzySearch?: boolean;
    synonyms?: boolean;
  };
}

export interface SearchResult {
  version?: string;
  items: any[];
  total: number;
  page: number;
  limit: number;
  suggestions?: string[];
  facets?: Record<string, any>;
  vehicle?: any;
  message?: string;
  executionTime?: number;
  fromCache?: boolean;
}

export interface InstantSearchResult {
  suggestions: string[];
  products: Array<{
    id: string;
    reference: string;
    designation: string;
    price: number;
    image?: string;
    type: 'product' | 'vehicle';
  }>;
  query: string;
}

class SearchApiService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '') {
    // Utiliser l'URL de l'environnement ou valeur par défaut
    this.baseUrl = baseUrl || 
      (typeof window !== 'undefined' 
        ? window.ENV?.API_BASE_URL || '' 
        : 'http://localhost:3000'); // Valeur par défaut côté serveur
  }

  /**
   * 🔍 Recherche principale avec toutes les fonctionnalités
   */
  async search(params: SearchParams, userId?: string): Promise<SearchResult> {
    const url = new URL(`${this.baseUrl}/api/search`);
    
    // Construire les paramètres de requête
    this.buildSearchParams(url, params, userId);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(userId && { 'X-User-ID': userId }),
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur de recherche: ${response.status} ${response.statusText}`);
    }

    const result: SearchResult = await response.json();
    
    // Enrichir avec métadonnées côté client si nécessaire
    return this.enrichSearchResult(result, params);
  }

  /**
   * ⚡ Recherche instantanée ultra-rapide
   */
  async instantSearch(query: string): Promise<InstantSearchResult> {
    if (!query || query.length < 2) {
      return { suggestions: [], products: [], query };
    }

    const url = new URL(`${this.baseUrl}/api/search/instant`);
    url.searchParams.set('q', query);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Instant search failed: ${response.status}`);
      return { suggestions: [], products: [], query };
    }

    const result = await response.json();
    
    return {
      suggestions: result.suggestions || [],
      products: result.items?.map((item: any) => ({
        id: item.id,
        reference: item.reference || `${item.brand} ${item.model}`,
        designation: item.designation || `${item.brand} ${item.model} ${item.year || ''}`,
        price: item.price || 0,
        image: item.image,
        type: item.source || item.type || 'product',
      })) || [],
      query,
    };
  }

  /**
   * 🚗 Recherche par code MINE
   */
  async searchByMine(mineCode: string): Promise<{
    vehicle: any;
    parts: any[];
    count: number;
  }> {
    const url = new URL(`${this.baseUrl}/api/search/mine/${encodeURIComponent(mineCode)}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Recherche MINE échouée: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 🔧 Recherche par numéro VIN
   */
  async searchByVin(vinCode: string): Promise<SearchResult> {
    return this.search({
      query: vinCode,
      type: 'vin',
      options: {
        facets: true,
        suggestions: true,
      },
    });
  }

  /**
   * 📄 Récupérer fiche produit complète
   */
  async getProductSheet(reference: string): Promise<any> {
    const url = new URL(`${this.baseUrl}/api/search/product/${encodeURIComponent(reference)}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Fiche produit introuvable: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 📊 Statistiques de recherche (admin)
   */
  async getSearchStats(): Promise<any> {
    const url = new URL(`${this.baseUrl}/api/search/stats`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Statistiques indisponibles: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 🔍 Recherche avec filtres avancés pour interface admin
   */
  async advancedSearch(params: {
    query: string;
    category?: 'all' | 'vehicles' | 'products' | 'pages';
    page?: number;
    limit?: number;
    filters?: Record<string, any>;
  }): Promise<SearchResult> {
    return this.search({
      query: params.query,
      type: 'v8',
      pagination: { 
        page: params.page || 1, 
        limit: params.limit || 20 
      },
      filters: params.filters,
      options: {
        facets: true,
        suggestions: true,
        highlight: true,
        useAI: true,
      },
    });
  }

  /**
   * 🔧 MÉTHODES UTILITAIRES PRIVÉES
   */

  private buildSearchParams(url: URL, params: SearchParams, userId?: string): void {
    // Paramètres de base
    url.searchParams.set('q', params.query);
    if (params.type) url.searchParams.set('type', params.type);
    if (userId) url.searchParams.set('userId', userId);

    // Pagination
    if (params.pagination?.page) {
      url.searchParams.set('page', params.pagination.page.toString());
    }
    if (params.pagination?.limit) {
      url.searchParams.set('limit', params.pagination.limit.toString());
    }

    // Filtres
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object' && key === 'compatibility') {
            // Filtres de compatibilité véhicule
            Object.entries(value).forEach(([subKey, subValue]) => {
              if (subValue !== undefined && subValue !== null) {
                url.searchParams.set(`compatibility.${subKey}`, subValue.toString());
              }
            });
          } else {
            url.searchParams.set(key, value.toString());
          }
        }
      });
    }

    // Tri
    if (params.sort) {
      url.searchParams.set('sortField', params.sort.field);
      url.searchParams.set('sortOrder', params.sort.order);
    }

    // Options
    if (params.options) {
      Object.entries(params.options).forEach(([key, value]) => {
        if (value === true) {
          url.searchParams.set(key, 'true');
        }
      });
    }
  }

  private enrichSearchResult(result: SearchResult, params: SearchParams): SearchResult {
    // Ajouter des métadonnées côté client
    const enriched = {
      ...result,
      searchParams: params,
      clientTimestamp: new Date().toISOString(),
    };

    // Traitement des highlights côté client si nécessaire
    if (params.options?.highlight && result.items) {
      enriched.items = result.items.map(item => ({
        ...item,
        clientHighlights: this.generateClientHighlights(item, params.query),
      }));
    }

    return enriched;
  }

  private generateClientHighlights(item: any, query: string): string[] {
    const highlights: string[] = [];
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    
    const fields = [
      item.designation, 
      item.description, 
      item.brand, 
      item.model, 
      item.reference
    ];

    fields.forEach(field => {
      if (field && typeof field === 'string') {
        let highlightedText = field;
        let hasMatch = false;

        terms.forEach(term => {
          if (field.toLowerCase().includes(term)) {
            const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
            hasMatch = true;
          }
        });

        if (hasMatch) {
          highlights.push(highlightedText);
        }
      }
    });

    return highlights;
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 🔄 MÉTHODES DE COMPATIBILITÉ
   */

  // Pour compatibilité avec ancien code
  async legacySearch(query: string, options: any = {}): Promise<any[]> {
    const result = await this.search({
      query,
      type: 'v8',
      ...options,
    });

    return result.items;
  }
}

// Export singleton
export const searchApi = new SearchApiService();

// Export class pour injection custom
export { SearchApiService };

/**
 * 🎯 HOOKS REMIX POUR RECHERCHE
 */

/**
 * Hook pour recherche avec debounce
 */
export function useSearchWithDebounce(
  initialQuery: string = '',
  delay: number = 300
) {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, delay);

    return () => clearTimeout(timer);
  }, [query, delay]);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) return [];

    setIsSearching(true);
    try {
      const result = await searchApi.instantSearch(searchQuery);
      return result.products;
    } finally {
      setIsSearching(false);
    }
  }, []);

  return {
    query,
    setQuery,
    debouncedQuery,
    isSearching,
    search,
  };
}

/**
 * Hook pour gestion état de recherche
 */
export function useSearchState() {
  const [searchParams, setSearchParams] = useState<SearchParams>({
    query: '',
    type: 'v8',
    pagination: { page: 1, limit: 20 },
    options: { highlight: true, facets: true, suggestions: true },
  });

  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearch = useCallback(async () => {
    if (!searchParams.query) {
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await searchApi.search(searchParams);
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de recherche');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  return {
    searchParams,
    setSearchParams,
    results,
    loading,
    error,
    performSearch,
  };
}
