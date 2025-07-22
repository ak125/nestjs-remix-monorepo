/**
 * Service d'intégration pour Remix - Accès direct aux services NestJS
 * Evite les appels HTTP internes inutiles
 */

import { Injectable } from '@nestjs/common';
import { OrdersCompleteService } from '../modules/orders/orders-complete.service';
import { OrdersService } from '../modules/orders/orders.service';
import { UsersService } from '../modules/users/users.service';
import { PaymentService } from '../modules/payments/services/payments-legacy.service';
import { CartService } from '../modules/cart/cart.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class RemixIntegrationService {
  constructor(
    private readonly ordersCompleteService: OrdersCompleteService,
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
    private readonly paymentsService: PaymentService,
    private readonly cartService: CartService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Récupérer les commandes avec pagination pour Remix
   */
  async getOrdersForRemix(params: {
    page?: number;
    limit?: number;
    status?: string;
    paymentStatus?: string;
    search?: string;
  }) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        paymentStatus, // eslint-disable-line @typescript-eslint/no-unused-vars
        search, // eslint-disable-line @typescript-eslint/no-unused-vars
      } = params;

      // Utiliser directement le service orders
      const result = await this.ordersCompleteService.getOrdersWithAllRelations(
        page,
        limit,
        {
          status,
          ...(search && { customerId: search }),
        },
      );

      return {
        success: true,
        orders: result.orders || [],
        total: result.total || 0,
        page,
        totalPages: Math.ceil((result.total || 0) / limit),
      };
    } catch (error) {
      console.error('Erreur dans getOrdersForRemix:', error);
      return {
        success: false,
        orders: [],
        total: 0,
        page: 1,
        totalPages: 1,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Récupérer les utilisateurs pour Remix
   */
  async getUsersForRemix(params: {
    page?: number;
    limit?: number;
    search?: string;
    level?: number;
  }) {
    try {
      const {
        page = 1,
        limit = 10,
        search, // eslint-disable-line @typescript-eslint/no-unused-vars
        level, // eslint-disable-line @typescript-eslint/no-unused-vars
      } = params;

      const result = await this.usersService.getAllUsers(page, limit);

      return {
        success: true,
        users: result.users || [],
        total: result.total || 0,
        page,
        totalPages: Math.ceil((result.total || 0) / limit),
      };
    } catch (error) {
      console.error('Erreur dans getUsersForRemix:', error);
      return {
        success: false,
        users: [],
        total: 0,
        page: 1,
        totalPages: 1,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Récupérer les statistiques pour le dashboard
   */
  async getDashboardStats() {
    try {
      // Récupérer les stats en parallèle
      const [ordersResult, usersResult] = await Promise.all([
        this.ordersCompleteService.getOrdersWithAllRelations(1, 1),
        this.usersService.getAllUsers(1, 1),
      ]);

      return {
        success: true,
        stats: {
          totalOrders: ordersResult.total || 0,
          totalUsers: usersResult.total || 0,
          // Ajoutez d'autres statistiques selon vos besoins
        },
      };
    } catch (error) {
      console.error('Erreur dans getDashboardStats:', error);
      return {
        success: false,
        stats: {
          totalOrders: 0,
          totalUsers: 0,
        },
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * ========================================
   * MÉTHODES POUR LES PAIEMENTS LEGACY
   * ========================================
   */

  /**
   * Récupérer les statistiques des paiements pour Remix
   */
  async getPaymentStatsForRemix() {
    try {
      const stats = await this.paymentsService.getPaymentStats();
      return {
        success: true,
        stats,
      };
    } catch (error) {
      console.error('Erreur dans getPaymentStatsForRemix:', error);
      return {
        success: false,
        stats: {
          total_orders: 0,
          paid_orders: 0,
          pending_orders: 0,
          total_amount: 0,
          currency: 'EUR',
        },
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Créer un paiement pour Remix
   */
  async createPaymentForRemix(paymentData: any) {
    try {
      const payment = await this.paymentsService.createPayment(paymentData);
      return {
        success: true,
        payment,
      };
    } catch (error) {
      console.error('Erreur dans createPaymentForRemix:', error);
      return {
        success: false,
        payment: null,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Récupérer le statut d'un paiement pour Remix
   */
  async getPaymentStatusForRemix(orderId: string | number) {
    try {
      const payment = await this.paymentsService.getPaymentStatus(
        orderId.toString(),
      );
      return {
        success: true,
        payment,
      };
    } catch (error) {
      console.error('Erreur dans getPaymentStatusForRemix:', error);
      return {
        success: false,
        payment: null,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Récupérer la liste des paiements avec pagination pour Remix
   */
  async getPaymentsForRemix(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    try {
      const { page = 1, limit = 10, status, search } = params;

      // Récupérer les commandes qui servent de base aux paiements
      const result = await this.ordersCompleteService.getOrdersWithAllRelations(
        page,
        limit,
        {
          status,
          ...(search && { customerId: search }),
        },
      );

      // Transformer les commandes en format paiement legacy
      const payments =
        result.orders?.map((order) => ({
          id: order.ord_id,
          orderId: order.ord_id,
          customerId: order.ord_cst_id,
          montantTotal: parseFloat(order.ord_total_ttc?.toString() || '0'),
          devise: order.ord_currency || 'EUR',
          statutPaiement: order.ord_is_pay?.toString() || '0',
          methodePaiement: order.ord_info?.payment_gateway || 'Non définie',
          referenceTransaction: order.ord_info?.transaction_id,
          dateCreation: order.ord_date || new Date().toISOString(),
          datePaiement: order.ord_date_pay,
        })) || [];

      return {
        success: true,
        payments,
        total: result.total || 0,
        page,
        totalPages: Math.ceil((result.total || 0) / limit),
      };
    } catch (error) {
      console.error('Erreur dans getPaymentsForRemix:', error);
      return {
        success: false,
        payments: [],
        total: 0,
        page: 1,
        totalPages: 1,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Récupérer le résumé du panier pour Remix
   */
  async getCartSummaryForRemix(userId?: string) {
    try {
      // Utiliser directement le service cart
      const summary = await this.cartService.getCartSummary(
        userId || 'anonymous',
      );
      return {
        success: true,
        summary,
      };
    } catch (error) {
      console.error('Erreur dans getCartSummaryForRemix:', error);
      return {
        success: false,
        summary: {
          total_items: 0,
          total_quantity: 0,
          subtotal: 0,
          total: 0,
          currency: 'EUR',
        },
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Ajouter un article au panier pour Remix
   */
  async addToCartForRemix(data: {
    productId: number;
    quantity: number;
    userId?: string;
  }) {
    try {
      const result = await this.cartService.addToCart(
        data.userId || 'anonymous',
        { product_id: data.productId, quantity: data.quantity },
      );
      return {
        success: true,
        data: result,
        message: 'Article ajouté au panier avec succès',
      };
    } catch (error) {
      console.error('Erreur dans addToCartForRemix:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Récupérer le panier complet pour Remix
   */
  async getCartForRemix(userId?: string) {
    try {
      const items = await this.cartService.getCartItems(userId || 'anonymous');
      const summary = await this.cartService.getCartSummary(
        userId || 'anonymous',
      );
      return {
        success: true,
        cart: { items, summary },
      };
    } catch (error) {
      console.error('Erreur dans getCartForRemix:', error);
      return {
        success: false,
        cart: {
          items: [],
          summary: {
            total_items: 0,
            total_quantity: 0,
            subtotal: 0,
            total: 0,
            currency: 'EUR',
          },
        },
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Mettre à jour la quantité d'un article dans le panier pour Remix
   */
  async updateCartItemForRemix(data: {
    itemId: number;
    quantity: number;
    userId?: string;
  }) {
    try {
      const result = await this.cartService.updateCartItem(
        data.userId || 'anonymous',
        data.itemId,
        { quantity: data.quantity },
      );
      return {
        success: true,
        data: result,
        message: 'Article mis à jour avec succès',
      };
    } catch (error) {
      console.error('Erreur dans updateCartItemForRemix:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Supprimer un article du panier pour Remix
   */
  async removeCartItemForRemix(data: { itemId: number; userId?: string }) {
    try {
      await this.cartService.removeFromCart(
        data.userId || 'anonymous',
        data.itemId,
      );
      return {
        success: true,
        message: 'Article supprimé du panier avec succès',
      };
    } catch (error) {
      console.error('Erreur dans removeCartItemForRemix:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Récupérer une commande par ID pour Remix
   */
  async getOrderByIdForRemix(orderId: string) {
    try {
      const order =
        await this.ordersCompleteService.getCompleteOrderById(orderId);

      if (!order) {
        return {
          success: false,
          error: 'Commande non trouvée',
          order: null,
        };
      }

      return {
        success: true,
        order,
      };
    } catch (error) {
      console.error('Erreur dans getOrderByIdForRemix:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        order: null,
      };
    }
  }

  /**
   * Créer une nouvelle commande pour Remix
   */
  async createOrderForRemix(orderData: any) {
    try {
      const newOrder = await this.ordersService.createOrder(orderData);

      if (!newOrder) {
        return {
          success: false,
          error: 'Erreur lors de la création de la commande',
          order: null,
        };
      }

      return {
        success: true,
        order: newOrder,
      };
    } catch (error) {
      console.error('Erreur dans createOrderForRemix:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        order: null,
      };
    }
  }

  /**
   * Récupérer les commandes d'un utilisateur spécifique pour Remix
   */
  async getUserOrdersForRemix(
    userId: string,
    params?: {
      page?: number;
      limit?: number;
      status?: string;
    },
  ) {
    try {
      const { page = 1, limit = 10, status } = params || {};

      // Utiliser getOrdersForRemix avec le customerId
      const result = await this.getOrdersForRemix({
        page,
        limit,
        status,
        search: userId, // search est utilisé comme customerId
      });

      return result;
    } catch (error) {
      console.error('Erreur dans getUserOrdersForRemix:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        orders: [],
        total: 0,
        page: 1,
        totalPages: 0,
      };
    }
  }

  /**
   * Demande de réinitialisation de mot de passe pour Remix
   */
  async forgotPasswordForRemix(email: string) {
    try {
      const resetToken =
        await this.authService.generatePasswordResetToken(email);

      if (!resetToken) {
        return {
          success: false,
          error: 'Impossible de générer le token de réinitialisation',
        };
      }

      return {
        success: true,
        message: 'Email de réinitialisation envoyé',
        resetToken, // Pour les tests/dev - à supprimer en production
      };
    } catch (error) {
      console.error('Erreur dans forgotPasswordForRemix:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Réinitialisation de mot de passe avec token pour Remix
   */
  async resetPasswordForRemix(token: string, newPassword: string) {
    try {
      const result = await this.authService.resetPasswordWithToken(
        token,
        newPassword,
      );

      return {
        success: result.success,
        error: result.error,
        message: result.success
          ? 'Mot de passe réinitialisé avec succès'
          : undefined,
      };
    } catch (error) {
      console.error('Erreur dans resetPasswordForRemix:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Vider le panier pour Remix
   */
  async clearCartForRemix(userId?: string) {
    try {
      await this.cartService.clearCart(userId || 'anonymous');
      return {
        success: true,
        message: 'Panier vidé avec succès',
      };
    } catch (error) {
      console.error('Erreur dans clearCartForRemix:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}
