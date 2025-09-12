// 📁 frontend/app/services/api/enhanced-product.api.ts
// 🔧 Enhanced Product API Service - Utilise ProductsService backend

export interface ProductCategory {
  gamme_id: number;
  gamme_name: string;
  gamme_alias?: string;
  gamme_description?: string;
  gamme_image?: string;
  products_count?: number;
  is_featured?: boolean;
}

export interface Product {
  piece_id: number;
  piece_name: string;
  piece_ref: string;
  piece_description?: string;
  piece_price?: number;
  piece_brand?: string;
  piece_category?: string;
  piece_image?: string;
  has_image?: boolean;
  has_oem?: boolean;
  is_featured?: boolean;
  stock_quantity?: number;
}

export interface EquipmentBrand {
  brand_id: number;
  brand_name: string;
  brand_logo?: string;
  brand_country?: string;
  is_equipment?: boolean;
  products_count?: number;
}

export interface ProductResponse<T> {
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

class EnhancedProductApiService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.API_BASE_URL || 'http://localhost:3000';
  }

  /**
   * 📂 Récupérer toutes les catégories de produits (gammes)
   */
  async getCategories(options?: {
    page?: number;
    limit?: number;
    search?: string;
    onlyFeatured?: boolean;
  }): Promise<ProductCategory[]> {
    try {
      const params = new URLSearchParams();
      
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.search) params.append('search', options.search);
      if (options?.onlyFeatured) params.append('onlyFeatured', 'true');

      const url = `${this.baseUrl}/api/products/gammes${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Erreur récupération catégories: ${response.status}`);
        return [];
      }

      const data = await response.json();
      // L'API retourne directement un tableau, pas un objet avec success/data
      return Array.isArray(data) ? data.map(cat => ({
        gamme_id: parseInt(cat.id),
        gamme_name: cat.name,
        gamme_alias: cat.alias,
        gamme_description: cat.name,
        gamme_image: cat.image,
        products_count: 0,
        is_featured: cat.is_top || false
      })) : [];
    } catch (error) {
      console.warn('❌ Erreur getCategories:', error);
      return [];
    }
  }

  /**
   * ⭐ Récupérer les produits populaires/en vedette
   */
  async getFeaturedProducts(options?: {
    limit?: number;
    category?: string;
  }): Promise<Product[]> {
    try {
      const params = new URLSearchParams();
      params.append('featured', 'true');
      
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.category) params.append('category', options.category);

      const url = `${this.baseUrl}/api/search/products?${params.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Erreur récupération produits populaires: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return data.success ? data.items || [] : [];
    } catch (error) {
      console.warn('❌ Erreur getFeaturedProducts:', error);
      return [];
    }
  }

  /**
   * 🏭 Récupérer les marques équipementiers
   */
  async getEquipmentBrands(options?: {
    limit?: number;
    country?: string;
  }): Promise<EquipmentBrand[]> {
    try {
      const params = new URLSearchParams();
      params.append('equipment', 'true');
      
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.country) params.append('country', options.country);

      const url = `${this.baseUrl}/api/vehicles/brands?${params.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Erreur récupération marques équipementiers: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return data.success ? data.data || [] : [];
    } catch (error) {
      console.warn('❌ Erreur getEquipmentBrands:', error);
      return [];
    }
  }

  /**
   * 🔍 Récupérer les produits d'une catégorie
   */
  async getProductsByCategory(categoryId: number, options?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<Product[]> {
    try {
      const params = new URLSearchParams();
      
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.search) params.append('search', options.search);
      if (options?.sortBy) params.append('sortBy', options.sortBy);
      if (options?.sortOrder) params.append('sortOrder', options.sortOrder);

      const url = `${this.baseUrl}/api/catalog/products/by-gamme/${categoryId}${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Erreur récupération produits catégorie ${categoryId}: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return data.success ? data.data || [] : [];
    } catch (error) {
      console.warn(`❌ Erreur getProductsByCategory ${categoryId}:`, error);
      return [];
    }
  }

  /**
   * 🔎 Rechercher des produits
   */
  async searchProducts(query: string, options?: {
    page?: number;
    limit?: number;
    category?: string;
    brand?: string;
    priceMin?: number;
    priceMax?: number;
  }): Promise<{
    products: Product[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const params = new URLSearchParams();
      if (query) params.append('query', query);
      
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.category) params.append('category', options.category);
      if (options?.brand) params.append('brand', options.brand);
      if (options?.priceMin) params.append('priceMin', options.priceMin.toString());
      if (options?.priceMax) params.append('priceMax', options.priceMax.toString());

      const url = `${this.baseUrl}/api/search/products?${params.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Erreur recherche produits: ${response.status}`);
        return { products: [], total: 0, page: 1, totalPages: 0 };
      }

      const data = await response.json();
      return {
        products: data.success ? data.items || [] : [],
        total: data.total || 0,
        page: data.page || 1,
        totalPages: Math.ceil((data.total || 0) / (options?.limit || 20)),
      };
    } catch (error) {
      console.warn('❌ Erreur searchProducts:', error);
      return { products: [], total: 0, page: 1, totalPages: 0 };
    }
  }

  /**
   * 📊 Récupérer les statistiques produits
   */
  async getStats(): Promise<{
    totalProducts: number;
    totalCategories: number;
    totalBrands: number;
    featuredProducts: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/products/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Erreur récupération stats produits: ${response.status}`);
        return { totalProducts: 0, totalCategories: 0, totalBrands: 0, featuredProducts: 0 };
      }

      const data = await response.json();
      return {
        totalProducts: data.totalProducts || 0,
        totalCategories: data.totalCategories || 0,
        totalBrands: data.totalBrands || 0,
        featuredProducts: data.activeProducts || 0
      };
    } catch (error) {
      console.warn('❌ Erreur getStats:', error);
      return { totalProducts: 0, totalCategories: 0, totalBrands: 0, featuredProducts: 0 };
    }
  }

  /**
   * 🎯 Récupérer toutes les données home en une seule fois (optimisé)
   */
  async getHomeData() {
    const [categoriesResult, featuredResult, equipmentResult] = await Promise.allSettled([
      this.getCategories({ limit: 12, onlyFeatured: true }),
      this.getFeaturedProducts({ limit: 8 }),
      this.getEquipmentBrands({ limit: 10 }),
    ]);

    return {
      categories: categoriesResult.status === 'fulfilled' ? categoriesResult.value : [],
      featuredProducts: featuredResult.status === 'fulfilled' ? featuredResult.value : [],
      equipmentBrands: equipmentResult.status === 'fulfilled' ? equipmentResult.value : [],
    };
  }
}

// Export singleton
export const enhancedProductApi = new EnhancedProductApiService();