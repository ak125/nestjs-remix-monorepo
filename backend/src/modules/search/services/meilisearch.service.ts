import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch, Index } from 'meilisearch';

@Injectable()
export class MeilisearchService implements OnModuleInit {
  private readonly logger = new Logger(MeilisearchService.name);
  private client: MeiliSearch;
  private vehicleIndex: Index;
  private productIndex: Index;

  constructor(private readonly configService: ConfigService) {
    const masterKey =
      this.configService.get('MEILISEARCH_MASTER_KEY') || 'masterKey123';
    this.client = new MeiliSearch({
      host:
        this.configService.get('MEILISEARCH_HOST') || 'http://localhost:7700',
      apiKey: masterKey,
    });
    this.logger.debug(
      `Meilisearch config: host=${this.configService.get('MEILISEARCH_HOST') || 'http://localhost:7700'}, apiKey=${masterKey ? '***' : 'undefined'}`,
    );
  }

  async onModuleInit() {
    try {
      await this.initializeIndexes();
      this.logger.log('✅ Meilisearch initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Meilisearch', error);
    }
  }

  private async initializeIndexes() {
    // Index des véhicules
    this.vehicleIndex = this.client.index('vehicles');
    await this.vehicleIndex.updateSettings({
      searchableAttributes: [
        'name',
        'reference',
        'marque',
        'modele',
        'version',
        'searchTerms',
      ],
      filterableAttributes: [
        'marque',
        'modele',
        'version',
        'anneeDebut',
        'anneeFin',
        'puissanceCV',
        'cylindree',
        'carburant',
        'transmissionType',
        'isActive',
        'createdAt',
        'updatedAt',
      ],
      sortableAttributes: [
        'createdAt',
        'updatedAt',
        'marque',
        'modele',
        'anneeDebut',
        'anneeFin',
        'puissanceCV',
        'cylindree',
      ],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
      ],
    });

    // Index des fiches produits
    this.productIndex = this.client.index('products');
    await this.productIndex.updateSettings({
      searchableAttributes: [
        'name',
        'reference',
        'description',
        'searchTerms',
        'brand', // 🏭 Ajout de la marque dans la recherche
      ],
      filterableAttributes: [
        'type',
        'isActive',
        'isFilter', // 🏭 Nouveau : filtrer par type filtre
        'brand', // 🏭 Nouveau : filtrer par marque
        'brandId',
        'productGroupId',
        'articleGroupId',
        'year',
        'hasImage',
        'hasOEM',
        'createdAt',
        'updatedAt',
      ],
      sortableAttributes: [
        'createdAt',
        'updatedAt',
        'brand', // 🏭 Nouveau : tri par marque
        'name',
        'year',
        'quantity',
        'weight',
      ],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
      ],
    });
  }

  /**
   * Recherche dans l'index des véhicules
   */
  async searchVehicles(query: string, options: any = {}) {
    try {
      this.logger.debug(
        `🚗 Recherche véhicules: "${query}" avec options:`,
        options,
      );
      const searchParams = {
        q: query,
        limit: options.limit || 20,
        offset: options.offset || 0,
        filter: options.filter,
        sort: options.sort,
        facets: options.facets,
        attributesToHighlight: ['name', 'fullName', 'searchTerms'],
        highlightPreTag: '<em>',
        highlightPostTag: '</em>',
      };

      const result = await this.vehicleIndex.search(query, searchParams);
      this.logger.debug(`🚗 Résultat recherche véhicules:`, result);
      return result;
    } catch (error) {
      this.logger.error('Error searching vehicles:', error);
      throw error;
    }
  }

  /**
   * Recherche dans l'index des produits
   */
  async searchProducts(query: string, options: any = {}) {
    try {
      this.logger.debug(
        `🔧 Recherche produits: "${query}" avec options:`,
        options,
      );
      const searchParams = {
        q: query,
        limit: options.limit || 20,
        offset: options.offset || 0,
        filter: options.filter,
        sort: options.sort,
        attributesToHighlight: [
          'name',
          'reference',
          'description',
          'searchTerms',
        ],
        highlightPreTag: '<em>',
        highlightPostTag: '</em>',
      };

      const result = await this.productIndex.search(query, searchParams);
      this.logger.debug(`🔧 Résultat recherche produits:`, result);
      return result;
    } catch (error) {
      this.logger.error('Error searching products:', error);
      throw error;
    }
  }

  /**
   * Indexe des véhicules en lot
   */
  async indexVehicles(vehicles: any[]) {
    try {
      return await this.vehicleIndex.addDocuments(vehicles, {
        primaryKey: 'id',
      });
    } catch (error) {
      this.logger.error('Error indexing vehicles:', error);
      throw error;
    }
  }

  /**
   * Indexe des produits en lot
   */
  async indexProducts(products: any[]) {
    try {
      return await this.productIndex.addDocuments(products, {
        primaryKey: 'id',
      });
    } catch (error) {
      this.logger.error('Error indexing products:', error);
      throw error;
    }
  }

  /**
   * Met à jour un véhicule dans l'index
   */
  async updateVehicle(vehicleId: string, vehicle: any) {
    try {
      return await this.vehicleIndex.addDocuments([
        { id: vehicleId, ...vehicle },
      ]);
    } catch (error) {
      this.logger.error(`Error updating vehicle ${vehicleId}:`, error);
      throw error;
    }
  }

  /**
   * Supprime un véhicule de l'index
   */
  async deleteVehicle(vehicleId: string) {
    try {
      return await this.vehicleIndex.deleteDocument(vehicleId);
    } catch (error) {
      this.logger.error(`Error deleting vehicle ${vehicleId}:`, error);
      throw error;
    }
  }

  /**
   * 📊 Ajouter des véhicules en lot
   */
  async addVehicles(vehicles: any[]): Promise<any> {
    try {
      return await this.vehicleIndex.addDocuments(vehicles, {
        primaryKey: 'id',
      });
    } catch (error) {
      this.logger.error('Error adding vehicles batch:', error);
      throw error;
    }
  }

  /**
   * 📊 Ajouter des produits en lot
   */
  async addProducts(products: any[]): Promise<any> {
    try {
      return await this.productIndex.addDocuments(products, {
        primaryKey: 'id',
      });
    } catch (error) {
      this.logger.error('Error adding products batch:', error);
      throw error;
    }
  }

  /**
   * 🗑️ Supprimer un index
   */
  async deleteIndex(indexName: string): Promise<any> {
    try {
      return await this.client.deleteIndex(indexName);
    } catch (error) {
      this.logger.error(`Error deleting index ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * 🧹 Clear/vider un index (supprimer tous les documents)
   */
  async clearIndex(indexName: string): Promise<any> {
    try {
      const index = this.client.index(indexName);
      return await index.deleteAllDocuments();
    } catch (error) {
      this.logger.error(`Error clearing index ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * 🔧 Créer un index
   */
  async createIndex(indexName: string): Promise<any> {
    try {
      return await this.client.createIndex(indexName, { primaryKey: 'id' });
    } catch (error) {
      this.logger.error(`Error creating index ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Obtient les statistiques d'un index
   */
  async getIndexStats(indexName: string) {
    try {
      const index = this.client.index(indexName);
      return await index.getStats();
    } catch (error) {
      this.logger.error(`Error getting stats for index ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Suggestions de recherche (auto-complétion)
   */
  async getSuggestions(query: string, indexName: string = 'vehicles') {
    try {
      const index = this.client.index(indexName);
      return await index.search(query, {
        limit: 10,
        attributesToRetrieve: ['brand', 'model', 'version'],
        attributesToHighlight: ['brand', 'model'],
      });
    } catch (error) {
      this.logger.error('Error getting suggestions:', error);
      throw error;
    }
  }

  /**
   * Obtient les facettes pour les filtres
   */
  async getFacets(indexName: string, facets: string[]) {
    try {
      const index = this.client.index(indexName);
      return await index.search('', {
        limit: 0,
        facets,
      });
    } catch (error) {
      this.logger.error('Error getting facets:', error);
      throw error;
    }
  }

  /**
   * Client Meilisearch brut pour opérations avancées
   */
  getClient(): MeiliSearch {
    return this.client;
  }

  /**
   * Obtient un index spécifique
   */
  getIndex(name: string): Index {
    return this.client.index(name);
  }
}
