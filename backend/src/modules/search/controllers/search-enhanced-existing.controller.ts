import { Controller, Get, Query, Logger } from '@nestjs/common';
import { SearchSimpleService } from '../services/search-simple.service';

/**
 * 🎯 CONTRÔLEUR RECHERCHE ENHANCED - Tables Existantes
 *
 * Endpoints optimisés utilisant uniquement les tables Supabase existantes :
 * - /api/search-existing/* : Recherche améliorée
 * - Compatible avec la logique PHP originale
 * - Performance optimisée (4M+ pièces indexées)
 */
@Controller('api/search-existing')
export class SearchEnhancedExistingController {
  private readonly logger = new Logger(SearchEnhancedExistingController.name);

  constructor(private readonly searchEnhancedService: SearchSimpleService) {}

  /**
   * 🔍 RECHERCHE PRINCIPALE
   * GET /api/search-existing/search?query=filtre+huile&page=1&limit=20
   * Supporte les filtres multiples: marque[]=TRW&marque[]=DELPHI&gamme[]=8
   */
  @Get('search')
  async search(
    @Query('query') query: string = '',
    @Query('q') q: string = '', // Support alias 'q' pour compatibilité
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('gammeId') gammeId?: string | string[],
    @Query('marqueId') marqueId?: string | string[],
    @Query('gamme') gamme?: string | string[], // Alias
    @Query('marque') marque?: string | string[], // Alias
    @Query('vehicleMarqueId') vehicleMarqueId?: string,
    @Query('vehicleModeleId') vehicleModeleId?: string,
    @Query('vehicleTypeId') vehicleTypeId?: string,
  ) {
    const startTime = Date.now();

    try {
      this.logger.log(
        `🔍 [SEARCH-EXISTING] "${query}" - page:${page} limit:${limit}`,
      );

      // Validation et conversion
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

      // Construction des paramètres
      const searchParams: any = {
        query: query.trim(),
        pagination: {
          page: pageNum,
          limit: limitNum,
        },
      };

      // Filtres optionnels - Support multi-valeurs
      if (gammeId || gamme || marqueId || marque) {
        searchParams.filters = {};

        // Gammes: supporter gammeId=8 ou gamme[]=8&gamme[]=9 ou gamme=8
        const gammeValues = gammeId || gamme;
        if (gammeValues) {
          const gammeIds = Array.isArray(gammeValues)
            ? gammeValues.map((g) => parseInt(g, 10)).filter((id) => !isNaN(id))
            : [parseInt(gammeValues, 10)].filter((id) => !isNaN(id));
          if (gammeIds.length > 0) {
            searchParams.filters.gammeIds = gammeIds;
          }
        }

        // Marques: supporter marqueId=42 ou marque[]=42&marque[]=43 ou marque=42
        const marqueValues = marqueId || marque;
        if (marqueValues) {
          const marqueIds = Array.isArray(marqueValues)
            ? marqueValues
                .map((m) => parseInt(m, 10))
                .filter((id) => !isNaN(id))
            : [parseInt(marqueValues, 10)].filter((id) => !isNaN(id));
          if (marqueIds.length > 0) {
            searchParams.filters.marqueIds = marqueIds;
          }
        }
      }

      // Contexte véhicule
      if (vehicleMarqueId || vehicleModeleId || vehicleTypeId) {
        searchParams.vehicleContext = {};
        if (vehicleMarqueId)
          searchParams.vehicleContext.marqueId = parseInt(vehicleMarqueId, 10);
        if (vehicleModeleId)
          searchParams.vehicleContext.modeleId = parseInt(vehicleModeleId, 10);
        if (vehicleTypeId)
          searchParams.vehicleContext.typeId = parseInt(vehicleTypeId, 10);
      }

      // Appel au service de recherche SIMPLE
      const result = await this.searchEnhancedService.search(searchParams);

      this.logger.log(
        `✅ [SEARCH-EXISTING] ${result.data.items.length} résultats en ${result.data.executionTime}ms`,
      );

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`❌ [SEARCH-EXISTING] Exception:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur',
        executionTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🎯 AUTOCOMPLETE / SUGGESTIONS (DÉSACTIVÉ TEMPORAIREMENT)
   * GET /api/search-existing/autocomplete?q=fil
   */
  // @Get('autocomplete')
  // async autocomplete(@Query('q') query: string = '', @Query('limit') limit: string = '5') {
  //   return { success: true, suggestions: [], query: query.trim() };
  // }

  /**
   * 🚗 RECHERCHE PAR VÉHICULE (DÉSACTIVÉ TEMPORAIREMENT)
   * GET /api/search-existing/vehicle?query=filtre&marqueId=7
   */
  // @Get('vehicle')
  // async searchByVehicle() {
  //   return { success: true, data: { items: [], total: 0 } };
  // }

  /**
   * 🚗 RECHERCHE PAR VÉHICULE
   * GET /api/search-existing/vehicle?query=filtre&marqueId=7&modeleId=88&typeId=88062
   */
  @Get('vehicle')
  async searchByVehicle(
    @Query('query') query: string = '',
    @Query('marqueId') marqueId: string,
    @Query('modeleId') modeleId?: string,
    @Query('typeId') typeId?: string,
    @Query('gammeId') gammeId?: string,
    @Query('limit') limit: string = '20',
  ) {
    try {
      // Validation des paramètres requis
      if (!marqueId || !query.trim()) {
        return {
          success: false,
          error: 'Paramètres manquants: query et marqueId sont requis',
          timestamp: new Date().toISOString(),
        };
      }

      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

      this.logger.log(
        `🚗 [SEARCH-VEHICLE] "${query}" marque:${marqueId} modele:${modeleId} type:${typeId}`,
      );

      const searchParams: any = {
        query: query.trim(),
        marqueId: parseInt(marqueId, 10),
        limit: limitNum,
      };

      if (modeleId) searchParams.modeleId = parseInt(modeleId, 10);
      if (typeId) searchParams.typeId = parseInt(typeId, 10);
      if (gammeId) searchParams.gammeId = parseInt(gammeId, 10);

      const result =
        await this.searchEnhancedService.searchPiecesByVehicle(searchParams);

      if (result.success) {
        this.logger.log(
          `✅ [SEARCH-VEHICLE] ${result.data?.items?.length || 0} résultats`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`❌ [SEARCH-VEHICLE] Erreur:`, error);

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Erreur recherche véhicule',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * ⚡ SANTÉ DU SERVICE
   * GET /api/search-existing/health
   */
  @Get('health')
  async health() {
    try {
      // Test rapide d'accès aux tables
      const testQueries = await Promise.allSettled([
        this.searchEnhancedService['client']
          .from('pieces')
          .select('piece_id')
          .limit(1),

        this.searchEnhancedService['client']
          .from('pieces_gamme')
          .select('pg_id')
          .limit(1),

        this.searchEnhancedService['client']
          .from('pieces_marque')
          .select('pm_id')
          .limit(1),
      ]);

      const tablesStatus = {
        pieces: testQueries[0].status === 'fulfilled',
        pieces_gamme: testQueries[1].status === 'fulfilled',
        pieces_marque: testQueries[2].status === 'fulfilled',
      };

      const allTablesOk = Object.values(tablesStatus).every((status) => status);

      return {
        status: allTablesOk ? 'operational' : 'degraded',
        service: 'search-enhanced-existing',
        tables: tablesStatus,
        features: [
          'search-existing-tables',
          'autocomplete',
          'vehicle-context',
          'price-calculation',
          'relevance-scoring',
        ],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ [HEALTH-CHECK] Erreur:`, error);

      return {
        status: 'error',
        service: 'search-enhanced-existing',
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📊 STATISTIQUES ET MÉTRIQUES
   * GET /api/search-existing/stats
   */
  @Get('stats')
  async getStats() {
    try {
      this.logger.log(`📊 [STATS] Récupération des statistiques`);

      // Compter les enregistrements dans les tables principales
      const [piecesCount, gammesCount, marquesCount, pricesCount] =
        await Promise.allSettled([
          this.searchEnhancedService['client']
            .from('pieces')
            .select('*', { count: 'exact', head: true })
            .eq('piece_display', 1),

          this.searchEnhancedService['client']
            .from('pieces_gamme')
            .select('*', { count: 'exact', head: true })
            .eq('pg_display', 1),

          this.searchEnhancedService['client']
            .from('pieces_marque')
            .select('*', { count: 'exact', head: true })
            .eq('pm_display', 1),

          this.searchEnhancedService['client']
            .from('pieces_price')
            .select('*', { count: 'exact', head: true })
            .eq('pri_dispo', '1'),
        ]);

      return {
        success: true,
        data: {
          pieces:
            piecesCount.status === 'fulfilled' ? piecesCount.value.count : null,
          gammes:
            gammesCount.status === 'fulfilled' ? gammesCount.value.count : null,
          marques:
            marquesCount.status === 'fulfilled'
              ? marquesCount.value.count
              : null,
          prices:
            pricesCount.status === 'fulfilled' ? pricesCount.value.count : null,
        },
        features: ['existing-tables-only', 'no-new-tables-created'],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ [STATS] Erreur:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur statistiques',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
