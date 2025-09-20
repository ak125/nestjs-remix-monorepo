import { Injectable, Logger } from '@nestjs/common';
import { CartDataService } from './cart-data.service';
import { UserDataService } from './user-data.service';
import { OrderDataService } from './order-data.service';

/**
 * Service principal qui compose tous les services spécialisés
 * Remplace le monolithe SupabaseServiceFacade avec une architecture modulaire
 *
 * Avantages:
 * - Séparation des responsabilités (SRP)
 * - Services testables individuellement
 * - Architecture scalable
 * - Réduction de la complexité (1085 lignes → services de ~200 lignes)
 */
@Injectable()
export class DatabaseCompositionService {
  private readonly logger = new Logger(DatabaseCompositionService.name);

  constructor(
    private readonly cartDataService: CartDataService,
    private readonly userDataService: UserDataService,
    private readonly orderDataService: OrderDataService,
  ) {
    this.logger.log(
      'DatabaseCompositionService initialized with modular architecture',
    );
  }

  // === CART OPERATIONS ===
  async getCartItems(userId: number | string) {
    return this.cartDataService.getCartItems(String(userId));
  }

  async getProductById(productId: number) {
    return this.cartDataService.getProductById(productId);
  }

  async getCartItemByUserAndProduct(
    userId: number | string,
    productId: number,
  ) {
    return this.cartDataService.getCartItemByUserAndProduct(
      String(userId),
      productId,
    );
  }

  async addCartItem(cartItem: any) {
    return this.cartDataService.addCartItem(cartItem);
  }

  async updateCartItem(itemId: number, updates: any) {
    return this.cartDataService.updateCartItem(itemId, updates);
  }

  async deleteCartItem(itemId: number, userId: number | string) {
    return this.cartDataService.deleteCartItem(itemId, String(userId));
  }

  async clearUserCart(userId: number | string) {
    return this.cartDataService.clearUserCart(String(userId));
  }

  async getCartItemByIdAndUser(itemId: number, userId: number | string) {
    return this.cartDataService.getCartItemByIdAndUser(itemId, String(userId));
  }

  async calculateCartTotals(userId: string) {
    return this.cartDataService.calculateCartTotals(userId);
  }

  // ============================================
  // USER OPERATIONS - Délégation vers UserDataService
  // ============================================

  async getUserByEmail(email: string) {
    return this.userDataService.getUserByEmail(email);
  }

  async getUserById(id: string) {
    return this.userDataService.getUserById(id);
  }

  async createUser(userData: any) {
    return this.userDataService.createUser(userData);
  }

  async updateUser(id: string, updates: any) {
    return this.userDataService.updateUser(id, updates);
  }

  // ============================================
  // ORDER OPERATIONS - Délégation vers OrderDataService
  // ============================================

  async getUserOrders(userId: string) {
    return this.orderDataService.getUserOrders(userId);
  }

  async getOrderById(orderId: number) {
    return this.orderDataService.getOrderById(orderId);
  }

  async createOrder(orderData: any) {
    return this.orderDataService.createOrder(orderData);
  }

  async updateOrderStatus(orderId: number, status: number) {
    return this.orderDataService.updateOrderStatus(orderId, status);
  }

  // ============================================
  // CROSS-SERVICE OPERATIONS - Orchestration
  // ============================================

  /**
   * Convertit un panier en commande (opération cross-service)
   */
  async convertCartToOrder(userId: string, orderData: any) {
    try {
      // 1. Récupérer le panier
      const cartTotals = await this.cartDataService.calculateCartTotals(userId);

      if (!cartTotals.items.length) {
        throw new Error('Panier vide');
      }

      // 2. Créer la commande
      const order = await this.orderDataService.createOrder({
        customer_id: userId,
        subtotal: cartTotals.subtotal,
        tax: cartTotals.tax,
        shipping: cartTotals.shipping,
        discount: cartTotals.discount,
        total: cartTotals.total,
        ...orderData,
      });

      // 3. Vider le panier
      await this.cartDataService.clearUserCart(userId);

      this.logger.log(`Cart converted to order ${order.id} for user ${userId}`);
      return order;
    } catch (error) {
      this.logger.error('Failed to convert cart to order:', error);
      throw error;
    }
  }

  /**
   * Statistiques utilisateur (opération cross-service)
   */
  async getUserStats(userId: string) {
    try {
      const [cartTotals, orders] = await Promise.all([
        this.cartDataService.calculateCartTotals(userId),
        this.orderDataService.getUserOrders(userId),
      ]);

      return {
        cartItemsCount: cartTotals.items.length,
        cartTotal: cartTotals.total,
        ordersCount: orders.length,
        totalSpent: orders.reduce((sum, order) => sum + order.total, 0),
      };
    } catch (error) {
      this.logger.error(`Failed to get user stats for ${userId}:`, error);
      throw error;
    }
  }
}
