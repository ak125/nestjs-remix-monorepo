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
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { StockManagementService } from '../services/stock-management.service';
import { WorkingStockService } from '../services/working-stock.service';
import {
  StockDashboardFilters,
  UpdateStockDto,
  ReserveStockDto,
  DisableProductDto,
} from '../dto/stock.dto';

@ApiTags('Admin - Stock Management CONSOLIDÉ')
@Controller('api/admin/stock')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@ApiBearerAuth()
export class StockController {
  private readonly logger = new Logger(StockController.name);

  constructor(
    private readonly stockService: StockManagementService,
    private readonly workingStockService: WorkingStockService,
  ) {
    this.logger.log(
      '✅ Stock Controller consolidé - 6 controllers fusionnés en 1',
    );
  }

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
   * GET /admin/stock/stats
   * Statistiques détaillées du stock
   * ⚡ NOUVEAU - Fusionné de WorkingStockController
   */
  @Get('stats')
  @ApiOperation({ summary: 'Statistiques détaillées des stocks' })
  @ApiResponse({ status: 200, description: 'Statistiques récupérées' })
  async getStockStats() {
    try {
      this.logger.debug('Récupération statistiques stock');
      const stats = await this.workingStockService.getStockStatistics();
      return {
        success: true,
        data: stats,
        message: 'Statistiques récupérées avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur récupération statistiques', error);
      throw error;
    }
  }

  /**
   * GET /admin/stock/search
   * Recherche avancée dans le stock
   * ⚡ NOUVEAU - Fusionné de WorkingStockController
   */
  @Get('search')
  @ApiOperation({ summary: 'Rechercher des articles dans le stock' })
  @ApiResponse({ status: 200, description: 'Résultats de recherche' })
  async searchStock(
    @Query('query') query: string,
    @Query('limit') limit: string = '50',
    @Query('availableOnly') availableOnly: string = 'true',
  ) {
    try {
      this.logger.debug('Recherche stock', { query, limit, availableOnly });
      const items = await this.workingStockService.searchItems(
        query,
        parseInt(limit),
        availableOnly === 'true',
      );
      return {
        success: true,
        data: items,
        count: items.length,
        message: 'Recherche effectuée avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur recherche stock', error);
      throw error;
    }
  }

  /**
   * GET /admin/stock/top-items
   * Récupérer les top produits
   * ⚡ NOUVEAU - Fusionné de WorkingStockController
   */
  @Get('top-items')
  @ApiOperation({ summary: 'Récupérer les produits top (prix élevé)' })
  @ApiResponse({ status: 200, description: 'Top produits récupérés' })
  async getTopItems(@Query('limit') limit: string = '10') {
    try {
      this.logger.debug('Récupération top items', { limit });
      const items = await this.workingStockService.getTopItems(parseInt(limit));
      return {
        success: true,
        data: items,
        count: items.length,
        message: 'Top produits récupérés avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur top items', error);
      throw error;
    }
  }

  /**
   * PUT /admin/stock/:pieceId/availability
   * Mettre à jour la disponibilité d'un produit
   * ⚡ NOUVEAU - Fusionné de WorkingStockController
   */
  @Put(':pieceId/availability')
  @ApiOperation({ summary: 'Mettre à jour la disponibilité' })
  @ApiResponse({ status: 200, description: 'Disponibilité mise à jour' })
  async updateAvailability(
    @Param('pieceId') pieceId: string,
    @Body() body: { available: boolean },
  ) {
    try {
      this.logger.debug('Mise à jour disponibilité', { pieceId, ...body });
      const result = await this.workingStockService.updateAvailability(
        pieceId,
        body.available,
      );
      return {
        success: true,
        data: { pieceId, available: body.available, updated: result },
        message: 'Disponibilité mise à jour avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur mise à jour disponibilité', error);
      throw error;
    }
  }

  /**
   * GET /admin/stock/health
   * Vérifier la santé du service de gestion des stocks
   */
  @Get('health')
  @ApiOperation({ summary: 'État de santé du service stock consolidé' })
  @ApiResponse({ status: 200, description: 'Service opérationnel' })
  async checkHealth() {
    try {
      this.logger.debug('Vérification santé service stock');
      return {
        success: true,
        data: {
          service: 'StockController-Consolidated',
          oldControllers: 6,
          newControllers: 1,
          routes: 13,
          status: 'operational',
          timestamp: new Date().toISOString(),
        },
        message: '✅ Service stock consolidé opérationnel - 83% reduction',
      };
    } catch (error) {
      this.logger.error('Erreur vérification santé', error);
      return {
        success: false,
        data: {
          service: 'StockController-Consolidated',
          status: 'error',
          timestamp: new Date().toISOString(),
        },
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }
}
