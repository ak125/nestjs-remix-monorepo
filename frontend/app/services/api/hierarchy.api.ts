// 📁 frontend/app/services/api/hierarchy.api.ts
// 🏗️ Service API pour la hiérarchie Familles → Gammes
// Source unique : /api/catalog/homepage-families (CatalogHierarchyService)

import { FAMILY_REGISTRY } from "@repo/database-types";
import { getFamilyTheme } from "~/utils/family-theme";
import { logger } from "~/utils/logger";
import { type CatalogGamme } from "../../types/catalog.types";

export interface FamilyWithGammes {
  mf_id: string | number;
  mf_name: string;
  mf_name_meta?: string;
  mf_name_system?: string;
  mf_description: string;
  mf_pic: string;
  mf_display?: string;
  mf_sort: string | number;
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

/**
 * 🏗️ Service API pour la hiérarchie des familles et gammes
 * Source unique : /api/catalog/homepage-families
 */
class HierarchyApiService {
  private getBaseUrl(): string {
    return typeof window === "undefined"
      ? process.env.API_URL || "http://localhost:3000"
      : "";
  }

  /**
   * Fetch la hiérarchie depuis le endpoint unique
   */
  private async fetchHierarchy(): Promise<FamilyWithGammes[]> {
    const baseUrl = this.getBaseUrl();
    const response = await fetch(`${baseUrl}/api/catalog/homepage-families`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    // L'endpoint retourne { success, catalog: { families: [...] } }
    return data.catalog?.families ?? data.families ?? [];
  }

  /**
   * 🏗️ Récupère la hiérarchie complète
   */
  async getFullHierarchy(): Promise<HomepageHierarchyData> {
    try {
      logger.log("Récupération hiérarchie complète...");
      const families = await this.fetchHierarchy();

      const totalGammes = families.reduce(
        (sum, f) => sum + (f.gammes_count || f.gammes?.length || 0),
        0,
      );

      return {
        families,
        stats: {
          total_families: families.length,
          total_gammes: totalGammes,
          total_manufacturers: 0,
          families_with_gammes: families.filter((f) => f.gammes_count > 0)
            .length,
        },
        display_count: families.length,
        total_available: families.length,
      };
    } catch (error) {
      logger.error("Erreur hiérarchie complète:", error);
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
   * 🏠 Récupère les données pour la homepage (alias de getFullHierarchy)
   */
  async getHomepageData(): Promise<HomepageHierarchyData> {
    return this.getFullHierarchy();
  }

  /**
   * 🏗️ Récupère une famille avec ses gammes par ID
   */
  async getFamilyWithGammesById(
    familyId: string,
  ): Promise<FamilyWithGammes | null> {
    try {
      const families = await this.fetchHierarchy();
      return families.find((f) => String(f.mf_id) === String(familyId)) || null;
    } catch (error) {
      logger.error(`Erreur famille ${familyId}:`, error);
      return null;
    }
  }

  /**
   * 🎨 Récupère l'icône d'une famille
   */
  getFamilyIcon(family: FamilyWithGammes): string {
    const mfId = Number(family.mf_id);
    const meta = FAMILY_REGISTRY[mfId];
    return meta?.emoji ?? "🔧";
  }

  /**
   * 🖼️ Obtient l'URL de l'image d'une famille
   */
  getFamilyImage(family: FamilyWithGammes): string {
    if (!family.mf_pic) {
      return "/images/categories/default.svg";
    }
    return `/img/uploads/articles/familles-produits/${family.mf_pic}`;
  }

  /**
   * Récupère la couleur gradient d'une famille.
   * Délègue à getFamilyTheme() pour la source unique de vérité.
   * @deprecated Préférer getFamilyTheme() directement.
   */
  getFamilyColor(family: FamilyWithGammes): string {
    const id = family.mf_id?.toString();
    const name = family.mf_name_system || family.mf_name || "";
    return getFamilyTheme(id || name).gradient;
  }
}

// Instance singleton
export const hierarchyApi = new HierarchyApiService();
