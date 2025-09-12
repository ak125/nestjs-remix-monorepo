// 📁 frontend/app/services/api/enhanced-vehicle.api.ts
// 🚗 Enhanced Vehicle API Service - Utilise le service backend testé 100%

export interface VehicleBrandAPI {
  id: number;
  code: string;
  name: string;
  alias?: string;
  logo?: string;
  country?: string;
  isActive: boolean;
  isFavorite: boolean;
  displayOrder: number;
  products_count?: number;
}

export interface VehicleBrandComponent {
  marque_id: number;
  marque_name: string;
  marque_alias?: string;
  marque_logo?: string;
  marque_country?: string;
  products_count?: number;
  is_featured?: boolean;
}

export interface VehicleBrand {
  id: number;
  code: string;
  name: string;
  alias?: string;
  logo?: string;
  country?: string;
  isActive: boolean;
  isFavorite: boolean;
  displayOrder: number;
  products_count?: number;
  is_featured?: boolean;
}

export interface VehicleModel {
  modele_id: number;
  modele_name: string;
  modele_alias?: string;
  modele_ful_name?: string;
  brand_id: number;
  year_from?: number;
  year_to?: number;
}

export interface VehicleType {
  type_id: number;
  type_name: string;
  type_fuel?: string;
  type_power?: string;
  type_engine?: string;
  model_id: number;
  year_from?: number;
  year_to?: number;
}

export interface VehicleResponse<T> {
  success: boolean;
  data: T[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message?: string;
}

class EnhancedVehicleApiService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.API_BASE_URL || 'http://localhost:3000';
  }

  /**
   * 🏷️ Récupérer toutes les marques avec Enhanced Vehicle Service
   */
  async getBrands(options?: {
    page?: number;
    limit?: number;
    search?: string;
    onlyFavorites?: boolean;
    onlyActive?: boolean;
  }): Promise<VehicleBrandComponent[]> {
    try {
      const params = new URLSearchParams();
      
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.search) params.append('search', options.search);
      if (options?.onlyFavorites) params.append('onlyFavorites', 'true');
      if (options?.onlyActive) params.append('onlyActive', 'true');

      const url = `${this.baseUrl}/api/vehicles/brands${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Erreur récupération marques: ${response.status}`);
        return [];
      }

      const data: VehicleResponse<VehicleBrandAPI> = await response.json();
      
      // 🔄 Mapper les données de l'API vers le format attendu par le composant
      const mappedBrands: VehicleBrandComponent[] = data.success ? data.data.map((brand: VehicleBrandAPI) => ({
        marque_id: brand.id,
        marque_name: brand.name,
        marque_alias: brand.alias,
        marque_logo: brand.logo,
        marque_country: brand.country,
        products_count: brand.products_count,
        is_featured: brand.isFavorite
      })) : [];
      
      return mappedBrands;
    } catch (error) {
      console.warn('❌ Erreur getBrands:', error);
      return [];
    }
  }

  /**
   * 🚙 Récupérer les modèles d'une marque
   */
  async getModels(brandId: number, options?: {
    year?: number;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<VehicleModel[]> {
    try {
      const params = new URLSearchParams();
      
      if (options?.year) params.append('year', options.year.toString());
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.search) params.append('search', options.search);

      const url = `${this.baseUrl}/api/vehicles/brands/${brandId}/models${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Erreur récupération modèles pour marque ${brandId}: ${response.status}`);
        return [];
      }

      const data: VehicleResponse<any> = await response.json();
      
      // 🔄 Mapper les données de l'API vers le format attendu par le composant
      const mappedModels = data.success ? data.data.map((model: any) => ({
        modele_id: model.id,
        modele_name: model.name,
        modele_alias: model.alias,
        modele_ful_name: model.fullName,
        brand_id: model.brandId,
        year_from: model.yearFrom,
        year_to: model.yearTo
      })) : [];
      
      return mappedModels;
    } catch (error) {
      console.warn(`❌ Erreur getModels pour marque ${brandId}:`, error);
      return [];
    }
  }

  /**
   * ⚙️ Récupérer les types/motorisations d'un modèle
   */
  async getTypes(modelId: number, options?: {
    page?: number;
    limit?: number;
    search?: string;
    fuel?: string;
    year?: number;
  }): Promise<VehicleType[]> {
    try {
      const params = new URLSearchParams();
      
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.search) params.append('search', options.search);
      if (options?.fuel) params.append('fuel', options.fuel);
      if (options?.year) params.append('year', options.year.toString());

      const url = `${this.baseUrl}/api/vehicles/models/${modelId}/engines${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Erreur récupération types pour modèle ${modelId}: ${response.status}`);
        return [];
      }

      const data: any = await response.json();
      
      // 🔄 L'API engines retourne directement un array (pas de wrapper)
      // Mapper les données de l'API engines (camelCase) vers le format attendu par le composant (snake_case)
      const types = Array.isArray(data) ? data : (data.data || []);
      const mappedTypes = types.map((type: any) => ({
        type_id: parseInt(type.id || type.type_id),
        type_name: type.name || type.type_name,
        type_fuel: type.fuel || type.type_fuel,
        type_power: type.power ? `${type.power} PS` : (type.type_power_ps ? `${type.type_power_ps} PS` : undefined),
        type_engine: type.engine || type.type_engine,
        model_id: parseInt(type.modelId || type.type_modele_id),
        year_from: type.yearFrom ? parseInt(type.yearFrom) : (type.type_year_from ? parseInt(type.type_year_from) : undefined),
        year_to: type.yearTo ? parseInt(type.yearTo) : (type.type_year_to ? parseInt(type.type_year_to) : undefined),
        type_slug: type.engineCode || type.type_alias
      }));
      
      return mappedTypes;
    } catch (error) {
      console.warn(`❌ Erreur getTypes pour modèle ${modelId}:`, error);
      return [];
    }
  }

  /**
   * 📅 Récupérer les années disponibles pour une marque
   */
  async getYearsByBrand(brandId: number): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/vehicles/brands/${brandId}/years`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Erreur récupération années pour marque ${brandId}: ${response.status}`);
        return [];
      }

      const data = await response.json();
      
      // 🔄 L'API retourne directement un tableau d'années, pas un objet wrapper
      if (Array.isArray(data)) {
        return data;
      }
      
      // Fallback pour le format {success: true, data: [...]}
      return data.success ? data.data : [];
    } catch (error) {
      console.warn(`❌ Erreur getYearsByBrand pour marque ${brandId}:`, error);
      return [];
    }
  }

  /**
   * 🔍 Rechercher des véhicules
   */
  async searchVehicles(query: string, options?: {
    type?: 'brand' | 'model' | 'type' | 'all';
    limit?: number;
  }): Promise<{
    brands: VehicleBrand[];
    models: VehicleModel[];
    types: VehicleType[];
  }> {
    try {
      const params = new URLSearchParams();
      params.append('query', query);
      if (options?.type) params.append('type', options.type);
      if (options?.limit) params.append('limit', options.limit.toString());

      const response = await fetch(`${this.baseUrl}/api/vehicles/search?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Erreur recherche véhicules: ${response.status}`);
        return { brands: [], models: [], types: [] };
      }

      const data = await response.json();
      return data.success ? data.data : { brands: [], models: [], types: [] };
    } catch (error) {
      console.warn('❌ Erreur searchVehicles:', error);
      return { brands: [], models: [], types: [] };
    }
  }

  /**
   * 📊 Récupérer les statistiques véhicules
   */
  async getStats(): Promise<{
    totalBrands: number;
    totalModels: number;
    totalTypes: number;
    featuredBrands: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/vehicles/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Erreur récupération stats véhicules: ${response.status}`);
        return { totalBrands: 0, totalModels: 0, totalTypes: 0, featuredBrands: 0 };
      }

      const data = await response.json();
      return data.success ? data.data : { totalBrands: 0, totalModels: 0, totalTypes: 0, featuredBrands: 0 };
    } catch (error) {
      console.warn('❌ Erreur getStats:', error);
      return { totalBrands: 0, totalModels: 0, totalTypes: 0, featuredBrands: 0 };
    }
  }
}

// Export singleton
export const enhancedVehicleApi = new EnhancedVehicleApiService();