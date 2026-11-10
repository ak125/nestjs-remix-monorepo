import {
  Controller,
  Get,
  Post,
  Param,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { ShippingService } from './shipping.service';

/**
 * Les routes indexées par commande (suivi, frais, délai) sont réservées aux
 * administrateurs. `methods/:zipCode` ne lit qu'un barème par code postal et
 * reste publique.
 */
@Controller('shipping')
export class ShippingController {
  private readonly logger = new Logger(ShippingController.name);

  constructor(private readonly shippingService: ShippingService) {}

  /**
   * Obtenir toutes les expéditions avec tracking
   */
  @Get('tracking/all')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async getAllShipmentsTracking() {
    try {
      const trackingData =
        await this.shippingService.getAllShipmentsWithTracking();
      return {
        success: true,
        data: trackingData,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting all shipments tracking:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Calculer les frais de port pour une commande
   */
  @Post('calculate/:orderId')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async calculateShippingFee(@Param('orderId') orderId: string) {
    try {
      const fee = await this.shippingService.calculateShippingFee(
        parseInt(orderId),
      );
      return {
        success: true,
        data: {
          orderId: parseInt(orderId),
          shippingFee: fee,
          currency: 'EUR',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error calculating shipping fee:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Estimer le délai de livraison
   */
  @Get('delivery-estimate/:orderId')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async getDeliveryEstimate(@Param('orderId') orderId: string) {
    try {
      const estimate = await this.shippingService.estimateDeliveryTime(
        parseInt(orderId),
      );
      return {
        success: true,
        data: estimate,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error estimating delivery:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Obtenir les méthodes de livraison disponibles
   */
  @Get('methods/:zipCode')
  async getShippingMethods(@Param('zipCode') zipCode: string) {
    try {
      const methods =
        await this.shippingService.getAvailableShippingMethods(zipCode);
      return {
        success: true,
        data: {
          zipCode,
          methods,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting shipping methods:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
