/**
 * 🛒 SERVICE CART PRINCIPAL - Version Consolidée et Simplifiée
 *
 * Service orchestrant uniquement les opérations complexes du panier
 * ✅ Délègue toutes les opérations CRUD à CartDataService
 * ✅ Utilise PromoService avancé (Zod + Cache Redis)
 * ✅ Gère uniquement la logique métier complexe (codes promo)
 *
 * NOTE: Les opérations simples (get, add, update, delete) sont gérées
 * directement par CartDataService dans le controller pour plus de clarté
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PromoService } from '../../promo/promo.service';
import { CartDataService } from '../../../database/services/cart-data.service';

@Injectable()
export class CartService {
  protected readonly logger = new Logger(CartService.name);

  constructor(
    private readonly promoService: PromoService,
    private readonly cartDataService: CartDataService,
  ) {
    this.logger.log('✅ CartService initialized - Consolidated architecture');
  }

  /**
   * ===================================================================
   * MÉTHODE PRINCIPALE : APPLICATION CODE PROMO
   * ===================================================================
   * Toutes les autres opérations (get, add, update, delete) sont gérées
   * directement par CartDataService dans le controller pour plus de simplicité
   * ===================================================================
   */

  /**
   * Appliquer un code promo au panier
   * ✅ Utilise PromoService avec validation Zod + Cache Redis
   * ✅ Calcule le total du panier en temps réel
   * ✅ Valide la validité et les conditions du code promo
   *
   * @param sessionId - ID de session du panier
   * @param promoCode - Code promo à appliquer
   * @param userId - ID utilisateur optionnel
   * @returns Résultat de la validation avec réduction appliquée
   */
  async applyPromoCode(
    sessionId: string,
    promoCode: string,
    userId?: string,
  ): Promise<{
    valid: boolean;
    discount: number;
    finalTotal: number;
    message?: string;
  }> {
    try {
      this.logger.log(
        `📦 Application code promo "${promoCode}" pour ${userId || sessionId}`,
      );

      // 1. Récupérer le panier via CartDataService
      const cart = await this.cartDataService.getCartWithMetadata(sessionId);

      if (!cart || !cart.items || cart.items.length === 0) {
        throw new BadRequestException(
          "Panier vide - impossible d'appliquer un code promo",
        );
      }

      // 2. Calculer le total du panier
      const subtotal = cart.items.reduce((sum: number, item: any) => {
        return sum + item.price * item.quantity;
      }, 0);

      // 3. Préparer le résumé du panier pour PromoService
      const cartSummary = {
        userId: userId ? parseInt(userId, 10) : 0,
        subtotal,
        shipping: 0, // Sera calculé plus tard
        items: cart.items.map((item: any) => ({
          productId: item.product_id,
          quantity: item.quantity,
          price: item.price,
        })),
      };

      // 4. Valider le code promo avec PromoService (Zod + Cache)
      const validationResult = await this.promoService.validatePromoCode(
        promoCode,
        cartSummary,
      );

      if (!validationResult.valid) {
        this.logger.warn(
          `❌ Code promo "${promoCode}" invalide: ${validationResult.message}`,
        );
        return {
          valid: false,
          discount: 0,
          finalTotal: subtotal,
          message: validationResult.message || 'Code promo invalide',
        };
      }

      // 5. Calculer la réduction
      const discount = validationResult.discount || 0;
      const finalTotal = Math.max(0, subtotal - discount);

      // 6. L'enregistrement de l'utilisation se fera lors de la validation de la commande
      // (pas ici car le panier peut être abandonné sans achat)

      this.logger.log(
        `✅ Code promo "${promoCode}" appliqué: -${discount}€ (total: ${finalTotal}€)`,
      );

      return {
        valid: true,
        discount,
        finalTotal,
        message:
          validationResult.message || `Réduction de ${discount}€ appliquée`,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur application code promo: ${(error as any)?.message || error}`,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        "Erreur lors de l'application du code promo",
      );
    }
  }
}
