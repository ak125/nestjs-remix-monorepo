import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  Req,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  OperationFailedException,
  DomainValidationException,
} from '../../../common/exceptions';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CartDataService } from '../../../database/services/cart-data.service';
import { ShippingCalculatorService } from '../services/shipping-calculator.service';
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
    private readonly shippingCalculator: ShippingCalculatorService,
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

      // Poids réel via pieces_price
      const cartItems = (cart.items || []).map((item) => ({
        productId: item.product_id,
        quantity: item.quantity,
      }));
      const totalWeightG =
        await this.shippingCalculator.getCartItemsWeight(cartItems);

      // Zone géographique via code postal
      const zone = this.shippingCalculator.determineZone(postalCode);
      const fee = this.shippingCalculator.calculateByWeight(
        totalWeightG,
        cart.stats.subtotal,
        zone,
      );
      const isFree = fee === 0 && cart.stats.subtotal > 0;

      return {
        success: true,
        shipping: {
          zone,
          cost: fee,
          isFree,
          method: isFree ? 'Livraison gratuite' : 'Colissimo',
          weight_g: totalWeightG,
          weight_kg: +(totalWeightG / 1000).toFixed(2),
        },
        remainingForFreeShipping: isFree
          ? 0
          : Math.max(0, 150 - cart.stats.subtotal),
      };
    } catch (error) {
      this.logger.error('Erreur calcul shipping:', error);
      throw new DomainValidationException({
        message:
          error instanceof Error ? error.message : 'Erreur calcul livraison',
      });
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

      const cartItems = (cart.items || []).map((item) => ({
        productId: item.product_id,
        quantity: item.quantity,
      }));
      const totalWeightG =
        await this.shippingCalculator.getCartItemsWeight(cartItems);

      const zone = this.shippingCalculator.determineZone(postalCode);
      const fee = this.shippingCalculator.calculateByWeight(
        totalWeightG,
        cart.stats.subtotal,
        zone,
      );
      const isFree = fee === 0 && cart.stats.subtotal > 0;

      const shippingInfo = {
        zone,
        cost: fee,
        isFree,
        method: isFree ? 'Livraison gratuite' : 'Colissimo',
      };

      await this.cartDataService.applyShipping(userIdForCart, {
        method_id: 1,
        method_name: shippingInfo.method,
        zone: shippingInfo.zone,
        cost: shippingInfo.cost,
        estimated_days: zone === 'france' || zone === 'corse' ? 2 : 7,
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
      throw new DomainValidationException({
        message:
          error instanceof Error
            ? error.message
            : 'Erreur application livraison',
      });
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
      throw new OperationFailedException({
        message: 'Erreur lors du retrait de la méthode de livraison',
      });
    }
  }
}
