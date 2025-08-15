/**
 * 🛒 CART CONTROLLER - API moderne simplifiée
 *
 * Version initiale adaptée aux services existants
 * ✅ Support invité + utilisateur authentifié
 * ✅ Cache Redis intégré
 * ✅ Documentation OpenAPI
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
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
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';

// 🔧 Services et DTOs
import { CartService } from './services/cart.service';
import { CartCalculationService } from './services/cart-calculation.service';
import { CartValidationService } from './services/cart-validation.service';
import { validateAddItem } from './dto/add-item.dto';
import { validateUpdateItem } from './dto/update-item.dto';
import { validateApplyPromo } from './dto/apply-promo.dto';

// 🔒 Guards et authentification
import { OptionalAuthGuard } from '../../auth/guards/optional-auth.guard';

// 🏷️ Types et interfaces
interface AuthenticatedUser {
  id: string;
  email: string;
  role?: string;
}

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
  sessionID: string;
}

@ApiTags('🛒 Cart Management')
@Controller('api/cart')
@UseGuards(OptionalAuthGuard)
@ApiBearerAuth()
export class CartController {
  private readonly logger = new Logger(CartController.name);

  constructor(
    private readonly cartService: CartService,
    private readonly cartCalculationService: CartCalculationService,
    private readonly cartValidationService: CartValidationService,
  ) {}

  /**
   * 🧪 Test de santé du module Cart
   */
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

  /**
   * 📋 Récupérer le panier actuel
   */
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
      // Test basique sans session d'abord
      return {
        id: 'test-cart',
        sessionId: 'test-session',
        userId: null,
        items: [],
        metadata: {
          subtotal: 0,
          promo_code: null,
          shipping_address: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur récupération panier: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération du panier',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ➕ Ajouter un article au panier
   */
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
      const addItemDto = validateAddItem(body);
      const sessionId = this.getSessionId(req);
      const userId = req.user?.id;

      this.logger.debug(
        `Ajout article au panier - session: ${sessionId}, product: ${addItemDto.product_id}`,
      );

      // Utiliser les méthodes existantes du service
      const result = await this.cartService.addToCart(
        sessionId,
        addItemDto.product_id,
        addItemDto.quantity,
        addItemDto.custom_price || 0, // Le service va récupérer le prix réel
        userId,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Erreur ajout article: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new HttpException(
        "Erreur lors de l'ajout de l'article",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔄 Mettre à jour la quantité d'un article
   */
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
      // Valider que l'itemId est un UUID
      if (!itemId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        throw new BadRequestException('ID item invalide (doit être un UUID)');
      }

      const updateItemDto = validateUpdateItem(body);
      const sessionId = this.getSessionId(req);
      const userId = req.user?.id;

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

      throw new HttpException(
        "Erreur lors de la mise à jour de l'article",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🗑️ Supprimer un article du panier
   */
  @Delete('items/:itemId')
  @ApiOperation({
    summary: 'Supprimer un article du panier',
    description: 'Retire complètement un article du panier',
  })
  @ApiParam({
    name: 'itemId',
    description: "ID de l'item à supprimer (numérique)",
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'Article supprimé avec succès',
  })
  async removeItem(
    @Param('itemId') itemIdStr: string,
    @Req() req: RequestWithUser,
  ) {
    try {
      const itemId = parseInt(itemIdStr, 10);
      if (isNaN(itemId)) {
        throw new BadRequestException('ID item invalide');
      }

      const sessionId = this.getSessionId(req);
      const userId = req.user?.id;

      this.logger.debug(
        `Suppression article - session: ${sessionId}, itemId: ${itemId}`,
      );

      const result = await this.cartService.removeFromCart(
        sessionId,
        itemId.toString(),
        userId,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Erreur suppression article: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new HttpException(
        "Erreur lors de la suppression de l'article",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🏷️ Appliquer un code promo
   */
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
      const sessionId = this.getSessionId(req);
      const userId = req.user?.id;

      this.logger.debug(
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

      throw new HttpException(
        "Erreur lors de l'application du code promo",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🗑️ Vider le panier
   */
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
      const sessionId = this.getSessionId(req);
      const userId = req.user?.id;

      this.logger.debug(`Vidage du panier - session: ${sessionId}`);

      await this.cartService.clearCart(sessionId, userId);

      return {
        message: 'Panier vidé avec succès',
        sessionId,
        userId,
      };
    } catch (error) {
      this.logger.error(
        `Erreur vidage panier: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new HttpException(
        'Erreur lors du vidage du panier',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔑 Utilitaire : obtenir l'identifiant de session
   */
  private getSessionId(req: RequestWithUser): string {
    if (req.sessionID) {
      return req.sessionID;
    }

    // Fallback : générer un ID temporaire
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.logger.warn(
      `Aucune session trouvée, utilisation d'un ID temporaire: ${tempId}`,
    );
    return tempId;
  }
}
