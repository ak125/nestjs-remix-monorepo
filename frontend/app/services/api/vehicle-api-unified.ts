/**
 * Enhanced Vehicle API Service - Migration vers types unifiés
 */

import type {
  VehicleBrand,
  VehicleModel, 
  VehicleType,
  ApiResponse,
  PaginationOptions
} from '@monorepo/shared-types';

const API_BASE_URL = '/api';

/**
 * Service API pour les véhicules avec types unifiés
 */
export const enhancedVehicleApi = {
  
  /**
   * Récupère toutes les marques
   */
  async getBrands(): Promise<ApiResponse<VehicleBrand[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}/vehicles/brands`);
      const data = await response.json();
      
      return {
        success: true,
        data: data.data || [],
        message: 'Marques récupérées'
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Erreur',
          timestamp: new Date().toISOString()
        }
      };
    }
  },

  /**
   * Récupère les modèles d'une marque
   */
  async getModelsByBrand(brandId: number): Promise<ApiResponse<VehicleModel[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}/vehicles/brands/${brandId}/models`);
      const data = await response.json();
      
      return {
        success: true,
        data: data.data || [],
        message: 'Modèles récupérés'
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Erreur',
          timestamp: new Date().toISOString()
        }
      };
    }
  },

  /**
   * Récupère les types d'un modèle
   */
  async getTypesByModel(modelId: number): Promise<ApiResponse<VehicleType[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}/vehicles/models/${modelId}/types`);
      const data = await response.json();
      
      return {
        success: true,
        data: data.data || [],
        message: 'Types récupérés'
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Erreur',
          timestamp: new Date().toISOString()
        }
      };
    }
  },

  /**
   * Méthodes compatibles avec l'ancien API pour migration progressive
   */
  async getYearsByBrand(brandId: number): Promise<ApiResponse<number[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}/vehicles/brands/${brandId}/years`);
      const data = await response.json();
      
      return {
        success: true,
        data: data.data || [],
        message: 'Années récupérées'
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Erreur',
          timestamp: new Date().toISOString()
        }
      };
    }
  },

  async getModels(brandId: number, options?: { year?: number }): Promise<ApiResponse<VehicleModel[]>> {
    try {
      const params = new URLSearchParams();
      if (options?.year) params.append('year', options.year.toString());
      
      const response = await fetch(`${API_BASE_URL}/vehicles/brands/${brandId}/models?${params}`);
      const data = await response.json();
      
      return {
        success: true,
        data: data.data || [],
        message: 'Modèles récupérés'
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Erreur',
          timestamp: new Date().toISOString()
        }
      };
    }
  },

  async getTypes(modelId: number, options?: { year?: number }): Promise<ApiResponse<VehicleType[]>> {
    try {
      const params = new URLSearchParams();
      if (options?.year) params.append('year', options.year.toString());
      
      const response = await fetch(`${API_BASE_URL}/vehicles/models/${modelId}/types?${params}`);
      const data = await response.json();
      
      return {
        success: true,
        data: data.data || [],
        message: 'Types récupérés'
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Erreur',
          timestamp: new Date().toISOString()
        }
      };
    }
  }
};

export default enhancedVehicleApi;