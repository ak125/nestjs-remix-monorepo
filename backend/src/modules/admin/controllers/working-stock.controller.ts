import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Query, 
  Param, 
  Logger 
} from '@nestjs/common';
import { WorkingStockService } from '../services/working-stock.service';

@Controller('api/admin/working-stock')
export class WorkingStockController {
  private readonly logger = new Logger(WorkingStockController.name);

  constructor(private readonly stockService: WorkingStockService) {}

  @Get('health')
  async health() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'working-stock',
      message: 'Service de stock fonctionnel basé sur pieces_price',
    };
  }

  @Get('dashboard')
  async getDashboard(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('available') available?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
  ) {
    try {
      const filters: any = {};
      if (search) filters.search = search;
      if (available !== undefined) filters.available = available === 'true';
      if (minPrice) filters.minPrice = parseFloat(minPrice);
      if (maxPrice) filters.maxPrice = parseFloat(maxPrice);

      const result = await this.stockService.getDashboard(
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

  @Get('stats')
  async getStatistics() {
    try {
      const stats = await this.stockService.getStockStatistics();
      return {
        success: true,
        data: stats,
        message: 'Statistiques récupérées avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur statistiques', error);
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
    @Query('availableOnly') availableOnly: string = 'true',
  ) {
    try {
      if (!query) {
        return {
          success: false,
          error: 'Paramètre de recherche manquant',
        };
      }

      const results = await this.stockService.searchItems(
        query,
        parseInt(limit, 10) || 50,
        availableOnly === 'true',
      );

      return {
        success: true,
        data: results,
        count: results.length,
        message: `${results.length} résultats trouvés pour "${query}"`,
      };
    } catch (error) {
      this.logger.error('Erreur recherche', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  @Get('top-items')
  async getTopItems(@Query('limit') limit: string = '10') {
    try {
      const results = await this.stockService.getTopItems(
        parseInt(limit, 10) || 10,
      );

      return {
        success: true,
        data: results,
        count: results.length,
        message: `Top ${results.length} articles (prix élevés)`,
      };
    } catch (error) {
      this.logger.error('Erreur top items', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  @Get('export')
  async exportData(
    @Query('format') format: string = 'csv',
    @Query('type') type: string = 'all',
    @Query('limit') limit: string = '1000',
  ) {
    try {
      let data: any[] = [];
      
      switch (type) {
        case 'top':
          data = await this.stockService.getTopItems(parseInt(limit, 10));
          break;
        case 'available':
          data = await this.stockService.searchItems('', parseInt(limit, 10), true);
          break;
        case 'unavailable':
          data = await this.stockService.searchItems('', parseInt(limit, 10), false);
          break;
        default:
          const dashboard = await this.stockService.getDashboard(1, parseInt(limit, 10));
          data = dashboard.items;
      }

      if (format === 'json') {
        return {
          success: true,
          data,
          count: data.length,
          exportedAt: new Date().toISOString(),
        };
      }

      // Pour CSV, on retourne les données formatées
      const csvData = data.map(item => ({
        'ID Pièce': item.pri_piece_id,
        'Référence': item.pri_ref,
        'Description': item.pri_des,
        'Disponible': item.pri_dispo === '1' ? 'Oui' : 'Non',
        'Prix HT': parseFloat(item.pri_vente_ht || '0').toFixed(2),
        'Prix TTC': parseFloat(item.pri_vente_ttc || '0').toFixed(2),
        'Marge (%)': parseFloat(item.pri_marge || '0').toFixed(2),
        'Qté Vente': item.pri_qte_vente,
      }));

      return {
        success: true,
        format: 'csv',
        data: csvData,
        count: csvData.length,
        exportedAt: new Date().toISOString(),
        filename: `stock_export_${type}_${new Date().toISOString().split('T')[0]}.csv`,
      };
    } catch (error) {
      this.logger.error('Erreur export données', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  @Put(':pieceId/availability')
  async updateAvailability(
    @Param('pieceId') pieceId: string,
    @Body() body: { available: boolean },
  ) {
    try {
      const result = await this.stockService.updateAvailability(
        pieceId,
        body.available,
      );

      return {
        success: result,
        message: `Disponibilité mise à jour: ${body.available ? 'disponible' : 'indisponible'}`,
      };
    } catch (error) {
      this.logger.error('Erreur mise à jour disponibilité', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
}
