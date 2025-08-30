/**
 * 🚀 TEMPLATE SERVICE OPTIMISÉ UNIVERSEL
 * 
 * Template réutilisable pour optimiser n'importe quel service du projet
 * Intègre toutes les optimisations des BlogService et ConstructeurService
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

// Interfaces génériques réutilisables
export interface UniversalFilters<T = any> {
  search?: string;
  sortBy?: keyof T;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  dateRange?: { from: Date; to: Date };
  popularity?: 'high' | 'medium' | 'low';
  tags?: string[];
  minScore?: number;
  withRelations?: boolean;
  customFilters?: Record<string, any>;
}

export interface UniversalStats {
  total: number;
  totalViews: number;
  avgViews: number;
  mostPopular: any[];
  recentlyUpdated: any[];
  performance: {
    cacheHitRate: number;
    avgResponseTime: number;
    totalRequests: number;
  };
}

export interface SearchResult<T> {
  results: T[];
  total: number;
  suggestions?: string[];
  searchTime: number;
}

/**
 * 🏭 Classe de base optimisée pour tous les services
 */
@Injectable()
export abstract class OptimizedBaseService {
  protected readonly logger = new Logger(this.constructor.name);
  
  // Métriques de performance intégrées
  protected performanceMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    avgResponseTime: 0,
  };

  constructor(
    @Inject(CACHE_MANAGER) protected cacheManager: Cache,
    protected configService?: ConfigService,
  ) {}

  // MÉTHODES UTILITAIRES RÉUTILISABLES

  /**
   * 🔑 Construction de clés de cache intelligentes
   */
  protected buildCacheKey(prefix: string, params: any): string {
    const sortedParams = JSON.stringify(params, Object.keys(params).sort());
    const hash = Buffer.from(sortedParams).toString('base64').slice(0, 16);
    return `${prefix}:${hash}`;
  }

  /**
   * ⚡ TTL intelligent basé sur la popularité
   */
  protected calculateIntelligentTTL(
    avgViews: number = 0, 
    totalItems: number = 0
  ): number {
    if (avgViews > 5000) return 300;   // 5min - très populaire
    if (avgViews > 2000) return 900;   // 15min - populaire
    if (avgViews > 1000) return 1800;  // 30min - modéré
    if (totalItems > 100) return 3600; // 1h - beaucoup d'items
    return 7200; // 2h - standard
  }

  /**
   * 🚀 Transformation parallèle optimisée
   */
  protected async transformItemsParallel<T, R>(
    items: T[],
    transformer: (item: T) => Promise<R>,
    concurrency: number = 5
  ): Promise<R[]> {
    const results: R[] = [];
    
    // Traitement par chunks pour éviter la surcharge
    const chunks = this.chunkArray(items, concurrency);
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (item) => {
        try {
          const transformed = await transformer(item);
          if (transformed) results.push(transformed);
        } catch (error) {
          this.logger.warn(
            `⚠️ Erreur transformation: ${(error as Error).message}`
          );
        }
      });
      
      await Promise.allSettled(promises);
    }
    
    return results;
  }

  /**
   * 📊 Mise à jour des métriques de performance
   */
  protected updatePerformanceMetrics(
    startTime: number, 
    cacheHit: boolean = false
  ): void {
    const responseTime = Date.now() - startTime;
    this.performanceMetrics.totalRequests += 1;
    
    if (cacheHit) this.performanceMetrics.cacheHits += 1;
    
    // Moyenne mobile
    this.performanceMetrics.avgResponseTime = 
      (this.performanceMetrics.avgResponseTime + responseTime) / 2;
  }

  /**
   * 🔍 Recherche avancée avec suggestions
   */
  protected async performAdvancedSearch<T>(
    searchTerm: string,
    searchFunction: (term: string) => Promise<T[]>,
    suggestionFunction?: (term: string) => Promise<string[]>
  ): Promise<SearchResult<T>> {
    const startTime = Date.now();
    
    if (!searchTerm || searchTerm.length < 2) {
      return { results: [], total: 0, searchTime: 0 };
    }

    try {
      // Recherche principale
      const results = await searchFunction(searchTerm);
      
      // Suggestions si peu de résultats
      let suggestions: string[] = [];
      if (results.length < 5 && suggestionFunction) {
        suggestions = await suggestionFunction(searchTerm);
      }

      const searchTime = Date.now() - startTime;
      
      return {
        results,
        total: results.length,
        suggestions,
        searchTime,
      };
    } catch (error) {
      this.logger.error(`❌ Erreur recherche: ${(error as Error).message}`);
      return { 
        results: [], 
        total: 0, 
        searchTime: Date.now() - startTime 
      };
    }
  }

  /**
   * 🎯 Application de filtres universels
   */
  protected applyUniversalFilters<T>(
    query: any, // Requête Supabase ou autre
    filters: UniversalFilters<T>
  ): any {
    let filteredQuery = query;

    // Recherche textuelle
    if (filters.search) {
      const searchFilter = this.buildSearchFilter(filters.search);
      filteredQuery = filteredQuery.or(searchFilter);
    }

    // Tri
    if (filters.sortBy) {
      const ascending = (filters.sortOrder || 'asc') === 'asc';
      filteredQuery = filteredQuery.order(
        filters.sortBy as string, 
        { ascending }
      );
    }

    // Pagination
    if (filters.limit && filters.offset !== undefined) {
      filteredQuery = filteredQuery.range(
        filters.offset, 
        filters.offset + filters.limit - 1
      );
    }

    // Filtres de date
    if (filters.dateRange) {
      filteredQuery = filteredQuery
        .gte('created_at', filters.dateRange.from.toISOString())
        .lte('created_at', filters.dateRange.to.toISOString());
    }

    return filteredQuery;
  }

  /**
   * 📈 Génération de statistiques universelles
   */
  protected async generateUniversalStats(
    dataFetcher: () => Promise<any[]>,
    popularItemsFetcher: () => Promise<any[]>
  ): Promise<UniversalStats> {
    const startTime = Date.now();
    const cacheKey = 'universal_stats';

    try {
      const cached = await this.cacheManager.get<UniversalStats>(cacheKey);
      if (cached) {
        this.updatePerformanceMetrics(startTime, true);
        return cached;
      }

      const [allItems, popularItems] = await Promise.all([
        dataFetcher(),
        popularItemsFetcher(),
      ]);

      const totalViews = allItems.reduce((sum, item) => 
        sum + (parseInt(item.views || '0') || 0), 0
      );
      const avgViews = Math.round(totalViews / allItems.length);

      // Calcul taux de cache hit
      const cacheHitRate = this.performanceMetrics.totalRequests > 0
        ? Math.round(
            (this.performanceMetrics.cacheHits / 
             this.performanceMetrics.totalRequests) * 100
          ) / 100
        : 0;

      const stats: UniversalStats = {
        total: allItems.length,
        totalViews,
        avgViews,
        mostPopular: popularItems.slice(0, 5),
        recentlyUpdated: allItems
          .sort((a, b) => new Date(b.updated_at || 0).getTime() - 
                          new Date(a.updated_at || 0).getTime())
          .slice(0, 5),
        performance: {
          cacheHitRate,
          avgResponseTime: Math.round(this.performanceMetrics.avgResponseTime),
          totalRequests: this.performanceMetrics.totalRequests,
        },
      };

      // Cache avec TTL intelligent
      const ttl = this.calculateIntelligentTTL(avgViews, allItems.length);
      await this.cacheManager.set(cacheKey, stats, ttl * 1000);

      this.updatePerformanceMetrics(startTime, false);
      return stats;
      
    } catch (error) {
      this.logger.error(`❌ Erreur stats: ${(error as Error).message}`);
      this.updatePerformanceMetrics(startTime, false);
      
      return {
        total: 0,
        totalViews: 0,
        avgViews: 0,
        mostPopular: [],
        recentlyUpdated: [],
        performance: {
          cacheHitRate: 0,
          avgResponseTime: 0,
          totalRequests: 0,
        },
      };
    }
  }

  // MÉTHODES UTILITAIRES PRIVÉES

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private buildSearchFilter(searchTerm: string): string {
    // À personnaliser selon le service
    const cleanTerm = searchTerm.toLowerCase().trim();
    return `title.ilike.%${cleanTerm}%,content.ilike.%${cleanTerm}%,keywords.ilike.%${cleanTerm}%`;
  }
}

/**
 * 🎯 Interface pour services spécialisés
 */
export interface OptimizedServiceInterface<T, F extends UniversalFilters<T> = UniversalFilters<T>> {
  getAll(filters?: F): Promise<{ items: T[]; total: number }>;
  getById(id: string | number): Promise<T | null>;
  search(query: string, options?: any): Promise<SearchResult<T>>;
  getStats(): Promise<UniversalStats>;
  getPopular(limit?: number): Promise<T[]>;
}
