/**
 * Service d'intégration pour Remix - Accès direct aux services NestJS
 * Evite les appels HTTP internes inutiles
 */

import { Injectable } from '@nestjs/common';
import { OrdersCompleteService } from '../modules/orders/orders-complete.service';
import { UsersService } from '../modules/users/users.service';
import { PaymentService } from '../modules/payments/services/payments-legacy.service';

@Injectable()
export class RemixIntegrationService {
  constructor(
    private readonly ordersService: OrdersCompleteService,
    private readonly usersService: UsersService,
    private readonly paymentsService: PaymentService,
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
      const { page = 1, limit = 10, status, paymentStatus, search } = params;
      
      // Utiliser directement le service orders
      const result = await this.ordersService.getOrdersWithAllRelations(
        page,
        limit,
        {
          status,
          ...(search && { customerId: search })
        }
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
      const { page = 1, limit = 10, search, level } = params;
      
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
        this.ordersService.getOrdersWithAllRelations(1, 1),
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
          currency: 'EUR'
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
      const payment = await this.paymentsService.getPaymentStatus(orderId.toString());
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
      const result = await this.ordersService.getOrdersWithAllRelations(
        page,
        limit,
        {
          status,
          ...(search && { customerId: search })
        }
      );

      // Transformer les commandes en format paiement legacy
      const payments = result.orders?.map(order => ({
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
}
