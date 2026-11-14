import { Injectable, Logger } from '@nestjs/common';
import { CartDataService } from './cart-data.service';
import { OrdersService } from './orders.service';

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
    private readonly ordersService: OrdersService,
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
      (item: { product_id?: string }) =>
        parseInt(item.product_id || '0') === productId,
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
      (item: { product_id?: string }) =>
        parseInt(item.product_id || '0') === productId,
    );
  }

  async calculateCartTotals(userId: string) {
    return this.cartDataService.calculateCartTotals(userId);
  }

  // ============================================
  // ORDER OPERATIONS - Délégation vers OrdersService
  // ============================================

  async getUserOrders(userId: string) {
    return this.ordersService.getUserOrders(userId);
  }

  async getOrderById(orderId: number) {
    return this.ordersService.getOrderById(String(orderId));
  }

  async updateOrderStatus(orderId: number, status: number) {
    // Mapper le status number vers le format string
    const statusString = status === 1 ? 'paid' : 'pending';
    return this.ordersService.updateOrderStatus(String(orderId), statusString);
  }

  // ============================================
  // CROSS-SERVICE OPERATIONS - Orchestration
  // ============================================

  /**
   * Statistiques utilisateur (opération cross-service)
   */
  async getUserStats(userId: string) {
    try {
      const [cartTotals, orders] = await Promise.all([
        this.cartDataService.calculateCartTotals(userId),
        this.ordersService.getUserOrders(userId),
      ]);

      return {
        cartItemsCount: cartTotals.items.length,
        cartTotal: cartTotals.total,
        ordersCount: orders.length,
        totalSpent: orders.reduce(
          (sum, order) => sum + (order.totalTtc || 0),
          0,
        ),
      };
    } catch (error) {
      this.logger.error(`Failed to get user stats for ${userId}:`, error);
      throw error;
    }
  }
}
