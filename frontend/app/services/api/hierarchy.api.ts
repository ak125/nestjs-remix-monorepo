// 📁 frontend/app/services/api/hierarchy.api.ts
// 🏗️ Service API pour la hiérarchie Familles → Gammes (sous-catégories)

import { type CatalogGamme } from '../../types/catalog.types';

export interface FamilyWithGammes {
  mf_id: string | number; // Peut être string ou number selon la source
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
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * 🏗️ Service API pour la hiérarchie des familles et gammes
 */
class HierarchyApiService {
  private getBaseUrl(): string {
    // Côté serveur (SSR) : utiliser l'URL complète
    // Côté client : utiliser l'URL relative
    return typeof window === 'undefined' 
      ? (process.env.API_URL || 'http://localhost:3000')
      : '';
  }

  /**
   * 🏗️ Récupère la hiérarchie complète via la nouvelle API unifiée
   */
  async getFullHierarchy(): Promise<HomepageHierarchyData> {
    try {
      console.log('🏗️ Récupération hiérarchie complète...');

      const baseUrl = this.getBaseUrl();
      const response = await fetcher(`${baseUrl}/api/catalog/gammes/hierarchy`);

      // L'API retourne { families: [...], stats: {...} } avec le nouveau format
      // On doit mapper vers l'ancien format attendu par le frontend
      const mappedFamilies: FamilyWithGammes[] = (response.families || []).map((family: any) => ({
        mf_id: family.id,
        mf_name: family.name,
        mf_name_meta: family.name,
        mf_name_system: family.system_name,
        mf_description: family.description || '',
        mf_pic: family.image || '',
        mf_display: '1',
        mf_sort: family.sort_order?.toString() || '0',
        // Mapper les gammes du format nouveau vers l'ancien
        gammes: (family.gammes || []).map((gamme: any) => ({
          pg_id: parseInt(gamme.id),
          pg_alias: gamme.alias || gamme.name,
          pg_name: gamme.name,
          pg_name_url: gamme.alias || gamme.name.toLowerCase().replace(/\s+/g, '-'),
          pg_name_meta: gamme.name,
          pg_pic: gamme.image || '',
          pg_img: gamme.image || '',
          mc_sort: gamme.sort_order || 0,
        })),
        gammes_count: family.gammes?.length || 0,
      }));

      const data: HomepageHierarchyData = {
        families: mappedFamilies,
        stats: response.stats || {
          total_families: 0,
          total_gammes: 0,
          total_manufacturers: 0,
          families_with_gammes: 0,
        },
        display_count: mappedFamilies.length,
        total_available: response.stats?.total_families || 0,
      };

      console.log(`✅ Hiérarchie: ${data.families.length} familles, ${data.stats.total_gammes} gammes`);
      return data;
    } catch (error) {
      console.error('❌ Erreur hiérarchie complète:', error);
      return {
        families: [],
        stats: {
          total_families: 0,
          total_gammes: 0,
          total_manufacturers: 0,
          families_with_gammes: 0,
        },
        display_count: 0,
        total_available: 0,
      };
    }
  }

  /**
   * 🏠 Récupère les données optimisées pour la homepage via la nouvelle API unifiée
   */
  async getHomepageData(): Promise<HomepageHierarchyData> {
    try {
      console.log('🏠 Récupération données homepage...');

      const baseUrl = this.getBaseUrl();
      const response = await fetcher(`${baseUrl}/api/catalog/gammes/hierarchy`);

      // L'API retourne { families: [...], stats: {...} } avec le nouveau format
      // On doit mapper vers l'ancien format attendu par le frontend
      const mappedFamilies: FamilyWithGammes[] = (response.families || []).map((family: any) => ({
        mf_id: family.id,
        mf_name: family.name,
        mf_name_meta: family.name,
        mf_name_system: family.system_name,
        mf_description: family.description || '',
        mf_pic: family.image || '',
        mf_display: '1',
        mf_sort: family.sort_order?.toString() || '0',
        // Mapper les gammes du format nouveau vers l'ancien
        gammes: (family.gammes || []).map((gamme: any) => ({
          pg_id: parseInt(gamme.id),
          pg_alias: gamme.alias || gamme.name,
          pg_name: gamme.name,
          pg_name_url: gamme.alias || gamme.name.toLowerCase().replace(/\s+/g, '-'),
          pg_name_meta: gamme.name,
          pg_pic: gamme.image || '',
          pg_img: gamme.image || '',
          mc_sort: gamme.sort_order || 0,
        })),
        gammes_count: family.gammes?.length || 0,
      }));

      const data: HomepageHierarchyData = {
        families: mappedFamilies,
        stats: response.stats || {
          total_families: 0,
          total_gammes: 0,
          total_manufacturers: 0,
          families_with_gammes: 0,
        },
        display_count: mappedFamilies.length,
        total_available: response.stats?.total_families || 0,
      };

      console.log(`✅ Homepage: ${data.display_count}/${data.total_available} familles, ${data.stats.total_gammes} gammes`);
      return data;
    } catch (error) {
      console.error('❌ Erreur données homepage:', error);
      return {
        families: [],
        stats: {
          total_families: 0,
          total_gammes: 0,
          total_manufacturers: 0,
          families_with_gammes: 0,
        },
        display_count: 0,
        total_available: 0,
      };
    }
  }

  /**
   * 🏗️ Récupère une famille avec ses gammes par ID
   */
  async getFamilyWithGammesById(familyId: string): Promise<FamilyWithGammes | null> {
    try {
      console.log(`🏗️ Récupération famille ${familyId} avec gammes...`);

      const baseUrl = this.getBaseUrl();
      const response: HierarchyApiResponse = await fetcher(
        `${baseUrl}/api/catalog/hierarchy/family/${familyId}`
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
    // Mapping par ID numérique
    const iconMapById: { [id: string]: string } = {
      '1': '🔧', // Système de filtration
      '2': '🛠️', // Système de freinage
      '3': '⚙️', // Système de distribution
      '4': '🔌', // Système électrique / Allumage préchauffage
      '5': '🏁', // Train avant
      '6': '🛡️', // Amortisseur suspension
      '7': '💡', // Éclairage
      '8': '🌡️', // Refroidissement
      '9': '🚗', // Carrosserie
      '10': '🔩', // Moteur
      '11': '🔊', // Échappement
      '12': '⚙️', // Transmission
      '13': '🔌', // Capteurs
      '14': '⛽', // Alimentation
      '15': '🏭', // Support moteur
      '16': '💨', // Turbo
      '17': '❄️', // Climatisation
      '18': '🎨', // Accessoires
      '19': '🔄', // Embrayage
    };
    
    // Mapping par nom de famille (fallback)
    const iconMapByName: { [key: string]: string } = {
      'filtration': '🔧',
      'freinage': '🛠️',
      'distribution': '⚙️',
      'électrique': '🔌',
      'allumage': '🔌',
      'préchauffage': '🔌',
      'train': '🏁',
      'direction': '🏁',
      'amortisseur': '🛡️',
      'suspension': '🛡️',
      'éclairage': '💡',
      'eclairage': '💡',
      'refroidissement': '🌡️',
      'carrosserie': '🚗',
      'moteur': '🔩',
      'échappement': '🔊',
      'echappement': '🔊',
      'transmission': '⚙️',
      'capteur': '🔌',
      'alimentation': '⛽',
      'support': '🏭',
      'turbo': '💨',
      'climatisation': '❄️',
      'clim': '❄️',
      'accessoire': '🎨',
      'embrayage': '🔄',
    };

    // Essayer d'abord par ID
    const idStr = family.mf_id?.toString();
    if (idStr && iconMapById[idStr]) {
      return iconMapById[idStr];
    }

    // Fallback: chercher par nom (normaliser sans accents)
    const familyName = (family.mf_name_system || family.mf_name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Enlever les accents
    
    for (const [keyword, icon] of Object.entries(iconMapByName)) {
      if (familyName.includes(keyword)) {
        return icon;
      }
    }

    // Fallback final
    return '🔧';
  }

  /**
   * 🖼️ Obtient l'URL de l'image d'une famille
   * ✅ OPTIMISÉ WEBP - Conversion automatique sans re-upload !
   */
  getFamilyImage(family: FamilyWithGammes): string {
    if (!family.mf_pic) {
      return '/images/categories/default.svg';
    }
    
    // ✅ URL DIRECTE comme dans FamilyGammeHierarchy (fonctionne en prod)
    const supabaseStorageUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/familles-produits/';
    return `${supabaseStorageUrl}${family.mf_pic}`;
  }

  /**
   * 🎨 Récupère la couleur d'une famille
   * Palette complète de 30+ couleurs distinctes et sémantiques
   */
  getFamilyColor(family: FamilyWithGammes): string {
    // 🎨 Mapping complet par ID - Palette étendue et distinctive
    const colorMapById: { [id: string]: string } = {
      // === MÉCANIQUE & MOTEUR ===
      '1': 'from-blue-500 to-blue-700',           // Filtration (eau/purification)
      '2': 'from-red-600 to-rose-700',            // Freinage (danger/stop)
      '3': 'from-slate-600 to-slate-800',         // Distribution (précision mécanique)
      '4': 'from-yellow-400 to-amber-600',        // Électrique/Allumage (énergie)
      '10': 'from-orange-600 to-red-700',         // Moteur (puissance/feu)
      '14': 'from-lime-500 to-green-600',         // Alimentation (carburant/énergie)
      '16': 'from-rose-600 to-pink-700',          // Turbo (performance)
      '19': 'from-emerald-600 to-green-700',      // Embrayage (transmission force)
      
      // === TRAIN ROULANT ===
      '5': 'from-emerald-500 to-teal-600',        // Train avant (stabilité)
      '6': 'from-purple-600 to-violet-700',       // Amortisseur (confort)
      '12': 'from-teal-600 to-cyan-700',          // Transmission (fluidité)
      '15': 'from-violet-600 to-purple-800',      // Support moteur (isolation)
      
      // === SYSTÈMES ÉLECTRONIQUES ===
      '7': 'from-indigo-500 to-blue-700',         // Éclairage (lumière)
      '13': 'from-amber-600 to-orange-700',       // Capteurs (technologie)
      
      // === CONFORT & HABITACLE ===
      '8': 'from-cyan-400 to-blue-600',           // Refroidissement (froid)
      '17': 'from-sky-400 to-cyan-600',           // Climatisation (fraîcheur)
      '18': 'from-fuchsia-500 to-pink-600',       // Accessoires (style)
      
      // === STRUCTURE & CARROSSERIE ===
      '9': 'from-pink-500 to-rose-600',           // Carrosserie (protection)
      '11': 'from-gray-700 to-neutral-800',       // Échappement (fumée)
      
      // === COULEURS SUPPLÉMENTAIRES (ID 20-50) ===
      '20': 'from-blue-400 to-indigo-600',        // Variante bleu
      '21': 'from-green-400 to-emerald-600',      // Variante vert
      '22': 'from-red-400 to-rose-600',           // Variante rouge
      '23': 'from-purple-400 to-fuchsia-600',     // Variante violet
      '24': 'from-yellow-300 to-orange-500',      // Variante jaune
      '25': 'from-cyan-300 to-teal-600',          // Variante cyan
      '26': 'from-indigo-400 to-purple-700',      // Variante indigo
      '27': 'from-lime-400 to-green-700',         // Variante lime
      '28': 'from-amber-400 to-yellow-700',       // Variante amber
      '29': 'from-rose-400 to-red-700',           // Variante rose
      '30': 'from-teal-400 to-cyan-700',          // Variante teal
      '31': 'from-violet-400 to-purple-700',      // Variante violet
      '32': 'from-sky-300 to-blue-700',           // Variante sky
      '33': 'from-emerald-400 to-teal-700',       // Variante emerald
      '34': 'from-orange-400 to-red-600',         // Variante orange
      '35': 'from-pink-400 to-fuchsia-700',       // Variante pink
      '36': 'from-slate-400 to-gray-700',         // Variante slate
      '37': 'from-zinc-500 to-slate-700',         // Variante zinc
      '38': 'from-neutral-500 to-gray-700',       // Variante neutral
      '39': 'from-stone-500 to-slate-700',        // Variante stone
      '40': 'from-red-500 to-orange-700',         // Rouge-orange
      '41': 'from-blue-300 to-cyan-600',          // Bleu clair
      '42': 'from-green-300 to-lime-600',         // Vert clair
      '43': 'from-purple-300 to-violet-600',      // Violet clair
      '44': 'from-yellow-200 to-amber-600',       // Jaune clair
      '45': 'from-pink-300 to-rose-600',          // Rose clair
      '46': 'from-indigo-300 to-blue-600',        // Indigo clair
      '47': 'from-teal-300 to-emerald-600',       // Teal clair
      '48': 'from-orange-300 to-red-600',         // Orange clair
      '49': 'from-fuchsia-300 to-pink-600',       // Fuchsia clair
      '50': 'from-cyan-200 to-teal-600',          // Cyan clair
    };
    
    // 📖 Mapping étendu par nom (fallback intelligent)
    const colorMapByName: { [key: string]: string } = {
      // Mécanique & Moteur
      'filtration': 'from-blue-500 to-blue-700',
      'filtre': 'from-blue-500 to-blue-700',
      'freinage': 'from-red-600 to-rose-700',
      'frein': 'from-red-600 to-rose-700',
      'distribution': 'from-slate-600 to-slate-800',
      'courroie': 'from-slate-600 to-slate-800',
      'électrique': 'from-yellow-400 to-amber-600',
      'electrique': 'from-yellow-400 to-amber-600',
      'allumage': 'from-yellow-400 to-amber-600',
      'batterie': 'from-yellow-400 to-amber-600',
      'moteur': 'from-orange-600 to-red-700',
      'bloc': 'from-orange-600 to-red-700',
      'alimentation': 'from-lime-500 to-green-600',
      'carburant': 'from-lime-500 to-green-600',
      'essence': 'from-lime-500 to-green-600',
      'diesel': 'from-lime-500 to-green-600',
      'turbo': 'from-rose-600 to-pink-700',
      'compresseur': 'from-rose-600 to-pink-700',
      'embrayage': 'from-emerald-600 to-green-700',
      'volant': 'from-emerald-600 to-green-700',
      
      // Train roulant
      'train': 'from-emerald-500 to-teal-600',
      'direction': 'from-emerald-500 to-teal-600',
      'cremaillere': 'from-emerald-500 to-teal-600',
      'amortisseur': 'from-purple-600 to-violet-700',
      'suspension': 'from-purple-600 to-violet-700',
      'ressort': 'from-purple-600 to-violet-700',
      'transmission': 'from-teal-600 to-cyan-700',
      'boite': 'from-teal-600 to-cyan-700',
      'differentiel': 'from-teal-600 to-cyan-700',
      'support': 'from-violet-600 to-purple-800',
      'silent': 'from-violet-600 to-purple-800',
      'tampon': 'from-violet-600 to-purple-800',
      
      // Électronique
      'éclairage': 'from-indigo-500 to-blue-700',
      'eclairage': 'from-indigo-500 to-blue-700',
      'phare': 'from-indigo-500 to-blue-700',
      'feu': 'from-indigo-500 to-blue-700',
      'capteur': 'from-amber-600 to-orange-700',
      'sonde': 'from-amber-600 to-orange-700',
      'calculateur': 'from-amber-600 to-orange-700',
      
      // Confort
      'refroidissement': 'from-cyan-400 to-blue-600',
      'radiateur': 'from-cyan-400 to-blue-600',
      'eau': 'from-cyan-400 to-blue-600',
      'climatisation': 'from-sky-400 to-cyan-600',
      'clim': 'from-sky-400 to-cyan-600',
      'condenseur': 'from-sky-400 to-cyan-600',
      'accessoire': 'from-fuchsia-500 to-pink-600',
      'interieur': 'from-fuchsia-500 to-pink-600',
      'equipement': 'from-fuchsia-500 to-pink-600',
      
      // Structure
      'carrosserie': 'from-pink-500 to-rose-600',
      'aile': 'from-pink-500 to-rose-600',
      'pare': 'from-pink-500 to-rose-600',
      'capot': 'from-pink-500 to-rose-600',
      'échappement': 'from-gray-700 to-neutral-800',
      'echappement': 'from-gray-700 to-neutral-800',
      'silencieux': 'from-gray-700 to-neutral-800',
      'pot': 'from-gray-700 to-neutral-800',
      
      // Autres systèmes
      'lubrifiant': 'from-amber-500 to-yellow-700',
      'huile': 'from-amber-500 to-yellow-700',
      'liquide': 'from-cyan-300 to-blue-600',
      'pneumatique': 'from-zinc-600 to-slate-800',
      'pneu': 'from-zinc-600 to-slate-800',
      'roue': 'from-zinc-600 to-slate-800',
      'vitrage': 'from-sky-300 to-blue-500',
      'pare-brise': 'from-sky-300 to-blue-500',
      'vitre': 'from-sky-300 to-blue-500',
    };

    // 1️⃣ Essayer d'abord par ID exact
    const idStr = family.mf_id?.toString();
    if (idStr && colorMapById[idStr]) {
      return colorMapById[idStr];
    }

    // 2️⃣ Fallback: chercher par nom (normaliser sans accents)
    const familyName = (family.mf_name_system || family.mf_name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    
    for (const [keyword, color] of Object.entries(colorMapByName)) {
      if (familyName.includes(keyword)) {
        return color;
      }
    }

    // 3️⃣ Fallback final: couleur par hash pour cohérence
    // Utilise l'ID pour générer une couleur consistante
    const colorPalette = [
      'from-blue-400 to-indigo-600',
      'from-green-400 to-emerald-600',
      'from-red-400 to-rose-600',
      'from-purple-400 to-fuchsia-600',
      'from-yellow-300 to-orange-500',
      'from-cyan-300 to-teal-600',
      'from-pink-400 to-rose-600',
      'from-indigo-400 to-purple-700',
      'from-lime-400 to-green-700',
      'from-amber-400 to-yellow-700',
    ];
    
    const hash = parseInt(idStr || '0', 10);
    return colorPalette[hash % colorPalette.length];
  }

}

// Instance singleton
export const hierarchyApi = new HierarchyApiService();