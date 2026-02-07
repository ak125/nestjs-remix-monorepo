import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Logger,
  UseInterceptors,
} from '@nestjs/common';
import { OperationFailedException } from '../../../common/exceptions';
import { ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { StockService } from '../services/stock.service';

@ApiTags('Products Inventory')
@Controller('api/products')
@UseInterceptors(CacheInterceptor)
export class ProductsInventoryController {
  private readonly logger = new Logger(ProductsInventoryController.name);

  constructor(private readonly stockService: StockService) {}

  /**
   * Obtenir la liste de réapprovisionnement
   */
  @Get('inventory/reorder-list')
  @CacheTTL(60)
  async getReorderList() {
    try {
      const reorderList = await this.stockService.getReorderList();
      return {
        success: true,
        count: reorderList.length,
        items: reorderList,
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération de la liste de réapprovisionnement:',
        error,
      );
      throw new OperationFailedException({
        message:
          'Erreur lors de la récupération de la liste de réapprovisionnement',
      });
    }
  }

  /**
   * Rapport d'inventaire global
   */
  @Get('inventory/report')
  @CacheTTL(300)
  async getInventoryReport() {
    try {
      const report = await this.stockService.getInventoryReport();
      return {
        success: true,
        report,
      };
    } catch (error) {
      this.logger.error(
        "Erreur lors de la génération du rapport d'inventaire:",
        error,
      );
      throw new OperationFailedException({
        message: "Erreur lors de la génération du rapport d'inventaire",
      });
    }
  }

  /**
   * Simuler un réapprovisionnement (pour tests/démo)
   */
  @Post('inventory/restock/:id')
  async simulateRestock(
    @Param('id') id: string,
    @Body() body: { quantity: number },
  ) {
    try {
      const productId = parseInt(id, 10);
      const success = await this.stockService.simulateRestock(
        productId,
        body.quantity,
      );

      if (success) {
        return {
          success: true,
          message: `Réapprovisionnement de ${body.quantity} unités effectué`,
          productId,
        };
      } else {
        throw new OperationFailedException({
          message: 'Échec du réapprovisionnement',
        });
      }
    } catch (error) {
      this.logger.error('Erreur lors du réapprovisionnement:', error);
      throw new OperationFailedException({
        message: 'Erreur lors du réapprovisionnement',
      });
    }
  }
}
