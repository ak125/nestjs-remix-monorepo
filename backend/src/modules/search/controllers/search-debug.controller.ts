import { Controller, Get, Query, Logger } from '@nestjs/common';
import { SearchEnhancedExistingService } from '../services/search-enhanced-existing.service';

@Controller('api/search-debug')
export class SearchDebugController {
  private readonly logger = new Logger(SearchDebugController.name);

  constructor(private readonly searchService: SearchEnhancedExistingService) {}

  /**
   * 🗂️ LISTE DES TABLES ET COLONNES
   * GET /api/search-debug/tables
   */
  @Get('tables')
  async getTables() {
    try {
      const tables = [
        'pieces',
        'pieces_gamme',
        'pieces_marque',
        'pieces_price',
        'pieces_media_img',
        'pieces_ref_search',
        'pieces_ref_oem',
      ];

      const results = await Promise.all(
        tables.map(async (tableName) => {
          try {
            const result = await this.searchService['client']
              .from(tableName)
              .select('*')
              .limit(1);

            return {
              table: tableName,
              accessible: !result.error,
              sample: result.data?.[0] || null,
              columns: result.data?.[0] ? Object.keys(result.data[0]) : [],
              error: result.error?.message || null,
            };
          } catch (error) {
            return {
              table: tableName,
              accessible: false,
              sample: null,
              columns: [],
              error: error instanceof Error ? error.message : 'Erreur inconnue',
            };
          }
        }),
      );

      return {
        success: true,
        data: {
          tables: results,
          total: results.filter((t) => t.accessible).length,
          unavailable: results.filter((t) => !t.accessible).map((t) => t.table),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔍 INSPECTION D'UNE PIÈCE
   * GET /api/search-debug/inspect?pieceId=7766691
   */
  @Get('inspect')
  async inspectPiece(@Query('pieceId') pieceId: string) {
    try {
      const id = parseInt(pieceId, 10);
      if (isNaN(id)) {
        return { success: false, error: 'pieceId invalide' };
      }

      // Récupérer toutes les données
      const [piece, prices, images, refSearch, refOem, gamme, marque] =
        await Promise.all([
          this.searchService['client']
            .from('pieces')
            .select('*')
            .eq('piece_id', id)
            .single(),
          this.searchService['client']
            .from('pieces_price')
            .select('*')
            .eq('pri_piece_id', id),
          this.searchService['client']
            .from('pieces_media_img')
            .select('*')
            .eq('pmi_piece_id', id),
          this.searchService['client']
            .from('pieces_ref_search')
            .select('*')
            .eq('prs_piece_id', id.toString()),
          this.searchService['client']
            .from('pieces_ref_oem')
            .select('*')
            .eq('pro_piece_id', id.toString()),
          this.searchService['client']
            .from('pieces_gamme')
            .select('*')
            .limit(1),
          this.searchService['client']
            .from('pieces_marque')
            .select('*')
            .limit(1),
        ]);

      // Récupérer gamme et marque spécifiques
      let gammeData = null;
      let marqueData = null;

      if (piece.data?.piece_pg_id) {
        const g = await this.searchService['client']
          .from('pieces_gamme')
          .select('*')
          .eq('pg_id', piece.data.piece_pg_id)
          .single();
        gammeData = g.data;
      }

      if (piece.data?.piece_pm_id) {
        const m = await this.searchService['client']
          .from('pieces_marque')
          .select('*')
          .eq('pm_id', piece.data.piece_pm_id)
          .single();
        marqueData = m.data;
      }

      return {
        success: true,
        data: {
          piece: piece.data,
          gamme: gammeData,
          marque: marqueData,
          prices: prices.data || [],
          images: images.data || [],
          ref_search: refSearch.data || [],
          ref_oem: refOem.data || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur',
      };
    }
  }
}
