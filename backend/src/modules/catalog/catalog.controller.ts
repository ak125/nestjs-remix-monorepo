import { Controller, Get, Query, Param, Logger } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('api/catalog')
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);

  constructor(private readonly catalogService: CatalogService) {}

  /**
   * GET /api/catalog/brands
   * Récupérer toutes les marques automobiles
   */
  @Get('brands')
  async getBrands(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.catalogService.getAutoBrands(limitNum);
  }

  /**
   * GET /api/catalog/models/:brandId
   * Récupérer les modèles d'une marque
   */
  @Get('models/:brandId')
  async getModelsByBrand(
    @Param('brandId') brandId: string,
    @Query('limit') limit?: string,
  ) {
    const brandIdNum = parseInt(brandId, 10);
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.catalogService.getModelsByBrand(brandIdNum, limitNum);
  }

  /**
   * GET /api/catalog/pieces/search
   * Rechercher des pièces
   */
  @Get('pieces/search')
  async searchPieces(
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!query) {
      return {
        success: false,
        error: 'Paramètre de recherche requis',
        data: [],
        count: 0,
      };
    }

    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    return this.catalogService.searchPieces(query, limitNum, offsetNum);
  }

  /**
   * GET /api/catalog/pieces/:pieceId
   * Récupérer les détails d'une pièce
   */
  @Get('pieces/:pieceId')
  async getPieceById(@Param('pieceId') pieceId: string) {
    const pieceIdNum = parseInt(pieceId, 10);
    return this.catalogService.getPieceById(pieceIdNum);
  }

  /**
   * GET /api/catalog/stats
   * Statistiques du catalogue
   */
  @Get('stats')
  async getStats() {
    return this.catalogService.getCatalogStats();
  }
}
