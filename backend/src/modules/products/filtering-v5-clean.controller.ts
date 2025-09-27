import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { FilteringServiceV5UltimateCleanService } from './filtering-service-v5-ultimate-clean.service';

@ApiTags('Filtering V5 Ultimate Clean')
@Controller('filtering-v5-clean')
export class FilteringV5CleanController {
  constructor(
    private readonly filteringService: FilteringServiceV5UltimateCleanService,
  ) {}

  /**
   * 🏥 HEALTH CHECK
   */
  @Get('health')
  @ApiOperation({ summary: 'Vérifier la santé du service V5 Clean' })
  async getHealth() {
    return this.filteringService.getHealthStatus();
  }

  /**
   * 📊 STATISTIQUES DU SERVICE
   */
  @Get('stats')
  @ApiOperation({ summary: 'Obtenir les statistiques du service V5 Clean' })
  async getStats() {
    return this.filteringService.getServiceStats();
  }

  /**
   * 🧹 VIDER LE CACHE
   */
  @Get('cache/clear')
  @ApiOperation({ summary: 'Vider le cache du service V5 Clean' })
  async clearCache() {
    this.filteringService.invalidateCache();
    return {
      success: true,
      message: 'Cache V5 Clean vidé avec succès',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * ✅ ENDPOINT PRINCIPAL PROPRE
   */
  @Get(':pgId/:typeId')
  @ApiOperation({ 
    summary: 'Récupérer tous les filtres V5 Clean',
    description: 'Version propre et fonctionnelle du service V5 Ultimate avec code TypeScript parfait',
  })
  @ApiParam({ name: 'pgId', description: 'ID de la gamme de produits' })
  @ApiParam({ name: 'typeId', description: 'ID du type de produit' })
  @ApiResponse({ 
    status: 200, 
    description: 'Filtres récupérés avec succès',
    schema: {
      example: {
        success: true,
        data: {
          filters: [],
          summary: {
            total_filters: 3,
            total_options: 6,
            trending_options: 4,
          },
        },
        metadata: {
          cached: false,
          response_time: 45,
          service_name: 'FilteringServiceV5UltimateClean',
          api_version: 'V5_ULTIMATE_CLEAN',
          methodology: 'vérifier existant avant et utiliser le meilleur et améliorer - VERSION PROPRE',
        },
      },
    },
  })
  async getAllFilters(
    @Param('pgId', ParseIntPipe) pgId: number,
    @Param('typeId', ParseIntPipe) typeId: number,
    @Query() options: any = {},
  ) {
    return this.filteringService.getAllFilters(pgId, typeId, options);
  }
}