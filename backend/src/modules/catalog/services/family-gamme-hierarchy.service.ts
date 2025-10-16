// 📁 backend/src/modules/catalog/services/family-gamme-hierarchy.service.ts
// 🏗️ Service pour gérer la hiérarchie Familles → Gammes (sous-catégories)

import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CatalogFamily } from '../interfaces/catalog-family.interface';
import { CatalogGamme, CatalogGammeService } from './catalog-gamme.service';

export interface FamilyWithGammes extends CatalogFamily {
  gammes: CatalogGamme[];
  gammes_count: number;
}

export interface FamilyGammeHierarchy {
  [familyId: string]: {
    family: CatalogFamily;
    gammes: CatalogGamme[];
    stats: {
      total_gammes: number;
      manufacturers_count: number;
    };
  };
}

export interface HierarchyStats {
  total_families: number;
  total_gammes: number;
  total_manufacturers: number;
  families_with_gammes: number;
}

@Injectable()
export class FamilyGammeHierarchyService extends SupabaseBaseService {
  constructor(private readonly catalogGammeService: CatalogGammeService) {
    super();
  }

  /**
   * 🏗️ Récupère la hiérarchie complète Familles → Gammes
   */
  async getFamilyGammeHierarchy(): Promise<{
    hierarchy: FamilyGammeHierarchy;
    stats: HierarchyStats;
  }> {
    try {
      this.logger.log('🏗️ Construction hiérarchie Familles → Gammes...');

      // 1. Récupérer toutes les familles actives
      const { data: families, error: familiesError } = await this.supabase
        .from('catalog_family')
        .select('*')
        .eq('mf_display', '1')
        .order('mf_sort', { ascending: true });

      if (familiesError) {
        throw new BadRequestException(
          `Erreur familles: ${familiesError.message}`,
        );
      }

      // 2. Récupérer toutes les gammes avec noms enrichis
      const gammes = await this.catalogGammeService.getAllGammes();

      // 3. Créer le mapping famille → gammes
      // Note: il faut identifier comment lier catalog_family à catalog_gamme
      // Pour l'instant, nous utilisons une logique simple de regroupement
      const hierarchy: FamilyGammeHierarchy = {};

      // Initialiser toutes les familles
      for (const family of families || []) {
        hierarchy[family.mf_id] = {
          family,
          gammes: [],
          stats: {
            total_gammes: 0,
            manufacturers_count: 0,
          },
        };
      }

      // 4. Distribuer les gammes dans les familles
      // CORRECTION: Utiliser mc_mf_prime qui est l'ID de la famille réelle

      for (const gamme of gammes || []) {
        // mc_mf_prime correspond à l'ID de la famille (mf_id)
        const familyId = gamme.mc_mf_prime;

        if (familyId && hierarchy[familyId]) {
          hierarchy[familyId].gammes.push(gamme);
          hierarchy[familyId].stats.total_gammes++;

          // Compter les fabricants uniques pour cette famille
          const uniqueManufacturers = new Set(
            hierarchy[familyId].gammes.map((g) => g.mc_mf_id),
          );
          hierarchy[familyId].stats.manufacturers_count =
            uniqueManufacturers.size;
        }
      }

      // 5. Trier les gammes au sein de chaque famille par mc_sort
      Object.values(hierarchy).forEach((family) => {
        family.gammes.sort((a, b) => parseInt(a.mc_sort) - parseInt(b.mc_sort));
      });

      // 6. Calculer les statistiques globales
      const stats = this.calculateHierarchyStats(hierarchy, gammes || []);

      this.logger.log(
        `✅ Hiérarchie construite: ${stats.total_families} familles, ${stats.total_gammes} gammes`,
      );

      return { hierarchy, stats };
    } catch (error) {
      this.logger.error('❌ Erreur construction hiérarchie:', error);
      throw new BadRequestException(
        'Erreur lors de la construction de la hiérarchie',
      );
    }
  }

  /**
   * 🏗️ Récupère les familles avec leurs sous-catégories pour affichage homepage
   */
  async getFamiliesWithSubcategories(): Promise<FamilyWithGammes[]> {
    try {
      this.logger.log('🏗️ Récupération familles avec sous-catégories...');

      const { hierarchy } = await this.getFamilyGammeHierarchy();

      const familiesWithGammes: FamilyWithGammes[] = Object.values(hierarchy)
        .map((item) => ({
          ...item.family,
          gammes: item.gammes,
          gammes_count: item.stats.total_gammes,
        }))
        .filter((family) => family.gammes_count > 0) // Seulement les familles avec gammes
        .sort((a, b) => {
          const sortA = a.mf_sort || 0;
          const sortB = b.mf_sort || 0;
          return sortA - sortB;
        });

      this.logger.log(
        `✅ ${familiesWithGammes.length} familles avec sous-catégories préparées`,
      );
      return familiesWithGammes;
    } catch (error) {
      this.logger.error('❌ Erreur familles avec sous-catégories:', error);
      throw new BadRequestException(
        'Erreur lors de la récupération des familles avec sous-catégories',
      );
    }
  }

  /**
   * 🔗 Crée le mapping fabricant → famille
   */
  private createManufacturerToFamilyMapping(families: CatalogFamily[]): {
    [manufacturerId: string]: string;
  } {
    const mapping: { [manufacturerId: string]: string } = {};

    // Logique simple: attribuer les fabricants aux familles
    // Cette logique peut être raffinée selon vos besoins métier
    for (const family of families) {
      // Exemple: famille 1 = fabricants 1-3, famille 2 = fabricants 4-6, etc.
      const familyIndex = family.mf_id;
      const startManufacturer = (familyIndex - 1) * 3 + 1;
      const endManufacturer = familyIndex * 3;

      for (
        let mfId = startManufacturer;
        mfId <= endManufacturer && mfId <= 20;
        mfId++
      ) {
        mapping[mfId.toString()] = family.mf_id.toString();
      }
    }

    return mapping;
  }

  /**
   * 🎯 Mappe une gamme à une famille
   */
  private mapGammeToFamily(
    gamme: CatalogGamme,
    mapping: { [manufacturerId: string]: string },
  ): string | null {
    // Utiliser le mapping fabricant → famille
    const familyId = mapping[gamme.mc_mf_id];
    if (familyId) return familyId;

    // Fallback: distribution basée sur l'ID du fabricant
    const manufacturerId = parseInt(gamme.mc_mf_id);
    if (manufacturerId <= 5) return '1'; // Système de filtration
    if (manufacturerId <= 10) return '2'; // Système de freinage
    if (manufacturerId <= 15) return '3'; // Système d'échappement
    if (manufacturerId <= 20) return '4'; // Système électrique

    return '1'; // Par défaut, première famille
  }

  /**
   * 📊 Calcule les statistiques de la hiérarchie
   */
  private calculateHierarchyStats(
    hierarchy: FamilyGammeHierarchy,
    allGammes: CatalogGamme[],
  ): HierarchyStats {
    const familiesWithGammes = Object.values(hierarchy).filter(
      (item) => item.stats.total_gammes > 0,
    );
    const uniqueManufacturers = new Set(allGammes.map((g) => g.mc_mf_id));

    return {
      total_families: Object.keys(hierarchy).length,
      total_gammes: allGammes.length,
      total_manufacturers: uniqueManufacturers.size,
      families_with_gammes: familiesWithGammes.length,
    };
  }

  /**
   * 🔍 Récupère une famille avec ses gammes par ID
   */
  async getFamilyWithGammesById(
    familyId: string,
  ): Promise<FamilyWithGammes | null> {
    try {
      this.logger.log(`🔍 Récupération famille ${familyId} avec gammes...`);

      const { hierarchy } = await this.getFamilyGammeHierarchy();
      const familyData = hierarchy[familyId];

      if (!familyData) {
        this.logger.warn(`⚠️ Famille ${familyId} non trouvée`);
        return null;
      }

      const familyWithGammes: FamilyWithGammes = {
        ...familyData.family,
        gammes: familyData.gammes,
        gammes_count: familyData.stats.total_gammes,
      };

      this.logger.log(
        `✅ Famille ${familyId} avec ${familyWithGammes.gammes_count} gammes récupérée`,
      );
      return familyWithGammes;
    } catch (error) {
      this.logger.error(`❌ Erreur famille ${familyId} avec gammes:`, error);
      return null;
    }
  }
}
