import { Injectable, Logger } from '@nestjs/common';
import { MeilisearchService } from './meilisearch.service';

export interface SearchOptions {
  limit?: number;
  offset?: number;
  filter?: string[];
  sort?: string[];
  facets?: string[];
  attributesToHighlight?: string[];
  attributesToRetrieve?: string[];
}

export interface SearchResult<T = any> {
  hits: T[];
  query: string;
  processingTimeMs: number;
  limit: number;
  offset: number;
  estimatedTotalHits: number;
  facetDistribution?: Record<string, Record<string, number>>;
}

@Injectable()
export class SearchEngineService {
  private readonly logger = new Logger(SearchEngineService.name);

  constructor(private readonly meilisearchService: MeilisearchService) {}

  /**
   * Recherche globale multi-index
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    try {
      const vehicleResults = await this.meilisearchService.searchVehicles(query, options);
      const productResults = await this.meilisearchService.searchProducts(query, options);

      // Combine et trie les résultats par pertinence
      const combinedHits = [
        ...vehicleResults.hits.map(hit => ({ ...hit, _index: 'vehicles' })),
        ...productResults.hits.map(hit => ({ ...hit, _index: 'products' })),
      ];

      return {
        hits: combinedHits,
        query,
        processingTimeMs: Math.max(vehicleResults.processingTimeMs, productResults.processingTimeMs),
        limit: options.limit || 20,
        offset: options.offset || 0,
        estimatedTotalHits: vehicleResults.estimatedTotalHits + productResults.estimatedTotalHits,
        facetDistribution: {
          ...vehicleResults.facetDistribution,
          ...productResults.facetDistribution,
        },
      };
    } catch (error) {
      this.logger.error('Error in global search:', error);
      throw error;
    }
  }

  /**
   * Recherche dans un index spécifique
   */
  async searchIndex(indexName: string, query: string, options: SearchOptions = {}): Promise<SearchResult> {
    try {
      let results;
      
      if (indexName === 'vehicles') {
        results = await this.meilisearchService.searchVehicles(query, options);
      } else if (indexName === 'products') {
        results = await this.meilisearchService.searchProducts(query, options);
      } else {
        throw new Error(`Index ${indexName} not supported`);
      }

      return {
        hits: results.hits,
        query,
        processingTimeMs: results.processingTimeMs,
        limit: options.limit || 20,
        offset: options.offset || 0,
        estimatedTotalHits: results.estimatedTotalHits,
        facetDistribution: results.facetDistribution,
      };
    } catch (error) {
      this.logger.error(`Error searching index ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Suggestions d'auto-complétion
   */
  async getSuggestions(query: string, indexName: string = 'vehicles'): Promise<any[]> {
    try {
      const results = await this.meilisearchService.getSuggestions(query, indexName);
      return results.hits;
    } catch (error) {
      this.logger.error('Error getting suggestions:', error);
      throw error;
    }
  }

  /**
   * Obtient les facettes pour les filtres
   */
  async getFacets(indexName: string, facets: string[]): Promise<Record<string, Record<string, number>>> {
    try {
      const results = await this.meilisearchService.getFacets(indexName, facets);
      return results.facetDistribution || {};
    } catch (error) {
      this.logger.error('Error getting facets:', error);
      throw error;
    }
  }

  /**
   * Recherche similaire (based on document)
   */
  async findSimilar(indexName: string, documentId: string, options: SearchOptions = {}): Promise<SearchResult> {
    try {
      // Meilisearch n'a pas de "more like this" natif, on utilise les attributs du document
      const index = this.meilisearchService.getIndex(indexName);
      const document = await index.getDocument(documentId);
      
      if (!document) {
        throw new Error(`Document ${documentId} not found in index ${indexName}`);
      }

      // Utilise les attributs principaux pour la recherche similaire
      let similarityQuery = '';
      if (indexName === 'vehicles' && document.brand && document.model) {
        similarityQuery = `${document.brand} ${document.model}`;
      } else if (indexName === 'products' && document.title) {
        similarityQuery = document.title;
      }

      const results = await this.searchIndex(indexName, similarityQuery, {
        ...options,
        filter: [...(options.filter || []), `id != ${documentId}`],
      });

      return results;
    } catch (error) {
      this.logger.error(`Error finding similar documents for ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Indexation de documents
   */
  async indexDocuments(indexName: string, documents: any[]): Promise<any> {
    try {
      if (indexName === 'vehicles') {
        return await this.meilisearchService.indexVehicles(documents);
      } else if (indexName === 'products') {
        return await this.meilisearchService.indexProducts(documents);
      } else {
        const index = this.meilisearchService.getIndex(indexName);
        return await index.addDocuments(documents);
      }
    } catch (error) {
      this.logger.error(`Error indexing documents to ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Mise à jour d'un document
   */
  async updateDocument(indexName: string, documentId: string, document: any): Promise<any> {
    try {
      if (indexName === 'vehicles') {
        return await this.meilisearchService.updateVehicle(documentId, document);
      } else {
        const index = this.meilisearchService.getIndex(indexName);
        return await index.addDocuments([{ id: documentId, ...document }]);
      }
    } catch (error) {
      this.logger.error(`Error updating document ${documentId} in ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Suppression d'un document
   */
  async deleteDocument(indexName: string, documentId: string): Promise<any> {
    try {
      if (indexName === 'vehicles') {
        return await this.meilisearchService.deleteVehicle(documentId);
      } else {
        const index = this.meilisearchService.getIndex(indexName);
        return await index.deleteDocument(documentId);
      }
    } catch (error) {
      this.logger.error(`Error deleting document ${documentId} from ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Statistiques d'index
   */
  async getIndexStats(indexName: string): Promise<any> {
    try {
      return await this.meilisearchService.getIndexStats(indexName);
    } catch (error) {
      this.logger.error(`Error getting stats for index ${indexName}:`, error);
      throw error;
    }
  }
}