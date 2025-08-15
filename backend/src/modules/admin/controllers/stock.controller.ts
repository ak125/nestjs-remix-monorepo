/**
 * 📦 StockController - Contrôleur de gestion des stocks
 *
 * Contrôleur aligné sur l'architecture existante :
 * ✅ Documentation Swagger complète
 * ✅ Guards d'authentification standards
 * ✅ DTOs avec validation Zod
 * ✅ Gestion d'erreurs cohérente
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  Request,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { StockManagementService } from '../services/stock-management.service';
import {
  StockDashboardFilters,
  UpdateStockDto,
  ReserveStockDto,
  DisableProductDto,
} from '../dto/stock.dto';

@ApiTags('Admin - Stock Management')
@Controller('admin/stock')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@ApiBearerAuth()
export class StockController {
  private readonly logger = new Logger(StockController.name);

  constructor(private readonly stockService: StockManagementService) {}

  /**
   * GET /admin/stock/dashboard
   * Récupérer le dashboard des stocks avec statistiques
   */
  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard stock avec statistiques' })
  @ApiResponse({ status: 200, description: 'Dashboard récupéré avec succès' })
  async getStockDashboard(@Query() filters: StockDashboardFilters) {
    try {
      this.logger.debug('Récupération dashboard stock', { filters });
      return await this.stockService.getStockDashboard(filters);
    } catch (error) {
      this.logger.error('Erreur dashboard stock', error);
      throw error;
    }
  }

  /**
   * PUT /admin/stock/:productId
   * Mettre à jour le stock d'un produit
   */
  @Put(':productId')
  @ApiOperation({ summary: "Mettre à jour le stock d'un produit" })
  @ApiResponse({ status: 200, description: 'Stock mis à jour avec succès' })
  async updateStock(
    @Param('productId') productId: string,
    @Body() updateData: UpdateStockDto,
    @Request() req: any,
  ) {
    try {
      this.logger.debug('Mise à jour stock', { productId, updateData });
      const { reason, ...stockData } = updateData;
      return await this.stockService.updateStock(
        productId,
        stockData,
        req.user.id,
        reason,
      );
    } catch (error) {
      this.logger.error('Erreur mise à jour stock', error);
      throw error;
    }
  }

  /**
   * POST /admin/stock/:productId/disable
   * Désactiver un produit
   */
  @Post(':productId/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Désactiver un produit' })
  @ApiResponse({ status: 200, description: 'Produit désactivé avec succès' })
  async disableProduct(
    @Param('productId') productId: string,
    @Body() body: DisableProductDto,
    @Request() req: any,
  ) {
    try {
      this.logger.debug('Désactivation produit', {
        productId,
        reason: body.reason,
      });
      return await this.stockService.disableProduct(
        productId,
        req.user.id,
        body.reason,
      );
    } catch (error) {
      this.logger.error('Erreur désactivation produit', error);
      throw error;
    }
  }

  /**
   * POST /admin/stock/:productId/reserve
   * Réserver du stock pour une commande
   */
  @Post(':productId/reserve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Réserver du stock pour une commande' })
  @ApiResponse({ status: 200, description: 'Stock réservé avec succès' })
  async reserveStock(
    @Param('productId') productId: string,
    @Body() body: ReserveStockDto,
  ) {
    try {
      this.logger.debug('Réservation stock', { productId, ...body });
      return await this.stockService.reserveStock(
        productId,
        body.quantity,
        body.orderId,
      );
    } catch (error) {
      this.logger.error('Erreur réservation stock', error);
      throw error;
    }
  }

  /**
   * POST /admin/stock/:productId/release
   * Libérer du stock réservé
   */
  @Post(':productId/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Libérer du stock réservé' })
  @ApiResponse({ status: 200, description: 'Stock libéré avec succès' })
  async releaseStock(
    @Param('productId') productId: string,
    @Body() body: ReserveStockDto,
  ) {
    try {
      this.logger.debug('Libération stock', { productId, ...body });
      return await this.stockService.releaseStock(
        productId,
        body.quantity,
        body.orderId,
      );
    } catch (error) {
      this.logger.error('Erreur libération stock', error);
      throw error;
    }
  }

  /**
   * GET /admin/stock/:productId/movements
   * Récupérer l'historique des mouvements de stock
   */
  @Get(':productId/movements')
  @ApiOperation({ summary: "Historique des mouvements de stock d'un produit" })
  @ApiResponse({ status: 200, description: 'Mouvements récupérés avec succès' })
  async getStockMovements(
    @Param('productId') productId: string,
    @Query('limit') limit?: number,
  ) {
    try {
      this.logger.debug('Récupération mouvements stock', { productId, limit });
      return await this.stockService.getStockMovements(productId, limit);
    } catch (error) {
      this.logger.error('Erreur récupération mouvements', error);
      throw error;
    }
  }

  /**
   * GET /admin/stock/alerts
   * Récupérer les alertes de stock actives
   */
  @Get('alerts')
  @ApiOperation({ summary: 'Récupérer les alertes de stock actives' })
  @ApiResponse({ status: 200, description: 'Alertes récupérées avec succès' })
  async getStockAlerts() {
    try {
      this.logger.debug('Récupération alertes stock');
      return await this.stockService.getStockAlerts();
    } catch (error) {
      this.logger.error('Erreur récupération alertes', error);
      throw error;
    }
  }

  /**
   * GET /admin/stock/health
   * Vérifier la santé du service de gestion des stocks
   */
  @Get('health')
  @ApiOperation({ summary: 'État de santé du service stock' })
  @ApiResponse({ status: 200, description: 'Service opérationnel' })
  async checkHealth() {
    try {
      this.logger.debug('Vérification santé service stock');
      return {
        success: true,
        data: {
          service: 'StockManagementService',
          status: 'operational',
          timestamp: new Date().toISOString(),
        },
        message: 'Service opérationnel',
      };
    } catch (error) {
      this.logger.error('Erreur vérification santé', error);
      return {
        success: false,
        data: {
          service: 'StockManagementService',
          status: 'error',
          timestamp: new Date().toISOString(),
        },
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }
}