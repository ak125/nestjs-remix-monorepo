import { Controller, Get, Query, Logger } from '@nestjs/common';
import { RealStockService } from '../services/real-stock.service';

@Controller('api/admin/real-stock')
export class RealStockController {
  private readonly logger = new Logger(RealStockController.name);

  constructor(private readonly realStockService: RealStockService) {}

  @Get('health')
  async health() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'real-stock',
    };
  }

  @Get('dashboard')
  async getDashboard(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('available') available?: string,
  ) {
    try {
      const filters: any = {};
      if (search) filters.search = search;
      if (available !== undefined) filters.available = available === 'true';

      const result = await this.realStockService.getDashboard(
        parseInt(page, 10) || 1,
        parseInt(limit, 10) || 20,
        filters,
      );

      return {
        success: true,
        data: result,
        message: 'Dashboard récupéré avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur dashboard', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('limit') limit: string = '50',
  ) {
    try {
      if (!query) {
        return {
          success: false,
          error: 'Paramètre de recherche manquant',
        };
      }

      const results = await this.realStockService.searchPieces(
        query,
        parseInt(limit, 10) || 50,
      );

      return {
        success: true,
        data: results,
        count: results.length,
        message: `${results.length} résultats trouvés`,
      };
    } catch (error) {
      this.logger.error('Erreur recherche', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
}
