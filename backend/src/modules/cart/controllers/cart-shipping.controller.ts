import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  Req,
  Logger,
  HttpStatus,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CartDataService } from '../../../database/services/cart-data.service';
import { ShippingService } from '../../shipping/shipping.service';
import { OptionalAuthGuard } from '../../../auth/guards/optional-auth.guard';
import { RequestWithUser, getCartUserId } from './cart-controller.utils';

@ApiTags('Cart Shipping')
@Controller('api/cart')
@UseGuards(OptionalAuthGuard)
@ApiBearerAuth()
export class CartShippingController {
  private readonly logger = new Logger(CartShippingController.name);

  constructor(
    private readonly cartDataService: CartDataService,
    private readonly shippingService: ShippingService,
  ) {}

  @Post('shipping/calculate')
  @ApiOperation({
    summary: 'Calculer les frais de livraison',
    description:
      'Calcule le coût de livraison selon le code postal et le poids du panier',
  })
  @ApiResponse({
    status: 200,
    description: 'Frais de livraison calculés avec succès',
  })
  async calculateShipping(
    @Req() req: RequestWithUser,
    @Body() body: { postalCode: string },
  ) {
    try {
      const { userIdForCart } = getCartUserId(req, this.logger);
      const { postalCode } = body;

      if (!postalCode) {
        throw new BadRequestException('Code postal requis');
      }

      const cart =
        await this.cartDataService.getCartWithMetadata(userIdForCart);

      const totalWeight = cart.items.reduce(
        (sum, item) => sum + (item.weight || 0) * item.quantity,
        0,
      );

      const estimate = await this.shippingService.calculateShippingEstimate({
        weight: totalWeight,
        country: 'FR',
        postalCode: postalCode,
        orderAmount: cart.stats.subtotal,
      });

      return {
        success: true,
        shipping: {
          zone: estimate.zone,
          cost: estimate.fee,
          isFree: estimate.freeShipping,
          estimatedDays: estimate.deliveryEstimate.minDays,
          method: estimate.freeShipping ? 'Livraison gratuite' : 'Colissimo',
        },
        remainingForFreeShipping: estimate.freeShipping
          ? 0
          : Math.max(0, 100 - cart.stats.subtotal),
      };
    } catch (error) {
      this.logger.error('Erreur calcul shipping:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Erreur calcul livraison',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('shipping')
  @ApiOperation({
    summary: 'Appliquer une méthode de livraison au panier',
    description: 'Enregistre la méthode de livraison sélectionnée',
  })
  @ApiResponse({
    status: 200,
    description: 'Méthode de livraison appliquée avec succès',
  })
  async applyShipping(
    @Req() req: RequestWithUser,
    @Body()
    body: {
      postalCode: string;
      address?: string;
    },
  ) {
    try {
      const { userIdForCart } = getCartUserId(req, this.logger);
      const { postalCode, address } = body;

      if (!postalCode) {
        throw new BadRequestException('Code postal requis');
      }

      const cart =
        await this.cartDataService.getCartWithMetadata(userIdForCart);

      const totalWeight = cart.items.reduce(
        (sum, item) => sum + (item.weight || 0) * item.quantity,
        0,
      );

      const estimate = await this.shippingService.calculateShippingEstimate({
        weight: totalWeight,
        country: 'FR',
        postalCode: postalCode,
        orderAmount: cart.stats.subtotal,
      });

      const shippingInfo = {
        zone: estimate.zone,
        cost: estimate.fee,
        isFree: estimate.freeShipping,
        estimatedDays: estimate.deliveryEstimate.minDays,
        method: estimate.freeShipping ? 'Livraison gratuite' : 'Colissimo',
      };

      await this.cartDataService.applyShipping(userIdForCart, {
        method_id: 1,
        method_name: shippingInfo.method,
        zone: shippingInfo.zone,
        cost: shippingInfo.cost,
        estimated_days: shippingInfo.estimatedDays,
        postal_code: postalCode,
        address,
      });

      return {
        success: true,
        message: 'Méthode de livraison appliquée avec succès',
        shipping: shippingInfo,
      };
    } catch (error) {
      this.logger.error('Erreur application shipping:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Erreur application livraison',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete('shipping')
  @ApiOperation({
    summary: 'Retirer la méthode de livraison',
    description:
      'Retire la méthode de livraison actuellement appliquée au panier',
  })
  @ApiResponse({
    status: 200,
    description: 'Méthode de livraison retirée avec succès',
  })
  async removeShipping(@Req() req: RequestWithUser) {
    try {
      const { userIdForCart } = getCartUserId(req, this.logger);

      await this.cartDataService.removeShipping(userIdForCart);

      return {
        success: true,
        message: 'Méthode de livraison retirée avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur retrait shipping:', error);
      throw new HttpException(
        'Erreur lors du retrait de la méthode de livraison',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
