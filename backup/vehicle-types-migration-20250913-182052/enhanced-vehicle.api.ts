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
    // ✅ Utilise le port 3000 pour correspondre au backend NestJS
    this.baseUrl = typeof window !== 'undefined' 
      ? `${window.location.protocol}//${window.location.hostname}:3000`
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
      // ✅ Le backend retourne { data: [...], total, page, limit } sans propriété success
      const mappedBrands: VehicleBrandComponent[] = data.data ? data.data.map((brand: any) => ({
        marque_id: brand.marque_id,
        marque_name: brand.marque_name,
        marque_alias: brand.marque_alias,
        marque_logo: brand.marque_logo,
        marque_country: brand.marque_country,
        products_count: brand.products_count,
        is_featured: brand.marque_top === 1
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
      
      console.log(`🚙 API Call: ${url}`); // Debug log
      
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
      
      console.log(`📊 Modèles reçus pour marque ${brandId}:`, data); // Debug log
      
      // 🔄 Mapper les données de l'API vers le format attendu par le composant
      // ✅ Le backend retourne { data: [...], total, page, limit } sans propriété success
      const mappedModels = data.data ? data.data.map((model: any) => ({
        modele_id: model.modele_id,
        modele_name: model.modele_name,
        modele_alias: model.modele_alias,
        modele_ful_name: model.modele_ful_name,
        brand_id: model.modele_marque_id,
        year_from: model.modele_year_from,
        year_to: model.modele_year_to
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

      const url = `${this.baseUrl}/api/vehicles/models/${modelId}/types${params.toString() ? '?' + params.toString() : ''}`;
      
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

      const data: VehicleResponse<any> = await response.json();
      
      // 🔄 Mapper les données de l'API vers le format attendu par le composant
      // ✅ Le backend retourne { data: [...], total, page, limit } sans propriété success
      const mappedTypes = data.data ? data.data.map((type: any) => ({
        type_id: parseInt(type.type_id),
        type_name: type.type_name,
        type_fuel: type.type_fuel,
        type_power: type.type_power_ps ? `${type.type_power_ps} PS` : undefined,
        type_engine: type.type_engine,
        model_id: parseInt(type.type_modele_id),
        year_from: type.type_year_from ? parseInt(type.type_year_from) : undefined,
        year_to: type.type_year_to ? parseInt(type.type_year_to) : undefined,
        type_slug: type.type_alias
      })) : [];
      
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
      const url = `${this.baseUrl}/api/vehicles/brands/${brandId}/years`;
      console.log(`📅 API Call: ${url}`); // Debug log
      console.log(`📅 baseUrl: ${this.baseUrl}`); // Debug baseUrl
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`📅 Response status: ${response.status}`); // Debug status
      console.log(`📅 Response ok: ${response.ok}`); // Debug ok

      if (!response.ok) {
        console.warn(`❌ Erreur récupération années pour marque ${brandId}: ${response.status}`);
        return [];
      }

      const data = await response.json();
      console.log(`📅 Raw response:`, data); // Debug log
      
      // 🔄 Le backend retourne { data: [...], total, page, limit } 
      if (data.data && Array.isArray(data.data)) {
        const years = data.data.map((item: any) => item.year);
        console.log(`📅 Extracted years:`, years); // Debug log
        return years;
      }
      
      // Fallback si format différent
      console.warn(`❌ Format de données inattendu:`, data);
      return [];
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