// 📁 backend/src/modules/catalog/controllers/family-gamme-hierarchy.controller.ts
// 🏗️ Contrôleur pour la hiérarchie Familles → Gammes (sous-catégories)

import { Controller, Get, Param, Logger } from '@nestjs/common';
import { FamilyGammeHierarchyService } from '../services/family-gamme-hierarchy.service';
import { CatalogFamilyService } from '../services/catalog-family.service';
import { RateLimitModerate } from '../../../../common/decorators/rate-limit.decorator';

@RateLimitModerate() // 🛡️ 30 req/min - Catalog hierarchy lookups
@Controller('api/catalog/hierarchy')
export class FamilyGammeHierarchyController {
  private readonly logger = new Logger(FamilyGammeHierarchyController.name);

  constructor(
    private readonly hierarchyService: FamilyGammeHierarchyService,
    private readonly catalogFamilyService: CatalogFamilyService,
  ) {}

  /**
   * 📋 GET /api/catalog/hierarchy/php-logic - Reproduction exacte de la logique PHP index.php
   * Pour le composant SimpleCatalogFamilies du frontend
   */
  @Get('php-logic')
  async getCatalogFamiliesPhpLogic() {
    this.logger.log(
      '📋 [GET] /api/catalog/hierarchy/php-logic - Logique PHP index.php',
    );

    try {
      const result =
        await this.catalogFamilyService.getCatalogFamiliesPhpLogic();

      this.logger.log(
        `✅ Logique PHP: ${result.totalFamilies} familles avec gammes récupérées`,
      );
      return result;
    } catch (error: any) {
      this.logger.error('❌ Erreur logique PHP:', error);
      return {
        success: false,
        families: [],
        totalFamilies: 0,
        message:
          error?.message ||
          'Erreur lors de la récupération des familles (logique PHP)',
      };
    }
  }

  /**
   * 🏗️ GET /api/catalog/hierarchy/full - Hiérarchie complète Familles → Gammes
   */
  @Get('full')
  async getFullHierarchy() {
    this.logger.log('🏗️ [GET] /api/catalog/hierarchy/full');

    try {
      const result = await this.hierarchyService.getFamilyGammeHierarchy();

      this.logger.log(
        `✅ Hiérarchie complète: ${result.stats.total_families} familles, ${result.stats.total_gammes} gammes`,
      );
      return {
        success: true,
        ...result,
        message: `Hiérarchie avec ${result.stats.total_families} familles et ${result.stats.total_gammes} gammes récupérée`,
      };
    } catch (error: any) {
      this.logger.error('❌ Erreur hiérarchie complète:', error);
      return {
        success: false,
        hierarchy: {},
        stats: {
          total_families: 0,
          total_gammes: 0,
          total_manufacturers: 0,
          families_with_gammes: 0,
        },
        error: error?.message || 'Erreur inconnue',
      };
    }
  }

  /**
   * 🏗️ GET /api/catalog/hierarchy/families-with-subcategories - Familles avec sous-catégories
   */
  @Get('families-with-subcategories')
  async getFamiliesWithSubcategories() {
    this.logger.log(
      '🏗️ [GET] /api/catalog/hierarchy/families-with-subcategories',
    );

    try {
      const families =
        await this.hierarchyService.getFamiliesWithSubcategories();

      this.logger.log(
        `✅ ${families.length} familles avec sous-catégories récupérées`,
      );
      return {
        success: true,
        data: families,
        count: families.length,
        message: `${families.length} familles avec sous-catégories récupérées avec succès`,
      };
    } catch (error: any) {
      this.logger.error('❌ Erreur familles avec sous-catégories:', error);
      return {
        success: false,
        data: [],
        count: 0,
        error: error?.message || 'Erreur inconnue',
      };
    }
  }

  /**
   * 🏗️ GET /api/catalog/hierarchy/stats - Statistiques de la hiérarchie
   */
  @Get('stats')
  async getHierarchyStats() {
    this.logger.log('🏗️ [GET] /api/catalog/hierarchy/stats');

    try {
      const { stats } = await this.hierarchyService.getFamilyGammeHierarchy();

      this.logger.log(
        `✅ Statistiques calculées: ${stats.total_families} familles, ${stats.total_gammes} gammes`,
      );
      return {
        success: true,
        data: stats,
        message: 'Statistiques de la hiérarchie récupérées avec succès',
      };
    } catch (error: any) {
      this.logger.error('❌ Erreur statistiques hiérarchie:', error);
      return {
        success: false,
        data: {
          total_families: 0,
          total_gammes: 0,
          total_manufacturers: 0,
          families_with_gammes: 0,
        },
        error: error?.message || 'Erreur inconnue',
      };
    }
  }

  /**
   * 🏗️ GET /api/catalog/hierarchy/family/:id - Famille avec ses gammes
   */
  @Get('family/:id')
  async getFamilyWithGammes(@Param('id') familyId: string) {
    this.logger.log(`🏗️ [GET] /api/catalog/hierarchy/family/${familyId}`);

    try {
      const family =
        await this.hierarchyService.getFamilyWithGammesById(familyId);

      if (!family) {
        this.logger.warn(`⚠️ Famille ${familyId} non trouvée`);
        return {
          success: false,
          data: null,
          message: `Famille ${familyId} non trouvée`,
        };
      }

      this.logger.log(
        `✅ Famille ${familyId} avec ${family.gammes_count} gammes récupérée`,
      );
      return {
        success: true,
        data: family,
        message: `Famille ${familyId} avec ${family.gammes_count} gammes récupérée avec succès`,
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur famille ${familyId} avec gammes:`, error);
      return {
        success: false,
        data: null,
        error: error?.message || 'Erreur inconnue',
      };
    }
  }

  /**
   * 🏗️ GET /api/catalog/hierarchy/homepage - Données optimisées pour homepage
   */
  @Get('homepage')
  async getHomepageData() {
    this.logger.log('🏗️ [GET] /api/catalog/hierarchy/homepage');

    try {
      // Un seul appel pour obtenir à la fois les familles et les stats
      const { hierarchy, stats } =
        await this.hierarchyService.getFamilyGammeHierarchy();

      // Transformer l'objet hierarchy en tableau de familles pour le frontend
      const homepageFamilies = Object.values(hierarchy)
        .map((item) => ({
          ...item.family,
          gammes: item.gammes,
          gammes_count: item.stats.total_gammes,
        }))
        .filter((family) => family.gammes_count > 0) // Seulement les familles avec gammes
        .sort((a, b) => {
          const sortA = parseInt(a.mf_sort?.toString() || '0') || 0;
          const sortB = parseInt(b.mf_sort?.toString() || '0') || 0;
          return sortA - sortB;
        });

      this.logger.log(
        `✅ Données homepage: ${homepageFamilies.length} familles affichées`,
      );
      return {
        success: true,
        families: homepageFamilies,
        stats,
        display_count: homepageFamilies.length,
        total_available: Object.keys(hierarchy).length,
        message: `Données homepage avec ${homepageFamilies.length} familles affichées`,
      };
    } catch (error: any) {
      this.logger.error('❌ Erreur données homepage:', error);
      return {
        success: false,
        families: [],
        stats: {
          total_families: 0,
          total_gammes: 0,
          total_manufacturers: 0,
          families_with_gammes: 0,
        },
        display_count: 0,
        total_available: 0,
        error: error?.message || 'Erreur inconnue',
      };
    }
  }
}
