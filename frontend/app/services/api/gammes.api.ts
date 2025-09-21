// 📁 frontend/app/services/api/gammes.api.ts
// 🔧 Service API pour les gammes de catalogue (table catalog_gamme)

import { fetcher } from './base.api';

export interface CatalogGamme {
  mc_id: string;
  mc_mf_id: string;        // ID fabricant/marque
  mc_mf_prime: string;     // Priorité fabricant
  mc_pg_id: string;        // ID gamme produit (catalog_gamme)
  mc_sort: string;         // Ordre de tri
  // Champs enrichis depuis pieces_gamme (JOIN)
  pg_id?: string;          // ID réel pieces_gamme (pour les liens)
  pg_name?: string;        // Nom réel de la gamme
  pg_alias?: string;       // Alias URL de la gamme
  pg_image?: string;       // Image de la gamme
}

export interface GammesByManufacturer {
  [manufacturerId: string]: CatalogGamme[];
}

export interface GammesDisplayData {
  manufacturers: {
    [id: string]: {
      name: string;
      gammes: CatalogGamme[];
    };
  };
  stats: {
    total_gammes: number;
    total_manufacturers: number;
  };
}

export interface GammesApiResponse<T = any> {
  success: boolean;
  data: T;
  count?: number;
  message?: string;
  error?: string;
}

class GammesApiService {
  private baseUrl = '/api/catalog/gammes';

  /**
   * 🔧 Récupère toutes les gammes
   */
  async getAllGammes(): Promise<CatalogGamme[]> {
    try {
      console.log('🔧 Récupération de toutes les gammes...');

      const response: GammesApiResponse<CatalogGamme[]> = await fetcher(
        `${this.baseUrl}/all`
      );

      if (!response.success) {
        throw new Error(response.error || 'Erreur lors de la récupération des gammes');
      }

      console.log(`✅ ${response.data?.length || 0} gammes récupérées`);
      return response.data || [];

    } catch (error) {
      console.error('❌ Erreur récupération gammes:', error);
      throw error;
    }
  }

  /**
   * 🔧 Récupère les gammes groupées par fabricant
   */
  async getGammesByManufacturer(): Promise<GammesByManufacturer> {
    try {
      console.log('🔧 Récupération gammes par fabricant...');

      const response: GammesApiResponse<GammesByManufacturer> = await fetcher(
        `${this.baseUrl}/by-manufacturer`
      );

      if (!response.success) {
        throw new Error(response.error || 'Erreur lors du groupement des gammes');
      }

      console.log(`✅ Gammes groupées par ${Object.keys(response.data || {}).length} fabricants`);
      return response.data || {};

    } catch (error) {
      console.error('❌ Erreur groupement gammes:', error);
      throw error;
    }
  }

  /**
   * 🔧 Récupère les données formatées pour affichage
   */
  async getGammesForDisplay(): Promise<GammesDisplayData> {
    try {
      console.log('🔧 Récupération données d\'affichage gammes...');

      const response: GammesApiResponse<GammesDisplayData> = await fetcher(
        `${this.baseUrl}/display`
      );

      if (!response.success) {
        throw new Error(response.error || 'Erreur lors de la préparation des données d\'affichage');
      }

      console.log(`✅ Données d'affichage préparées: ${response.data?.stats?.total_gammes || 0} gammes`);
      return response.data || { manufacturers: {}, stats: { total_gammes: 0, total_manufacturers: 0 } };

    } catch (error) {
      console.error('❌ Erreur données affichage:', error);
      throw error;
    }
  }

  /**
   * 🔧 Récupère une gamme spécifique par ID
   */
  async getGammeById(id: string): Promise<CatalogGamme | null> {
    try {
      console.log(`🔧 Récupération gamme ID: ${id}`);

      const response: GammesApiResponse<CatalogGamme> = await fetcher(
        `${this.baseUrl}/${id}`
      );

      if (!response.success) {
        console.warn(`⚠️ Gamme ${id} non trouvée:`, response.error);
        return null;
      }

      console.log(`✅ Gamme ${id} récupérée`);
      return response.data || null;

    } catch (error) {
      console.error(`❌ Erreur récupération gamme ${id}:`, error);
      return null;
    }
  }

  /**
   * 🔧 Récupère les gammes d'un fabricant spécifique
   */
  async getGammesByManufacturerId(manufacturerId: string): Promise<CatalogGamme[]> {
    try {
      console.log(`🔧 Récupération gammes fabricant: ${manufacturerId}`);

      const response: GammesApiResponse<CatalogGamme[]> = await fetcher(
        `${this.baseUrl}/manufacturer/${manufacturerId}`
      );

      if (!response.success) {
        throw new Error(response.error || `Erreur lors de la récupération des gammes du fabricant ${manufacturerId}`);
      }

      console.log(`✅ ${response.data?.length || 0} gammes récupérées pour fabricant ${manufacturerId}`);
      return response.data || [];

    } catch (error) {
      console.error(`❌ Erreur gammes fabricant ${manufacturerId}:`, error);
      throw error;
    }
  }
}

// Export de l'instance unique
export const gammesApi = new GammesApiService();

// Export du type pour utilisation dans les composants
export type { GammesApiService };