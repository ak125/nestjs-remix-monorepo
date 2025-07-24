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
import { AdminSuppliersService } from '../modules/admin/services/admin-suppliers.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class RemixIntegrationService {
  constructor(
    private readonly ordersCompleteService: OrdersCompleteService,
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
    private readonly paymentsService: PaymentService,
    private readonly cartService: CartService,
    private readonly authService: AuthService,
    private readonly suppliersService: AdminSuppliersService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Cache pour les utilisateurs - évite les requêtes N+1
   */
  private userCache = new Map<string, any>();
  private userCacheExpiry = new Map<string, number>();

  /**
   * Récupérer un utilisateur avec cache optimisé
   */
  private async getCachedUser(userId: string) {
    const cacheKey = `user:${userId}`;
    const now = Date.now();

    // Vérifier le cache en mémoire (plus rapide que Redis pour les requêtes répétées)
    if (this.userCache.has(userId)) {
      const expiry = this.userCacheExpiry.get(userId) || 0;
      if (now < expiry) {
        return this.userCache.get(userId);
      } else {
        // Nettoyer le cache expiré
        this.userCache.delete(userId);
        this.userCacheExpiry.delete(userId);
      }
    }

    // Essayer Redis
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      // Sauvegarder en mémoire pour les prochains accès
      this.userCache.set(userId, cached);
      this.userCacheExpiry.set(userId, now + 300000); // 5 minutes en mémoire
      return cached;
    }

    return null;
  }

  /**
   * Sauvegarder un utilisateur dans le cache
   */
  private async setCachedUser(userId: string, userData: any) {
    const cacheKey = `user:${userId}`;
    const now = Date.now();

    // Cache en mémoire
    this.userCache.set(userId, userData);
    this.userCacheExpiry.set(userId, now + 300000); // 5 minutes

    // Cache Redis (plus persistant)
    await this.cacheService.set(cacheKey, userData, 600); // 10 minutes
  }

  /**
   * Récupérer les commandes avec pagination pour Remix (avec cache et limites optimisées)
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
        limit = 20, // Limite par défaut réduite pour de meilleures performances
        status,
        paymentStatus, // eslint-disable-line @typescript-eslint/no-unused-vars
        search, // eslint-disable-line @typescript-eslint/no-unused-vars
      } = params;

      // Limiter la limite maximum pour éviter les surcharges
      const maxLimit = Math.min(limit, 100);

      // Cache key basé sur les paramètres
      const cacheKey = `orders:${page}:${maxLimit}:${status || 'all'}:${search || 'all'}`;

      // Vérifier le cache (TTL: 5 minutes pour les données admin)
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        console.log('📦 Cache hit - Retour des commandes depuis le cache');
        return cached;
      }

      // Utiliser directement le service orders avec limite optimisée
      const result = await this.ordersCompleteService.getOrdersWithAllRelations(
        page,
        maxLimit,
        {
          status,
          ...(search && { customerId: search }),
        },
      );

      // Pré-charger les utilisateurs en batch pour éviter les requêtes N+1
      if (result.orders && result.orders.length > 0) {
        const userIds = [
          ...new Set(
            result.orders.map((order) => order.ord_cst_id).filter(Boolean),
          ),
        ];
        console.log(
          `🔄 Pré-chargement de ${userIds.length} utilisateurs uniques...`,
        );

        // Traiter les utilisateurs par batch pour éviter la surcharge
        for (const userId of userIds) {
          if (!(await this.getCachedUser(userId))) {
            try {
              // TODO: Remplacer par le vrai service utilisateur quand disponible
              const userData = { id: userId, name: `User ${userId}` };
              await this.setCachedUser(userId, userData);
            } catch (error) {
              console.warn(
                `⚠️ Erreur lors du pré-chargement utilisateur ${userId}:`,
                error,
              );
            }
          }
        }
      }

      const response = {
        success: true,
        orders: result.orders || [],
        total: result.total || 0,
        page,
        totalPages: Math.ceil((result.total || 0) / maxLimit),
        limit: maxLimit,
      };

      // Mettre en cache pour 5 minutes
      await this.cacheService.set(cacheKey, response, 300);

      return response;
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

      // TODO: Implement proper user retrieval when UsersService.getAllUsers is available
      // const result = await this.usersService.getAllUsers(page, limit);

      // Temporary fallback - return empty result
      const result = {
        users: [],
        total: 0,
      };

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
   * Récupérer les statistiques pour le dashboard (avec cache et limite optimisée)
   */
  async getDashboardStats() {
    try {
      const cacheKey = 'dashboard_stats';

      // Vérifier le cache (TTL: 2 minutes pour les stats dashboard)
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        console.log(
          '📦 Cache hit - Retour des stats dashboard depuis le cache',
        );
        return cached;
      }

      // Récupérer seulement le total (limite 1 pour optimiser la performance)
      const [ordersResult] = await Promise.all([
        this.ordersCompleteService.getOrdersWithAllRelations(1, 1, {}),
        // TODO: Add back users when UsersService.getAllUsers is available
        // this.usersService.getAllUsers(1, 1),
      ]);

      const response = {
        success: true,
        stats: {
          totalOrders: ordersResult.total || 0,
          totalUsers: 0, // TODO: Implement when UsersService is fixed
          // Ajoutez d'autres statistiques selon vos besoins
        },
      };

      // Mettre en cache pour 2 minutes
      await this.cacheService.set(cacheKey, response, 120);

      return response;
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
   * Récupérer les statistiques des paiements pour Remix (avec cache)
   */
  async getPaymentStatsForRemix() {
    try {
      const cacheKey = 'payment_stats';

      // Vérifier le cache (TTL: 3 minutes pour les stats)
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        console.log(
          '📦 Cache hit - Retour des stats paiements depuis le cache',
        );
        return cached;
      }

      const stats = await this.paymentsService.getPaymentStats();
      const response = {
        success: true,
        stats,
      };

      // Mettre en cache pour 3 minutes
      await this.cacheService.set(cacheKey, response, 180);

      return response;
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
   * Récupérer la liste des paiements avec pagination pour Remix (avec cache et limites optimisées)
   */
  async getPaymentsForRemix(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    try {
      const {
        page = 1,
        limit = 20, // Limite par défaut réduite
        status,
        search,
      } = params;

      // Limiter la limite maximum pour éviter les surcharges
      const maxLimit = Math.min(limit, 50);

      // Cache key basé sur les paramètres
      const cacheKey = `payments:${page}:${maxLimit}:${status || 'all'}:${search || 'all'}`;

      // Vérifier le cache (TTL: 5 minutes pour les données admin)
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        console.log('📦 Cache hit - Retour des paiements depuis le cache');
        return cached;
      }

      // Récupérer les commandes qui servent de base aux paiements avec limite optimisée
      const result = await this.ordersCompleteService.getOrdersWithAllRelations(
        page,
        maxLimit,
        {
          status,
          ...(search && { customerId: search }),
        },
      );

      // Pré-charger les utilisateurs en batch pour éviter les requêtes N+1
      if (result.orders && result.orders.length > 0) {
        const userIds = [
          ...new Set(
            result.orders.map((order) => order.ord_cst_id).filter(Boolean),
          ),
        ];
        console.log(
          `🔄 Pré-chargement utilisateurs pour paiements: ${userIds.length} uniques...`,
        );

        // Traiter les utilisateurs par batch
        for (const userId of userIds) {
          if (!(await this.getCachedUser(userId))) {
            try {
              // TODO: Remplacer par le vrai service utilisateur quand disponible
              const userData = { id: userId, name: `User ${userId}` };
              await this.setCachedUser(userId, userData);
            } catch (error) {
              console.warn(
                `⚠️ Erreur lors du pré-chargement paiements utilisateur ${userId}:`,
                error,
              );
            }
          }
        }
      }

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

      const response = {
        success: true,
        payments,
        total: result.total || 0,
        page,
        totalPages: Math.ceil((result.total || 0) / maxLimit),
        limit: maxLimit,
      };

      // Mettre en cache pour 5 minutes
      await this.cacheService.set(cacheKey, response, 300);

      return response;
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

  /**
   * Récupérer les fournisseurs pour Remix (avec cache)
   */
  async getSuppliersForRemix(params: {
    page?: number;
    limit?: number;
    search?: string;
    country?: string;
    isActive?: boolean;
  }) {
    try {
      const { page = 1, limit = 10, search, country, isActive } = params;

      // Cache key basé sur les paramètres
      const cacheKey = `suppliers:${page}:${limit}:${search || 'all'}:${country || 'all'}:${isActive ?? 'all'}`;

      // Vérifier le cache (TTL: 10 minutes pour les fournisseurs - données moins volatiles)
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        console.log('📦 Cache hit - Retour des fournisseurs depuis le cache');
        return cached;
      }

      const result = await this.suppliersService.getAllSuppliers(
        {
          page,
          limit,
          search,
          country,
          isActive,
          sortBy: 'name',
          sortOrder: 'asc',
        },
        'system', // userId pour les logs admin
      );

      const response = {
        success: true,
        suppliers: result.data || [],
        total: result.total || 0,
        page,
        totalPages: Math.ceil((result.total || 0) / limit),
      };

      // Mettre en cache pour 10 minutes (fournisseurs moins volatiles)
      await this.cacheService.set(cacheKey, response, 600);

      return response;
    } catch (error) {
      console.error('Erreur dans getSuppliersForRemix:', error);
      return {
        success: false,
        suppliers: [],
        total: 0,
        page: 1,
        totalPages: 1,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}
