import {
  Controller,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
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
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CartService } from '../services/cart.service';
import { CartDataService } from '../../../database/services/cart-data.service';
import { StockService } from '../../products/services/stock.service';
import { validateAddItem } from '../dto/add-item.dto';
import { validateUpdateItem } from '../dto/update-item.dto';
import { OptionalAuthGuard } from '../../../auth/guards/optional-auth.guard';
import { RequestWithUser, getCartUserId } from './cart-controller.utils';

@ApiTags('Cart Items')
@Controller('api/cart')
@UseGuards(OptionalAuthGuard)
@ApiBearerAuth()
export class CartItemsController {
  private readonly logger = new Logger(CartItemsController.name);

  constructor(
    private readonly cartService: CartService,
    private readonly cartDataService: CartDataService,
    private readonly stockService: StockService,
  ) {}

  @Post('items')
  @ApiOperation({
    summary: 'Ajouter un article au panier',
    description:
      'Ajoute un nouvel article ou met à jour la quantité si déjà présent',
  })
  @ApiResponse({
    status: 201,
    description: 'Article ajouté avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides ou produit non disponible',
  })
  async addItem(@Body() body: unknown, @Req() req: RequestWithUser) {
    try {
      this.logger.log(`Raw body received:`, JSON.stringify(body, null, 2));

      const addItemDto = validateAddItem(body);
      const { sessionId, userId, userIdForCart } = getCartUserId(
        req,
        this.logger,
      );

      this.logger.debug(
        `Ajout article au panier - session: ${sessionId}, product: ${addItemDto.product_id}`,
      );

      const productIdNum = parseInt(String(addItemDto.product_id), 10);

      // Stock validation disabled temporarily
      this.logger.log(
        `TEMPORAIRE: Validation du stock DÉSACTIVÉE pour produit ${productIdNum}`,
      );

      const isReplace = (body as Record<string, unknown>)?.replace === true;

      const result = await this.cartDataService.addCartItem(
        userIdForCart,
        productIdNum,
        addItemDto.quantity,
        addItemDto.custom_price,
        isReplace,
      );

      this.logger.log(
        `Article ajouté: ${productIdNum} x${addItemDto.quantity}`,
      );

      // Retourner le panier complet directement
      const cartData =
        await this.cartDataService.getCartWithMetadata(userIdForCart);
      this.logger.log(
        `Panier optimisé: ${cartData.stats.totalQuantity} articles, ${cartData.stats.total.toFixed(2)}€`,
      );

      return {
        success: true,
        message: `Article ajouté au panier`,
        item: result,
        productId: productIdNum,
        quantity: addItemDto.quantity,
        cart: {
          cart_id: `cart_${userIdForCart}`,
          user_id: userId || null,
          items: cartData.items,
          totals: {
            total_items: cartData.stats.totalQuantity,
            item_count: cartData.stats.totalQuantity,
            subtotal: cartData.stats.subtotal,
            consigne_total: cartData.stats.consigne_total || 0,
            tax: 0,
            shipping: 0,
            discount: cartData.stats.promoDiscount,
            total: cartData.stats.total,
          },
          summary: {
            total_items: cartData.stats.totalQuantity,
            total_price: cartData.stats.total,
            subtotal: cartData.stats.subtotal,
            tax_amount: 0,
            shipping_cost: 0,
            consigne_total: cartData.stats.consigne_total || 0,
            currency: 'EUR',
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `Erreur ajout article: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new OperationFailedException({
        message: "Erreur lors de l'ajout de l'article",
      });
    }
  }

  @Post('add')
  @ApiOperation({
    summary: 'Ajouter un article au panier (alias)',
    description: 'Alias de POST /items pour compatibilité frontend',
  })
  async addItemAlias(@Body() body: unknown, @Req() req: RequestWithUser) {
    return this.addItem(body, req);
  }

  @Put('items/:itemId')
  @ApiOperation({
    summary: "Mettre à jour la quantité d'un article",
    description: "Modifie la quantité ou supprime l'article si quantité = 0",
  })
  @ApiParam({
    name: 'itemId',
    description: "ID de l'item dans le panier (UUID)",
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Article mis à jour avec succès',
  })
  async updateItem(
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    try {
      if (!itemId || itemId.trim() === '') {
        throw new BadRequestException('ID item manquant');
      }

      const updateItemDto = validateUpdateItem(body);
      const { sessionId, userId } = getCartUserId(req, this.logger);

      this.logger.debug(
        `Mise à jour quantité - session: ${sessionId}, itemId: ${itemId}, quantity: ${updateItemDto.quantity}`,
      );

      const result = await this.cartService.updateQuantity(
        sessionId,
        itemId,
        updateItemDto.quantity,
        userId,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Erreur mise à jour article: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new OperationFailedException({
        message: "Erreur lors de la mise à jour de l'article",
      });
    }
  }

  @Patch('items/:itemId')
  @ApiOperation({
    summary: 'Mettre à jour partiellement un article (alias de PUT)',
    description: 'Modifie la quantité via PATCH HTTP method',
  })
  @ApiParam({
    name: 'itemId',
    description: "ID de l'item dans le panier",
    type: 'string',
  })
  async patchItem(
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    return this.updateItem(itemId, body, req);
  }

  @Delete('items/:itemId')
  @ApiOperation({
    summary: 'Supprimer un article du panier',
    description: 'Retire complètement un article du panier',
  })
  @ApiParam({
    name: 'itemId',
    description:
      "ID de l'item à supprimer (format: userId-productId-timestamp)",
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Article supprimé avec succès',
  })
  async removeItem(
    @Param('itemId') itemId: string,
    @Req() req: RequestWithUser,
  ) {
    try {
      if (!itemId || itemId.trim() === '') {
        throw new BadRequestException('ID item manquant');
      }

      const { sessionId, userIdForCart } = getCartUserId(req, this.logger);

      this.logger.debug(
        `Suppression article - session: ${sessionId}, itemId: ${itemId}`,
      );

      const isProductId = /^\d+$/.test(itemId);

      if (isProductId) {
        this.logger.log(`Suppression par product_id: ${itemId}`);
        await this.cartDataService.removeCartItem(
          userIdForCart,
          parseInt(itemId, 10),
        );
      } else {
        this.logger.log(`Suppression par item ID complet: ${itemId}`);
        await this.cartDataService.deleteCartItem(itemId, userIdForCart);
      }

      // Retourner le panier complet directement
      const cartData =
        await this.cartDataService.getCartWithMetadata(userIdForCart);
      this.logger.log(
        `Panier après suppression: ${cartData.stats.totalQuantity} articles`,
      );

      return {
        success: true,
        message: 'Article supprimé avec succès',
        itemId: itemId,
        cart: {
          items: cartData.items,
          summary: {
            total_items: cartData.stats.totalQuantity,
            total_price: cartData.stats.total,
            subtotal: cartData.stats.subtotal,
            tax_amount: 0,
            shipping_cost: 0,
            consigne_total: cartData.stats.consigne_total || 0,
            currency: 'EUR',
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `Erreur suppression article: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new OperationFailedException({
        message: "Erreur lors de la suppression de l'article",
      });
    }
  }
}
