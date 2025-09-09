import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';
import { ConfigService } from '@nestjs/config';
import {
  Order,
  OrderLine,
  OrderDbEntity,
  OrderLineDbEntity,
  OrderMapper,
  OrderStatus,
  OrderWithDetails,
} from '../../types/order.types';

@Injectable()
export class OrderDataService extends SupabaseBaseService {
  constructor(configService: ConfigService) {
    super(configService);
    this.logger.log('OrderDataService initialized');
  }

  /**
   * Récupère toutes les commandes d'un utilisateur
   */
  async getUserOrders(userId: string): Promise<Order[]> {
    try {
      const { data, error } = await this.client
        .from('___xtr_order')
        .select('*')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((dbOrder) => OrderMapper.fromDb(dbOrder));
    } catch (error) {
      this.logger.error(`Failed to get orders for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère une commande par son ID
   */
  async getOrderById(orderId: number): Promise<Order> {
    try {
      const { data, error } = await this.client
        .from('___xtr_order')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (error || !data) {
        throw new NotFoundException(`Commande ${orderId} non trouvée`);
      }

      return OrderMapper.fromDb(data);
    } catch (error) {
      this.logger.error(`Failed to get order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Crée une nouvelle commande
   */
  async createOrder(orderData: Partial<Order>): Promise<Order> {
    try {
      const dbData = OrderMapper.toDb({
        ...orderData,
        createdAt: new Date(),
      });

      const { data, error } = await this.client
        .from('___xtr_order')
        .insert(dbData)
        .select()
        .single();

      if (error) throw error;
      return OrderMapper.fromDb(data);
    } catch (error) {
      this.logger.error('Failed to create order:', error);
      throw error;
    }
  }

  /**
   * Met à jour le statut d'une commande
   */
  async updateOrderStatus(
    orderId: number,
    status: OrderStatus,
  ): Promise<Order> {
    try {
      const { data, error } = await this.client
        .from('___xtr_order')
        .update({
          status,
          updated_at: new Date(),
        })
        .eq('order_id', orderId)
        .select()
        .single();

      if (error) throw error;
      return OrderMapper.fromDb(data);
    } catch (error) {
      this.logger.error(`Failed to update order ${orderId} status:`, error);
      throw error;
    }
  }
}
