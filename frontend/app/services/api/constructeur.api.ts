/**
 * API Client pour les constructeurs automobiles
 * Service optimisé pour gérer les données constructeurs avec cache intelligent
 */

const API_BASE_URL = typeof window !== 'undefined' && window.ENV?.API_BASE_URL 
  ? window.ENV.API_BASE_URL 
  : "http://localhost:3000";

export interface ConstructeurFilters {
  search?: string;
  brand?: string;
  letter?: string;
  popular?: boolean;
  limit?: number;
  page?: number;
  sortBy?: 'name' | 'views' | 'date' | 'models' | 'alpha';
  sortOrder?: 'asc' | 'desc';
  hasModels?: boolean;
  withStats?: boolean;
}

export interface ConstructeurArticle {
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
  brand: string;
  modelsCount: number;
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

export interface ConstructeurStats {
  total: number;
  totalViews: number;
  avgViews: number;
  totalModels: number;
}

export interface ConstructeurResponse {
  success: boolean;
  data: {
    constructeurs: ConstructeurArticle[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    filters: ConstructeurFilters;
    stats?: ConstructeurStats;
  };
  error?: string;
}

class ConstructeurApiService {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  private getCacheKey(filters: ConstructeurFilters): string {
    const normalized = {
      ...filters,
      page: filters.page || 1,
      limit: filters.limit || 24
    };
    return `constructeurs:${JSON.stringify(normalized, Object.keys(normalized).sort())}`;
  }

  private isValidCache(entry: { timestamp: number; ttl: number }): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private calculateTTL(hasStats: boolean, resultsCount: number): number {
    if (hasStats) return 5 * 60 * 1000; // 5 minutes pour les stats
    if (resultsCount > 50) return 10 * 60 * 1000; // 10 minutes pour beaucoup de résultats
    return 15 * 60 * 1000; // 15 minutes standard
  }

  /**
   * Récupère la liste des constructeurs avec filtres
   */
  async getConstructeurs(filters: ConstructeurFilters = {}): Promise<ConstructeurResponse> {
    try {
      const cacheKey = this.getCacheKey(filters);
      const cached = this.cache.get(cacheKey);

      if (cached && this.isValidCache(cached)) {
        console.log('[CACHE HIT] Constructeurs:', cacheKey);
        return cached.data;
      }

      const queryParams = new URLSearchParams();
      
      // Paramètres de base
      queryParams.set('page', (filters.page || 1).toString());
      queryParams.set('limit', (filters.limit || 24).toString());
      
      // Filtres optionnels
      if (filters.search) queryParams.set('search', filters.search);
      if (filters.brand) queryParams.set('brand', filters.brand);
      if (filters.letter) queryParams.set('letter', filters.letter);
      if (filters.sortBy) queryParams.set('sortBy', filters.sortBy);
      if (filters.sortOrder) queryParams.set('sortOrder', filters.sortOrder);
      if (filters.popular) queryParams.set('popular', 'true');
      if (filters.hasModels) queryParams.set('hasModels', 'true');
      if (filters.withStats) queryParams.set('withStats', 'true');

      const url = `${API_BASE_URL}/api/blog/constructeurs?${queryParams}`;
      console.log('[API CALL] Constructeurs:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ConstructeurResponse = await response.json();

      // Mise en cache avec TTL intelligent
      const ttl = this.calculateTTL(!!filters.withStats, data.data?.constructeurs?.length || 0);
      this.cache.set(cacheKey, { 
        data, 
        timestamp: Date.now(), 
        ttl 
      });

      console.log('[CACHE SET] Constructeurs:', cacheKey, `TTL: ${ttl/1000}s`);
      return data;

    } catch (error) {
      console.error('[ERROR] Constructeurs API:', error);
      throw error;
    }
  }

  /**
   * Récupère les données pour la page d'accueil constructeurs
   * Combine constructeurs populaires et articles en vedette
   */
  async getConstructeursHome(): Promise<{
    brands: ConstructeurArticle[];
    featured: ConstructeurArticle[];
    stats: ConstructeurStats;
  }> {
    try {
      const cacheKey = 'constructeurs:home';
      const cached = this.cache.get(cacheKey);

      if (cached && this.isValidCache(cached)) {
        console.log('[CACHE HIT] Constructeurs Home:', cacheKey);
        return cached.data;
      }

      // Récupération parallèle des données
      const [brandsResponse, featuredResponse] = await Promise.all([
        this.getConstructeurs({ 
          limit: 24, 
          sortBy: 'name', 
          withStats: true 
        }),
        this.getConstructeurs({ 
          limit: 6, 
          sortBy: 'views', 
          popular: true 
        })
      ]);

      const result = {
        brands: brandsResponse.data?.constructeurs || [],
        featured: featuredResponse.data?.constructeurs || [],
        stats: brandsResponse.data?.stats || {
          total: 0,
          totalViews: 0,
          avgViews: 0,
          totalModels: 0
        }
      };

      // Cache pour 10 minutes
      this.cache.set(cacheKey, { 
        data: result, 
        timestamp: Date.now(), 
        ttl: 10 * 60 * 1000 
      });

      return result;

    } catch (error) {
      console.error('[ERROR] Constructeurs Home API:', error);
      return {
        brands: [],
        featured: [],
        stats: { total: 0, totalViews: 0, avgViews: 0, totalModels: 0 }
      };
    }
  }

  /**
   * Récupère un constructeur spécifique par slug
   */
  async getConstructeurBySlug(slug: string): Promise<ConstructeurArticle | null> {
    try {
      const cacheKey = `constructeur:slug:${slug}`;
      const cached = this.cache.get(cacheKey);

      if (cached && this.isValidCache(cached)) {
        console.log('[CACHE HIT] Constructeur:', slug);
        return cached.data;
      }

      const url = `${API_BASE_URL}/api/blog/constructeurs/${slug}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const constructeur = data.success ? data.data : null;

      // Cache pour 30 minutes (article individuel)
      this.cache.set(cacheKey, { 
        data: constructeur, 
        timestamp: Date.now(), 
        ttl: 30 * 60 * 1000 
      });

      return constructeur;

    } catch (error) {
      console.error('[ERROR] Constructeur by slug API:', error);
      return null;
    }
  }

  /**
   * Recherche constructeurs avec suggestions
   */
  async searchConstructeurs(query: string, limit: number = 10): Promise<ConstructeurArticle[]> {
    try {
      if (!query.trim()) return [];

      const cacheKey = `search:${query.toLowerCase().trim()}:${limit}`;
      const cached = this.cache.get(cacheKey);

      if (cached && this.isValidCache(cached)) {
        console.log('[CACHE HIT] Search Constructeurs:', query);
        return cached.data;
      }

      const response = await this.getConstructeurs({
        search: query,
        limit,
        sortBy: 'views'
      });

      const results = response.data?.constructeurs || [];

      // Cache pour 5 minutes (recherche)
      this.cache.set(cacheKey, { 
        data: results, 
        timestamp: Date.now(), 
        ttl: 5 * 60 * 1000 
      });

      return results;

    } catch (error) {
      console.error('[ERROR] Search Constructeurs API:', error);
      return [];
    }
  }

  /**
   * Récupère les lettres disponibles pour navigation alphabétique
   */
  async getAvailableLetters(): Promise<string[]> {
    try {
      const cacheKey = 'constructeurs:letters';
      const cached = this.cache.get(cacheKey);

      if (cached && this.isValidCache(cached)) {
        return cached.data;
      }

      const url = `${API_BASE_URL}/api/blog/constructeurs/letters`;
      const response = await fetch(url);

      if (!response.ok) {
        // Fallback: générer A-Z
        return Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
      }

      const data = await response.json();
      const letters = data.success ? data.data : [];

      // Cache pour 1 heure
      this.cache.set(cacheKey, { 
        data: letters, 
        timestamp: Date.now(), 
        ttl: 60 * 60 * 1000 
      });

      return letters;

    } catch (error) {
      console.error('[ERROR] Available Letters API:', error);
      // Fallback: générer A-Z
      return Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
    }
  }

  /**
   * Nettoie le cache (utile pour les tests)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[CACHE CLEARED] Constructeurs cache cleared');
  }

  /**
   * Retourne les statistiques du cache
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export de l'instance singleton
export const constructeurApi = new ConstructeurApiService();
