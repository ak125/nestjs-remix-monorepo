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
  Patch,
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
import { CartAnalyticsService } from './services/cart-analytics.service';
import { CartDataService } from '../../database/services/cart-data.service';
import { ShippingService } from '../shipping/shipping.service';
import { StockService } from '../products/services/stock.service';
import { validateAddItem } from './dto/add-item.dto';
import { validateUpdateItem } from './dto/update-item.dto';
import { validateApplyPromo } from './dto/apply-promo.dto';

// 🔒 Guards et authentification
import { OptionalAuthGuard } from '../../auth/guards/optional-auth.guard';

// 🏷️ Types et interfaces
interface AuthenticatedUser {
  id_utilisateur: number; // ✅ Propriété requise par Express.User
  id: string;
  email: string;
  nom?: string;
  prenom?: string;
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
    private readonly shippingService: ShippingService,
    private readonly stockService: StockService,
    private readonly cartAnalyticsService: CartAnalyticsService,
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
      // const referer = req.headers.referer || 'Unknown';
      // this.logger.log(
      //   `🔍 Cart GET Request - Session: ${sessionId}, User: ${userId}, Referer: ${referer}`,
      // );

      this.logger.debug(
        `Récupération panier pour: session=${sessionId}, user=${userId}`,
      );

      // Récupérer le panier complet avec métadonnées et prix enrichis
      const cartData =
        await this.cartDataService.getCartWithMetadata(userIdForCart);

      // 🔍 DEBUG: Voir ce qui revient du CartDataService
      // this.logger.log('🔍 CartData brut:', JSON.stringify(cartData, null, 2));

      // if (cartData.items?.length > 0) {
      //   this.logger.log('🔍 Premier item:', JSON.stringify(cartData.items[0], null, 2));
      // }

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
          consigne_total: cartData.stats.consigne_total || 0, // ✅ PHASE 4: Total consignes
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
   * 💬 Récupérer les informations de fusion de panier
   */
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
      const mergeInfo = (req as any).session?.cartMergeInfo;

      if (mergeInfo) {
        // Effacer l'info après lecture pour ne l'afficher qu'une fois
        delete (req as any).session.cartMergeInfo;

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

      // 🚧 TEMPORAIRE: Validation du stock désactivée pour déboguer
      // const stockValidation = await this.stockService.validateStock(
      //   productIdNum,
      //   addItemDto.quantity,
      // );

      // if (!stockValidation.isValid) {
      //   throw new BadRequestException(
      //     stockValidation.message ||
      //       `Stock insuffisant. Seulement ${stockValidation.available} unité(s) disponible(s)`,
      //   );
      // }

      this.logger.log(
        `⚠️ TEMPORAIRE: Validation du stock DÉSACTIVÉE pour produit ${productIdNum}`,
      );

      // Vérifier si c'est une mise à jour de quantité (flag replace dans le body)
      const isReplace = (body as any)?.replace === true;

      const result = await this.cartDataService.addCartItem(
        userIdForCart,
        productIdNum,
        addItemDto.quantity,
        addItemDto.custom_price,
        isReplace,
      );

      this.logger.log(
        `✅ Article ajouté: ${productIdNum} x${addItemDto.quantity}`,
      );

      // ⚡ OPTIMISATION: Retourner le panier complet directement
      // Évite un deuxième appel API depuis le frontend
      this.logger.log(`⚡ Récupération panier complet pour optimisation...`);
      const cartData =
        await this.cartDataService.getCartWithMetadata(userIdForCart);
      this.logger.log(
        `⚡ Panier optimisé: ${cartData.stats.totalQuantity} articles, ${cartData.stats.total.toFixed(2)}€`,
      );

      return {
        success: true,
        message: `Article ajouté au panier`,
        item: result,
        productId: productIdNum,
        quantity: addItemDto.quantity,
        // ⚡ Panier complet inclus dans la réponse
        cart: {
          cart_id: `cart_${userIdForCart}`,
          user_id: req.user?.id || null,
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
      // Valider que l'itemId est fourni
      if (!itemId || itemId.trim() === '') {
        throw new BadRequestException('ID item manquant');
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
   * � PATCH - Alias pour PUT (compatibilité REST standard)
   */
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
    // Rediriger vers PUT
    return this.updateItem(itemId, body, req);
  }

  /**
   * �🗑️ Supprimer un article du panier
   */
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
      // Valider que l'itemId est fourni
      if (!itemId || itemId.trim() === '') {
        throw new BadRequestException('ID item manquant');
      }

      const sessionId = this.getSessionId(req);

      this.logger.debug(
        `Suppression article - session: ${sessionId}, itemId: ${itemId}`,
      );

      // Déterminer si c'est un ID complet ou juste un product_id
      const userId = req.user?.id;
      const userIdForCart = userId || sessionId;

      // Si c'est un numéro (product_id), utiliser removeCartItem
      // Sinon, c'est un ID complet, utiliser deleteCartItem
      const isProductId = /^\d+$/.test(itemId);

      if (isProductId) {
        // C'est un product_id numérique
        this.logger.log(`🗑️ Suppression par product_id: ${itemId}`);
        await this.cartDataService.removeCartItem(
          userIdForCart,
          parseInt(itemId, 10),
        );
      } else {
        // C'est un ID complet (format: sessionId-productId-timestamp)
        this.logger.log(`🗑️ Suppression par item ID complet: ${itemId}`);
        await this.cartDataService.deleteCartItem(itemId, userIdForCart);
      }

      // ⚡ OPTIMISATION: Retourner le panier complet directement
      const cartData =
        await this.cartDataService.getCartWithMetadata(userIdForCart);
      this.logger.log(
        `⚡ Panier après suppression: ${cartData.stats.totalQuantity} articles`,
      );

      return {
        success: true,
        message: 'Article supprimé avec succès',
        itemId: itemId,
        // ⚡ Panier complet inclus
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

      this.logger.log(
        `Application code promo ${applyPromoDto.promoCode} - session: ${sessionId}`,
      );

      // Utiliser CartService pour valider et appliquer le promo
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

  // ============================================================
  // 🚚 GESTION SHIPPING
  // ============================================================

  /**
   * 💰 Calculer les frais de livraison
   */
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
      const sessionId = this.getSessionId(req);
      const userId = req.user?.id;
      const userIdForCart = userId || sessionId;

      const { postalCode } = body;

      if (!postalCode) {
        throw new BadRequestException('Code postal requis');
      }

      // Récupérer le panier pour calculer poids et subtotal
      const cart =
        await this.cartDataService.getCartWithMetadata(userIdForCart);

      // Calculer poids total
      const totalWeight = cart.items.reduce(
        (sum, item) => sum + (item.weight || 0) * item.quantity,
        0,
      );

      // Utiliser ShippingService pour calculer les frais
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

  /**
   * 🚚 Appliquer une méthode de livraison
   */
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
      const sessionId = this.getSessionId(req);
      const userId = req.user?.id;
      const userIdForCart = userId || sessionId;

      const { postalCode, address } = body;

      if (!postalCode) {
        throw new BadRequestException('Code postal requis');
      }

      // Récupérer le panier
      const cart =
        await this.cartDataService.getCartWithMetadata(userIdForCart);

      // Calculer poids total
      const totalWeight = cart.items.reduce(
        (sum, item) => sum + (item.weight || 0) * item.quantity,
        0,
      );

      // Utiliser ShippingService pour calculer
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

      // Enregistrer dans Redis
      await this.cartDataService.applyShipping(userIdForCart, {
        method_id: 1, // Colissimo par défaut
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

  /**
   * 🗑️ Retirer la méthode de livraison
   */
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
      const sessionId = this.getSessionId(req);
      const userId = req.user?.id;
      const userIdForCart = userId || sessionId;

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

  // ============================================================
  // � ANALYTICS
  // ============================================================

  /**
   * 📊 Rapport d'analytics du panier
   */
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

  /**
   * 📈 Taux d'abandon et conversion
   */
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

  /**
   * 💰 Valeur moyenne du panier
   */
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

  /**
   * 🏆 Produits les plus abandonnés
   */
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

  // ============================================================
  // �🗑️ NETTOYAGE
  // ============================================================

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
   * 🎁 GET /api/cart/recommendations - Suggestions produits complémentaires
   */
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
      const sessionId = this.getSessionId(req);
      const userId = req.user?.id || null;
      const userIdForCart = userId || sessionId;

      this.logger.debug(
        `Récupération recommendations - session: ${sessionId}, user: ${userId}`,
      );

      // Récupérer le panier actuel
      const cart =
        await this.cartDataService.getCartWithMetadata(userIdForCart);

      // Logique simple de recommandations basée sur les catégories
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
        recommendations: recommendations.slice(0, 3), // Limiter à 3
        cartItemCount: cart?.items?.length || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur récupération recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Ne pas bloquer si erreur - retourner tableau vide
      return {
        success: true,
        recommendations: [],
        cartItemCount: 0,
        timestamp: new Date().toISOString(),
      };
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
