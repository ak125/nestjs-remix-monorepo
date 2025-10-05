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
import { CartDataService } from '../../database/services/cart-data.service';
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
    private readonly cartDataService: CartDataService,
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
      // Obtenir l'ID utilisateur ou session (MÊME LOGIQUE QUE L'AJOUT)
      const sessionId = this.getSessionId(req);
      const userId = req.user?.id;
      const userIdForCart = userId || sessionId;

      // 🔍 DEBUG: Identifier l'origine des appels répétés
      const referer = req.headers.referer || 'Unknown';
      this.logger.log(
        `🔍 Cart GET Request - Session: ${sessionId}, User: ${userId}, Referer: ${referer}`,
      );

      this.logger.debug(
        `Récupération panier pour: session=${sessionId}, user=${userId}`,
      );

      // Récupérer le panier complet avec métadonnées et prix enrichis
      const cartData =
        await this.cartDataService.getCartWithMetadata(userIdForCart);

      // 🔍 DEBUG: Voir ce qui revient du CartDataService
      this.logger.log('🔍 CartData brut:', JSON.stringify(cartData, null, 2));
      
      if (cartData.items?.length > 0) {
        this.logger.log('🔍 Premier item:', JSON.stringify(cartData.items[0], null, 2));
      }

      // Reformater au format API attendu par le frontend
      const cart = {
        cart_id: `cart_${userIdForCart}`,
        user_id: userId || null,
        session_id: sessionId,
        items: cartData.items,
        totals: {
          total_items: cartData.stats.totalQuantity,
          item_count: cartData.stats.totalQuantity,
          subtotal: cartData.stats.subtotal,
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

      this.logger.log(
        `✅ Panier récupéré: ${cart.totals.total_items} articles, total: ${cart.totals.total.toFixed(2)}€`,
      );
      return cart;
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
      // 🔍 DEBUG: Voir ce qui est reçu
      this.logger.log(`🔍 Raw body received:`, JSON.stringify(body, null, 2));
      
      const addItemDto = validateAddItem(body);
      const sessionId = this.getSessionId(req);
      const userId = req.user?.id;

      this.logger.debug(
        `Ajout article au panier - session: ${sessionId}, product: ${addItemDto.product_id}`,
      );

      // Utiliser CartDataService directement avec les IDs numériques
      const productIdNum = parseInt(String(addItemDto.product_id), 10);
      const userIdForCart = userId || sessionId;
      
      // Vérifier si c'est une mise à jour de quantité (flag replace dans le body)
      const isReplace = (body as any)?.replace === true;
      
      // Récupérer les données produit enrichies si fournies depuis le frontend
      const productData = (body as any)?.productData;

      const result = await this.cartDataService.addCartItem(
        userIdForCart,
        productIdNum,
        addItemDto.quantity,
        addItemDto.custom_price,
        isReplace,
        productData,
      );

      this.logger.log(
        `✅ Article ajouté: ${productIdNum} x${addItemDto.quantity}`,
      );

      return {
        success: true,
        message: `Article ajouté au panier`,
        item: result,
        productId: productIdNum,
        quantity: addItemDto.quantity,
      };
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
   * ➕ Alias pour ajouter un article au panier (compatibilité frontend)
   */
  @Post('add')
  @ApiOperation({
    summary: 'Ajouter un article au panier (alias)',
    description: 'Alias de POST /items pour compatibilité frontend',
  })
  async addItemAlias(@Body() body: unknown, @Req() req: RequestWithUser) {
    // Rediriger vers la méthode principale
    return this.addItem(body, req);
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
      if (
        !itemId.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        )
      ) {
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
        throw new BadRequestException('ID item invalide (doit être un nombre)');
      }

      const sessionId = this.getSessionId(req);
      const userId = req.user?.id;
      const userIdForCart = userId || sessionId;

      this.logger.debug(
        `Suppression article - session: ${sessionId}, productId: ${itemId}`,
      );

      // Utiliser CartDataService pour supprimer directement avec l'ID du produit
      await this.cartDataService.removeCartItem(userIdForCart, itemId);

      return {
        success: true,
        message: 'Article supprimé avec succès',
        productId: itemId,
      };
    } catch (error) {
      this.logger.error(
        `Erreur suppression article: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

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
      const userIdForCart = userId || sessionId;

      this.logger.debug(
        `Application code promo ${applyPromoDto.promoCode} - session: ${sessionId}`,
      );

      // 1. Récupérer le panier actuel pour calculer le subtotal
      const cart = await this.cartDataService.getCartWithMetadata(userIdForCart);

      // 2. Utiliser CartService pour valider et appliquer le promo
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
   * 🗑️ Retirer le code promo appliqué
   */
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
      const sessionId = this.getSessionId(req);
      const userId = req.user?.id;
      const userIdForCart = userId || sessionId;

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

      throw new HttpException(
        'Erreur lors du retrait du code promo',
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
      const userIdForCart = userId || sessionId;

      this.logger.debug(
        `Vidage du panier - session: ${sessionId}, user: ${userId}`,
      );

      // Utiliser CartDataService (Redis) au lieu de CartService (Supabase)
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
      throw new HttpException(
        'Erreur lors du vidage du panier',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔑 Utilitaire : obtenir l'identifiant de session depuis le cookie userSession
   */
  private getSessionId(req: RequestWithUser): string {
    // 1. PRIORITÉ : Cookie personnalisé userSession (utilisé par Remix)
    const cookies = req.headers.cookie?.split(';') || [];
    const userSessionCookie = cookies
      .find((c) => c.trim().startsWith('userSession='))
      ?.split('=')[1];
    
    if (userSessionCookie) {
      return userSessionCookie.trim();
    }

    // 2. Fallback vers express sessionID si disponible
    if (req.sessionID) {
      return req.sessionID;
    }

    // 3. Fallback final : générer un ID temporaire
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.logger.warn(
      `Aucune session trouvée, utilisation d'un ID temporaire: ${tempId}`,
    );
    return tempId;
  }
}
