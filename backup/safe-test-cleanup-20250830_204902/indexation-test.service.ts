import { Injectable, Logger } from '@nestjs/common';
import { MeilisearchService } from './meilisearch.service';

/**
 * 📊 IndexationService - Service d'indexation simplifié pour tests
 */
@Injectable()
export class IndexationService {
  private readonly logger = new Logger(IndexationService.name);

  constructor(private readonly meilisearch: MeilisearchService) {}

  /**
   * 🚗 Indexer des véhicules de test
   */
  async indexTestVehicles(): Promise<any> {
    this.logger.log('🚗 Indexation véhicules de test...');
    
    const vehicles = [
      { id: 1, brand: 'Renault', model: 'Clio', year: 2020, price: 15000, fuel_type: 'Essence' },
      { id: 2, brand: 'Peugeot', model: '208', year: 2021, price: 18000, fuel_type: 'Hybride' },
      { id: 3, brand: 'Citroën', model: 'C3', year: 2022, price: 16500, fuel_type: 'Diesel' },
      { id: 4, brand: 'Volkswagen', model: 'Golf', year: 2023, price: 22000, fuel_type: 'Essence' },
      { id: 5, brand: 'BMW', model: 'Série 1', year: 2021, price: 28000, fuel_type: 'Diesel' },
    ];

    try {
      const result = await this.meilisearch.addVehicles(vehicles);
      this.logger.log(`✅ ${vehicles.length} véhicules indexés`);
      return { success: true, count: vehicles.length, result };
    } catch (error) {
      this.logger.error('❌ Erreur indexation véhicules:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 📄 Indexer des produits de test
   */
  async indexTestProducts(): Promise<any> {
    this.logger.log('📄 Indexation produits de test...');
    
    const products = [
      { id: 1, name: 'Pneu Michelin Energy', category: 'Pneus', price: 120, brand: 'Michelin' },
      { id: 2, name: 'Batterie Varta Blue', category: 'Électrique', price: 89, brand: 'Varta' },
      { id: 3, name: 'Filtre à air K&N Sport', category: 'Filtres', price: 45, brand: 'K&N' },
      { id: 4, name: 'Plaquettes Brembo', category: 'Freinage', price: 67, brand: 'Brembo' },
      { id: 5, name: 'Huile Castrol GTX', category: 'Lubrifiants', price: 35, brand: 'Castrol' },
    ];

    try {
      const result = await this.meilisearch.addProducts(products);
      this.logger.log(`✅ ${products.length} produits indexés`);
      return { success: true, count: products.length, result };
    } catch (error) {
      this.logger.error('❌ Erreur indexation produits:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🔄 Indexation complète de test
   */
  async indexTestData(): Promise<any> {
    this.logger.log('🚀 Indexation complète des données de test...');
    
    const vehiclesResult = await this.indexTestVehicles();
    const productsResult = await this.indexTestProducts();
    
    return {
      vehicles: vehiclesResult,
      products: productsResult,
      summary: {
        totalIndexed: (vehiclesResult.count || 0) + (productsResult.count || 0),
        success: vehiclesResult.success && productsResult.success
      }
    };
  }

  /**
   * 📊 Statut des index
   */
  async getIndexStatus(): Promise<any> {
    try {
      const vehicleStats = await this.meilisearch.getIndexStats('vehicles');
      const productStats = await this.meilisearch.getIndexStats('products');
      
      return {
        vehicles: vehicleStats,
        products: productStats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('❌ Erreur statut index:', error);
      return { error: error.message };
    }
  }

  /**
   * 🧹 Nettoyer les index
   */
  async clearIndexes(): Promise<any> {
    this.logger.log('🧹 Nettoyage des index...');
    
    try {
      await this.meilisearch.clearIndex('vehicles');
      await this.meilisearch.clearIndex('products');
      
      this.logger.log('✅ Index nettoyés');
      return { success: true };
    } catch (error) {
      this.logger.error('❌ Erreur nettoyage:', error);
      return { success: false, error: error.message };
    }
  }
}
