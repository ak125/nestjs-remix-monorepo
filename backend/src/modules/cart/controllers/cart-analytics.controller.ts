import {
  Controller,
  Get,
  UseGuards,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CartAnalyticsService } from '../services/cart-analytics.service';
import { OptionalAuthGuard } from '../../../auth/guards/optional-auth.guard';

@ApiTags('Cart Analytics')
@Controller('api/cart')
@UseGuards(OptionalAuthGuard)
@ApiBearerAuth()
export class CartAnalyticsController {
  private readonly logger = new Logger(CartAnalyticsController.name);

  constructor(private readonly cartAnalyticsService: CartAnalyticsService) {}

  @Get('analytics/report')
  @ApiOperation({
    summary: 'Rapport complet des analytics panier',
    description:
      'Taux d abandon, valeur moyenne, produits abandonnés, conversion',
  })
  async getAnalyticsReport() {
    try {
      const report = await this.cartAnalyticsService.getComprehensiveReport();
      return {
        success: true,
        report,
      };
    } catch (error) {
      this.logger.error('Erreur getAnalyticsReport:', error);
      throw new HttpException(
        'Erreur lors de la récupération du rapport analytics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('analytics/abandonment')
  @ApiOperation({
    summary: 'Taux d abandon et de conversion',
    description: 'Statistiques sur les paniers créés, convertis et abandonnés',
  })
  async getAbandonmentRate() {
    try {
      const stats = await this.cartAnalyticsService.getAbandonmentRate();
      return {
        success: true,
        stats,
      };
    } catch (error) {
      this.logger.error('Erreur getAbandonmentRate:', error);
      throw new HttpException(
        'Erreur lors de la récupération du taux d abandon',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('analytics/average-value')
  @ApiOperation({
    summary: 'Valeur moyenne du panier',
    description: 'Statistiques sur les valeurs des paniers convertis',
  })
  async getAverageCartValue() {
    try {
      const stats = await this.cartAnalyticsService.getAverageCartValue();
      return {
        success: true,
        stats,
      };
    } catch (error) {
      this.logger.error('Erreur getAverageCartValue:', error);
      throw new HttpException(
        'Erreur lors de la récupération de la valeur moyenne',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('analytics/abandoned-products')
  @ApiOperation({
    summary: 'Produits les plus abandonnés',
    description: 'Liste des produits fréquemment laissés dans les paniers',
  })
  async getTopAbandonedProducts() {
    try {
      const products =
        await this.cartAnalyticsService.getTopAbandonedProducts(10);
      return {
        success: true,
        count: products.length,
        products,
      };
    } catch (error) {
      this.logger.error('Erreur getTopAbandonedProducts:', error);
      throw new HttpException(
        'Erreur lors de la récupération des produits abandonnés',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
