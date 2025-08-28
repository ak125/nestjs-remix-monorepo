import { Injectable, Logger } from '@nestjs/common';
import { MeilisearchService } from './meilisearch.service';

export interface FilterOption {
  value: string;
  count: number;
  selected?: boolean;
}

export interface FilterGroup {
  name: string;
  label: string;
  options: FilterOption[];
  type: 'checkbox' | 'radio' | 'range' | 'select';
}

@Injectable()
export class SearchFilterService {
  private readonly logger = new Logger(SearchFilterService.name);

  constructor(private readonly meilisearchService: MeilisearchService) {}

  /**
   * Obtient les filtres disponibles pour un index
   */
  async getAvailableFilters(indexName: string): Promise<FilterGroup[]> {
    try {
      const facets = await this.getFacetsForIndex(indexName);
      const facetResults = await this.meilisearchService.getFacets(indexName, facets);

      return this.transformFacetsToFilters(facetResults.facetDistribution || {});
    } catch (error) {
      this.logger.error(`Error getting filters for ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Obtient les filtres pour les véhicules
   */
  async getVehicleFilters(): Promise<FilterGroup[]> {
    try {
      return await this.getAvailableFilters('vehicles');
    } catch (error) {
      this.logger.error('Error getting vehicle filters:', error);
      throw error;
    }
  }

  /**
   * Obtient les filtres pour les produits
   */
  async getProductFilters(): Promise<FilterGroup[]> {
    try {
      return await this.getAvailableFilters('products');
    } catch (error) {
      this.logger.error('Error getting product filters:', error);
      throw error;
    }
  }

  /**
   * Construit une requête de filtre Meilisearch
   */
  buildFilterQuery(filters: Record<string, any>): string[] {
    const filterQueries: string[] = [];

    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // Filtre multiple (OR)
        const orConditions = value.map(v => `${key} = "${v}"`).join(' OR ');
        filterQueries.push(`(${orConditions})`);
      } else if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
        // Filtre de plage
        filterQueries.push(`${key} >= ${value.min} AND ${key} <= ${value.max}`);
      } else if (value !== null && value !== undefined && value !== '') {
        // Filtre simple
        filterQueries.push(`${key} = "${value}"`);
      }
    });

    return filterQueries;
  }

  /**
   * Applique des filtres à une recherche
   */
  async searchWithFilters(
    indexName: string,
    query: string,
    filters: Record<string, any>,
    options: any = {},
  ) {
    try {
      const filterQueries = this.buildFilterQuery(filters);
      const searchOptions = {
        ...options,
        filter: filterQueries,
        facets: this.getFacetsForIndex(indexName),
      };

      if (indexName === 'vehicles') {
        return await this.meilisearchService.searchVehicles(query, searchOptions);
      } else if (indexName === 'products') {
        return await this.meilisearchService.searchProducts(query, searchOptions);
      } else {
        throw new Error(`Index ${indexName} not supported`);
      }
    } catch (error) {
      this.logger.error('Error searching with filters:', error);
      throw error;
    }
  }

  /**
   * Obtient les facettes configurées pour un index
   */
  private getFacetsForIndex(indexName: string): string[] {
    const facetMapping: Record<string, string[]> = {
      vehicles: ['brand', 'model', 'category', 'fuel_type', 'transmission', 'color', 'year'],
      products: ['category', 'type', 'status'],
    };

    return facetMapping[indexName] || [];
  }

  /**
   * Transforme les facettes Meilisearch en filtres UI
   */
  private transformFacetsToFilters(facetDistribution: Record<string, Record<string, number>>): FilterGroup[] {
    const filterGroups: FilterGroup[] = [];

    Object.entries(facetDistribution).forEach(([facetName, facetValues]) => {
      const filterGroup: FilterGroup = {
        name: facetName,
        label: this.getFacetLabel(facetName),
        type: this.getFacetType(facetName),
        options: Object.entries(facetValues).map(([value, count]) => ({
          value,
          count,
        })),
      };

      filterGroups.push(filterGroup);
    });

    return filterGroups;
  }

  /**
   * Obtient le libellé d'affichage pour une facette
   */
  private getFacetLabel(facetName: string): string {
    const labelMapping: Record<string, string> = {
      brand: 'Marque',
      model: 'Modèle',
      category: 'Catégorie',
      fuel_type: 'Carburant',
      transmission: 'Transmission',
      color: 'Couleur',
      year: 'Année',
      type: 'Type',
      status: 'Statut',
    };

    return labelMapping[facetName] || facetName;
  }

  /**
   * Détermine le type d'interface pour une facette
   */
  private getFacetType(facetName: string): FilterGroup['type'] {
    const typeMapping: Record<string, FilterGroup['type']> = {
      brand: 'checkbox',
      model: 'checkbox',
      category: 'checkbox',
      fuel_type: 'checkbox',
      transmission: 'radio',
      color: 'checkbox',
      year: 'range',
      type: 'select',
      status: 'radio',
    };

    return typeMapping[facetName] || 'checkbox';
  }
}
