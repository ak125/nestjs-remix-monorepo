// 📁 frontend/app/services/api/hierarchy.api.ts
// 🏗️ Service API pour la hiérarchie Familles → Gammes (sous-catégories)

import { type CatalogGamme } from './gammes.api';

export interface FamilyWithGammes {
  mf_id: string;
  mf_name: string;
  mf_name_meta: string;
  mf_name_system: string;
  mf_description: string;
  mf_pic: string;
  mf_display: string;
  mf_sort: string;
  gammes: CatalogGamme[];
  gammes_count: number;
}

export interface HierarchyStats {
  total_families: number;
  total_gammes: number;
  total_manufacturers: number;
  families_with_gammes: number;
}

export interface HomepageHierarchyData {
  families: FamilyWithGammes[];
  stats: HierarchyStats;
  display_count: number;
  total_available: number;
}

export interface HierarchyApiResponse<T = any> {
  success: boolean;
  data?: T;
  families?: FamilyWithGammes[];
  stats?: HierarchyStats;
  count?: number;
  display_count?: number;
  total_available?: number;
  message?: string;
  error?: string;
}

// Fonction fetcher locale
async function fetcher(url: string): Promise<any> {
  // Assurer que l'URL est absolue pour les appels côté serveur
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * 🏗️ Service API pour la hiérarchie des familles et gammes
 */
class HierarchyApiService {
  private baseUrl = '/api/catalog/hierarchy';

  /**
   * 🏗️ Récupère la hiérarchie complète
   */
  async getFullHierarchy(): Promise<HomepageHierarchyData> {
    try {
      console.log('🏗️ Récupération hiérarchie complète...');

      const response: HierarchyApiResponse = await fetcher(`${this.baseUrl}/full`);

      if (!response.success) {
        throw new Error(response.error || 'Erreur lors de la récupération de la hiérarchie');
      }

      const data: HomepageHierarchyData = {
        families: response.families || [],
        stats: response.stats || {
          total_families: 0,
          total_gammes: 0,
          total_manufacturers: 0,
          families_with_gammes: 0,
        },
        display_count: response.families?.length || 0,
        total_available: response.stats?.total_families || 0,
      };

      console.log(`✅ Hiérarchie: ${data.families.length} familles, ${data.stats.total_gammes} gammes`);
      return data;
    } catch (error) {
      console.error('❌ Erreur hiérarchie complète:', error);
      throw error;
    }
  }

  /**
   * 🏠 Récupère les données optimisées pour la homepage
   */
  async getHomepageData(): Promise<HomepageHierarchyData> {
    try {
      console.log('🏠 Récupération données homepage...');

      const response: HierarchyApiResponse = await fetcher(`${this.baseUrl}/homepage`);

      if (!response.success) {
        throw new Error(response.error || 'Erreur lors de la récupération des données homepage');
      }

      const data: HomepageHierarchyData = {
        families: response.families || [],
        stats: response.stats || {
          total_families: 0,
          total_gammes: 0,
          total_manufacturers: 0,
          families_with_gammes: 0,
        },
        display_count: response.display_count || response.families?.length || 0,
        total_available: response.total_available || response.stats?.total_families || 0,
      };

      console.log(`✅ Homepage: ${data.display_count}/${data.total_available} familles, ${data.stats.total_gammes} gammes`);
      return data;
    } catch (error) {
      console.error('❌ Erreur données homepage:', error);
      throw error;
    }
  }

  /**
   * 🏗️ Récupère une famille avec ses gammes par ID
   */
  async getFamilyWithGammesById(familyId: string): Promise<FamilyWithGammes | null> {
    try {
      console.log(`🏗️ Récupération famille ${familyId} avec gammes...`);

      const response: HierarchyApiResponse = await fetcher(
        `${this.baseUrl}/family/${familyId}`
      );

      if (!response.success) {
        console.warn(`⚠️ Famille ${familyId} non trouvée:`, response.error);
        return null;
      }

      console.log(`✅ Famille ${familyId} avec ${response.data?.gammes_count || 0} gammes récupérée`);
      return response.data || null;

    } catch (error) {
      console.error(`❌ Erreur famille ${familyId} avec gammes:`, error);
      return null;
    }
  }

  /**
   * 🎨 Récupère l'icône d'une famille
   */
  getFamilyIcon(family: FamilyWithGammes): string {
    const iconMap: { [id: string]: string } = {
      '1': '🔧', // Système de filtration
      '2': '🛠️', // Système de freinage
      '3': '⚙️', // Système d'échappement
      '4': '🔌', // Système électrique
      '5': '🏁', // Performance
      '6': '🛡️', // Protection
      '7': '💡', // Éclairage
      '8': '🌡️', // Refroidissement
      '9': '🚗', // Carrosserie
      '10': '🔩', // Visserie
    };

    return iconMap[family.mf_id] || '🔧';
  }

  /**
   * 🖼️ Obtient l'URL de l'image d'une famille
   */
  getFamilyImage(family: FamilyWithGammes): string {
    if (!family.mf_pic) {
      return '/images/categories/default.svg';
    }
    
    // URL de base Supabase Storage pour les images des familles
    const supabaseStorageUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/familles-produits/';
    
    // Utiliser l'image depuis Supabase Storage
    return `${supabaseStorageUrl}${family.mf_pic}`;
  }

  /**
   * 🎨 Récupère la couleur d'une famille
   */
  getFamilyColor(family: FamilyWithGammes): string {
    const colors = [
      'from-blue-500 to-blue-600',    // Filtration
      'from-red-500 to-red-600',      // Freinage
      'from-gray-500 to-gray-600',    // Échappement
      'from-yellow-500 to-yellow-600', // Électrique
      'from-green-500 to-green-600',  // Performance
      'from-purple-500 to-purple-600', // Protection
      'from-indigo-500 to-indigo-600', // Éclairage
      'from-cyan-500 to-cyan-600',    // Refroidissement
      'from-pink-500 to-pink-600',    // Carrosserie
      'from-orange-500 to-orange-600', // Visserie
    ];

    const index = parseInt(family.mf_id) - 1;
    return colors[index] || 'from-gray-500 to-gray-600';
  }
}

// Instance singleton
export const hierarchyApi = new HierarchyApiService();