/**
 * 📡 SERVICE API CATÉGORIE FRONTEND
 * 
 * Client pour communiquer avec l'API backend des catégories
 */

// Types importés du backend
interface CategoryQueryOptions {
  includeRelated?: boolean;
  includeMotorizations?: boolean;
  includeEquipementiers?: boolean;
  includeTechnicalInfo?: boolean;
  includeStats?: boolean;
  limit?: number;
  offset?: number;
}

interface CategoryPageData {
  category: {
    id: string;
    name: string;
    slug: string;
    description: string;
    seoTitle: string;
    seoDescription: string;
    image?: string;
  };
  vehicleSelector: {
    brands: Array<{ id: string; name: string; logo?: string }>;
    searchByTypemine: boolean;
  };
  article?: {
    id: string;
    title: string;
    slug: string;
    publishedAt: string;
    content: string;
    excerpt: string;
    readTime?: number;
  };
  relatedCategories: Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
    advice: string;
    image?: string;
  }>;
  popularMotorizations: Array<{
    id: string;
    brand: string;
    model: string;
    engine: string;
    power: number;
    unit: string;
    pricePrefix: string;
    symptoms: string[];
    description: string;
    productCount?: number;
  }>;
  equipmentiers: Array<{
    id: string;
    name: string;
    description: string;
    qualityLevel?: 'OEM' | 'Premium' | 'Standard';
    technologies?: string[];
  }>;
  technicalInfo: Array<{
    id: string;
    title: string;
    content: string;
    order: number;
    isMainInfo: boolean;
  }>;
  seo: {
    canonicalUrl: string;
    breadcrumbs: Array<{ name: string; url: string }>;
  };
  stats?: {
    totalProducts: number;
    totalBrands: number;
    totalVehicles: number;
    avgPrice?: number;
    lastUpdated: string;
  };
}

/**
 * 🌐 Client API pour les catégories
 */
class CategoryApiService {
  private readonly baseUrl: string;

  constructor() {
    // 🔧 URL de base configurée selon l'environnement
    this.baseUrl = typeof window !== 'undefined'
      ? window.ENV?.API_URL || 'http://localhost:3000'
      : process.env.API_URL || 'http://localhost:3000';
  }

  /**
   * 🎯 Récupère les données complètes d'une page de catégorie
   */
  async getCategoryPageData(
    slug: string, 
    options: CategoryQueryOptions = {}
  ): Promise<CategoryPageData> {
    
    console.log(`📡 Appel API catégorie: ${slug}`, options);
    
    // 🔗 Construction des paramètres de query
    const searchParams = new URLSearchParams();
    
    if (options.includeRelated !== undefined) {
      searchParams.set('includeRelated', options.includeRelated.toString());
    }
    if (options.includeMotorizations !== undefined) {
      searchParams.set('includeMotorizations', options.includeMotorizations.toString());
    }
    if (options.includeEquipementiers !== undefined) {
      searchParams.set('includeEquipmentiers', options.includeEquipementiers.toString());
    }
    if (options.includeTechnicalInfo !== undefined) {
      searchParams.set('includeTechnicalInfo', options.includeTechnicalInfo.toString());
    }
    if (options.includeStats !== undefined) {
      searchParams.set('includeStats', options.includeStats.toString());
    }
    if (options.limit !== undefined) {
      searchParams.set('limit', options.limit.toString());
    }
    if (options.offset !== undefined) {
      searchParams.set('offset', options.offset.toString());
    }

    const url = `${this.baseUrl}/api/categories/${slug}/page-data?${searchParams.toString()}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        // 🔄 Cache pour améliorer les performances
        cache: 'default'
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Catégorie "${slug}" non trouvée`);
        }
        throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log(`✅ Données catégorie récupérées: ${data.category?.name}`);
      
      return data;
      
    } catch (error) {
      console.error(`❌ Erreur API catégorie ${slug}:`, error);
      throw error;
    }
  }

  /**
   * 🔍 Récupère seulement les infos de base (version allégée)
   */
  async getCategoryBasic(slug: string) {
    console.log(`📡 Appel API catégorie basique: ${slug}`);
    
    const url = `${this.baseUrl}/api/categories/${slug}/basic`;
    
    try {
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'default'
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      return await response.json();
      
    } catch (error) {
      console.error(`❌ Erreur API catégorie basique ${slug}:`, error);
      throw error;
    }
  }

  /**
   * 🚗 Récupère seulement les données du sélecteur de véhicules
   */
  async getCategoryVehicles(slug: string) {
    console.log(`📡 Appel API véhicules catégorie: ${slug}`);
    
    const url = `${this.baseUrl}/api/categories/${slug}/vehicles`;
    
    try {
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'default'
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      return await response.json();
      
    } catch (error) {
      console.error(`❌ Erreur API véhicules ${slug}:`, error);
      throw error;
    }
  }

  /**
   * 🔧 Récupère les motorisations avec pagination
   */
  async getCategoryMotorizations(
    slug: string, 
    limit: number = 20, 
    offset: number = 0
  ) {
    console.log(`📡 Appel API motorisations: ${slug} (${limit}/${offset})`);
    
    const url = `${this.baseUrl}/api/categories/${slug}/motorizations?limit=${limit}&offset=${offset}`;
    
    try {
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'default'
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      return await response.json();
      
    } catch (error) {
      console.error(`❌ Erreur API motorisations ${slug}:`, error);
      throw error;
    }
  }

  /**
   * 📊 Récupère les statistiques d'une catégorie
   */
  async getCategoryStats(slug: string) {
    console.log(`📡 Appel API statistiques: ${slug}`);
    
    const url = `${this.baseUrl}/api/categories/${slug}/stats`;
    
    try {
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'default'
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      return await response.json();
      
    } catch (error) {
      console.error(`❌ Erreur API statistiques ${slug}:`, error);
      throw error;
    }
  }

  /**
   * 🧪 Méthode pour tester la connectivité de l'API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      return response.ok;
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return false;
    }
  }
}

// 🌟 Instance singleton exportée
export const categoryApiService = new CategoryApiService();

// 📊 Export des types pour utilisation dans les composants
export type { CategoryPageData, CategoryQueryOptions };