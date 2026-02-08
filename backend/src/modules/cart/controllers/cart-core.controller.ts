import {
  Controller,
  Get,
  Delete,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { OperationFailedException } from '../../../common/exceptions';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CartDataService } from '../../../database/services/cart-data.service';
import { OptionalAuthGuard } from '../../../auth/guards/optional-auth.guard';
import { RequestWithUser, getCartUserId } from './cart-controller.utils';

@ApiTags('Cart')
@Controller('api/cart')
@UseGuards(OptionalAuthGuard)
@ApiBearerAuth()
export class CartCoreController {
  private readonly logger = new Logger(CartCoreController.name);

  constructor(private readonly cartDataService: CartDataService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Test de santé du Cart',
    description: 'Endpoint pour vérifier que le module Cart fonctionne',
  })
  getHealth() {
    return {
      status: 'OK',
      module: 'Cart',
      timestamp: new Date().toISOString(),
      message: 'Module Cart opérationnel',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Récupérer le panier actuel',
    description:
      "Obtient le panier pour l'utilisateur connecté ou la session invité",
  })
  @ApiResponse({
    status: 200,
    description: 'Panier récupéré avec succès',
  })
  async getCart(@Req() req: RequestWithUser) {
    try {
      const { sessionId, userId, userIdForCart } = getCartUserId(
        req,
        this.logger,
      );

      this.logger.debug(
        `Récupération panier pour: session=${sessionId}, user=${userId}`,
      );

      const cartData =
        await this.cartDataService.getCartWithMetadata(userIdForCart);

      const cart = {
        cart_id: `cart_${userIdForCart}`,
        user_id: userId || null,
        session_id: sessionId,
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
        metadata: {
          currency: 'EUR',
          last_updated: new Date().toISOString(),
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      this.logger.debug(
        `Panier récupéré: ${cart.totals.total_items} articles, total: ${cart.totals.total.toFixed(2)}€`,
      );
      return cart;
    } catch (error) {
      this.logger.error(
        `Erreur récupération panier: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération du panier',
      });
    }
  }

  @Get('merge-info')
  @ApiOperation({
    summary: 'Informations de fusion de panier après connexion',
    description:
      "Récupère les informations sur la fusion de panier qui s'est produite lors de la connexion (si disponible)",
  })
  @ApiResponse({
    status: 200,
    description: 'Informations de fusion disponibles',
  })
  async getCartMergeInfo(@Req() req: RequestWithUser) {
    try {
      const session = req.session as unknown as
        | Record<string, unknown>
        | undefined;
      const mergeInfo = session?.cartMergeInfo as
        | { guestItems: number; existingItems: number; timestamp: string }
        | undefined;

      if (mergeInfo && session) {
        delete session.cartMergeInfo;

        return {
          merged: true,
          guestItems: mergeInfo.guestItems,
          existingItems: mergeInfo.existingItems,
          totalItems: mergeInfo.guestItems + mergeInfo.existingItems,
          message: `Vos ${mergeInfo.guestItems} nouveaux articles ont été ajoutés aux ${mergeInfo.existingItems} articles déjà présents dans votre panier.`,
          timestamp: mergeInfo.timestamp,
        };
      }

      return {
        merged: false,
        message: 'Aucune fusion de panier récente',
      };
    } catch (error) {
      this.logger.error(`Erreur récupération info fusion: ${error}`);
      return {
        merged: false,
        message: 'Erreur lors de la récupération des informations',
      };
    }
  }

  @Delete()
  @ApiOperation({
    summary: 'Vider complètement le panier',
    description: 'Supprime tous les articles du panier',
  })
  @ApiResponse({
    status: 200,
    description: 'Panier vidé avec succès',
  })
  async clearCart(@Req() req: RequestWithUser) {
    try {
      const { sessionId, userId, userIdForCart } = getCartUserId(
        req,
        this.logger,
      );

      this.logger.debug(
        `Vidage du panier - session: ${sessionId}, user: ${userId}`,
      );

      await this.cartDataService.clearUserCart(userIdForCart);

      return {
        message: 'Panier vidé avec succès',
        sessionId,
        userId,
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `Erreur vidage panier: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new OperationFailedException({
        message: 'Erreur lors du vidage du panier',
      });
    }
  }

  @Get('recommendations')
  @ApiOperation({
    summary: 'Obtenir des recommandations produits basées sur le panier',
    description:
      'Retourne 3-5 produits complémentaires selon le contenu du panier',
  })
  @ApiResponse({
    status: 200,
    description: 'Recommendations récupérées avec succès',
  })
  async getRecommendations(@Req() req: RequestWithUser) {
    try {
      const { sessionId, userId, userIdForCart } = getCartUserId(
        req,
        this.logger,
      );

      this.logger.debug(
        `Récupération recommendations - session: ${sessionId}, user: ${userId}`,
      );

      const cart =
        await this.cartDataService.getCartWithMetadata(userIdForCart);

      // TODO: Améliorer avec un vrai système de recommandations ML
      const recommendations = [
        {
          id: '99901',
          name: 'Liquide de refroidissement 5L',
          price: 12.99,
          imageUrl: '/images/products/coolant.jpg',
          category: 'Entretien',
          stock: 'in-stock',
          brand: 'TOTAL',
          reason: 'Souvent acheté ensemble',
        },
        {
          id: '99902',
          name: 'Filtre à huile premium',
          price: 8.5,
          imageUrl: '/images/products/oil-filter.jpg',
          category: 'Filtration',
          stock: 'in-stock',
          brand: 'MANN-FILTER',
          reason: 'Compatible avec votre véhicule',
        },
        {
          id: '99903',
          name: 'Kit courroie distribution',
          price: 89.99,
          imageUrl: '/images/products/timing-belt.jpg',
          category: 'Distribution',
          stock: 'low-stock',
          brand: 'GATES',
          reason: 'Entretien recommandé',
        },
      ];

      return {
        success: true,
        recommendations: recommendations.slice(0, 3),
        cartItemCount: cart?.items?.length || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur récupération recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        success: true,
        recommendations: [],
        cartItemCount: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
