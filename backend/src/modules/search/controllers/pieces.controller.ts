import { Controller, Get, Logger, Query } from '@nestjs/common';
import { OperationFailedException } from '../../../common/exceptions';
import { PiecesAnalysisService } from '../services/pieces-analysis.service';
import { SupabaseIndexationService } from '../services/supabase-indexation.service';
import { MeilisearchService } from '../services/meilisearch.service';
import { getErrorMessage } from '../../../common/utils/error.utils';

/**
 * 🔧 Contrôleur pour l'analyse des pièces
 */
@Controller('api/pieces')
export class PiecesController {
  private readonly logger = new Logger(PiecesController.name);

  constructor(
    private readonly piecesAnalysisService: PiecesAnalysisService,
    private readonly supabaseIndexationService: SupabaseIndexationService,
    private readonly meilisearchService: MeilisearchService,
  ) {}

  /**
   * 🔍 Analyser la table pieces
   */
  @Get('analyze')
  async analyzePieces() {
    this.logger.log('🔍 Analyse de la table pieces...');

    try {
      const result = await this.piecesAnalysisService.analyzePiecesTable();

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur analyse pieces:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔍 Rechercher des pièces par nom
   */
  @Get('search')
  async searchPieces(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query) {
      return {
        success: false,
        error: 'Paramètre "q" requis',
        timestamp: new Date().toISOString(),
      };
    }

    this.logger.log(`🔍 Recherche pieces: "${query}"`);

    try {
      const result = await this.piecesAnalysisService.searchPiecesByName(
        query,
        limit ? parseInt(limit, 10) : 20,
      );

      return {
        success: result.success,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur recherche pieces "${query}":`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔍 Découvrir la structure complète de la table pieces
   */
  @Get('structure')
  async getPiecesStructure() {
    try {
      const structure = await this.piecesAnalysisService.getPiecesStructure();
      return {
        success: true,
        data: structure,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new OperationFailedException({
        message: `Erreur lors de la récupération de la structure: ${getErrorMessage(error)}`,
      });
    }
  }

  @Get('brand-info')
  async getBrandInfo() {
    try {
      const brandInfo = await this.piecesAnalysisService.getBrandInfo();
      return {
        success: true,
        data: brandInfo,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new OperationFailedException({
        message: `Erreur lors de la récupération des marques: ${getErrorMessage(error)}`,
      });
    }
  }

  @Get('test-brands')
  async testBrands() {
    try {
      // Récupérer quelques filtres avec les infos de marques
      const result =
        await this.supabaseIndexationService.getAllProductsFromSupabase(10);

      return {
        success: true,
        data: {
          sample: result.data?.slice(0, 3) || [],
          count: result.count || 0,
          hasData: result.data?.length > 0,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('test-bosch-filters')
  async testBoschFilters() {
    try {
      // Récupérer spécifiquement les filtres à air BOSCH
      const result =
        await this.supabaseIndexationService.getAllProductsFromSupabase(50);

      // Filtrer les produits BOSCH
      const boschFilters =
        result.data?.filter((p: any) => p.brand === 'BOSCH' && p.isFilter) ||
        [];

      return {
        success: true,
        data: {
          boschFilters: boschFilters.slice(0, 5),
          totalBoschFilters: boschFilters.length,
          brandDetection:
            boschFilters.length > 0 ? 'SUCCESS' : 'NO_BOSCH_FOUND',
          sampleBrands: [
            ...new Set(result.data?.map((p: any) => p.brand) || []),
          ].slice(0, 10),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('test-bosch-direct')
  async testBoschDirect() {
    try {
      // Test direct avec une référence BOSCH connue
      const testRef = '0 986 B02 502';

      // Utiliser la méthode d'extraction directement (nous devons l'exposer)
      const extractedBrand = this.extractBrandFromRef(testRef);

      return {
        success: true,
        data: {
          testReference: testRef,
          extractedBrand,
          expected: 'BOSCH',
          isCorrect: extractedBrand === 'BOSCH',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('test-air-filters-with-brands')
  async testAirFiltersWithBrands() {
    try {
      // Récupérer spécifiquement les filtres à air et calculer leurs marques
      const result =
        await this.piecesAnalysisService.searchCompleteAirFilters(20);

      // Transformer avec extraction de marques
      const filtersWithBrands =
        result.filtres?.map((filter: any) => {
          const brand = this.extractBrandFromRef(filter.piece_ref || '');
          return {
            ...filter,
            extractedBrand: brand,
            isBosch: brand === 'BOSCH',
          };
        }) || [];

      const boschCount = filtersWithBrands.filter((f) => f.isBosch).length;

      return {
        success: true,
        data: {
          filtersWithBrands: filtersWithBrands.slice(0, 10),
          brandDistribution: {
            total: filtersWithBrands.length,
            bosch: boschCount,
            others: filtersWithBrands.length - boschCount,
          },
          uniqueBrands: [
            ...new Set(filtersWithBrands.map((f) => f.extractedBrand)),
          ],
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔍 Rechercher spécifiquement les filtres à air avec équipementiers
   */
  @Get('filtre-air')
  async searchFiltreAir(@Query('limit') limit: string = '50') {
    try {
      const limitNum = parseInt(limit) || 50;

      const result =
        await this.piecesAnalysisService.searchCompleteAirFilters(limitNum);

      return {
        success: true,
        query: 'Filtre à air (exact + équipementiers)',
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur recherche filtre à air:', error);
      return {
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      };
    }
  }
  @Get('test-products')
  async testProducts(@Query('limit') limit?: string) {
    const testLimit = limit ? parseInt(limit, 10) : 50;
    this.logger.log(`🧪 Test récupération ${testLimit} produits...`);

    try {
      const result =
        await this.supabaseIndexationService.getAllProductsFromSupabase(
          testLimit,
        );

      const filterItems =
        result.data?.filter((p: any) =>
          p.name?.toLowerCase().includes('filtre'),
        ) || [];

      return {
        success: result.success,
        data: {
          total: result.data?.length || 0,
          filters: filterItems.length,
          sampleProducts: result.data?.slice(0, 5),
          sampleFilters: filterItems.slice(0, 5),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur test products:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }
  @Get('index')
  async indexPieces(@Query('limit') limit?: string) {
    const indexLimit = limit ? parseInt(limit, 10) : 500;
    this.logger.log(`🔧 Indexation de ${indexLimit} pièces...`);

    try {
      // Récupérer les pièces depuis Supabase (avec filtres)
      const result =
        await this.supabaseIndexationService.getAllProductsFromSupabase(
          indexLimit,
        );

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Erreur récupération produits',
          timestamp: new Date().toISOString(),
        };
      }

      // Indexer dans Meilisearch
      await this.meilisearchService.indexProducts(result.data);

      this.logger.log(`✅ ${result.data.length} pièces indexées avec succès`);

      return {
        success: true,
        message: `${result.data.length} pièces indexées (avec filtres)`,
        data: {
          count: result.data.length,
          hasFilters: result.data.some((p: any) =>
            p.name?.toLowerCase().includes('filtre'),
          ),
          filterCount: result.data.filter((p: any) =>
            p.name?.toLowerCase().includes('filtre'),
          ).length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur indexation pieces:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('index-bosch-filters')
  async indexBoschFilters() {
    try {
      // Récupérer spécifiquement les filtres à air BOSCH
      const boschFilters =
        await this.piecesAnalysisService.searchCompleteAirFilters(50);

      if (!boschFilters.filtres || boschFilters.filtres.length === 0) {
        return {
          success: false,
          message: 'Aucun filtre à air trouvé',
          timestamp: new Date().toISOString(),
        };
      }

      // Transformer les filtres BOSCH pour Meilisearch avec les marques
      const transformedFilters = boschFilters.filtres.map((filter: any) => {
        const brand = this.extractBrandFromRef(filter.piece_ref || '');

        return {
          id: `product_${filter.piece_id}`,
          type: 'product',
          productId: filter.piece_id,
          name: filter.piece_name,
          reference: filter.piece_ref,
          description: filter.piece_des,

          // 🏭 Informations équipementier
          brand: brand,
          brandId: filter.piece_pm_id || null,
          productGroupId: filter.piece_pg_id || null,
          articleGroupId: filter.piece_ga_id || null,

          // Métadonnées pour recherche
          searchTerms: [
            filter.piece_name,
            filter.piece_ref,
            filter.piece_des,
            brand, // Important : inclure la marque
          ].filter(Boolean),

          // Données d'indexation
          isActive: filter.piece_display === true,
          isFilter: true, // Force true pour les filtres

          // Métadonnées supplémentaires
          year: filter.piece_year || null,
          weight: filter.piece_weight_kgm || 0,
          hasImage: filter.piece_has_img || false,
          hasOEM: filter.piece_has_oem || false,
          quantity: filter.piece_qty_sale || 1,

          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      // TODO: Indexer dans Meilisearch (nécessite l'accès au MeilisearchService)

      return {
        success: true,
        message: `${transformedFilters.length} filtres BOSCH préparés pour indexation`,
        data: {
          count: transformedFilters.length,
          boschCount: transformedFilters.filter((f) => f.brand === 'BOSCH')
            .length,
          sample: transformedFilters.slice(0, 3),
          brands: [...new Set(transformedFilters.map((f) => f.brand))],
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Extraire la marque depuis une référence produit
   */
  private extractBrandFromRef(reference: string): string {
    if (!reference) return 'INCONNU';

    const ref = reference.toLowerCase().replace(/\s+/g, '');

    // Patterns de références courantes
    const brandPatterns = {
      bosch: ['0986', '0 986', 'bosch'],
      'mann-filter': ['mann', 'hum', 'w'],
      mahle: ['lx', 'ox', 'kx', 'mahle'],
      fram: ['fram', 'ca'],
      purflux: ['purflux', 'a', 'l'],
      knecht: ['knecht', 'lx'],
      champion: ['champion', 'cof'],
      febi: ['febi', '49', '48'],
      sachs: ['sachs', 'zf'],
      valeo: ['valeo', '585'],
    };

    // Recherche de correspondance
    for (const [brand, patterns] of Object.entries(brandPatterns)) {
      if (patterns.some((pattern) => ref.includes(pattern))) {
        return brand.toUpperCase();
      }
    }

    // Si aucune correspondance, retourner le début de la référence
    const firstPart = reference.split(' ')[0] || reference.substring(0, 4);
    return firstPart.toUpperCase();
  }
}
