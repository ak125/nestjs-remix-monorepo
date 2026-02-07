import { Injectable, Logger, Inject } from '@nestjs/common';
import { MeilisearchService } from './meilisearch.service';
import { SupabaseIndexationService } from './supabase-indexation.service';
import { getErrorMessage } from '../../../common/utils/error.utils';

export interface VehicleIndexData {
  id: number;
  brand: string;
  model: string;
  year: number;
  fuel_type?: string;
  price?: number;
  mileage?: number;
  description?: string;
}

export interface ProductIndexData {
  id: number;
  name: string;
  brand?: string;
  category?: string;
  price?: number;
  description?: string;
}

/**
 * 📊 IndexationService - Service d'importation de données Supabase → Meilisearch
 */
@Injectable()
export class IndexationService {
  private readonly logger = new Logger(IndexationService.name);

  constructor(
    private readonly meilisearch: MeilisearchService,
    @Inject(SupabaseIndexationService)
    private readonly supabase: SupabaseIndexationService,
  ) {}

  /**
   * � INDEXER DONNÉES RÉELLES - Véhicules depuis Supabase
   */
  async indexRealVehicles(
    batchSize: number = 1000,
  ): Promise<{ success: boolean; count: number; message: string }> {
    try {
      this.logger.log(
        '🚗 Démarrage indexation véhicules RÉELS depuis Supabase...',
      );

      // Récupérer les vraies données depuis Supabase
      const vehicleData =
        await this.supabase.getAllVehiclesFromSupabase(batchSize);

      // Type guard: vérifier si c'est un array ou un objet { success, data }
      if (Array.isArray(vehicleData)) {
        // Ancien format: array direct
        if (vehicleData.length === 0) {
          return {
            success: true,
            count: 0,
            message: 'Aucun véhicule trouvé dans Supabase',
          };
        }

        await this.meilisearch.indexVehicles(vehicleData);
        this.logger.log(
          `✅ ${vehicleData.length} véhicules RÉELS indexés avec succès`,
        );

        return {
          success: true,
          count: vehicleData.length,
          message: `${vehicleData.length} véhicules réels indexés depuis Supabase`,
        };
      }

      // Nouveau format: objet { success, data, count }
      if (!('success' in vehicleData) || !vehicleData.success) {
        return {
          success: false,
          count: 0,
          message: `Erreur récupération Supabase: ${vehicleData.error || 'Erreur inconnue'}`,
        };
      }

      if (!vehicleData.data || vehicleData.data.length === 0) {
        return {
          success: true,
          count: 0,
          message: 'Aucun véhicule trouvé dans Supabase',
        };
      }

      // Indexer dans Meilisearch
      await this.meilisearch.indexVehicles(vehicleData.data);

      this.logger.log(
        `✅ ${vehicleData.count} véhicules RÉELS indexés avec succès`,
      );

      return {
        success: true,
        count: vehicleData.count,
        message: `${vehicleData.count} véhicules réels indexés depuis Supabase`,
      };
    } catch (error) {
      this.logger.error('❌ Erreur indexation véhicules réels:', error);
      return {
        success: false,
        count: 0,
        message: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      };
    }
  }

  /**
   * 🔧 INDEXER DONNÉES RÉELLES - Produits depuis Supabase
   */
  async indexRealProducts(
    batchSize: number = 1000,
  ): Promise<{ success: boolean; count: number; message: string }> {
    try {
      this.logger.log(
        '🔧 Démarrage indexation produits RÉELS depuis Supabase...',
      );

      // Récupérer les vraies données depuis Supabase
      const productData =
        await this.supabase.getAllProductsFromSupabase(batchSize);

      if (!productData.success) {
        return {
          success: false,
          count: 0,
          message: `Erreur récupération Supabase: ${productData.error}`,
        };
      }

      if (productData.data.length === 0) {
        return {
          success: true,
          count: 0,
          message: 'Aucun produit trouvé dans Supabase',
        };
      }

      // Indexer dans Meilisearch
      await this.meilisearch.indexProducts(productData.data);

      this.logger.log(
        `✅ ${productData.count} produits RÉELS indexés avec succès`,
      );

      return {
        success: true,
        count: productData.count,
        message: `${productData.count} produits réels indexés depuis Supabase`,
      };
    } catch (error) {
      this.logger.error('❌ Erreur indexation produits réels:', error);
      return {
        success: false,
        count: 0,
        message: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      };
    }
  }

  /**
   * 📊 INDEXER TOUTES LES DONNÉES RÉELLES
   */
  async indexAllRealData(): Promise<{
    success: boolean;
    vehicles: number;
    products: number;
    message: string;
  }> {
    try {
      this.logger.log(
        '🚀 Démarrage indexation COMPLÈTE des données réelles...',
      );

      // Obtenir les statistiques Supabase d'abord
      const stats = await this.supabase.getSupabaseStats();
      this.logger.log(
        '📊 Statistiques Supabase:',
        JSON.stringify(stats, null, 2),
      );

      // Indexer véhicules et produits en parallèle
      const [vehicleResult, productResult] = await Promise.all([
        this.indexRealVehicles(1000),
        this.indexRealProducts(1000),
      ]);

      const success = vehicleResult.success && productResult.success;
      const totalCount = vehicleResult.count + productResult.count;

      if (success) {
        this.logger.log(
          `🎉 Indexation complète réussie: ${vehicleResult.count} véhicules + ${productResult.count} produits = ${totalCount} éléments`,
        );
      }

      return {
        success,
        vehicles: vehicleResult.count,
        products: productResult.count,
        message: success
          ? `Indexation complète réussie: ${vehicleResult.count} véhicules + ${productResult.count} produits`
          : `Erreurs: ${vehicleResult.success ? '' : vehicleResult.message} ${productResult.success ? '' : productResult.message}`,
      };
    } catch (error) {
      this.logger.error('❌ Erreur indexation complète:', error);
      return {
        success: false,
        vehicles: 0,
        products: 0,
        message: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      };
    }
  }

  /**
   * 🧪 Test de connexion Supabase
   */
  async testSupabaseConnection(): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      this.logger.log('🧪 Test de connexion Supabase...');

      const result = await this.supabase.testSupabaseConnection();

      if (result.success) {
        this.logger.log('✅ Connexion Supabase fonctionnelle');
        return {
          success: true,
          message: 'Connexion Supabase réussie',
          data: result.samples,
        };
      } else {
        this.logger.error('❌ Échec connexion Supabase:', result.error);
        return {
          success: false,
          message: `Connexion échouée: ${result.error}`,
        };
      }
    } catch (error) {
      this.logger.error('❌ Erreur test connexion:', error);
      return {
        success: false,
        message: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      };
    }
  }

  /**
   * 🚗 INDEXER VÉHICULES RÉELS - Avec noms complets
   *
   * NOUVELLE VERSION : Utilise les vrais véhicules de Supabase
   * avec les noms complets générés par VehicleNamingService
   */
  async indexVehicles(): Promise<{
    success: boolean;
    count: number;
    message: string;
  }> {
    try {
      this.logger.log('🚗 Début indexation véhicules RÉELS...');

      // Récupérer les véhicules avec noms complets depuis Supabase
      const vehiclesWithNames =
        await this.supabase.getAllVehiclesFromSupabase(50);

      // Vérification du type de retour
      const vehiclesArray = Array.isArray(vehiclesWithNames)
        ? vehiclesWithNames
        : [];

      if (!vehiclesArray || vehiclesArray.length === 0) {
        this.logger.warn('⚠️ Aucun véhicule récupéré depuis Supabase');
        return {
          success: false,
          count: 0,
          message: 'Aucun véhicule trouvé dans la base de données',
        };
      }

      // Convertir le format pour Meilisearch
      const meilisearchData: VehicleIndexData[] = vehiclesArray.map(
        (vehicle: any) => ({
          id: parseInt(vehicle.typeId),
          brand: vehicle.marque || 'Unknown',
          model: vehicle.modele || 'Unknown',
          year: vehicle.yearFrom || new Date().getFullYear(),
          fuel_type: vehicle.motorisation || 'Unknown',
          description: vehicle.fullName, // Le nom complet comme description
          // Champs optionnels pour compatibilité
          price: 0,
          mileage: 0,
          // Ajout du nom complet pour la recherche
          fullName: vehicle.fullName,
          searchTerms: vehicle.searchTerms,
        }),
      );

      this.logger.log(
        `📝 Conversion terminée: ${meilisearchData.length} véhicules formatés`,
      );

      // Index vehicles dans Meilisearch
      await this.meilisearch.indexVehicles(meilisearchData);

      this.logger.log(
        `✅ ${meilisearchData.length} véhicules RÉELS indexés avec succès`,
      );

      return {
        success: true,
        count: meilisearchData.length,
        message: `${meilisearchData.length} véhicules indexés`,
      };
    } catch (error) {
      this.logger.error('❌ Erreur indexation véhicules:', error);
      return {
        success: false,
        count: 0,
        message: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      };
    }
  }

  /**
   * 🛍️ Index products data with real Supabase data
   */
  async indexProducts(): Promise<{
    success: boolean;
    count: number;
    message: string;
  }> {
    try {
      this.logger.log('🛍️ Début indexation produits avec données réelles...');

      // Récupérer les vraies pièces depuis Supabase
      const productsData = await this.supabase.getAllProductsFromSupabase(1000);

      if (!productsData.success || !productsData.data) {
        this.logger.error(
          '❌ Échec récupération produits Supabase:',
          productsData.error,
        );
        return {
          success: false,
          count: 0,
          message:
            'Erreur lors de la récupération des produits depuis Supabase',
        };
      }

      if (productsData.data.length === 0) {
        this.logger.warn('⚠️ Aucun produit trouvé dans Supabase');
        return {
          success: true,
          count: 0,
          message: 'Aucun produit à indexer',
        };
      }

      this.logger.log(
        `📦 ${productsData.data.length} produits récupérés, indexation en cours...`,
      );

      // Indexer les produits réels dans Meilisearch
      await this.meilisearch.indexProducts(productsData.data);

      this.logger.log(
        `✅ ${productsData.data.length} produits réels indexés avec succès`,
      );

      return {
        success: true,
        count: productsData.data.length,
        message: `${productsData.data.length} produits réels indexés`,
      };
    } catch (error) {
      this.logger.error('❌ Erreur indexation produits:', error);
      return {
        success: false,
        count: 0,
        message: `Erreur: ${getErrorMessage(error)}`,
      };
    }
  }

  /**
   * 🗑️ Clear all indexes
   */
  async clearAllIndexes(): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log('🗑️ Suppression de tous les index...');

      await this.meilisearch.clearIndex('vehicles');
      await this.meilisearch.clearIndex('products');

      this.logger.log('✅ Tous les index ont été supprimés');

      return {
        success: true,
        message: 'Tous les index ont été supprimés avec succès',
      };
    } catch (error) {
      this.logger.error('❌ Erreur suppression index:', error);
      return {
        success: false,
        message: `Erreur: ${getErrorMessage(error)}`,
      };
    }
  }

  /**
   * 📊 Get indexation status
   */
  async getIndexationStatus(): Promise<{
    vehicles: { count: number; status: string };
    products: { count: number; status: string };
  }> {
    try {
      // Get stats from Meilisearch
      const vehicleStats = await this.meilisearch.getIndexStats('vehicles');
      const productStats = await this.meilisearch.getIndexStats('products');

      return {
        vehicles: {
          count: vehicleStats.numberOfDocuments || 0,
          status: vehicleStats.numberOfDocuments > 0 ? 'indexé' : 'vide',
        },
        products: {
          count: productStats.numberOfDocuments || 0,
          status: productStats.numberOfDocuments > 0 ? 'indexé' : 'vide',
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur récupération statut:', error);
      return {
        vehicles: { count: 0, status: 'erreur' },
        products: { count: 0, status: 'erreur' },
      };
    }
  }

  /**
   * 📰 Indexer les articles de blog dans Meilisearch
   */
  async indexBlogArticles(
    articles: any[],
  ): Promise<{ success: boolean; indexed: number; message: string }> {
    try {
      this.logger.log(
        `📰 Indexation de ${articles.length} articles de blog...`,
      );

      if (!articles || articles.length === 0) {
        return {
          success: false,
          indexed: 0,
          message: 'Aucun article à indexer',
        };
      }

      // Créer l'index blog_articles s'il n'existe pas
      const blogIndex = await this.meilisearch
        .getClient()
        .getIndex('blog_articles');

      // Configuration de l'index blog
      await blogIndex.updateSettings({
        searchableAttributes: [
          'title',
          'excerpt',
          'content',
          'tags',
          'category',
          'searchTerms',
        ],
        filterableAttributes: [
          'articleType',
          'category',
          'publishedAt',
          'tags',
        ],
        sortableAttributes: ['publishedAt', 'viewsCount', 'readingTime'],
        displayedAttributes: [
          'id',
          'title',
          'excerpt',
          'slug',
          'articleType',
          'category',
          'tags',
          'publishedAt',
          'readingTime',
          'viewsCount',
        ],
      });

      // Indexer par batches pour éviter la surcharge
      const batchSize = 100;
      let totalIndexed = 0;

      for (let i = 0; i < articles.length; i += batchSize) {
        const batch = articles.slice(i, i + batchSize);

        const task = await blogIndex.addDocuments(batch);
        this.logger.log(
          `📝 Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} articles ajoutés (Task ID: ${task.taskUid})`,
        );

        totalIndexed += batch.length;
      }

      this.logger.log(
        `✅ ${totalIndexed} articles de blog indexés avec succès`,
      );

      return {
        success: true,
        indexed: totalIndexed,
        message: `${totalIndexed} articles de blog indexés avec succès`,
      };
    } catch (error) {
      this.logger.error('❌ Erreur indexation articles blog:', error);
      return {
        success: false,
        indexed: 0,
        message: `Erreur indexation blog: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      };
    }
  }
}
