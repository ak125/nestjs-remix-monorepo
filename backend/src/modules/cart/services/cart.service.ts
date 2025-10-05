/**
 * 🛒 SERVICE CART PRINCIPAL - Architecture moderne alignée
 *
 * Service principal de gestion du panier basé sur l'architecture existante :
 * ✅ Hérite de SupabaseBaseService (approche commune)
 * ✅ Utilise les interfaces existantes
 * ✅ Intégration avec cache et validation
 * ✅ Compatible avec l'approche modulaire
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';
import { PromoService } from '../promo.service';
import { CartCalculationService } from './cart-calculation.service';
import { CartDataService } from '../../../database/services/cart-data.service';
import { CartItem, CartMetadata } from '../cart.interfaces';

export interface Cart {
  id: string;
  sessionId: string;
  userId?: string;
  items: CartItem[];
  metadata: CartMetadata;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CartService extends SupabaseBaseService {
  protected readonly logger = new Logger(CartService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly promoService: PromoService,
    private readonly calculationService: CartCalculationService,
    private readonly cartDataService: CartDataService,
  ) {
    super();
    this.logger.log('CartService initialized - Modern architecture');
  }

  /**
   * Récupérer le panier complet (items + metadata)
   */
  async getCart(sessionId: string, userId?: string): Promise<Cart> {
    try {
      // Vérifier le cache
      const cacheKey = `cart:${userId || sessionId}`;
      const cached = await this.cacheService.get<Cart>(cacheKey);
      if (cached) {
        return cached;
      }

      // Récupérer les items du panier
      const items = await this.getCartItems(userId || sessionId);

      // Récupérer ou créer les métadonnées
      const metadata = await this.getOrCreateCartMetadata(sessionId, userId);

      const cart: Cart = {
        id: metadata.id.toString(),
        sessionId,
        userId,
        items,
        metadata,
        createdAt: metadata.created_at,
        updatedAt: metadata.updated_at,
      };

      // Mettre en cache
      await this.cacheService.set(cacheKey, cart, 300); // 5 minutes

      return cart;
    } catch (error) {
      this.logger.error(`Erreur getCart: ${(error as any)?.message || error}`);
      throw new Error('Impossible de récupérer le panier');
    }
  }

  /**
   * Récupérer les items du panier
   */
  private async getCartItems(userOrSessionId: string): Promise<CartItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', userOrSessionId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Erreur items panier: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error(
        `Erreur getCartItems: ${(error as any)?.message || error}`,
      );
      return [];
    }
  }

  /**
   * Récupérer ou créer les métadonnées du panier
   */
  private async getOrCreateCartMetadata(
    sessionId: string,
    userId?: string,
  ): Promise<CartMetadata> {
    try {
      // Chercher les métadonnées existantes
      const { data: existing, error: selectError } = await this.supabase
        .from('cart_metadata')
        .select('*')
        .or(
          userId
            ? `user_id.eq.${userId},session_id.eq.${sessionId}`
            : `session_id.eq.${sessionId}`,
        )
        .single();

      if (!selectError && existing) {
        return existing;
      }

      // Créer de nouvelles métadonnées
      const { data: newMetadata, error: insertError } = await this.supabase
        .from('cart_metadata')
        .insert({
          user_id: userId || sessionId, // La clé primaire
          session_id: sessionId,
          subtotal: 0,
          tax_amount: 0,
          shipping_cost: 0,
          total: 0,
          promo_discount: 0,
          currency: 'EUR',
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Erreur création métadonnées: ${insertError.message}`);
      }

      return newMetadata;
    } catch (error) {
      this.logger.error(
        `Erreur getOrCreateCartMetadata: ${(error as any)?.message || error}`,
      );
      throw error;
    }
  }

  /**
   * Ajouter un produit au panier
   */
  async addToCart(
    sessionId: string,
    productId: string,
    quantity: number,
    price: number,
    userId?: string,
  ): Promise<Cart> {
    try {
      // Vérifier si le produit existe déjà
      const { data: existingItem, error: selectError } = await this.supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', userId || sessionId)
        .eq('product_id', productId)
        .single();

      if (existingItem && !selectError) {
        // Mettre à jour la quantité
        const newQuantity = existingItem.quantity + quantity;

        const { error: updateError } = await this.supabase
          .from('cart_items')
          .update({
            quantity: newQuantity,
            price: price,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingItem.id);

        if (updateError) {
          throw new Error(`Erreur mise à jour item: ${updateError.message}`);
        }
      } else {
        // Ajouter un nouvel item
        const { error: insertError } = await this.supabase
          .from('cart_items')
          .insert({
            user_id: userId || sessionId,
            product_id: productId,
            quantity,
            price,
          });

        if (insertError) {
          throw new Error(`Erreur ajout item: ${insertError.message}`);
        }
      }

      // Mettre à jour les métadonnées
      await this.updateCartMetadata(sessionId, userId);

      // Invalider le cache
      const cacheKey = `cart:${userId || sessionId}`;
      await this.cacheService.del(cacheKey);

      this.logger.log(`Produit ${productId} ajouté au panier`);

      // Retourner le panier mis à jour
      return this.getCart(sessionId, userId);
    } catch (error) {
      this.logger.error(
        `Erreur addToCart: ${(error as any)?.message || error}`,
      );
      throw new BadRequestException(
        "Impossible d'ajouter le produit au panier",
      );
    }
  }

  /**
   * Modifier la quantité d'un item
   */
  async updateQuantity(
    sessionId: string,
    itemId: string,
    quantity: number,
    userId?: string,
  ): Promise<Cart> {
    try {
      if (quantity < 0) {
        throw new BadRequestException('La quantité doit être positive');
      }

      if (quantity === 0) {
        return this.removeFromCart(sessionId, itemId, userId);
      }

      const { error } = await this.supabase
        .from('cart_items')
        .update({
          quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('user_id', userId || sessionId);

      if (error) {
        throw new Error(`Erreur mise à jour quantité: ${error.message}`);
      }

      // Mettre à jour les métadonnées
      await this.updateCartMetadata(sessionId, userId);

      // Invalider le cache
      const cacheKey = `cart:${userId || sessionId}`;
      await this.cacheService.del(cacheKey);

      return this.getCart(sessionId, userId);
    } catch (error) {
      this.logger.error(
        `Erreur updateQuantity: ${(error as any)?.message || error}`,
      );
      throw new BadRequestException('Impossible de modifier la quantité');
    }
  }

  /**
   * Supprimer un item du panier
   */
  async removeFromCart(
    sessionId: string,
    itemId: string,
    userId?: string,
  ): Promise<Cart> {
    try {
      const { error } = await this.supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', userId || sessionId);

      if (error) {
        throw new Error(`Erreur suppression item: ${error.message}`);
      }

      // Mettre à jour les métadonnées
      await this.updateCartMetadata(sessionId, userId);

      // Invalider le cache
      const cacheKey = `cart:${userId || sessionId}`;
      await this.cacheService.del(cacheKey);

      this.logger.log(`Item ${itemId} supprimé du panier`);

      return this.getCart(sessionId, userId);
    } catch (error) {
      this.logger.error(
        `Erreur removeFromCart: ${(error as any)?.message || error}`,
      );
      throw new BadRequestException("Impossible de supprimer l'article");
    }
  }

  /**
   * Vider le panier
   */
  async clearCart(sessionId: string, userId?: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId || sessionId);

      if (error) {
        throw new Error(`Erreur vidage panier: ${error.message}`);
      }

      // Mettre à jour les métadonnées
      await this.updateCartMetadata(sessionId, userId);

      // Invalider le cache
      const cacheKey = `cart:${userId || sessionId}`;
      await this.cacheService.del(cacheKey);

      this.logger.log('Panier vidé');
    } catch (error) {
      this.logger.error(
        `Erreur clearCart: ${(error as any)?.message || error}`,
      );
      throw new BadRequestException('Impossible de vider le panier');
    }
  }

  /**
   * Appliquer un code promo (VERSION CONSOLIDÉE - Redis)
   */
  async applyPromoCode(
    sessionId: string,
    promoCode: string,
    userId?: string,
  ): Promise<any> {
    try {
      const userIdForCart = userId || sessionId;

      // 1. Récupérer le panier depuis Redis via CartDataService
      const cart = await this.cartDataService.getCartWithMetadata(userIdForCart);

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Le panier est vide');
      }

      // 2. Valider le code promo avec le subtotal
      const validation = await this.promoService.validatePromoCode(
        promoCode,
        userIdForCart,
        cart.stats.subtotal,
      );

      if (!validation.valid) {
        throw new BadRequestException(
          validation.reason || 'Code promo invalide',
        );
      }

      // 3. Sauvegarder le code promo appliqué dans Redis
      await this.cartDataService.applyPromoCode(userIdForCart, {
        code: promoCode,
        discount_type: validation.discountType!,
        discount_value: validation.discount,
        discount_amount: validation.discount,
        promo_id: validation.promoId!,
        applied_at: new Date().toISOString(),
      });

      this.logger.log(
        `✅ Code promo ${promoCode} appliqué: -${validation.discount.toFixed(2)}€`,
      );

      // 4. Retourner le panier mis à jour
      return {
        success: true,
        message: 'Code promo appliqué avec succès',
        promo_code: promoCode,
        discount: validation.discount,
        discount_type: validation.discountType,
      };
    } catch (error) {
      this.logger.error(
        `Erreur applyPromoCode: ${(error as any)?.message || error}`,
      );
      throw new BadRequestException(
        (error as any)?.message || "Impossible d'appliquer le code promo",
      );
    }
  }

  /**
   * Mettre à jour les métadonnées du panier (calculs avancés)
   */
  private async updateCartMetadata(
    sessionId: string,
    userId?: string,
  ): Promise<void> {
    try {
      const items = await this.getCartItems(userId || sessionId);

      // Utiliser le service de calcul avancé
      const calculations = await this.calculationService.calculateCart(items);

      const { error } = await this.supabase
        .from('cart_metadata')
        .update({
          total_items: calculations.itemCount,
          total_quantity: calculations.itemCount,
          subtotal: calculations.subtotalHT,
          tax_amount: calculations.tva,
          shipping_amount: calculations.shippingFee,
          total_amount: calculations.grandTotal,
          last_activity: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .or(
          userId
            ? `user_id.eq.${userId},session_id.eq.${sessionId}`
            : `session_id.eq.${sessionId}`,
        );

      if (error) {
        throw new Error(`Erreur mise à jour métadonnées: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(
        `Erreur updateCartMetadata: ${(error as any)?.message || error}`,
      );
    }
  }
}
