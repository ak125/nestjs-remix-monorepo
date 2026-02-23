// 📁 frontend/app/services/api/hierarchy.api.ts
// 🏗️ Service API pour la hiérarchie Familles → Gammes (sous-catégories)

import { getFamilyTheme } from "~/utils/family-theme";
import { logger } from "~/utils/logger";
import { type CatalogGamme } from "../../types/catalog.types";

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

export interface HierarchyApiResponse<T = unknown> {
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
    return typeof window === "undefined"
      ? process.env.API_URL || "http://localhost:3000"
      : "";
  }

  /**
   * 🏗️ Récupère la hiérarchie complète via la nouvelle API unifiée
   */
  async getFullHierarchy(): Promise<HomepageHierarchyData> {
    try {
      logger.log("🏗️ Récupération hiérarchie complète...");

      const baseUrl = this.getBaseUrl();
      const response = await fetcher(`${baseUrl}/api/catalog/gammes/hierarchy`);

      // L'API retourne { families: [...], stats: {...} } avec le nouveau format
      // On doit mapper vers l'ancien format attendu par le frontend
      const mappedFamilies: FamilyWithGammes[] = (response.families || []).map(
        (family: any) => ({
          mf_id: family.id,
          mf_name: family.name,
          mf_name_meta: family.name,
          mf_name_system: family.system_name,
          mf_description: family.description || "",
          mf_pic: family.image || "",
          mf_display: "1",
          mf_sort: family.sort_order?.toString() || "0",
          // Mapper les gammes du format nouveau vers l'ancien
          gammes: (family.gammes || []).map((gamme: any) => ({
            pg_id: parseInt(gamme.id),
            pg_alias: gamme.alias || gamme.name,
            pg_name: gamme.name,
            pg_name_url:
              gamme.alias || gamme.name.toLowerCase().replace(/\s+/g, "-"),
            pg_name_meta: gamme.name,
            pg_pic: gamme.image || "",
            pg_img: gamme.image || "",
            mc_sort: gamme.sort_order || 0,
          })),
          gammes_count: family.gammes?.length || 0,
        }),
      );

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

      logger.log(
        `✅ Hiérarchie: ${data.families.length} familles, ${data.stats.total_gammes} gammes`,
      );
      return data;
    } catch (error) {
      logger.error("❌ Erreur hiérarchie complète:", error);
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
      logger.log("🏠 Récupération données homepage...");

      const baseUrl = this.getBaseUrl();
      const response = await fetcher(`${baseUrl}/api/catalog/gammes/hierarchy`);

      // L'API retourne { families: [...], stats: {...} } avec le nouveau format
      // On doit mapper vers l'ancien format attendu par le frontend
      const mappedFamilies: FamilyWithGammes[] = (response.families || []).map(
        (family: any) => ({
          mf_id: family.id,
          mf_name: family.name,
          mf_name_meta: family.name,
          mf_name_system: family.system_name,
          mf_description: family.description || "",
          mf_pic: family.image || "",
          mf_display: "1",
          mf_sort: family.sort_order?.toString() || "0",
          // Mapper les gammes du format nouveau vers l'ancien
          gammes: (family.gammes || []).map((gamme: any) => ({
            pg_id: parseInt(gamme.id),
            pg_alias: gamme.alias || gamme.name,
            pg_name: gamme.name,
            pg_name_url:
              gamme.alias || gamme.name.toLowerCase().replace(/\s+/g, "-"),
            pg_name_meta: gamme.name,
            pg_pic: gamme.image || "",
            pg_img: gamme.image || "",
            mc_sort: gamme.sort_order || 0,
          })),
          gammes_count: family.gammes?.length || 0,
        }),
      );

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

      logger.log(
        `✅ Homepage: ${data.display_count}/${data.total_available} familles, ${data.stats.total_gammes} gammes`,
      );
      return data;
    } catch (error) {
      logger.error("❌ Erreur données homepage:", error);
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
  async getFamilyWithGammesById(
    familyId: string,
  ): Promise<FamilyWithGammes | null> {
    try {
      logger.log(`🏗️ Récupération famille ${familyId} avec gammes...`);

      const baseUrl = this.getBaseUrl();
      const response: HierarchyApiResponse<FamilyWithGammes> = await fetcher(
        `${baseUrl}/api/catalog/hierarchy/family/${familyId}`,
      );

      if (!response.success) {
        logger.warn(`⚠️ Famille ${familyId} non trouvée:`, response.error);
        return null;
      }

      logger.log(
        `✅ Famille ${familyId} avec ${response.data?.gammes_count || 0} gammes récupérée`,
      );
      return response.data || null;
    } catch (error) {
      logger.error(`❌ Erreur famille ${familyId} avec gammes:`, error);
      return null;
    }
  }

  /**
   * 🎨 Récupère l'icône d'une famille
   */
  getFamilyIcon(family: FamilyWithGammes): string {
    // Mapping par ID numérique
    const iconMapById: { [id: string]: string } = {
      "1": "🔧", // Système de filtration
      "2": "🛠️", // Système de freinage
      "3": "⚙️", // Système de distribution
      "4": "🔌", // Système électrique / Allumage préchauffage
      "5": "🏁", // Train avant
      "6": "🛡️", // Amortisseur suspension
      "7": "💡", // Éclairage
      "8": "🌡️", // Refroidissement
      "9": "🚗", // Carrosserie
      "10": "🔩", // Moteur
      "11": "🔊", // Échappement
      "12": "⚙️", // Transmission
      "13": "🔌", // Capteurs
      "14": "⛽", // Alimentation
      "15": "🏭", // Support moteur
      "16": "💨", // Turbo
      "17": "❄️", // Climatisation
      "18": "🎨", // Accessoires
      "19": "🔄", // Embrayage
    };

    // Mapping par nom de famille (fallback)
    const iconMapByName: { [key: string]: string } = {
      filtration: "🔧",
      freinage: "🛠️",
      distribution: "⚙️",
      électrique: "🔌",
      allumage: "🔌",
      préchauffage: "🔌",
      train: "🏁",
      direction: "🏁",
      amortisseur: "🛡️",
      suspension: "🛡️",
      éclairage: "💡",
      eclairage: "💡",
      refroidissement: "🌡️",
      carrosserie: "🚗",
      moteur: "🔩",
      échappement: "🔊",
      echappement: "🔊",
      transmission: "⚙️",
      capteur: "🔌",
      alimentation: "⛽",
      support: "🏭",
      turbo: "💨",
      climatisation: "❄️",
      clim: "❄️",
      accessoire: "🎨",
      embrayage: "🔄",
    };

    // Essayer d'abord par ID
    const idStr = family.mf_id?.toString();
    if (idStr && iconMapById[idStr]) {
      return iconMapById[idStr];
    }

    // Fallback: chercher par nom (normaliser sans accents)
    const familyName = (family.mf_name_system || family.mf_name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); // Enlever les accents

    for (const [keyword, icon] of Object.entries(iconMapByName)) {
      if (familyName.includes(keyword)) {
        return icon;
      }
    }

    // Fallback final
    return "🔧";
  }

  /**
   * 🖼️ Obtient l'URL de l'image d'une famille
   * ✅ Migration /img/* : Proxy Caddy avec cache 1 an
   */
  getFamilyImage(family: FamilyWithGammes): string {
    if (!family.mf_pic) {
      return "/images/categories/default.svg";
    }

    // ✅ Migration /img/* : Proxy Caddy au lieu d'URL Supabase directe
    return `/img/uploads/articles/familles-produits/${family.mf_pic}`;
  }

  /**
   * Recupere la couleur gradient d'une famille.
   * Delegue a getFamilyTheme() pour la source unique de verite.
   * @deprecated Preferer getFamilyTheme() pour obtenir le theme complet.
   */
  getFamilyColor(family: FamilyWithGammes): string {
    const id = family.mf_id?.toString();
    const name = family.mf_name_system || family.mf_name || "";
    return getFamilyTheme(id || name).gradient;
  }
}

// Instance singleton
export const hierarchyApi = new HierarchyApiService();
