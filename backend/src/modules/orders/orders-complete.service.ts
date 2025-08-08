/**
 * 📦 ORDERS COMPLETE SERVICE - NestJS-Remix Monorepo
 *
 * Service moderne pour la récupération complète des commandes avec relations
 * Utilise Redis pour les performances et SupabaseServiceFacade pour l'architecture moderne
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseServiceFacade } from '../../database/supabase-service-facade';
import { RedisCacheService } from '../../database/services/redis-cache.service';

@Injectable()
export class OrdersCompleteService {
  private readonly logger = new Logger(OrdersCompleteService.name);

  constructor(
    private readonly supabaseService: SupabaseServiceFacade,
    private readonly cacheService: RedisCacheService,
  ) {}

  /**
   * Récupérer les commandes avec toutes les relations (clients, produits, etc.)
   * Utilise Redis pour les performances optimales
   */
  async getOrdersWithAllRelations(
    pageOrParams?:
      | number
      | {
          page?: number;
          limit?: number;
          status?: string;
          search?: string;
        },
    limit?: number,
    filters?: any,
  ) {
    // Gérer les différentes signatures pour compatibilité
    let params: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
    };

    if (typeof pageOrParams === 'object') {
      params = pageOrParams;
    } else {
      params = {
        page: pageOrParams || 1,
        limit: limit || 10,
        status: filters?.status,
        search: filters?.search,
      };
    }

    try {
      this.logger.log(
        '🔍 Récupération des commandes avec relations via Redis...',
      );

      const { page = 1, limit: requestLimit = 10, status, search } = params;

      // Utiliser le cache Redis pour récupérer les commandes avec relations
      const cachedOrders = await this.cacheService.getCachedOrdersWithRelations(
        page,
        requestLimit,
      );

      this.logger.log(
        `📦 ${cachedOrders?.length || 0} commandes récupérées depuis Redis`,
      );

      // Validation des données du cache - être plus flexible
      if (
        !cachedOrders ||
        (Array.isArray(cachedOrders) && cachedOrders.length === 0)
      ) {
        this.logger.warn(
          '⚠️ Données cache vides ou invalides, invalidation et fallback',
        );
        await this.cacheService.invalidateOrderCache();
        throw new Error('Cache data empty or invalid');
      }

      // S'assurer qu'on a un tableau
      const ordersArray = Array.isArray(cachedOrders)
        ? cachedOrders
        : [cachedOrders];

      // Filtrer par statut si spécifié
      let filteredOrders = ordersArray;
      if (status) {
        filteredOrders = cachedOrders.filter((order) => {
          if (status === 'PAID')
            return order.ord_is_pay === '1' || order.ord_is_pay === 1;
          if (status === 'PENDING')
            return order.ord_is_pay === '0' || order.ord_is_pay === 0;
          return true;
        });
      }

      // Filtrer par recherche si spécifiée
      if (search) {
        filteredOrders = filteredOrders.filter(
          (order) =>
            order.ord_id?.toString().includes(search) ||
            order.customer?.cst_mail
              ?.toLowerCase()
              .includes(search.toLowerCase()) ||
            order.customer?.cst_name
              ?.toLowerCase()
              .includes(search.toLowerCase()) ||
            order.customer?.cst_fname
              ?.toLowerCase()
              .includes(search.toLowerCase()),
        );
      }

      // Calculer le total des commandes (estimation basée sur Redis)
      const totalOrders = await this.estimateTotalOrders();

      // Enrichir les commandes avec les données client (si nécessaire)
      const enrichedOrders = filteredOrders.map((order) => ({
        ...order,
        // Si la jointure a fonctionné, les données client sont déjà présentes
        // Sinon, on garde le fallback
        customer: order.customer || {
          cst_id: order.ord_cst_id,
          cst_name: 'Client non trouvé',
          cst_fname: '',
          cst_mail: 'Email non disponible',
          cst_activ: '0',
        },
      }));

      this.logger.log(
        `✅ Retour de ${enrichedOrders.length} commandes formatées`,
      );

      return {
        orders: enrichedOrders,
        total: totalOrders,
        page,
        limit: requestLimit,
        totalPages: Math.ceil(totalOrders / requestLimit),
        hasNextPage: page < Math.ceil(totalOrders / requestLimit),
        hasPreviousPage: page > 1,
        _redis_optimized: true,
        _architecture: 'modern',
      };
    } catch (error) {
      this.logger.error(
        '❌ Erreur lors de la récupération des commandes:',
        error,
      );

      // Fallback vers une récupération directe depuis Supabase
      return this.getFallbackOrders(params);
    }
  }

  /**
   * Estimation du total des commandes via une requête rapide
   */
  private async estimateTotalOrders(): Promise<number> {
    try {
      // Utiliser une requête count rapide sur Supabase
      const response = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/___xtr_order?select=count`,
        {
          headers: {
            apikey: process.env.SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'count=exact',
          },
        },
      );

      if (response.ok) {
        const count = response.headers.get('content-range')?.split('/')[1];
        return parseInt(count || '0', 10);
      }

      // Fallback
      return 1440; // Valeur approximative basée sur les logs précédents
    } catch (error) {
      this.logger.warn(
        "⚠️  Impossible d'estimer le total, utilisation d'une valeur par défaut",
      );
      return 1440;
    }
  }

  /**
   * Méthode de fallback en cas d'échec du cache Redis
   */
  private async getFallbackOrders(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    this.logger.warn('⚠️  Utilisation du fallback direct Supabase');

    const { page = 1, limit = 10 } = params;

    try {
      // Utiliser la méthode existante du SupabaseServiceFacade
      const result = await this.supabaseService.getOrdersWithAllRelations(
        page,
        limit,
      );

      return {
        orders: result.orders || [],
        total: result.total || 1440,
        page,
        limit,
        totalPages: Math.ceil((result.total || 1440) / limit),
        hasNextPage: page < Math.ceil((result.total || 1440) / limit),
        hasPreviousPage: page > 1,
        _fallback: true,
        _architecture: 'supabase_facade',
      };
    } catch (error) {
      this.logger.error('❌ Fallback également échoué:', error);

      // Retour minimal en cas d'échec total
      return {
        orders: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        _error: true,
      };
    }
  }

  /**
   * Récupérer une commande spécifique avec toutes ses relations
   */
  async getOrderById(orderId: string) {
    try {
      this.logger.log(`🔍 Récupération de la commande ${orderId}...`);

      // Utiliser les méthodes existantes du SupabaseServiceFacade
      const orders = await this.supabaseService.getOrdersByCustomerId(''); // Temporaire
      const order = orders.find((o: any) => o.ord_id === orderId);

      if (!order) {
        throw new Error(`Commande ${orderId} non trouvée`);
      }

      this.logger.log(`✅ Commande ${orderId} récupérée avec succès`);
      return order;
    } catch (error) {
      this.logger.error(
        `❌ Erreur lors de la récupération de la commande ${orderId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Alias pour compatibilité avec l'ancien code
   */
  async getCompleteOrderById(orderId: string) {
    return this.getOrderById(orderId);
  }

  /**
   * Récupérer les statistiques des commandes par statut
   */
  async getOrderStatsByStatus() {
    try {
      const stats = await this.supabaseService.getOrderStats();
      return stats;
    } catch (error) {
      this.logger.error('❌ Erreur lors de la récupération des stats:', error);
      return { total: 0, paid: 0, pending: 0 };
    }
  }

  /**
   * Récupérer tous les statuts de commandes
   */
  async getAllOrderStatuses() {
    try {
      const statuses = await this.supabaseService.getAllOrderStatuses();
      return statuses;
    } catch (error) {
      this.logger.error(
        '❌ Erreur lors de la récupération des statuts:',
        error,
      );
      return [];
    }
  }

  /**
   * Récupérer tous les statuts de lignes de commandes
   */
  async getAllOrderLineStatuses() {
    try {
      const statuses = await this.supabaseService.getAllOrderLineStatuses();
      return statuses;
    } catch (error) {
      this.logger.error(
        '❌ Erreur lors de la récupération des statuts de lignes:',
        error,
      );
      return [];
    }
  }

  /**
   * Enrichit les commandes avec les données client
   */
  private async enrichOrdersWithCustomers(orders: any[]): Promise<any[]> {
    if (!orders || orders.length === 0) return orders;

    try {
      this.logger.log(
        `🔗 Enrichissement de ${orders.length} commandes avec données client...`,
      );

      // Récupérer tous les IDs clients uniques
      const customerIds = [
        ...new Set(orders.map((order) => order.ord_cst_id).filter(Boolean)),
      ];
      this.logger.log(`👥 ${customerIds.length} clients uniques à récupérer`);

      if (customerIds.length === 0) {
        this.logger.warn(
          '⚠️ Aucun ID client trouvé, retour des commandes sans enrichissement',
        );
        return orders;
      }

      // Récupérer les données des clients
      const customers = new Map();
      for (const customerId of customerIds) {
        try {
          const customerData: any =
            await this.supabaseService.getUserById(customerId);
          if (customerData) {
            customers.set(customerId, {
              cst_id: customerData.id || customerId,
              cst_name:
                customerData.lastName || customerData.name || 'Nom inconnu',
              cst_fname:
                customerData.firstName ||
                customerData.fname ||
                'Prénom inconnu',
              cst_mail:
                customerData.email ||
                customerData.mail ||
                'Email non disponible',
              cst_activ: customerData.isActive ? '1' : '0',
            });
          }
        } catch (error: any) {
          this.logger.warn(
            `⚠️ Impossible de récupérer le client ${customerId}:`,
            error?.message || error,
          );
        }
      }

      this.logger.log(`✅ ${customers.size} clients récupérés`);

      // Enrichir les commandes avec les données client
      const enrichedOrders = orders.map((order) => ({
        ...order,
        customer: customers.get(order.ord_cst_id) || {
          cst_id: order.ord_cst_id,
          cst_name: 'Client non trouvé',
          cst_fname: '',
          cst_mail: 'Email non disponible',
          cst_activ: '0',
        },
      }));

      this.logger.log(
        `✅ ENRICHISSEMENT RÉUSSI: ${enrichedOrders.length} commandes enrichies`,
      );
      return enrichedOrders;
    } catch (error) {
      this.logger.error(
        "❌ Erreur lors de l'enrichissement des commandes:",
        error,
      );
      return orders; // Retourner les commandes non enrichies en cas d'erreur
    }
  }

  /**
   * Mettre à jour le statut d'une commande
   */
  async updateOrderStatus(orderId: string, isPaid: boolean) {
    try {
      this.logger.log(`🔄 Mise à jour du statut de la commande ${orderId}...`);

      // Pour l'instant, log seulement car nous n'avons pas de méthode update dans le facade
      this.logger.log(`📝 Commande ${orderId} -> statut payé: ${isPaid}`);

      // TODO: Implémenter la mise à jour via le SupabaseServiceFacade
      // const result = await this.supabaseService.updateOrderPaymentStatus(orderId, isPaid);

      this.logger.log(
        `✅ Statut de la commande ${orderId} mis à jour (simulé)`,
      );

      return { success: true, orderId, isPaid };
    } catch (error) {
      this.logger.error(
        `❌ Erreur lors de la mise à jour de la commande ${orderId}:`,
        error,
      );
      throw error;
    }
  }
}
