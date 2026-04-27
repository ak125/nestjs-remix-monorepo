// 📁 backend/src/modules/catalog/controllers/equipementiers.controller.ts
// 🏭 Contrôleur pour les équipementiers (table pieces_marque)

import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { EquipementiersService } from '../services/equipementiers.service';
import { CacheService } from '@cache/cache.service';

@Controller('api/catalog/equipementiers')
export class EquipementiersController {
  private readonly logger = new Logger(EquipementiersController.name);

  constructor(
    private readonly equipementiersService: EquipementiersService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 🏭 GET /api/catalog/equipementiers - Tous les équipementiers
   * Reproduit la logique PHP: SELECT DISTINCT pm_name, pm_id FROM pieces_marque
   */
  @Get()
  async getAllEquipementiers() {
    this.logger.log(
      '🏭 [GET] /api/catalog/equipementiers - Récupération équipementiers',
    );

    // 🚀 OPTIMISATION: Cache Redis TTL 1h (données quasi-statiques)
    const cacheKey = 'catalog:equipementiers:all';
    const cached = await this.cacheService.get(cacheKey);

    if (cached && typeof cached === 'string') {
      this.logger.log('⚡ Cache HIT - Équipementiers depuis Redis (<5ms)');
      return JSON.parse(cached);
    }

    const equipementiersResult =
      await this.equipementiersService.getEquipementiers();

    this.logger.log(
      `✅ ${equipementiersResult.stats.total_equipementiers} équipementiers récupérés`,
    );

    const result = {
      success: equipementiersResult.success,
      data: equipementiersResult.data,
      stats: equipementiersResult.stats,
      message: `${equipementiersResult.stats.total_equipementiers} équipementiers récupérés avec succès`,
    };

    // Mise en cache (TTL: 1h)
    try {
      await this.cacheService.set(cacheKey, JSON.stringify(result), 3600);
    } catch (error) {
      this.logger.warn('⚠️ Erreur cache équipementiers:', error);
    }

    return result;
  }

  /**
   * 🏭 GET /api/catalog/equipementiers/search?q=term - Recherche d'équipementiers
   */
  @Get('search')
  async searchEquipementiers(@Query('q') searchTerm?: string) {
    if (!searchTerm) {
      return {
        success: false,
        data: [],
        stats: { results_count: 0 },
        error: 'Terme de recherche requis (paramètre q)',
      };
    }

    this.logger.log(
      `🔍 [GET] /api/catalog/equipementiers/search?q=${searchTerm}`,
    );

    try {
      const searchResult =
        await this.equipementiersService.searchEquipementiers(searchTerm);

      this.logger.log(
        `✅ ${searchResult.stats.results_count} résultats pour "${searchTerm}"`,
      );
      return {
        success: searchResult.success,
        data: searchResult.data,
        stats: searchResult.stats,
        search_term: searchTerm,
        message: `${searchResult.stats.results_count} équipementiers trouvés pour "${searchTerm}"`,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur recherche équipementiers "${searchTerm}":`,
        error,
      );
      return {
        success: false,
        data: [],
        stats: { results_count: 0 },
        search_term: searchTerm,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * 🏭 GET /api/catalog/equipementiers/:id - Équipementier spécifique par ID
   */
  @Get(':id')
  async getEquipementierById(@Param('id') id: string) {
    this.logger.log(`🏭 [GET] /api/catalog/equipementiers/${id}`);

    try {
      const equipementier =
        await this.equipementiersService.getEquipementierById(id);

      if (!equipementier) {
        this.logger.warn(`⚠️ Équipementier ${id} non trouvé`);
        return {
          success: false,
          data: null,
          message: `Équipementier ${id} non trouvé`,
        };
      }

      this.logger.log(
        `✅ Équipementier ${id} trouvé: ${equipementier.pm_name}`,
      );
      return {
        success: true,
        data: equipementier,
        message: `Équipementier ${equipementier.pm_name} récupéré avec succès`,
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération équipementier ${id}:`, error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}
