import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';

// Types simplifiés pour la migration
export interface OrderStatus {
  id: number;
  label: string;
  color: string;
}

export interface OrderLine {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: number;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  status: number;
  total_ttc: number;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class OrderRepository extends SupabaseBaseService {
  constructor() {
    super();
  }

  /**
   * Récupérer une commande par ID
   */
  async findOrderById(orderId: number): Promise<Order | null> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) {
        this.logger.error('Erreur récupération commande:', error);
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error(`Erreur findOrderById (${orderId}):`, error);
      return null;
    }
  }

  /**
   * Récupérer les lignes d'une commande
   */
  async findOrderLines(orderId: number): Promise<OrderLine[]> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order_line')
        .select('*')
        .eq('order_id', orderId);

      if (error) {
        this.logger.error('Erreur récupération lignes:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Erreur findOrderLines (${orderId}):`, error);
      return [];
    }
  }

  /**
   * Mettre à jour le statut d'une commande
   */
  async updateOrderStatus(orderId: number, status: number): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('___xtr_order')
        .update({
          status: status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) {
        this.logger.error('Erreur mise à jour statut:', error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Erreur updateOrderStatus (${orderId}):`, error);
      return false;
    }
  }

  /**
   * Mettre à jour le statut d'une ligne de commande
   */
  async updateOrderLineStatus(lineId: number, status: number): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('___xtr_order_line')
        .update({
          status: status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lineId);

      if (error) {
        this.logger.error('Erreur mise à jour statut ligne:', error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Erreur updateOrderLineStatus (${lineId}):`, error);
      return false;
    }
  }

  /**
   * Récupérer les commandes avec pagination
   */
  async findOrders(filters: {
    limit?: number;
    offset?: number;
    status?: number;
    customerId?: number;
  } = {}): Promise<Order[]> {
    try {
      let query = this.supabase
        .from('___xtr_order')
        .select('*');

      if (filters.status !== undefined) {
        query = query.eq('status', filters.status);
      }

      if (filters.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(
          filters.offset || 0,
          (filters.offset || 0) + (filters.limit || 20) - 1
        );

      const { data, error } = await query;

      if (error) {
        this.logger.error('Erreur récupération commandes:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error('Erreur findOrders:', error);
      return [];
    }
  }

  /**
   * Récupérer l'historique des statuts d'une commande
   */
  async getOrderStatusHistory(orderId: number): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order_status')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('Erreur historique statuts:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Erreur getOrderStatusHistory (${orderId}):`, error);
      return [];
    }
  }

  /**
   * Créer un nouvel historique de statut
   */
  async createStatusHistory(
    orderId: number,
    status: number,
    comment?: string,
    userId?: number
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('___xtr_order_status')
        .insert({
          order_id: orderId,
          status: status,
          comment: comment || '',
          user_id: userId || null,
          created_at: new Date().toISOString(),
        });

      if (error) {
        this.logger.error('Erreur création historique:', error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Erreur createStatusHistory:', error);
      return false;
    }
  }

  /**
   * Récupérer les statistiques des commandes
   */
  async getOrderStats(): Promise<{
    total: number;
    byStatus: Record<number, number>;
  }> {
    try {
      // Compter le total
      const { count: total, error: countError } = await this.supabase
        .from('___xtr_order')
        .select('id', { count: 'exact', head: true });

      if (countError) {
        this.logger.error('Erreur comptage total:', countError);
        return { total: 0, byStatus: {} };
      }

      // Statistiques par statut - version simplifiée
      const { data: orders, error: statsError } = await this.supabase
        .from('___xtr_order')
        .select('status');

      if (statsError) {
        this.logger.error('Erreur stats par statut:', statsError);
        return { total: total || 0, byStatus: {} };
      }

      // Compter manuellement par statut
      const byStatus: Record<number, number> = {};
      orders?.forEach(order => {
        byStatus[order.status] = (byStatus[order.status] || 0) + 1;
      });

      return {
        total: total || 0,
        byStatus,
      };
    } catch (error) {
      this.logger.error('Erreur getOrderStats:', error);
      return { total: 0, byStatus: {} };
    }
  }
}
