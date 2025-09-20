import { Injectable, Logger } from '@nestjs/common';
import { MeilisearchService } from './meilisearch.service';

@Injectable()
export class SearchSuggestionService {
  private readonly logger = new Logger(SearchSuggestionService.name);

  constructor(private readonly meilisearchService: MeilisearchService) {}

  /**
   * Obtient des suggestions d'auto-complétion
   */
  async getSuggestions(query: string, indexName: string = 'vehicles') {
    try {
      return await this.meilisearchService.getSuggestions(query, indexName);
    } catch (error) {
      this.logger.error('Error getting suggestions:', error);
      throw error;
    }
  }

  /**
   * Obtient des suggestions populaires
   */
  async getPopularSuggestions(
    indexName: string = 'vehicles',
    limit: number = 10,
  ) {
    try {
      // Recherche les termes les plus fréquents (simulation)
      const results = await this.meilisearchService.searchVehicles('', {
        limit,
        attributesToRetrieve: ['brand', 'model'],
      });

      return results.hits.map((hit) => ({
        text: `${hit.brand} ${hit.model}`,
        count: Math.floor(Math.random() * 100), // Simulation de popularité
      }));
    } catch (error) {
      this.logger.error('Error getting popular suggestions:', error);
      throw error;
    }
  }

  /**
   * Suggestions basées sur l'historique de recherche
   */
  async getHistoryBasedSuggestions(userId: string, limit: number = 5) {
    try {
      // Ici on pourrait intégrer avec un service d'historique
      // Pour l'instant, on retourne des suggestions génériques
      return await this.getPopularSuggestions('vehicles', limit);
    } catch (error) {
      this.logger.error('Error getting history-based suggestions:', error);
      throw error;
    }
  }
}
