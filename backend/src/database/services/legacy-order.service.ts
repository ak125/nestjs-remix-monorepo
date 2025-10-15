import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../common/cache.service';

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

export interface CreateLegacyOrderData {
  customerId: string;
  orderLines: Array<{
    productId: string;
    productName: string;
    productReference: string;
    quantity: number;
    unitPrice: number;
    vatRate?: number;
    discount?: number;
  }>;
  billingAddress?: any;
  shippingAddress?: any;
  customerNote?: string;
  shippingMethod?: string;
  paymentMethod?: string;
}

export interface LegacyOrderLine {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productReference: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discount: number;
  totalHt: number;
  totalTtc: number;
  status?: string;
}

@Injectable()
export class LegacyOrderService extends SupabaseBaseService {
  private cacheService = new CacheService();

  constructor(configService?: ConfigService) {
    super(configService);
    this.logger.log('LegacyOrderService initialized');
  }

  /**
   * =====================================================
   * NOUVELLES MÉTHODES - CRÉATION ET GESTION COMMANDES
   * =====================================================
   */

  /**
   * Génère un nouveau numéro de commande unique
   */
  private async generateOrderNumber(): Promise<string> {
    try {
      const today = new Date();
      const year = today.getFullYear().toString().slice(-2);
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');

      // Préfixe basé sur la date
      const prefix = `ORD${year}${month}${day}`;

      // Chercher le dernier numéro pour aujourd'hui
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .select('ord_id')
        .like('ord_id', `${prefix}%`)
        .order('ord_id', { ascending: false })
        .limit(1);

      if (error) throw error;

      let sequence = 1;
      if (data && data.length > 0) {
        const lastNumber = data[0].ord_id;
        const lastSequence = parseInt(lastNumber.slice(-4), 10);
        sequence = lastSequence + 1;
      }

      const orderNumber = `${prefix}${String(sequence).padStart(4, '0')}`;
      this.logger.debug(`Generated order number: ${orderNumber}`);

      return orderNumber;
    } catch (error) {
      this.logger.error('Failed to generate order number:', error);
      // Fallback: timestamp-based number
      const timestamp = Date.now().toString().slice(-8);
      return `ORD${timestamp}`;
    }
  }

  /**
   * Calcule les totaux d'une commande
   */
  private calculateOrderTotals(
    orderLines: CreateLegacyOrderData['orderLines'],
  ): {
    totalHt: number;
    totalTtc: number;
    totalTva: number;
    shippingFeeHt: number;
    shippingFeeTtc: number;
  } {
    let totalHt = 0;
    let totalTva = 0;

    for (const line of orderLines) {
      const lineTotal = line.quantity * line.unitPrice;
      const lineDiscount = (lineTotal * (line.discount || 0)) / 100;
      const lineHt = lineTotal - lineDiscount;
      const vatRate = line.vatRate || 20;
      const lineTva = (lineHt * vatRate) / 100;

      totalHt += lineHt;
      totalTva += lineTva;
    }

    // Calcul simplifié des frais de port (5€ HT si commande < 50€)
    const shippingFeeHt = totalHt < 50 ? 5 : 0;
    const shippingFeeTtc = shippingFeeHt * 1.2; // 20% TVA

    const totalTtc = totalHt + totalTva + shippingFeeTtc;

    return {
      totalHt: Math.round(totalHt * 100) / 100,
      totalTtc: Math.round(totalTtc * 100) / 100,
      totalTva: Math.round(totalTva * 100) / 100,
      shippingFeeHt: Math.round(shippingFeeHt * 100) / 100,
      shippingFeeTtc: Math.round(shippingFeeTtc * 100) / 100,
    };
  }

  /**
   * Crée une nouvelle commande avec ses lignes
   */
  async createLegacyOrder(
    orderData: CreateLegacyOrderData,
  ): Promise<LegacyOrder> {
    try {
      this.logger.log(
        `Creating legacy order for customer ${orderData.customerId}`,
      );

      // 1. Vérifier que le client existe
      const { data: customer, error: customerError } = await this.supabase
        .from('___xtr_customer')
        .select('cst_id')
        .eq('cst_id', orderData.customerId)
        .single();

      if (customerError || !customer) {
        throw new NotFoundException(
          `Customer ${orderData.customerId} not found`,
        );
      }

      // 2. Générer le numéro de commande
      const orderNumber = await this.generateOrderNumber();

      // 3. Calculer les totaux
      const totals = this.calculateOrderTotals(orderData.orderLines);

      // 4. Préparer les données de la commande
      const orderInsertData = {
        ord_id: orderNumber,
        ord_cst_id: orderData.customerId,
        ord_date: new Date().toISOString(),
        ord_amount_ht: totals.totalHt,
        ord_total_ht: totals.totalHt,
        ord_amount_ttc: totals.totalTtc - totals.shippingFeeTtc,
        ord_total_ttc: totals.totalTtc,
        ord_deposit_ht: 0,
        ord_deposit_ttc: 0,
        ord_shipping_fee_ht: totals.shippingFeeHt,
        ord_shipping_fee_ttc: totals.shippingFeeTtc,
        ord_tva: totals.totalTva,
        ord_is_pay: '0', // Non payée par défaut
        ord_info: orderData.customerNote || '',
        ord_parent: '0', // Pas de commande parent
        ord_dept_id: null,
      };

      // 5. Insérer la commande
      const { error: orderError } = await this.supabase
        .from('___xtr_order')
        .insert(orderInsertData)
        .select()
        .single();

      if (orderError) {
        this.logger.error('Failed to insert order:', orderError);
        throw orderError;
      }

      // 6. Insérer les lignes de commande
      if (orderData.orderLines && orderData.orderLines.length > 0) {
        const orderLinesData = orderData.orderLines.map((line, index) => {
          const lineTotal = line.quantity * line.unitPrice;
          const lineDiscount = (lineTotal * (line.discount || 0)) / 100;
          const lineHt = lineTotal - lineDiscount;
          const vatRate = line.vatRate || 20;
          const lineTva = (lineHt * vatRate) / 100;
          const lineTtc = lineHt + lineTva;

          return {
            ordl_ord_id: orderNumber,
            ordl_prd_id: line.productId,
            ordl_prd_name: line.productName,
            ordl_prd_ref: line.productReference,
            ordl_quantity: line.quantity,
            ordl_unit_price: line.unitPrice,
            ordl_vat_rate: vatRate,
            ordl_discount: line.discount || 0,
            ordl_total_ht: Math.round(lineHt * 100) / 100,
            ordl_total_ttc: Math.round(lineTtc * 100) / 100,
            ordl_line_number: index + 1,
            ordl_status: 'pending',
          };
        });

        const { error: linesError } = await this.supabase
          .from('___xtr_order_line')
          .insert(orderLinesData);

        if (linesError) {
          this.logger.error('Failed to insert order lines:', linesError);
          // Tentative de rollback de la commande
          await this.supabase
            .from('___xtr_order')
            .delete()
            .eq('ord_id', orderNumber);
          throw linesError;
        }
      }

      // 7. Invalider le cache
      this.cacheService.delete('total_orders_count');

      // 8. Créer le statut initial
      await this.createOrderStatus(orderNumber, 'created', 'Commande créée');

      this.logger.log(`Order ${orderNumber} created successfully`);

      // 9. Retourner la commande créée
      return await this.getOrderById(orderNumber);
    } catch (error) {
      this.logger.error('Failed to create legacy order:', error);
      throw error;
    }
  }

  /**
   * Récupère les lignes d'une commande
   */
  async getOrderLines(orderId: string): Promise<LegacyOrderLine[]> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order_line')
        .select('*')
        .eq('ordl_ord_id', orderId)
        .order('ordl_line_number');

      if (error) throw error;

      return (data || []).map((line) => ({
        id: line.ordl_id || `${orderId}-${line.ordl_line_number}`,
        orderId: line.ordl_ord_id,
        productId: line.ordl_prd_id,
        productName: line.ordl_prd_name,
        productReference: line.ordl_prd_ref,
        quantity: line.ordl_quantity,
        unitPrice: parseFloat(line.ordl_unit_price || '0'),
        vatRate: parseFloat(line.ordl_vat_rate || '20'),
        discount: parseFloat(line.ordl_discount || '0'),
        totalHt: parseFloat(line.ordl_total_ht || '0'),
        totalTtc: parseFloat(line.ordl_total_ttc || '0'),
        status: line.ordl_status || 'pending',
      }));
    } catch (error) {
      this.logger.error(`Failed to get order lines for ${orderId}:`, error);
      throw error;
    }
  }

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
      let updateData: any = {};

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
          .from('___xtr_order')
          .update(updateData)
          .eq('ord_id', orderId);

        if (error) throw error;
      }

      // 3. Créer l'entrée dans l'historique des statuts
      await this.createOrderStatus(orderId, status, comment);

      // 4. Invalider le cache
      this.cacheService.delete('total_orders_count');

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
      const { error } = await this.supabase.from('___xtr_order_status').insert({
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
  async getOrderStatusHistory(orderId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order_status')
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
   * Récupère une commande avec ses lignes et son historique
   */
  async getOrderWithDetails(orderId: string): Promise<any> {
    try {
      const [order, lines, statusHistory, customer] = await Promise.all([
        this.getOrderById(orderId),
        this.getOrderLines(orderId),
        this.getOrderStatusHistory(orderId),
        this.getOrderCustomer(orderId),
      ]);

      return {
        ...order,
        lines,
        statusHistory,
        customer,
      };
    } catch (error) {
      this.logger.error(`Failed to get order details for ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les informations du client d'une commande
   */
  private async getOrderCustomer(orderId: string): Promise<any> {
    try {
      const order = await this.getOrderById(orderId);

      const { data: customer } = await this.supabase
        .from('___xtr_customer')
        .select('cst_id, cst_mail, cst_name, cst_fname, cst_city, cst_phone')
        .eq('cst_id', order.customerId)
        .single();

      return customer
        ? {
            id: customer.cst_id,
            email: customer.cst_mail,
            name: `${customer.cst_fname} ${customer.cst_name}`,
            firstName: customer.cst_fname,
            lastName: customer.cst_name,
            city: customer.cst_city,
            phone: customer.cst_phone,
          }
        : null;
    } catch (error) {
      this.logger.error(`Failed to get customer for order ${orderId}:`, error);
      return null;
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
      includeUnpaid?: boolean; // Nouveau paramètre
      excludePending?: boolean; // ✨ Nouveau: exclure statut "En attente" (ord_ords_id = 1)
    } = {},
  ): Promise<any[]> {
    try {
      const {
        limit = 20,
        offset = 0,
        status,
        userId,
        includeUnpaid = false,
        excludePending = true,
      } = options;

      // 1. Récupérer les commandes
      let query = this.supabase
        .from('___xtr_order')
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
        .from('___xtr_customer')
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
        .from('___xtr_order')
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
        .from('___xtr_order')
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
  async getOrdersStats(userId?: string): Promise<any> {
    try {
      let query = this.supabase
        .from('___xtr_order')
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
  async getOrderWithCustomer(orderId: string): Promise<any> {
    try {
      this.logger.debug(
        `📦 Récupération commande complète format BDD: ${orderId}`,
      );

      // 1. Récupérer la commande brute de la BDD
      const { data: orderData, error: orderError } = await this.supabase
        .from('___xtr_order')
        .select('*')
        .eq('ord_id', orderId)
        .single();

      if (orderError || !orderData) {
        throw new NotFoundException(`Commande non trouvée: ${orderId}`);
      }

      // 2. Récupérer les informations du client au format BDD
      const { data: customer } = await this.supabase
        .from('___xtr_customer')
        .select(
          'cst_id, cst_mail, cst_name, cst_fname, cst_city, cst_tel, cst_gsm, cst_address, cst_zip_code, cst_country',
        )
        .eq('cst_id', orderData.ord_cst_id)
        .single();

      // 3. Récupérer l'adresse de facturation (liée au client, pas à la commande)
      const { data: billingAddress } = await this.supabase
        .from('___xtr_customer_billing_address')
        .select('*')
        .eq('cba_cst_id', orderData.ord_cst_id)
        .limit(1)
        .maybeSingle();

      // 4. Récupérer l'adresse de livraison (liée au client, comme la facturation)
      const { data: deliveryAddress } = await this.supabase
        .from('___xtr_customer_delivery_address')
        .select('*')
        .eq('cda_cst_id', orderData.ord_cst_id)
        .order('cda_id', { ascending: false }) // La plus récente
        .limit(1)
        .maybeSingle();

      // 5. Récupérer les lignes de commande
      const { data: orderLines } = await this.supabase
        .from('___xtr_order_line')
        .select('*')
        .eq('orl_ord_id', orderId)
        .order('orl_id', { ascending: true });

      // 6. Récupérer le statut de la commande
      const { data: orderStatus } = await this.supabase
        .from('___xtr_order_status')
        .select('*')
        .eq('ords_id', orderData.ord_ords_id)
        .single();

      // 7. Enrichir les lignes avec leurs statuts
      let enrichedOrderLines = orderLines || [];
      if (enrichedOrderLines.length > 0) {
        enrichedOrderLines = await Promise.all(
          enrichedOrderLines.map(async (line) => {
            if (line.orl_orls_id) {
              const { data: lineStatus } = await this.supabase
                .from('___xtr_order_line_status')
                .select('*')
                .eq('orls_id', line.orl_orls_id)
                .single();
              return { ...line, lineStatus: lineStatus || null };
            }
            return { ...line, lineStatus: null };
          }),
        );
      }

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
    } = {},
  ): Promise<number> {
    const { status, userId, excludePending = true } = options;

    // Clé de cache dynamique basée sur les filtres
    const cacheKey = `total_orders_count_${status || 'all'}_${userId || 'all'}_${excludePending}`;

    // Essayer d'abord le cache (TTL: 2 minutes)
    const cached = this.cacheService.get<number>(cacheKey);
    if (cached !== null) {
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
        .from('___xtr_order')
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

      const { count, error } = await query;

      if (error) throw error;

      const totalCount = count || 0;

      // Cache pour 2 minutes (les stats changent moins souvent)
      this.cacheService.set(cacheKey, totalCount, 2 * 60 * 1000);

      return totalCount;
    } catch (error) {
      this.logger.error('Failed to count total orders:', error);
      throw error;
    }
  }
}
