/**
 * 🚗 VEHICLE SEARCH SERVICE - Version Meilisearch v3.0
 * 
 * Service de recherche spécialisé pour les véhicules utilisant Meilisearch
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeilisearchService } from './meilisearch.service';
import { SearchCacheService } from './search-cache.service';

export interface VehicleSearchFilters {
  brand?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  mileageMax?: number;
  fuelType?: string[];
  transmission?: string[];
  availability?: string;
}

export interface VehicleSearchResult {
  items: VehicleSearchResultItem[];
  total: number;
  page: number;
  limit: number;
  facets?: Record<string, any>;
  suggestions?: string[];
  executionTime: number;
}

export interface VehicleSearchResultItem {
  id: string;
  brand: string;
  model: string;
  year: number;
  price?: number;
  mileage?: number;
  fuelType?: string;
  transmission?: string;
  description?: string;
  images?: string[];
  availability?: string;
  relevanceScore?: number;
}

@Injectable()
export class VehicleSearchService {
  private readonly logger = new Logger(VehicleSearchService.name);
  private readonly vehicleIndex = 'vehicles';

  constructor(
    private readonly meilisearch: MeilisearchService,
    private readonly cache: SearchCacheService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 🔍 Recherche véhicules avec Meilisearch
   */
  async searchVehicles(params: {
    query?: string;
    filters?: VehicleSearchFilters;
    page?: number;
    limit?: number;
  }): Promise<VehicleSearchResult> {
    const startTime = Date.now();
    const cacheKey = `vehicles:${JSON.stringify(params)}`;

    try {
      // Vérifier le cache d'abord
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit pour recherche véhicules: ${params.query}`);
        return cached;
      }

      // Préparer les paramètres de recherche Meilisearch
      const searchParams = this.buildMeilisearchQuery(params);
      
      // Effectuer la recherche
      const response = await this.meilisearch.search(
        this.vehicleIndex,
        params.query || '',
        searchParams
      );

      // Formater les résultats
      const result: VehicleSearchResult = {
        items: response.hits.map(hit => this.formatVehicleItem(hit)),
        total: response.estimatedTotalHits || 0,
        page: params.page || 1,
        limit: params.limit || 20,
        facets: response.facetDistribution,
        suggestions: [], // Générer des suggestions si nécessaire
        executionTime: Date.now() - startTime,
      };

      // Mettre en cache le résultat
      await this.cache.set(cacheKey, result, 300); // 5 minutes

      this.logger.log(`Recherche véhicules terminée: ${result.total} résultats en ${result.executionTime}ms`);
      
      return result;

    } catch (error) {
      this.logger.error('Erreur lors de la recherche véhicules:', error);
      return {
        items: [],
        total: 0,
        page: params.page || 1,
        limit: params.limit || 20,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 🏗️ Construction des paramètres de recherche Meilisearch
   */
  private buildMeilisearchQuery(params: {
    query?: string;
    filters?: VehicleSearchFilters;
    page?: number;
    limit?: number;
  }) {
    const searchParams: any = {
      limit: params.limit || 20,
      offset: ((params.page || 1) - 1) * (params.limit || 20),
      attributesToRetrieve: [
        'id', 'brand', 'model', 'year', 'price', 'mileage', 
        'fuelType', 'transmission', 'description', 'images', 'availability'
      ],
      facets: ['brand', 'model', 'year', 'fuelType', 'transmission'],
      attributesToHighlight: ['brand', 'model', 'description'],
    };

    // Construire les filtres Meilisearch
    const filters: string[] = [];
    
    if (params.filters) {
      const { filters: f } = params;
      
      if (f.brand) {
        filters.push(`brand = "${f.brand}"`);
      }
      
      if (f.model) {
        filters.push(`model = "${f.model}"`);
      }
      
      if (f.yearMin) {
        filters.push(`year >= ${f.yearMin}`);
      }
      
      if (f.yearMax) {
        filters.push(`year <= ${f.yearMax}`);
      }
      
      if (f.priceMin) {
        filters.push(`price >= ${f.priceMin}`);
      }
      
      if (f.priceMax) {
        filters.push(`price <= ${f.priceMax}`);
      }
      
      if (f.mileageMax) {
        filters.push(`mileage <= ${f.mileageMax}`);
      }
      
      if (f.fuelType && f.fuelType.length > 0) {
        const fuelFilters = f.fuelType.map(fuel => `fuelType = "${fuel}"`);
        filters.push(`(${fuelFilters.join(' OR ')})`);
      }
      
      if (f.transmission && f.transmission.length > 0) {
        const transFilters = f.transmission.map(trans => `transmission = "${trans}"`);
        filters.push(`(${transFilters.join(' OR ')})`);
      }
      
      if (f.availability) {
        filters.push(`availability = "${f.availability}"`);
      }
    }

    if (filters.length > 0) {
      searchParams.filter = filters.join(' AND ');
    }

    return searchParams;
  }

  /**
   * 🎨 Formatage des résultats de véhicule
   */
  private formatVehicleItem(hit: any): VehicleSearchResultItem {
    return {
      id: hit.id,
      brand: hit.brand,
      model: hit.model,
      year: hit.year,
      price: hit.price,
      mileage: hit.mileage,
      fuelType: hit.fuelType,
      transmission: hit.transmission,
      description: hit.description,
      images: hit.images || [],
      availability: hit.availability,
      relevanceScore: hit._rankingScore,
    };
  }

  /**
   * 🔍 Recherche par numéro MINE ou VIN
   */
  async searchByMineOrVin(params: {
    mine?: string;
    vin?: string;
    page?: number;
    limit?: number;
  }): Promise<VehicleSearchResult> {
    const startTime = Date.now();

    try {
      let query = '';
      const filters: string[] = [];

      if (params.mine) {
        filters.push(`mine = "${params.mine}"`);
        query = params.mine;
      }

      if (params.vin) {
        filters.push(`vin = "${params.vin}"`);
        query = params.vin;
      }

      const searchParams = {
        limit: params.limit || 20,
        offset: ((params.page || 1) - 1) * (params.limit || 20),
        filter: filters.join(' OR '),
        attributesToRetrieve: [
          'id', 'brand', 'model', 'year', 'mine', 'vin',
          'engineCode', 'powerKw', 'cylinderCapacity', 'description'
        ],
      };

      const response = await this.meilisearch.search(
        'vehicles_technical',
        query,
        searchParams
      );

      return {
        items: response.hits.map(hit => this.formatVehicleItem(hit)),
        total: response.estimatedTotalHits || 0,
        page: params.page || 1,
        limit: params.limit || 20,
        executionTime: Date.now() - startTime,
      };

    } catch (error) {
      this.logger.error('Erreur recherche MINE/VIN:', error);
      return {
        items: [],
        total: 0,
        page: params.page || 1,
        limit: params.limit || 20,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 📊 Obtenir les statistiques des véhicules
   */
  async getVehicleStats(): Promise<{
    totalVehicles: number;
    brandCount: number;
    averagePrice: number;
    latestYear: number;
  }> {
    try {
      const stats = await this.meilisearch.getIndexStats(this.vehicleIndex);
      
      // Recherche pour obtenir des facettes
      const facetResponse = await this.meilisearch.search(this.vehicleIndex, '', {
        limit: 1,
        facets: ['brand', 'year', 'price'],
      });

      const brands = Object.keys(facetResponse.facetDistribution?.brand || {});
      const years = Object.keys(facetResponse.facetDistribution?.year || {}).map(Number);
      
      return {
        totalVehicles: stats.numberOfDocuments || 0,
        brandCount: brands.length,
        averagePrice: 0, // À calculer si nécessaire
        latestYear: Math.max(...years, 0),
      };

    } catch (error) {
      this.logger.error('Erreur récupération stats véhicules:', error);
      return {
        totalVehicles: 0,
        brandCount: 0,
        averagePrice: 0,
        latestYear: 0,
      };
    }
  }

  /**
   * 🔍 Recherche par code véhicule - Version simplifiée
   */
  async searchByCode(
    code: string,
    type: 'mine' | 'vin' | 'reference' = 'mine',
  ): Promise<any[]> {
    try {
      if (type === 'mine' || type === 'vin') {
        const result = await this.searchByMineOrVin(
          type === 'mine' ? { mine: code } : { vin: code },
        );
        return result.items;
      } else {
        // Recherche par référence - utiliser searchVehicles avec le code comme query
        const result = await this.searchVehicles({
          query: code,
          limit: 50,
        });
        return result.items;
      }
    } catch (error) {
      this.logger.error(`Erreur recherche par ${type}:`, error);
      return [];
    }
  }

  /**
   * 🔧 Obtenir les pièces compatibles - Version simplifiée
   */
  async getCompatibleParts(
    vehicleId: string,
    category?: string,
  ): Promise<any[]> {
    try {
      // Pour l'instant, retournons un tableau vide
      // TODO: Implémenter la recherche de pièces compatibles quand l'index sera disponible
      this.logger.debug(
        `Recherche pièces compatibles pour véhicule ${vehicleId}, catégorie: ${
          category || 'toutes'
        }`,
      );
      return [];
    } catch (error) {
      this.logger.error(
        `Erreur récupération pièces compatibles pour ${vehicleId}:`,
        error,
      );
      return [];
    }
  }
}
