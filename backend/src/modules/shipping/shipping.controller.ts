import { Controller, Get, Post, Param, Body, Logger } from '@nestjs/common';
import { ShippingService } from './shipping.service';

@Controller('shipping')
export class ShippingController {
  private readonly logger = new Logger(ShippingController.name);

  constructor(private readonly shippingService: ShippingService) {}

  /**
   * Obtenir toutes les expéditions avec tracking
   */
  @Get('tracking/all')
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
   * Calculer une estimation de frais de port
   */
  @Post('estimate')
  async calculateEstimate(
    @Body()
    data: {
      weight: number;
      country: string;
      postalCode: string;
      orderAmount?: number;
    },
  ) {
    try {
      const estimate =
        await this.shippingService.calculateShippingEstimate(data);
      return {
        success: true,
        data: estimate,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error calculating estimate:', error);
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

  /**
   * Test du service shipping
   */
  @Get('test')
  async testShippingService() {
    try {
      const tests = [];

      // Test 1: Estimation pour France métropolitaine
      const estimate1 = await this.shippingService.calculateShippingEstimate({
        weight: 2.5,
        country: 'FR',
        postalCode: '75001',
        orderAmount: 50,
      });
      tests.push({
        name: 'France métropolitaine (2.5kg, 50€)',
        data: estimate1,
      });

      // Test 2: Livraison gratuite
      const estimate2 = await this.shippingService.calculateShippingEstimate({
        weight: 1.0,
        country: 'FR',
        postalCode: '75001',
        orderAmount: 150,
      });
      tests.push({
        name: 'Livraison gratuite (>100€)',
        data: estimate2,
      });

      // Test 3: Corse
      const estimate3 = await this.shippingService.calculateShippingEstimate({
        weight: 1.5,
        country: 'FR',
        postalCode: '20000',
        orderAmount: 30,
      });
      tests.push({
        name: 'Corse (1.5kg, 30€)',
        data: estimate3,
      });

      // Test 4: Europe
      const estimate4 = await this.shippingService.calculateShippingEstimate({
        weight: 3.0,
        country: 'DE',
        postalCode: '10115',
        orderAmount: 80,
      });
      tests.push({
        name: 'Allemagne (3kg, 80€)',
        data: estimate4,
      });

      return {
        success: true,
        message: 'Tests du service shipping',
        data: {
          testsCount: tests.length,
          tests,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error testing shipping service:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
