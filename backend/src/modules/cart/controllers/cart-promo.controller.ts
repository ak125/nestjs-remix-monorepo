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
import { OperationFailedException } from '../../../common/exceptions';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CartService } from '../services/cart.service';
import { CartDataService } from '../../../database/services/cart-data.service';
import { validateApplyPromo } from '../dto/apply-promo.dto';
import { OptionalAuthGuard } from '../../../auth/guards/optional-auth.guard';
import { RequestWithUser, getCartUserId } from './cart-controller.utils';

@ApiTags('Cart Promo')
@Controller('api/cart')
@UseGuards(OptionalAuthGuard)
@ApiBearerAuth()
export class CartPromoController {
  private readonly logger = new Logger(CartPromoController.name);

  constructor(
    private readonly cartService: CartService,
    private readonly cartDataService: CartDataService,
  ) {}

  @Post('promo')
  @ApiOperation({
    summary: 'Appliquer un code promotionnel',
    description: 'Valide et applique un code promo au panier',
  })
  @ApiResponse({
    status: 200,
    description: 'Code promo appliqué avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Code promo invalide ou expiré',
  })
  async applyPromo(@Body() body: unknown, @Req() req: RequestWithUser) {
    try {
      const applyPromoDto = validateApplyPromo(body);
      const { sessionId, userId } = getCartUserId(req, this.logger);

      this.logger.log(
        `Application code promo ${applyPromoDto.promoCode} - session: ${sessionId}`,
      );

      const result = await this.cartService.applyPromoCode(
        sessionId,
        applyPromoDto.promoCode,
        userId,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Erreur application promo: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new OperationFailedException({
        message: "Erreur lors de l'application du code promo",
      });
    }
  }

  @Delete('promo')
  @ApiOperation({
    summary: 'Retirer le code promotionnel',
    description: 'Retire le code promo actuellement appliqué au panier',
  })
  @ApiResponse({
    status: 200,
    description: 'Code promo retiré avec succès',
  })
  async removePromo(@Req() req: RequestWithUser) {
    try {
      const { sessionId, userIdForCart } = getCartUserId(req, this.logger);

      this.logger.debug(`Retrait code promo - session: ${sessionId}`);

      await this.cartDataService.removePromoCode(userIdForCart);

      return {
        success: true,
        message: 'Code promo retiré avec succès',
      };
    } catch (error) {
      this.logger.error(
        `Erreur retrait promo: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      throw new OperationFailedException({
        message: 'Erreur lors du retrait du code promo',
      });
    }
  }
}
