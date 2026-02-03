// 📁 backend/src/modules/catalog/services/family-gamme-hierarchy.service.ts
// 🏗️ Service pour gérer la hiérarchie Familles → Gammes (sous-catégories)

import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CatalogFamily } from '../interfaces/catalog-family.interface';
import { CatalogGamme, CatalogGammeService } from './catalog-gamme.service';
import { GammeUnifiedService } from './gamme-unified.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';

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
  constructor(
    private readonly catalogGammeService: CatalogGammeService,
    private readonly gammeUnifiedService: GammeUnifiedService,
    rpcGate: RpcGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * 🏗️ Récupère la hiérarchie complète Familles → Gammes (OPTIMISÉ - 1 seule requête SQL)
   */
  async getFamilyGammeHierarchy(): Promise<{
    hierarchy: FamilyGammeHierarchy;
    stats: HierarchyStats;
  }> {
    try {
      this.logger.log('🏗️ Construction hiérarchie Familles → Gammes...');

      // 🚀 OPTIMISATION: Une seule requête avec jointure SQL native
      // 🛡️ RPC Safety Gate
      const { data: results, error } = await this.callRpc<any[]>(
        'get_catalog_hierarchy_optimized',
        {},
        { source: 'api' },
      );

      if (error) {
        this.logger.error(
          '❌ Erreur requête optimisée, fallback vers méthode classique:',
          error,
        );
        // Fallback vers l'ancienne méthode
        return this.getFamilyGammeHierarchyFallback();
      }

      // 3. Construire la hiérarchie depuis les résultats
      const hierarchy: FamilyGammeHierarchy = {};
      const statsMap = new Map<string, Set<string>>();

      for (const row of results || []) {
        const familyId = row.mf_id;

        // Initialiser la famille si elle n'existe pas encore
        if (!hierarchy[familyId]) {
          hierarchy[familyId] = {
            family: {
              mf_id: row.mf_id,
              mf_name: row.mf_name,
              mf_sort: row.mf_sort,
              mf_display: row.mf_display,
              mf_image: row.mf_image,
            },
            gammes: [],
            stats: {
              total_gammes: 0,
              manufacturers_count: 0,
            },
          };
          statsMap.set(familyId, new Set());
        }

        // Ajouter la gamme si elle existe
        if (row.pg_id) {
          hierarchy[familyId].gammes.push({
            mc_id: row.mc_id,
            mc_mf_id: row.mc_mf_id,
            mc_mf_prime: row.mc_mf_prime,
            mc_pg_id: row.mc_pg_id,
            mc_sort: row.mc_sort,
            pg_id: row.pg_id,
            pg_name: row.pg_name,
            pg_alias: row.pg_alias,
            pg_image: row.pg_img,
          });

          // Compter les fabricants uniques
          statsMap.get(familyId)?.add(row.mc_mf_id);
        }
      }

      // 4. Mettre à jour les stats et trier les gammes
      Object.keys(hierarchy).forEach((familyId) => {
        hierarchy[familyId].stats.total_gammes =
          hierarchy[familyId].gammes.length;
        hierarchy[familyId].stats.manufacturers_count =
          statsMap.get(familyId)?.size || 0;

        // Trier les gammes par mc_sort
        hierarchy[familyId].gammes.sort(
          (a, b) => parseInt(a.mc_sort) - parseInt(b.mc_sort),
        );
      });

      // 5. Calculer les statistiques globales
      const gammes = Object.values(hierarchy).flatMap((h) => h.gammes);
      const stats = this.calculateHierarchyStats(hierarchy, gammes);

      this.logger.log(
        `✅ Hiérarchie construite (optimisée): ${stats.total_families} familles, ${stats.total_gammes} gammes`,
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
   * 🔄 Fallback: Utilise GammeUnifiedService.getHierarchy() en cas d'erreur avec la fonction SQL
   * Migré de CatalogGammeService vers GammeUnifiedService
   */
  private async getFamilyGammeHierarchyFallback(): Promise<{
    hierarchy: FamilyGammeHierarchy;
    stats: HierarchyStats;
  }> {
    this.logger.log(
      '🔄 Fallback: utilisation de GammeUnifiedService.getHierarchy()',
    );

    // Utiliser GammeUnifiedService.getHierarchy() qui fait déjà le travail
    const unifiedHierarchy = await this.gammeUnifiedService.getHierarchy();

    // Transformer vers le format FamilyGammeHierarchy attendu
    const hierarchy: FamilyGammeHierarchy = {};

    for (const family of unifiedHierarchy.families) {
      // Convertir les gammes du format Gamme vers CatalogGamme
      const catalogGammes: CatalogGamme[] = family.gammes.map((gamme) => ({
        mc_id: String(gamme.id),
        mc_mf_id: String(family.id),
        mc_mf_prime: String(family.id),
        mc_pg_id: String(gamme.id),
        mc_sort: String(gamme.sort_order || 0),
        pg_id: String(gamme.id),
        pg_name: gamme.name,
        pg_alias: gamme.alias,
        pg_image: gamme.image,
      }));

      hierarchy[family.id] = {
        family: {
          mf_id: parseInt(String(family.id), 10) || 0,
          mf_name: family.name,
          mf_sort: family.sort_order,
          mf_display: 1,
          mf_image: family.image,
        },
        gammes: catalogGammes,
        stats: {
          total_gammes: family.stats.total_gammes,
          manufacturers_count: family.stats.manufacturers_count,
        },
      };
    }

    const stats: HierarchyStats = {
      total_families: unifiedHierarchy.stats.total_families,
      total_gammes: unifiedHierarchy.stats.total_gammes,
      total_manufacturers: unifiedHierarchy.stats.total_manufacturers,
      families_with_gammes: unifiedHierarchy.families.filter(
        (f) => f.gammes.length > 0,
      ).length,
    };

    this.logger.log(
      `✅ Hiérarchie construite (fallback via GammeUnifiedService): ${stats.total_families} familles, ${stats.total_gammes} gammes`,
    );

    return { hierarchy, stats };
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
