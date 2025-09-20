import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';
import { z } from 'zod';

/**
 * 📊 INTERFACES ET TYPES OPTIMISÉS
 */

export const CartItemSchema = z.object({
  id: z.number().optional(),
  user_id: z.number(),
  product_id: z.number(),
  quantity: z.number().min(1).max(99),
  price: z.number().min(0),
  options: z.record(z.string(), z.any()).optional(),
  product_name: z.string().optional(),
  product_sku: z.string().optional(),
  weight: z.number().min(0).optional(),
});

export const CartMetadataSchema = z.object({
  user_id: z.number(),
  promo_code: z.string().optional(),
  promo_discount: z.number().min(0).default(0),
  shipping_cost: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0),
  subtotal: z.number().min(0).default(0),
  total: z.number().min(0).default(0),
  currency: z.string().length(3).default('EUR'),
});

export type CartItem = z.infer<typeof CartItemSchema>;
export type CartMetadata = z.infer<typeof CartMetadataSchema>;

/**
 * 🛒 CART DATA SERVICE OPTIMISÉ
 *
 * Service spécialisé avec nouvelle structure SQL:
 * - Tables cart_items et cart_metadata séparées
 * - Triggers automatiques pour calculs
 * - Cache et optimisations intégrées
 * - Analytics et monitoring
 */
@Injectable()
export class CartDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(CartDataService.name);
  /**
   * 🛒 Récupérer le panier complet avec métadonnées et statistiques
   */
  async getCartWithMetadata(userId: string | number) {
    try {
      const userIdNum =
        typeof userId === 'string' ? parseInt(userId, 10) : userId;
      this.logger.log(`🛒 Récupération panier complet user ${userIdNum}`);

      // Récupérer métadonnées du panier
      const { data: metadata } = await this.client
        .from('cart_metadata')
        .select('*')
        .eq('user_id', userIdNum)
        .maybeSingle();

      // Récupérer items avec infos produits enrichies
      const { data: items, error: itemsError } = await this.client
        .from('cart_items')
        .select(
          `
          *,
          pieces:product_id (
            id,
            reference,
            name,
            price_ttc,
            stock_quantity,
            weight,
            active,
            pieces_marque:brand_id (
              name
            ),
            pieces_media_img!left (
              url
            )
          )
        `,
        )
        .eq('user_id', userIdNum)
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;

      // Récupérer statistiques via fonction SQL
      const { data: statsData } = await this.client.rpc('get_cart_stats', {
        p_user_id: userIdNum,
      });

      const stats = statsData?.[0] || {
        item_count: 0,
        total_quantity: 0,
        subtotal: 0,
        total: 0,
        has_promo: false,
        promo_discount: 0,
      };

      return {
        metadata: metadata || { user_id: userIdNum, subtotal: 0, total: 0 },
        items: items || [],
        stats: {
          itemCount: stats.item_count,
          totalQuantity: stats.total_quantity,
          subtotal: stats.subtotal,
          total: stats.total,
          hasPromo: stats.has_promo,
          promoDiscount: stats.promo_discount,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération panier user ${userId}`, error);
      throw error;
    }
  }

  /**
   * 📋 Méthode de compatibilité - récupérer items uniquement
   */
  async getCartItems(userId: string) {
    const result = await this.getCartWithMetadata(userId);
    return result.items;
  }

  /**
   * ➕ Ajouter un item au panier avec upsert intelligent
   */
  async addCartItem(cartItem: {
    user_id: string | number;
    product_id: number;
    quantity: number;
    price?: number;
    options?: Record<string, any>;
  }) {
    try {
      const userIdNum =
        typeof cartItem.user_id === 'string'
          ? parseInt(cartItem.user_id, 10)
          : cartItem.user_id;

      // Récupérer les infos produit pour enrichir
      const product = await this.getProductById(cartItem.product_id);

      const { data, error } = await this.client
        .from('cart_items')
        .upsert(
          {
            user_id: userIdNum,
            product_id: cartItem.product_id,
            quantity: cartItem.quantity,
            price: cartItem.price || product?.price_ttc || 0,
            options: cartItem.options || {},
            product_name: product?.name,
            product_sku: product?.reference,
            weight: product?.weight,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,product_id,options',
          },
        )
        .select()
        .single();

      if (error) throw error;

      // Log analytics
      await this.logCartEvent(userIdNum, 'add', {
        product_id: cartItem.product_id,
        quantity: cartItem.quantity,
        price: cartItem.price || product?.price_ttc || 0,
      });

      return data;
    } catch (error) {
      this.logger.error('❌ Erreur ajout item panier', error);
      throw error;
    }
  }
  async getProductById(productId: number) {
    const { data, error } = await this.client
      .from('pieces')
      .select('id, reference, name, price_ttc, stock_quantity, weight, active')
      .eq('id', productId)
      .eq('active', true)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Vérifier si un produit est déjà dans le panier
   */
  async getCartItemByUserAndProduct(userId: string, productId: number) {
    const { data, error } = await this.client
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * 📝 Mettre à jour un article du panier (méthode optimisée)
   */
  async updateCartItem(
    itemId: number,
    updates: { quantity?: number; price?: number },
  ) {
    const { data, error } = await this.client
      .from('cart_items')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Supprimer un article du panier
   */
  async deleteCartItem(itemId: number, userId: string) {
    const { error, count } = await this.client
      .from('cart_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);

    if (error) throw error;
    return (count || 0) > 0;
  }

  /**
   * Vider le panier d'un utilisateur
   */
  async clearUserCart(userId: string) {
    const { error } = await this.client
      .from('cart_items')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  /**
   * Vérifier qu'un article appartient à l'utilisateur
   */
  async getCartItemByIdAndUser(itemId: number, userId: string) {
    const { data, error } = await this.client
      .from('cart_items')
      .select('id, product_id, quantity')
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * 📊 Calcule les totaux du panier avec nouvelle structure
   */
  async calculateCartTotals(userId: string) {
    try {
      const cart = await this.getCartWithMetadata(userId);

      // Les totaux sont automatiquement calculés par les triggers SQL
      // Mais on peut forcer un recalcul si nécessaire
      const subtotal = cart.items.reduce(
        (sum: number, item: any) =>
          sum + (item.pieces?.price_ttc || item.price || 0) * item.quantity,
        0,
      );

      const tax = subtotal * 0.2; // TVA 20%
      const shipping = subtotal >= 50 ? 0 : 6.9; // Gratuit > 50€
      const discount = cart.metadata?.promo_discount || 0;
      const total = subtotal + tax + shipping - discount;

      // Mettre à jour les métadonnées si nécessaire
      await this.updateCartMetadata(userId, {
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount: Math.round(tax * 100) / 100,
        shipping_cost: Math.round(shipping * 100) / 100,
        total: Math.round(total * 100) / 100,
      });

      return {
        user_id: userId,
        items: cart.items,
        subtotal: Math.round(subtotal * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        shipping: Math.round(shipping * 100) / 100,
        discount: Math.round(discount * 100) / 100,
        total: Math.round(total * 100) / 100,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur calcul totaux panier user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 🔧 Mettre à jour les métadonnées du panier
   */
  private async updateCartMetadata(
    userId: string,
    metadata: Partial<CartMetadata>,
  ) {
    const userIdNum =
      typeof userId === 'string' ? parseInt(userId, 10) : userId;

    const { error } = await this.client.from('cart_metadata').upsert({
      user_id: userIdNum,
      ...metadata,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
  }

  /**
   * 📊 Logger les événements analytics
   */
  private async logCartEvent(
    userId: number,
    eventType: string,
    eventData: {
      product_id?: number;
      quantity?: number;
      price?: number;
    },
  ): Promise<void> {
    try {
      await this.client.from('cart_analytics').insert({
        user_id: userId,
        event_type: eventType,
        product_id: eventData.product_id,
        quantity: eventData.quantity,
        price: eventData.price,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      // Ne pas faire échouer l'opération principale
      this.logger.warn(`⚠️ Erreur analytics user ${userId}`, error);
    }
  }
}
