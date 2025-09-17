// 📁 backend/src/modules/catalog/controllers/family-gamme-hierarchy.controller.ts
// 🏗️ Contrôleur pour la hiérarchie Familles → Gammes (sous-catégories)

import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { FamilyGammeHierarchyService } from '../services/family-gamme-hierarchy.service';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { 
  HomepageHierarchyQuerySchema, 
  HomepageHierarchyResponseSchema,
  type HomepageHierarchyQuery,
  type HomepageHierarchyResponse 
} from '../dto/catalog.schemas';

@ApiTags('Catalog Hierarchy - API Hiérarchique avec Validation Zod')
@Controller('api/catalog/hierarchy')
export class FamilyGammeHierarchyController {
  private readonly logger = new Logger(FamilyGammeHierarchyController.name);

  constructor(private readonly hierarchyService: FamilyGammeHierarchyService) {}

  /**
   * 🏗️ GET /api/catalog/hierarchy/full - Hiérarchie complète Familles → Gammes
   */
  @Get('full')
  async getFullHierarchy() {
    this.logger.log('🏗️ [GET] /api/catalog/hierarchy/full');
    
    try {
      const result = await this.hierarchyService.getFamilyGammeHierarchy();
      
      this.logger.log(`✅ Hiérarchie complète: ${result.stats.total_families} familles, ${result.stats.total_gammes} gammes`);
      return {
        success: true,
        ...result,
        message: `Hiérarchie avec ${result.stats.total_families} familles et ${result.stats.total_gammes} gammes récupérée`
      };
    } catch (error: any) {
      this.logger.error('❌ Erreur hiérarchie complète:', error);
      return {
        success: false,
        hierarchy: {},
        stats: { total_families: 0, total_gammes: 0, total_manufacturers: 0, families_with_gammes: 0 },
        error: error?.message || 'Erreur inconnue',
      };
    }
  }

  /**
   * 🏗️ GET /api/catalog/hierarchy/families-with-subcategories - Familles avec sous-catégories
   */
  @Get('families-with-subcategories')
  async getFamiliesWithSubcategories() {
    this.logger.log('🏗️ [GET] /api/catalog/hierarchy/families-with-subcategories');
    
    try {
      const families = await this.hierarchyService.getFamiliesWithSubcategories();
      
      this.logger.log(`✅ ${families.length} familles avec sous-catégories récupérées`);
      return {
        success: true,
        data: families,
        count: families.length,
        message: `${families.length} familles avec sous-catégories récupérées avec succès`
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
  @ApiOperation({ summary: 'Récupère les statistiques de la hiérarchie catalogue' })
  @ApiResponse({ 
    status: 200, 
    description: 'Statistiques récupérées avec succès',
    type: Object
  })
  async getHierarchyStats() {
    this.logger.log('🏗️ [GET] /api/catalog/hierarchy/stats');
    
    try {
      const { stats } = await this.hierarchyService.getFamilyGammeHierarchy();
      
      this.logger.log(`✅ Statistiques calculées: ${stats.total_families} familles, ${stats.total_gammes} gammes`);
      return {
        success: true,
        data: stats,
        message: 'Statistiques de la hiérarchie récupérées avec succès'
      };
    } catch (error: any) {
      this.logger.error('❌ Erreur statistiques hiérarchie:', error);
      return {
        success: false,
        data: { total_families: 0, total_gammes: 0, total_manufacturers: 0, families_with_gammes: 0 },
        error: error?.message || 'Erreur inconnue',
      };
    }
  }

  /**
   * 🏗️ GET /api/catalog/hierarchy/family/:id - Famille avec ses gammes
   */
  @Get('family/:id')
  @ApiOperation({ summary: 'Récupère une famille avec ses gammes par ID' })
  @ApiResponse({
    status: 200,
    description: 'Famille avec gammes récupérée avec succès',
    type: Object,
  })
  @ApiParam({ name: 'id', description: 'ID de la famille', type: String })
  async getFamilyWithGammes(@Param('id') familyId: string) {
    this.logger.log(`🏗️ [GET] /api/catalog/hierarchy/family/${familyId}`);
    
    try {
      const family = await this.hierarchyService.getFamilyWithGammesById(familyId);
      
      if (!family) {
        this.logger.warn(`⚠️ Famille ${familyId} non trouvée`);
        return {
          success: false,
          data: null,
          message: `Famille ${familyId} non trouvée`
        };
      }

      this.logger.log(`✅ Famille ${familyId} avec ${family.gammes_count} gammes récupérée`);
      return {
        success: true,
        data: family,
        message: `Famille ${familyId} avec ${family.gammes_count} gammes récupérée avec succès`
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
  @ApiOperation({ summary: 'Récupère les données hiérarchiques pour la page d\'accueil' })
  @ApiResponse({
    status: 200,
    description: 'Données homepage récupérées avec succès',
    type: Object,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Nombre maximum de familles à retourner',
    type: Number,
  })
  async getHomepageData(
    @Query(new ZodValidationPipe(HomepageHierarchyQuerySchema)) query: HomepageHierarchyQuery = {}
  ) {
    this.logger.log('🏗️ [GET] /api/catalog/hierarchy/homepage');

    try {
      const families = await this.hierarchyService.getFamiliesWithSubcategories();
      const { stats } = await this.hierarchyService.getFamilyGammeHierarchy();

      // Appliquer la limite si fournie via query parameter
      const limit = query.limit;
      const homepageFamilies = limit ? families.slice(0, limit) : families;

      this.logger.log(
        `✅ Données homepage: ${homepageFamilies.length} familles affichées${
          limit ? ` (limite: ${limit})` : ''
        }`,
      );

      return {
        success: true,
        families: homepageFamilies,
        stats,
        display_count: homepageFamilies.length,
        total_available: families.length,
        message: `Données homepage avec ${homepageFamilies.length} familles affichées${
          limit ? ` (limite appliquée: ${limit})` : ''
        }`,
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