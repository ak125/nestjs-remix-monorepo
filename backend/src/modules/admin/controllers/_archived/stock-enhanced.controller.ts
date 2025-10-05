import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StockManagementService } from '../services/stock-management.service';
import { StockFilters, MovementFilters } from '../interfaces/stock.interface';

@ApiTags('Stock Management Enhanced')
@Controller('api/admin/stock-enhanced')
export class StockEnhancedController {
  private readonly logger = new Logger(StockEnhancedController.name);

  constructor(private readonly stockService: StockManagementService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Obtenir le tableau de bord du stock' })
  @ApiResponse({
    status: 200,
    description: 'Tableau de bord récupéré avec succès',
  })
  async getDashboard() {
    try {
      return await this.stockService.getStockDashboard();
    } catch (error) {
      this.logger.error('Erreur récupération dashboard stock', error);
      throw error;
    }
  }

  @Get('advanced')
  @ApiOperation({ summary: 'Obtenir le stock avec filtres avancés' })
  @ApiResponse({ status: 200, description: 'Stock récupéré avec succès' })
  async getStockWithFilters(@Query() filters: StockFilters) {
    try {
      // Utiliser le dashboard existant qui fonctionne
      return await this.stockService.getStockDashboard(filters);
    } catch (error) {
      this.logger.error('Erreur récupération stock avancé', error);
      throw error;
    }
  }

  @Get('report')
  @ApiOperation({ summary: 'Générer un rapport de stock complet' })
  @ApiResponse({ status: 200, description: 'Rapport généré avec succès' })
  async generateStockReport() {
    try {
      const report = await this.stockService.generateComprehensiveStockReport();
      return {
        ...report,
        generatedAt: new Date(),
        generatedBy: 'system',
      };
    } catch (error) {
      this.logger.error('Erreur génération rapport stock', error);
      throw error;
    }
  }

  @Get('movements/history')
  @ApiOperation({
    summary: "Obtenir l'historique des mouvements de stock",
  })
  @ApiResponse({ status: 200, description: 'Historique récupéré avec succès' })
  async getMovementHistory(@Query() filters: MovementFilters) {
    try {
      return await this.stockService.getMovementHistory(
        filters.productId,
        filters,
      );
    } catch (error) {
      this.logger.error('Erreur récupération historique mouvements', error);
      throw error;
    }
  }

  @Post('movements')
  @ApiOperation({ summary: 'Enregistrer un mouvement de stock' })
  @ApiResponse({ status: 201, description: 'Mouvement enregistré avec succès' })
  async recordMovement(@Body() movementData: any) {
    try {
      // Utiliser la méthode updateStock existante
      return await this.stockService.updateStock(
        movementData.product_id,
        { quantity: movementData.quantity },
        movementData.user_id || 'admin',
        movementData.reason || 'Ajustement manuel',
      );
    } catch (error) {
      this.logger.error('Erreur enregistrement mouvement', error);
      throw error;
    }
  }

  @Post('products/:productId/adjust')
  @ApiOperation({ summary: "Ajuster l'inventaire d'un produit" })
  @ApiResponse({ status: 200, description: 'Inventaire ajusté avec succès' })
  async adjustInventory(
    @Param('productId') productId: string,
    @Body()
    adjustment: {
      actualQuantity: number;
      reason: string;
      notes?: string;
    },
  ) {
    try {
      return await this.stockService.updateStock(
        productId,
        {
          quantity: adjustment.actualQuantity,
        },
        'system',
        adjustment.reason || 'Ajustement inventaire',
      );
    } catch (error) {
      this.logger.error('Erreur ajustement inventaire', error);
      throw error;
    }
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Obtenir les alertes de stock actives' })
  @ApiResponse({ status: 200, description: 'Alertes récupérées avec succès' })
  async getStockAlerts() {
    try {
      return await this.stockService.getStockAlerts();
    } catch (error) {
      this.logger.error('Erreur récupération alertes stock', error);
      throw error;
    }
  }

  @Get('products/:productId/movements')
  @ApiOperation({
    summary: "Obtenir les mouvements d'un produit spécifique",
  })
  @ApiResponse({ status: 200, description: 'Mouvements récupérés avec succès' })
  async getProductMovements(
    @Param('productId') productId: string,
    @Query() filters: Omit<MovementFilters, 'productId'>,
  ) {
    try {
      return await this.stockService.getMovementHistory(productId, filters);
    } catch (error) {
      this.logger.error('Erreur récupération mouvements produit', error);
      throw error;
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Vérifier la santé du service de stock' })
  @ApiResponse({ status: 200, description: 'État de santé récupéré' })
  async getHealthStatus() {
    try {
      return await this.stockService.healthCheck();
    } catch (error) {
      this.logger.error('Erreur vérification santé stock', error);
      throw error;
    }
  }
}
