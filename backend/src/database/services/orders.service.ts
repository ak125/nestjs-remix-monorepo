import { TABLES } from '@repo/database-types';
import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@cache/cache.service';
// Services de délégation (optionnels pour compatibilité)
// import { OrderCalculationService } from '../../modules/orders/services/order-calculation.service';
// import { OrderStatusService } from '../../modules/orders/services/order-status.service';
// import { ShippingService } from '../../modules/shipping/shipping.service';

export interface LegacyOrder {
  id: string;
  customerId: string;
  date: string;
  amountHt: number;
  totalHt: number;
  amountTtc: number;
  totalTtc: number;
  depositHt: number;
  depositTtc: number;
  shippingFeeHt: number;
  shippingFeeTtc: number;
  tva: number;
  isPaid: boolean;
  paymentDate?: string;
  status: string;
  info?: string;
  departmentId?: string;
  parentOrderId?: string;
}

@Injectable()
export class OrdersService extends SupabaseBaseService {
  constructor(
    configService?: ConfigService,
    private readonly cacheService?: CacheService,
    // Services de délégation optionnels (pour future intégration)
    // @Optional() private readonly calculationService?: OrderCalculationService,
    // @Optional() private readonly statusService?: OrderStatusService,
    // @Optional() private readonly shippingService?: ShippingService,
  ) {
    super(configService);
    this.logger.log('OrdersService initialized (formerly LegacyOrderService)');
  }

  /**
   * =====================================================
   * NOUVELLES MÉTHODES - CRÉATION ET GESTION COMMANDES
   * =====================================================
   */

  /**
   * Met à jour le statut d'une commande
   */
  async updateOrderStatus(
    orderId: string,
    status: string,
    comment?: string,
  ): Promise<void> {
    try {
      // 1. Vérifier que la commande existe
      const order = await this.getOrderById(orderId);

      // 2. Mettre à jour le statut de la commande
      let updateData: Record<string, string> = {};

      switch (status) {
        case 'paid':
          updateData = {
            ord_is_pay: '1',
            ord_date_pay: new Date().toISOString(),
          };
          break;
        case 'cancelled':
          updateData = {
            ord_is_pay: '0',
            ord_info: (order.info || '') + ' [ANNULÉE]',
          };
          break;
        case 'pending':
          updateData = {
            ord_is_pay: '0',
          };
          break;
        default:
          // Statut personnalisé
          break;
      }

      if (Object.keys(updateData).length > 0) {
        const { error } = await this.supabase
          .from(TABLES.xtr_order)
          .update(updateData)
          .eq('ord_id', orderId);

        if (error) throw error;
      }

      // 3. Créer l'entrée dans l'historique des statuts
      await this.createOrderStatus(orderId, status, comment);

      // 4. Invalider le cache
      await this.cacheService?.del('total_orders_count');

      this.logger.log(`Order ${orderId} status updated to: ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update order ${orderId} status:`, error);
      throw error;
    }
  }

  /**
   * Crée une entrée dans l'historique des statuts
   */
  private async createOrderStatus(
    orderId: string,
    status: string,
    comment?: string,
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from(TABLES.xtr_order_status)
        .insert({
          ords_ord_id: orderId,
          ords_status: status,
          ords_comment: comment || '',
          ords_date: new Date().toISOString(),
          ords_user_id: null, // Pourrait être l'utilisateur connecté
        });

      if (error) {
        this.logger.warn(
          `Failed to create order status entry: ${error.message}`,
        );
        // Ne pas faire échouer toute l'opération pour ça
      }
    } catch (error) {
      this.logger.warn('Failed to create order status entry:', error);
    }
  }

  /**
   * Récupère l'historique des statuts d'une commande
   */
  async getOrderStatusHistory(orderId: string): Promise<
    Array<{
      id: string;
      orderId: string;
      status: string;
      comment: string;
      date: string;
      userId: string | null;
    }>
  > {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_order_status)
        .select('*')
        .eq('ords_ord_id', orderId)
        .order('ords_date', { ascending: true });

      if (error) throw error;

      return (data || []).map((status) => ({
        id: status.ords_id,
        orderId: status.ords_ord_id,
        status: status.ords_status,
        comment: status.ords_comment,
        date: status.ords_date,
        userId: status.ords_user_id,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get order status history for ${orderId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * =====================================================
   * MÉTHODES EXISTANTES PRÉSERVÉES
   * =====================================================
   */
  async getAllOrders(
    options: {
      limit?: number;
      offset?: number;
      status?: string;
      userId?: string;
      includeUnpaid?: boolean;
      excludePending?: boolean;
      search?: string;
      paymentStatus?: string;
      orderStatus?: string;
    } = {},
  ): Promise<Record<string, unknown>[]> {
    try {
      const {
        limit = 20,
        offset = 0,
        status,
        userId,
        includeUnpaid = false,
        excludePending = true,
        search,
        paymentStatus,
        orderStatus,
      } = options;

      // 1. Récupérer les commandes
      let query = this.supabase
        .from(TABLES.xtr_order)
        .select(
          'ord_id, ord_cst_id, ord_date, ord_total_ttc, ord_is_pay, ord_info, ord_ords_id',
        )
        .order('ord_date', { ascending: false });

      // ✅ PAR DÉFAUT : Afficher uniquement les commandes PAYÉES
      // (sauf si includeUnpaid=true ou status spécifié)
      if (!includeUnpaid && !status) {
        query = query.eq('ord_is_pay', '1');
        this.logger.debug('🔒 Filtrage: Commandes PAYÉES uniquement');
      }

      // ✅ NOUVEAU : Exclure les commandes "En attente" (statut 1) par défaut
      if (excludePending) {
        query = query.neq('ord_ords_id', '1');
        this.logger.debug(
          '🔒 Filtrage: Exclusion statut "En attente" (ord_ords_id=1)',
        );
      }

      // Filtrer par utilisateur si spécifié
      if (userId) {
        query = query.eq('ord_cst_id', userId);
      }

      // Filtrer par statut si spécifié explicitement
      if (status === 'paid') {
        query = query.eq('ord_is_pay', '1');
      } else if (status === 'pending') {
        query = query.eq('ord_is_pay', '0');
      }

      // Filtre statut paiement explicite
      if (paymentStatus === '1' || paymentStatus === '0') {
        query = query.eq('ord_is_pay', paymentStatus);
      }

      // Filtre statut commande explicite
      if (orderStatus && orderStatus !== 'all') {
        query = query.eq('ord_ords_id', orderStatus);
      }

      // Recherche textuelle (ord_id)
      if (search && search.trim()) {
        query = query.ilike('ord_id', `%${search.trim()}%`);
      }

      // Pagination
      query = query.range(offset, offset + limit - 1);

      const { data: orders, error } = await query;

      if (error) throw error;
      if (!orders || orders.length === 0) return [];

      // 2. Récupérer tous les IDs clients uniques
      const customerIds = [
        ...new Set(orders.map((order) => order.ord_cst_id).filter(Boolean)),
      ];

      // 3. Charger tous les clients en une seule requête
      const { data: customers } = await this.supabase
        .from(TABLES.xtr_customer)
        .select(
          'cst_id, cst_mail, cst_name, cst_fname, cst_city, cst_tel, cst_gsm, cst_activ',
        )
        .in('cst_id', customerIds);

      // 4. Créer un map des clients pour lookup rapide
      const customerMap = new Map((customers || []).map((c) => [c.cst_id, c]));

      // 4. Récupérer les informations de paiement depuis ic_postback
      const orderIds = orders.map((o) => o.ord_id);
      const { data: postbacks } = await this.supabase
        .from('ic_postback')
        .select('orderid, paymentmethod, transactionid, datepayment, status')
        .in('orderid', orderIds);

      // 5. Créer un map des postbacks pour lookup rapide
      const postbackMap = new Map((postbacks || []).map((p) => [p.orderid, p]));

      // 6. ✅ Retourner le format BDD brut avec le customer + postback attachés
      return orders.map((order: any) => ({
        // Colonnes de la table ___xtr_order (format BDD brut)
        ord_id: order.ord_id,
        ord_cst_id: order.ord_cst_id,
        ord_date: order.ord_date,
        ord_total_ttc: order.ord_total_ttc,
        ord_is_pay: order.ord_is_pay,
        ord_info: order.ord_info,
        ord_ords_id: order.ord_ords_id,
        // Données client enrichies
        customer: customerMap.get(order.ord_cst_id) || null,
        // ✨ NOUVEAU: Informations de paiement réelles depuis ic_postback
        postback: postbackMap.get(order.ord_id) || null,
      }));
    } catch (error) {
      this.logger.error('Failed to get all orders:', error);
      throw error;
    }
  }

  /**
   * Récupère une commande par son ID avec détails complets
   */
  async getOrderById(orderId: string): Promise<LegacyOrder> {
    try {
      const { data: order, error } = await this.supabase
        .from(TABLES.xtr_order)
        .select('*')
        .eq('ord_id', orderId)
        .single();

      if (error || !order) {
        throw new NotFoundException('Commande non trouvée');
      }

      return this.mapToLegacyOrder(order);
    } catch (error) {
      this.logger.error(`Failed to get order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les commandes d'un utilisateur
   */
  async getUserOrders(userId: string): Promise<LegacyOrder[]> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_order)
        .select('ord_id, ord_date, ord_total_ttc, ord_is_pay, ord_info')
        .eq('ord_cst_id', userId)
        .order('ord_date', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map((order) => this.mapToSimpleOrder(order));
    } catch (error) {
      this.logger.error(`Failed to get orders for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Calcule les statistiques des commandes
   */
  async getOrdersStats(userId?: string): Promise<{
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
  }> {
    try {
      let query = this.supabase
        .from(TABLES.xtr_order)
        .select('ord_is_pay, ord_total_ttc, ord_date');

      if (userId) {
        query = query.eq('ord_cst_id', userId);
      }

      const { data: orders, error } = await query;

      if (error) throw error;

      const stats = {
        totalOrders: orders?.length || 0,
        paidOrders: orders?.filter((o) => o.ord_is_pay === '1').length || 0,
        pendingOrders: orders?.filter((o) => o.ord_is_pay === '0').length || 0,
        totalRevenue:
          orders
            ?.filter((o) => o.ord_is_pay === '1')
            .reduce((sum, o) => sum + parseFloat(o.ord_total_ttc || '0'), 0) ||
          0,
        averageOrderValue: 0,
      };

      if (stats.paidOrders > 0) {
        stats.averageOrderValue = stats.totalRevenue / stats.paidOrders;
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to calculate order stats:', error);
      throw error;
    }
  }

  /**
   * Récupère les informations client d'une commande
   */
  /**
   * 🎯 Récupère une commande COMPLÈTE au format BDD BRUT (pour le frontend)
   * Inclut : commande + client + adresses + lignes de commande
   */
  async getOrderWithCustomer(
    orderId: string,
  ): Promise<Record<string, unknown>> {
    try {
      this.logger.debug(
        `📦 Récupération commande complète format BDD: ${orderId}`,
      );

      // 1. Récupérer la commande brute de la BDD
      const { data: orderData, error: orderError } = await this.supabase
        .from(TABLES.xtr_order)
        .select('*')
        .eq('ord_id', orderId)
        .single();

      if (orderError || !orderData) {
        throw new NotFoundException(`Commande non trouvée: ${orderId}`);
      }

      // 2. Récupérer les informations du client au format BDD
      const { data: customer } = await this.supabase
        .from(TABLES.xtr_customer)
        .select(
          'cst_id, cst_mail, cst_name, cst_fname, cst_city, cst_tel, cst_gsm, cst_address, cst_zip_code, cst_country',
        )
        .eq('cst_id', orderData.ord_cst_id)
        .single();

      // 3. Récupérer l'adresse de facturation (liée au client, pas à la commande)
      const { data: billingAddress } = await this.supabase
        .from(TABLES.xtr_customer_billing_address)
        .select('*')
        .eq('cba_cst_id', orderData.ord_cst_id)
        .limit(1)
        .maybeSingle();

      // 4. Récupérer l'adresse de livraison (liée au client, comme la facturation)
      const { data: deliveryAddress } = await this.supabase
        .from(TABLES.xtr_customer_delivery_address)
        .select('*')
        .eq('cda_cst_id', orderData.ord_cst_id)
        .order('cda_id', { ascending: false }) // La plus récente
        .limit(1)
        .maybeSingle();

      // 5. Récupérer les lignes de commande
      const { data: orderLines } = await this.supabase
        .from(TABLES.xtr_order_line)
        .select('*')
        .eq('orl_ord_id', orderId)
        .order('orl_id', { ascending: true });

      // 6. Récupérer le statut de la commande
      const { data: orderStatus } = await this.supabase
        .from(TABLES.xtr_order_status)
        .select('*')
        .eq('ords_id', orderData.ord_ords_id)
        .single();

      // 7. Enrichir les lignes avec leurs statuts (batch query au lieu de N+1)
      let enrichedOrderLines = orderLines || [];
      if (enrichedOrderLines.length > 0) {
        // Collecter tous les IDs de statut en une seule fois
        const lineStatusIds = enrichedOrderLines
          .map((line) => line.orl_orls_id)
          .filter(Boolean);

        // Une seule requête pour tous les statuts
        let statusMap = new Map<string, Record<string, unknown>>();
        if (lineStatusIds.length > 0) {
          const { data: allStatuses } = await this.supabase
            .from(TABLES.xtr_order_line_status)
            .select('*')
            .in('orls_id', lineStatusIds);

          if (allStatuses) {
            statusMap = new Map(allStatuses.map((s) => [s.orls_id, s]));
          }
        }

        // Jointure locale
        enrichedOrderLines = enrichedOrderLines.map((line) => ({
          ...line,
          lineStatus: line.orl_orls_id
            ? statusMap.get(line.orl_orls_id) || null
            : null,
        }));
      }

      // 8. Récupérer les informations de paiement depuis ic_postback
      const { data: postback } = await this.supabase
        .from('ic_postback')
        .select(
          'status, statuscode, transactionid, paymentid, paymentmethod, datepayment, amount',
        )
        .eq('orderid', orderId)
        .maybeSingle();

      this.logger.debug(
        `✅ Commande ${orderId} complète récupérée (${enrichedOrderLines.length} lignes)`,
      );

      // Retourner tout au format BDD brut
      return {
        ...orderData, // Toutes les colonnes ord_*
        customer: customer || null, // Toutes les colonnes cst_*
        billingAddress: billingAddress || null, // Toutes les colonnes cba_*
        deliveryAddress: deliveryAddress || null, // Toutes les colonnes cda_*
        orderLines: enrichedOrderLines, // Toutes les colonnes orl_* + lineStatus
        statusDetails: orderStatus || null, // Toutes les colonnes ords_*
        postback: postback || null, // Informations paiement Paybox
      };
    } catch (error) {
      this.logger.error(`❌ Failed to get complete order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Mapping pour commande simple (liste)
   */
  private mapToSimpleOrder(dbData: any): LegacyOrder {
    return {
      id: dbData.ord_id,
      customerId: dbData.ord_cst_id,
      date: dbData.ord_date,
      amountHt: 0,
      totalHt: 0,
      amountTtc: parseFloat(dbData.ord_total_ttc || '0'),
      totalTtc: parseFloat(dbData.ord_total_ttc || '0'),
      depositHt: 0,
      depositTtc: 0,
      shippingFeeHt: 0,
      shippingFeeTtc: 0,
      tva: 20,
      isPaid: dbData.ord_is_pay === '1',
      status: dbData.ord_is_pay === '1' ? 'paid' : 'pending',
      info: dbData.ord_info,
    };
  }

  /**
   * Mapping pour commande complète (détail)
   */
  private mapToLegacyOrder(dbData: any): LegacyOrder {
    return {
      id: dbData.ord_id,
      customerId: dbData.ord_cst_id,
      date: dbData.ord_date,
      amountHt: parseFloat(dbData.ord_amount_ht || '0'),
      totalHt: parseFloat(dbData.ord_total_ht || '0'),
      amountTtc: parseFloat(dbData.ord_amount_ttc || '0'),
      totalTtc: parseFloat(dbData.ord_total_ttc || '0'),
      depositHt: parseFloat(dbData.ord_deposit_ht || '0'),
      depositTtc: parseFloat(dbData.ord_deposit_ttc || '0'),
      shippingFeeHt: parseFloat(dbData.ord_shipping_fee_ht || '0'),
      shippingFeeTtc: parseFloat(dbData.ord_shipping_fee_ttc || '0'),
      tva: parseFloat(dbData.ord_tva || '20'),
      isPaid: dbData.ord_is_pay === '1',
      paymentDate: dbData.ord_date_pay,
      status: dbData.ord_is_pay === '1' ? 'paid' : 'pending',
      info: dbData.ord_info,
      departmentId: dbData.ord_dept_id,
      parentOrderId: dbData.ord_parent !== '0' ? dbData.ord_parent : null,
    };
  }

  /**
   * Compte le nombre total de commandes (avec filtres optionnels)
   */
  async getTotalOrdersCount(
    options: {
      status?: string;
      userId?: string;
      excludePending?: boolean;
      search?: string;
      paymentStatus?: string;
      orderStatus?: string;
    } = {},
  ): Promise<number> {
    const {
      status,
      userId,
      excludePending = true,
      search,
      paymentStatus,
      orderStatus,
    } = options;

    // Clé de cache dynamique basée sur les filtres
    const cacheKey = `total_orders_count_${status || 'all'}_${userId || 'all'}_${excludePending}_${search || ''}_${paymentStatus || ''}_${orderStatus || ''}`;

    // Essayer d'abord le cache (TTL: 2 minutes)
    const cached = await this.cacheService?.get<number>(cacheKey);
    if (cached !== null && cached !== undefined) {
      this.logger.debug('📊 Using cached total orders count:', cached);
      return cached;
    }

    try {
      this.logger.debug('📊 Fetching total orders count from database', {
        status,
        userId,
        excludePending,
      });

      let query = this.supabase
        .from(TABLES.xtr_order)
        .select('*', { count: 'exact', head: true });

      // Appliquer les mêmes filtres que getAllOrders
      if (status === 'paid') {
        query = query.eq('ord_is_pay', '1');
      } else if (status === 'pending') {
        query = query.eq('ord_is_pay', '0');
      } else if (!status) {
        // Par défaut: commandes payées uniquement
        query = query.eq('ord_is_pay', '1');
      }

      if (excludePending) {
        query = query.neq('ord_ords_id', '1');
      }

      if (userId) {
        query = query.eq('ord_cst_id', userId);
      }

      if (paymentStatus === '1' || paymentStatus === '0') {
        query = query.eq('ord_is_pay', paymentStatus);
      }

      if (orderStatus && orderStatus !== 'all') {
        query = query.eq('ord_ords_id', orderStatus);
      }

      if (search && search.trim()) {
        query = query.ilike('ord_id', `%${search.trim()}%`);
      }

      const { count, error } = await query;

      if (error) throw error;

      const totalCount = count || 0;

      // Cache pour 2 minutes (les stats changent moins souvent)
      await this.cacheService?.set(cacheKey, totalCount, 120);

      return totalCount;
    } catch (error) {
      this.logger.error('Failed to count total orders:', error);
      throw error;
    }
  }

  /**
   * Alias pour compatibilité avec RemixApiService
   * Utilise getAllOrders en interne avec mapping des paramètres
   */
  async listOrders(filters: {
    customerId?: number;
    status?: number;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    data: Record<string, unknown>[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    // Convertir customerId en userId (string)
    const userId = filters.customerId ? String(filters.customerId) : undefined;

    // Mapper le status number vers le format string attendu
    let statusString: string | undefined;
    if (filters.status === 1) statusString = 'pending';
    else if (filters.status === 6) statusString = 'paid';

    const orders = await this.getAllOrders({
      limit,
      offset,
      status: statusString,
      userId,
      includeUnpaid: true,
      excludePending: false,
    });

    const totalCount = await this.getTotalOrdersCount({
      status: statusString,
      userId,
      excludePending: false,
    });

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPreviousPage: page > 1,
      },
    };
  }
}
