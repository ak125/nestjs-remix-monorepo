import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';
import { ConfigService } from '@nestjs/config';

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
export class LegacyOrderService extends SupabaseBaseService {
  constructor(configService: ConfigService) {
    super(configService);
    this.logger.log('LegacyOrderService initialized');
  }

  /**
   * Récupère toutes les commandes avec pagination et filtres
   */
  async getAllOrders(options: {
    limit?: number;
    offset?: number;
    status?: string;
    userId?: string;
  } = {}): Promise<LegacyOrder[]> {
    try {
      const { limit = 20, offset = 0, status, userId } = options;

      let query = this.supabase
        .from('___xtr_order')
        .select(
          'ord_id, ord_cst_id, ord_date, ord_total_ttc, ord_is_pay, ord_info',
        )
        .order('ord_date', { ascending: false });

      // Filtrer par utilisateur si spécifié
      if (userId) {
        query = query.eq('ord_cst_id', userId);
      }

      // Filtrer par statut si spécifié
      if (status === 'paid') {
        query = query.eq('ord_is_pay', '1');
      } else if (status === 'pending') {
        query = query.eq('ord_is_pay', '0');
      }

      // Pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((order) => this.mapToSimpleOrder(order));
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
  async getOrderWithCustomer(orderId: string): Promise<any> {
    try {
      const order = await this.getOrderById(orderId);

      // Récupérer les informations du client
      const { data: customer } = await this.supabase
        .from('___xtr_customer')
        .select('cst_id, cst_mail, cst_name, cst_fname, cst_city')
        .eq('cst_id', order.customerId)
        .single();

      return {
        ...order,
        customer: customer
          ? {
              id: customer.cst_id,
              email: customer.cst_mail,
              name: `${customer.cst_fname} ${customer.cst_name}`,
              city: customer.cst_city,
            }
          : null,
      };
    } catch (error) {
      this.logger.error(`Failed to get order with customer ${orderId}:`, error);
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
   * Compte le nombre total de commandes
   */
  async getTotalOrdersCount(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('___xtr_order')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      return count || 0;
    } catch (error) {
      this.logger.error('Failed to count total orders:', error);
      throw error;
    }
  }
}
