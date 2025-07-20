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

  /**
   * Récupérer les commandes d'un utilisateur spécifique pour Remix
   */
  async getUserOrdersForRemix(userId: string, params?: {
    page?: number;
    limit?: number;
    status?: string;
    paymentStatus?: string;
  }) {
    console.log('🛒 getUserOrdersForRemix - userId:', userId, 'params:', params);
    
    try {
      // Utiliser le service Orders avec un filtre par customerId
      const result = await this.ordersService.getOrdersWithAllRelations(
        params?.page || 1,
        params?.limit || 50,
        {
          status: params?.status,
          customerId: userId, // Filtrer par ID utilisateur
        }
      );

      console.log(`✅ ${result.orders?.length || 0} commandes utilisateur récupérées`);
      
      // Calculer totalPages à partir du total et limit
      const totalPages = Math.ceil(result.total / (params?.limit || 50));
      
      return {
        success: true,
        orders: result.orders || [],
        total: result.total || 0,
        page: params?.page || 1,
        totalPages: totalPages || 1,
      };
    } catch (error) {
      console.error('❌ Erreur dans getUserOrdersForRemix:', error);
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
   * Récupérer une commande spécifique par ID pour Remix
   */
  async getOrderByIdForRemix(orderId: string) {
    console.log('🔍 getOrderByIdForRemix - orderId:', orderId);
    
    try {
      const order = await this.ordersService.getCompleteOrderById(orderId);

      if (!order) {
        return {
          success: false,
          order: null,
          error: 'Commande non trouvée',
        };
      }

      console.log(`✅ Commande complète récupérée: ${order.ord_id}`);
      return {
        success: true,
        order,
      };
    } catch (error) {
      console.error('❌ Erreur dans getOrderByIdForRemix:', error);
      return {
        success: false,
        order: null,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Créer une nouvelle commande pour Remix
   */
  async createOrderForRemix(orderData: {
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      productName?: string;
    }>;
    deliveryAddress: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    };
    deliveryMethod: string;
    deliveryPrice: number;
    notes?: string;
    promocode?: string;
    discountAmount?: number;
    customerId?: string;
  }) {
    console.log('🛒 createOrderForRemix - orderData:', orderData);
    
    try {
      // Pour l'instant, créons une commande basique
      // TODO: Implémenter la création complète avec SupabaseRestService
      const orderId = `ORD-${Date.now()}`;
      
      const newOrder = {
        id: orderId,
        orderNumber: orderId,
        customerId: orderData.customerId || 'guest',
        status: 'pending',
        paymentStatus: 'pending',
        items: orderData.items,
        deliveryAddress: orderData.deliveryAddress,
        deliveryMethod: orderData.deliveryMethod,
        deliveryPrice: orderData.deliveryPrice,
        notes: orderData.notes,
        promocode: orderData.promocode,
        discountAmount: orderData.discountAmount || 0,
        totalPrice: orderData.items.reduce((sum, item) => 
          sum + (item.quantity * item.unitPrice), 0
        ) + orderData.deliveryPrice - (orderData.discountAmount || 0),
        createdAt: new Date().toISOString(),
      };

      console.log(`✅ Commande créée: ${orderId}`);
      return {
        success: true,
        order: newOrder,
      };
    } catch (error) {
      console.error('❌ Erreur dans createOrderForRemix:', error);
      return {
        success: false,
        order: null,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Réinitialiser le mot de passe pour Remix
   */
  async resetPasswordForRemix(token: string, newPassword: string) {
    console.log('🔐 resetPasswordForRemix - token:', token);
    
    try {
      // TODO: Implémenter la logique de reset password avec SupabaseRestService
      // Pour l'instant, retourner un succès simulé
      console.log('✅ Reset password simulé réussi');
      return {
        success: true,
        message: 'Mot de passe réinitialisé avec succès',
      };
    } catch (error) {
      console.error('❌ Erreur dans resetPasswordForRemix:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la réinitialisation',
      };
    }
  }

  /**
   * Envoyer email de mot de passe oublié pour Remix
   */
  async sendForgotPasswordForRemix(email: string) {
    console.log('📧 sendForgotPasswordForRemix - email:', email);
    
    try {
      // TODO: Implémenter la logique d'envoi d'email avec SupabaseRestService
      // Pour l'instant, retourner un succès simulé
      console.log('✅ Email de récupération simulé envoyé');
      return {
        success: true,
        message: 'Email de récupération envoyé avec succès',
      };
    } catch (error) {
      console.error('❌ Erreur dans sendForgotPasswordForRemix:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de l\'envoi',
      };
    }
  }

  /**
   * Déconnecter l'utilisateur pour Remix
   */
  async logoutUserForRemix(sessionId?: string) {
    console.log('🚪 logoutUserForRemix - sessionId:', sessionId);
    
    try {
      // TODO: Implémenter la logique de déconnexion avec session management
      // Pour l'instant, retourner un succès simulé
      console.log('✅ Déconnexion simulée réussie');
      return {
        success: true,
        message: 'Déconnexion réussie',
      };
    } catch (error) {
      console.error('❌ Erreur dans logoutUserForRemix:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la déconnexion',
      };
    }
  }

  /**
   * Mettre à jour le profil utilisateur pour Remix
   */
  async updateProfileForRemix(userId: string, profileData: any) {
    try {
      console.log('🔍 updateProfileForRemix - données reçues:', { userId, profileData });
      
      const result = await this.usersService.updateUser(userId, profileData);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Erreur dans updateProfileForRemix:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la mise à jour du profil',
      };
    }
  }

  /**
   * Changer le mot de passe pour Remix
   */
  async changePasswordForRemix(userId: string, currentPassword: string, newPassword: string) {
    try {
      console.log('🔍 changePasswordForRemix - userId:', userId);
      
      const changePasswordDto = {
        currentPassword,
        newPassword,
        confirmPassword: newPassword,
      };
      
      const result = await this.usersService.changePassword(userId, changePasswordDto);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Erreur dans changePasswordForRemix:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors du changement de mot de passe',
      };
    }
  }
}
