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

  // === CART OPERATIONS === (REFACTORÉ - utiliser CartDataService directement)
  async getCartItems(userId: number | string) {
    return this.cartDataService.getCartItems(String(userId));
  }

  async getProductById(productId: number) {
    return this.cartDataService.getProductWithAllData(productId);
  }

  async getCartItemByUserAndProduct(
    userId: number | string,
    productId: number,
  ) {
    // Méthode obsolète - récupérer le panier complet
    const cart = await this.cartDataService.getCartWithMetadata(String(userId));
    return cart.items.find(
      (item: any) => parseInt(item.product_id) === productId,
    );
  }

  async addCartItem(sessionId: string, productId: number, quantity: number) {
    return this.cartDataService.addCartItem(sessionId, productId, quantity);
  }

  async updateCartItem(sessionId: string, productId: number, quantity: number) {
    return this.cartDataService.addCartItem(
      sessionId,
      productId,
      quantity,
      undefined,
      true,
    );
  }

  async deleteCartItem(sessionId: string, productId: number) {
    return this.cartDataService.removeCartItem(sessionId, productId);
  }

  async clearUserCart(userId: number | string) {
    return this.cartDataService.clearUserCart(String(userId));
  }

  async getCartItemByIdAndUser(sessionId: string, productId: number) {
    // Méthode obsolète - récupérer depuis le panier complet
    const cart = await this.cartDataService.getCartWithMetadata(sessionId);
    return cart.items.find(
      (item: any) => parseInt(item.product_id) === productId,
    );
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
