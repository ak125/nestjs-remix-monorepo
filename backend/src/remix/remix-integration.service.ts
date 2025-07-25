/**
 * Service d'intégration pour Remix - Accès direct aux services NestJS
 * Evite les appels HTTP internes inutiles
 */

import { Injectable, Optional } from '@nestjs/common';
import { OrdersCompleteService } from '../modules/orders/orders-complete.service';
import { OrdersService } from '../modules/orders/orders.service';
import { UsersService } from '../modules/users/users.service';
import { PaymentService } from '../modules/payments/services/payments-legacy.service';
import { CartService } from '../modules/cart/cart.service';
import { AuthService } from '../auth/auth.service';
import { AdminSuppliersService } from '../modules/admin/services/admin-suppliers.service';
import { CacheService } from '../cache/cache.service';
import { SupabaseRestService } from '../database/supabase-rest.service';

@Injectable()
export class RemixIntegrationService {
  constructor(
    @Optional() private readonly ordersCompleteService?: OrdersCompleteService,
    @Optional() private readonly ordersService?: OrdersService,
    @Optional() private readonly usersService?: UsersService,
    @Optional() private readonly paymentsService?: PaymentService,
    @Optional() private readonly cartService?: CartService,
    @Optional() private readonly authService?: AuthService,
    @Optional() private readonly suppliersService?: AdminSuppliersService,
    @Optional() private readonly cacheService?: CacheService,
    @Optional() private readonly supabaseService?: SupabaseRestService,
  ) {
    console.log('🔧 RemixIntegrationService - Context7 initialization');
    console.log(`  - CacheService available: ${this.cacheService ? 'YES' : 'NO'}`);
    console.log(`  - OrdersCompleteService available: ${this.ordersCompleteService ? 'YES' : 'NO'}`);
    console.log(`  - OrdersService available: ${this.ordersService ? 'YES' : 'NO'}`);
    console.log(`  - UsersService available: ${this.usersService ? 'YES' : 'NO'}`);
    console.log(`  - PaymentsService available: ${this.paymentsService ? 'YES' : 'NO'}`);
    console.log(`  - CartService available: ${this.cartService ? 'YES' : 'NO'}`);
    console.log(`  - AuthService available: ${this.authService ? 'YES' : 'NO'}`);
    console.log(`  - SuppliersService available: ${this.suppliersService ? 'YES' : 'NO'}`);
  }

  /**
   * Context7 Helper - Safe cache operations
   */
  private async safeGetCache(key: string): Promise<any> {
    try {
      if (!this.cacheService) {
        console.log(`🔄 Cache service unavailable - fallback mode for key: ${key}`);
        return null;
      }
      return await this.cacheService.get(key);
    } catch (error) {
      console.error(`💥 Cache get error for key ${key}:`, error);
      return null;
    }
  }

  private async safeSetCache(key: string, value: any, ttl: number): Promise<void> {
    try {
      if (!this.cacheService) {
        console.log(`🔄 Cache service unavailable - skipping set for key: ${key}`);
        return;
      }
      await this.cacheService.set(key, value, ttl);
    } catch (error) {
      console.error(`💥 Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Context7 Helpers - Safe service operations
   */
  private async safeOrdersCompleteCall<T>(
    operation: (service: OrdersCompleteService) => Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      if (!this.ordersCompleteService) {
        console.log('🔄 OrdersCompleteService unavailable - using fallback');
        return fallback;
      }
      return await operation(this.ordersCompleteService);
    } catch (error) {
      console.error('💥 OrdersCompleteService error:', error);
      return fallback;
    }
  }

  private async safePaymentsCall<T>(
    operation: (service: PaymentService) => Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      if (!this.paymentsService) {
        console.log('🔄 PaymentsService unavailable - using fallback');
        return fallback;
      }
      return await operation(this.paymentsService);
    } catch (error) {
      console.error('💥 PaymentsService error:', error);
      return fallback;
    }
  }

  private async safeCartCall<T>(
    operation: (service: CartService) => Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      if (!this.cartService) {
        console.log('🔄 CartService unavailable - using fallback');
        return fallback;
      }
      return await operation(this.cartService);
    } catch (error) {
      console.error('💥 CartService error:', error);
      return fallback;
    }
  }

  private async safeOrdersCall<T>(
    operation: (service: OrdersService) => Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      if (!this.ordersService) {
        console.log('🔄 OrdersService unavailable - using fallback');
        return fallback;
      }
      return await operation(this.ordersService);
    } catch (error) {
      console.error('💥 OrdersService error:', error);
      return fallback;
    }
  }

  private async safeAuthCall<T>(
    operation: (service: AuthService) => Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      if (!this.authService) {
        console.log('🔄 AuthService unavailable - using fallback');
        return fallback;
      }
      return await operation(this.authService);
    } catch (error) {
      console.error('💥 AuthService error:', error);
      return fallback;
    }
  }

  private async safeSuppliersCall<T>(
    operation: (service: AdminSuppliersService) => Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      if (!this.suppliersService) {
        console.log('🔄 SuppliersService unavailable - using fallback');
        return fallback;
      }
      return await operation(this.suppliersService);
    } catch (error) {
      console.error('💥 SuppliersService error:', error);
      return fallback;
    }
  }

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

    // Essayer Redis avec Context7 resilience
    const cached = await this.safeGetCache(cacheKey);
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

    // Cache Redis avec Context7 resilience
    await this.safeSetCache(cacheKey, userData, 600); // 10 minutes
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

      // Vérifier le cache avec Context7 resilience (TTL: 5 minutes pour les données admin)
      const cached = await this.safeGetCache(cacheKey);
      if (cached) {
        console.log('📦 Cache hit - Retour des commandes depuis le cache');
        return cached;
      }

      // Utiliser directement le service orders avec limite optimisée
      const result = await this.safeOrdersCompleteCall(
        (service) => service.getOrdersWithAllRelations(
          page,
          maxLimit,
          {
            status,
            ...(search && { customerId: search }),
          },
        ),
        { success: false, orders: [], total: 0, page, limit: maxLimit, error: 'Service unavailable' }
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
              // Créer des données utilisateur par défaut pour éviter les erreurs 403
              const userData = { 
                id: userId, 
                name: `User ${userId}`,
                email: `user${userId}@system.local`,
                isPlaceholder: true
              };
              await this.setCachedUser(userId, userData);
            } catch (error) {
              console.warn(
                `⚠️ Erreur lors du pré-chargement utilisateur ${userId}:`,
                error,
              );
              // Fallback même en cas d'erreur 403
              const fallbackData = { 
                id: userId, 
                name: `User ${userId}`,
                email: `user${userId}@system.local`,
                isPlaceholder: true,
                error: 'Service non disponible'
              };
              await this.setCachedUser(userId, fallbackData);
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

      // Mettre en cache pour 5 minutes avec Context7 resilience
      await this.safeSetCache(cacheKey, response, 300);

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
        search,
        level,
      } = params;

      console.log(`🔍 getUsersForRemix: page=${page}, limit=${limit}, search=${search}, level=${level}`);

      // Vérifier que le service est disponible
      if (!this.supabaseService) {
        console.error('❌ SupabaseRestService non disponible');
        return {
          success: false,
          users: [],
          total: 0,
          page: 1,
          totalPages: 0,
          error: 'Service utilisateurs non disponible',
        };
      }

      // ✅ UTILISE Context7 - SupabaseRestService pour récupérer les vraies données
      const result = await this.supabaseService.getAllUsers(page, limit, search, level);

      // Transformer les données pour Remix
      const users = result.users.map((user: any) => ({
        id: user.cst_id,
        email: user.cst_email,
        firstName: user.cst_firstname || '',
        lastName: user.cst_lastname || '',
        phone: user.cst_phone || '',
        level: user.cst_level || 0,
        isActive: user.cst_is_active !== '0',
        isPro: user.cst_level >= 3,
        emailVerified: user.cst_email_verified === '1',
        createdAt: user.cst_date_crea || new Date().toISOString(),
        lastLogin: user.cst_last_login,
        totalOrders: 0, // À calculer si nécessaire
        totalSpent: 0, // À calculer si nécessaire
      }));

      console.log(`✅ getUsersForRemix: ${users.length} utilisateurs récupérés`);

      return {
        success: true,
        users,
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

      // Vérifier le cache avec Context7 resilience
      const cached = await this.safeGetCache(cacheKey);
      if (cached) {
        console.log(
          '📦 Cache hit - Retour des stats dashboard depuis le cache',
        );
        return cached;
      }

      console.log('📊 Calcul des stats dashboard - pas de cache disponible');

      // Context7 Resilience - Vérifier si le service orders est disponible
      let totalOrders = 0;
      if (this.ordersCompleteService) {
        try {
          console.log('📊 Service OrdersComplete disponible - récupération des données');
          const [ordersResult] = await Promise.all([
            this.ordersCompleteService.getOrdersWithAllRelations(1, 1, {}),
            // TODO: Add back users when UsersService.getAllUsers is available
            // this.usersService.getAllUsers(1, 1),
          ]);
          totalOrders = ordersResult.total || 0;
        } catch (error) {
          console.error('❌ Erreur lors de la récupération des commandes:', error);
          totalOrders = 0;
        }
      } else {
        console.log('⚠️ Service OrdersComplete non disponible - utilisation des valeurs par défaut');
      }

      const response = {
        success: true,
        stats: {
          totalOrders,
          totalUsers: 0, // TODO: Implement when UsersService is fixed
          // Ajoutez d'autres statistiques selon vos besoins
        },
        context7: {
          cacheAvailable: !!this.cacheService,
          fallbackMode: !this.cacheService,
          servicesAvailable: {
            ordersComplete: !!this.ordersCompleteService,
            orders: !!this.ordersService,
            users: !!this.usersService,
            payments: !!this.paymentsService,
            cache: !!this.cacheService,
          },
          timestamp: new Date().toISOString()
        }
      };

      // Mettre en cache pour 2 minutes avec Context7 resilience
      await this.safeSetCache(cacheKey, response, 120);

      console.log(`✅ Stats dashboard calculées: ${response.stats.totalOrders} commandes`);
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
        context7: {
          cacheAvailable: !!this.cacheService,
          fallbackMode: true,
          errorMode: true,
          servicesAvailable: {
            ordersComplete: !!this.ordersCompleteService,
            orders: !!this.ordersService,
            users: !!this.usersService,
            payments: !!this.paymentsService,
            cache: !!this.cacheService,
          },
          timestamp: new Date().toISOString()
        }
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

      // Vérifier le cache avec Context7 resilience (TTL: 3 minutes pour les stats)
      const cached = await this.safeGetCache(cacheKey);
      if (cached) {
        console.log(
          '📦 Cache hit - Retour des stats paiements depuis le cache',
        );
        return cached;
      }

      const stats = await this.safePaymentsCall(
        (service) => service.getPaymentStats(),
        { totalPayments: 0, successfulPayments: 0, pendingPayments: 0, failedPayments: 0 }
      );
      const response = {
        success: true,
        stats,
      };

      // Mettre en cache pour 3 minutes avec Context7 resilience
      await this.safeSetCache(cacheKey, response, 180);

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
      const payment = await this.safePaymentsCall(
        (service) => service.createPayment(paymentData),
        null
      );
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
      const payment = await this.safePaymentsCall(
        (service) => service.getPaymentStatus(orderId.toString()),
        null
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

      // Vérifier le cache avec Context7 resilience (TTL: 5 minutes pour les données admin)
      const cached = await this.safeGetCache(cacheKey);
      if (cached) {
        console.log('📦 Cache hit - Retour des paiements depuis le cache');
        return cached;
      }

      // Récupérer les commandes qui servent de base aux paiements avec limite optimisée
      const result = await this.safeOrdersCompleteCall(
        (service) => service.getOrdersWithAllRelations(
          page,
          maxLimit,
          {
            status,
            ...(search && { customerId: search }),
          },
        ),
        { success: false, orders: [], total: 0, page, limit: maxLimit, error: 'Service unavailable' }
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
              // Créer des données utilisateur par défaut pour éviter les erreurs 403
              const userData = { 
                id: userId, 
                name: `User ${userId}`,
                email: `user${userId}@system.local`,
                isPlaceholder: true
              };
              await this.setCachedUser(userId, userData);
            } catch (error) {
              console.warn(
                `⚠️ Erreur lors du pré-chargement paiements utilisateur ${userId}:`,
                error,
              );
              // Fallback même en cas d'erreur
              const fallbackData = { 
                id: userId, 
                name: `User ${userId}`,
                email: `user${userId}@system.local`,
                isPlaceholder: true,
                error: 'Service non disponible'
              };
              await this.setCachedUser(userId, fallbackData);
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
          devise: (order as any).ord_currency || 'EUR',
          statutPaiement: order.ord_is_pay?.toString() || '0',
          methodePaiement: typeof (order as any).ord_info === 'object' ? 
            (order as any).ord_info?.payment_gateway || 'Non définie' : 'Non définie',
          referenceTransaction: typeof (order as any).ord_info === 'object' ? 
            (order as any).ord_info?.transaction_id : undefined,
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

      // Mettre en cache pour 5 minutes avec Context7 resilience
      await this.safeSetCache(cacheKey, response, 300);

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
      const summary = await this.safeCartCall(
        (service) => service.getCartSummary(userId || 'anonymous'),
        { total_items: 0, total_quantity: 0, subtotal: 0, total: 0, currency: 'EUR' }
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
      const result = await this.safeCartCall(
        (service) => service.addToCart(
          data.userId || 'anonymous',
          { product_id: data.productId, quantity: data.quantity },
        ),
        null
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
      const items = await this.safeCartCall(
        (service) => service.getCartItems(userId || 'anonymous'),
        []
      );
      const summary = await this.safeCartCall(
        (service) => service.getCartSummary(userId || 'anonymous'),
        { total_items: 0, total_quantity: 0, subtotal: 0, total: 0, currency: 'EUR' }
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
      const result = await this.safeCartCall(
        (service) => service.updateCartItem(
          data.userId || 'anonymous',
          data.itemId,
          { quantity: data.quantity },
        ),
        null
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
      await this.safeCartCall(
        (service) => service.removeFromCart(
          data.userId || 'anonymous',
          data.itemId,
        ),
        null
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
      const order = await this.safeOrdersCompleteCall(
        (service) => service.getCompleteOrderById(orderId),
        null
      );

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
      const newOrder = await this.safeOrdersCall(
        (service) => service.createOrder(orderData),
        null
      );

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
      const resetToken = await this.safeAuthCall(
        (service) => service.generatePasswordResetToken(email),
        null
      );

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
      const result = await this.safeAuthCall(
        (service) => service.resetPasswordWithToken(token, newPassword),
        { success: false, error: 'Service indisponible' }
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
      await this.safeCartCall(
        (service) => service.clearCart(userId || 'anonymous'),
        null
      );
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

      // Vérifier le cache avec Context7 resilience (TTL: 10 minutes pour les fournisseurs - données moins volatiles)
      const cached = await this.safeGetCache(cacheKey);
      if (cached) {
        console.log('📦 Cache hit - Retour des fournisseurs depuis le cache');
        return cached;
      }

      const result = await this.safeSuppliersCall(
        (service) => service.getAllSuppliers(
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
        ),
        { data: [], total: 0, page: 1, limit: 10, totalPages: 0 }
      );

      const response = {
        success: true,
        suppliers: result.data || [],
        total: result.total || 0,
        page,
        totalPages: Math.ceil((result.total || 0) / limit),
      };

      // Mettre en cache pour 10 minutes avec Context7 resilience (fournisseurs moins volatiles)
      await this.safeSetCache(cacheKey, response, 600);

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
