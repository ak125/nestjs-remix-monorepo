import { Injectable, Logger } from '@nestjs/common';
import { OrderDataService } from '../../../database/services/order-data.service';
import { UserDataService } from '../../../database/services/user-data.service';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface OrderRepositoryInterface {
  findById(id: string): Promise<any>;
  findByCustomerId(customerId: string): Promise<any[]>;
  create(orderData: any): Promise<any>;
  update(id: string, updateData: any): Promise<any>;
  delete(id: string): Promise<void>;
  findWithPagination(page: number, limit: number, filters?: any): Promise<any>;
}

@Injectable()
export class OrderRepository
  extends SupabaseBaseService
  implements OrderRepositoryInterface
{
  protected readonly logger = new Logger(OrderRepository.name);

  constructor(
    private readonly orderDataService: OrderDataService,
    private readonly userDataService: UserDataService,
  ) {
    super();
  }

  /**
   * Trouve une commande par son ID
   */
  async findById(id: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .select(
          `
          *,
          ___xtr_customer(*),
          ___xtr_order_status(*),
          ___xtr_order_line(*)
        `,
        )
        .eq('order_id', id)
        .single();

      if (error) {
        this.logger.error(`Error finding order by ID ${id}:`, error);
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error(`Failed to find order by ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Trouve toutes les commandes d'un client
   */
  async findByCustomerId(customerId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .select(
          `
          *,
          ___xtr_order_status(*),
          ___xtr_order_line(*)
        `,
        )
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error(
          `Error finding orders for customer ${customerId}:`,
          error,
        );
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error(
        `Failed to find orders for customer ${customerId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Crée une nouvelle commande
   */
  async create(orderData: any): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .insert({
          ...orderData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Error creating order:', error);
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to create order:', error);
      throw error;
    }
  }

  /**
   * Met à jour une commande
   */
  async update(id: string, updateData: any): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', id)
        .select()
        .single();

      if (error) {
        this.logger.error(`Error updating order ${id}:`, error);
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error(`Failed to update order ${id}:`, error);
      throw error;
    }
  }

  /**
   * Supprime une commande
   */
  async delete(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('___xtr_order')
        .delete()
        .eq('order_id', id);

      if (error) {
        this.logger.error(`Error deleting order ${id}:`, error);
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to delete order ${id}:`, error);
      throw error;
    }
  }

  /**
   * Trouve des commandes avec pagination
   */
  async findWithPagination(
    page: number,
    limit: number,
    filters?: any,
  ): Promise<any> {
    try {
      const offset = (page - 1) * limit;

      let query = this.supabase.from('___xtr_order').select(
        `
          *,
          ___xtr_customer(*),
          ___xtr_order_status(*)
        `,
        { count: 'exact' },
      );

      // Appliquer les filtres si fournis
      if (filters) {
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.customerId) {
          query = query.eq('customer_id', filters.customerId);
        }
        if (filters.dateFrom) {
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('created_at', filters.dateTo);
        }
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        this.logger.error('Error finding orders with pagination:', error);
        throw error;
      }

      return {
        data: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      };
    } catch (error) {
      this.logger.error('Failed to find orders with pagination:', error);
      throw error;
    }
  }

  /**
   * Obtient les statistiques des commandes pour un client
   */
  async getOrderStatistics(customerId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .select('order_id, status, total')
        .eq('customer_id', customerId);

      if (error) {
        this.logger.error(
          `Error getting order statistics for customer ${customerId}:`,
          error,
        );
        throw error;
      }

      return {
        total_orders: data?.length || 0,
        total_amount:
          data?.reduce(
            (sum: number, order: any) => sum + (order.total || 0),
            0,
          ) || 0,
        pending_orders:
          data?.filter((order: any) => order.status === 1).length || 0,
        completed_orders:
          data?.filter((order: any) => order.status === 3).length || 0,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get order statistics for customer ${customerId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Recherche des commandes par terme
   */
  async searchOrders(searchTerm: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .select(
          `
          *,
          ___xtr_customer(*),
          ___xtr_order_status(*)
        `,
        )
        .or(
          `order_number.ilike.%${searchTerm}%,___xtr_customer.email.ilike.%${searchTerm}%,___xtr_customer.firstname.ilike.%${searchTerm}%,___xtr_customer.lastname.ilike.%${searchTerm}%`,
        )
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error(
          `Error searching orders for term "${searchTerm}":`,
          error,
        );
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error(
        `Failed to search orders for term "${searchTerm}":`,
        error,
      );
      throw error;
    }
  }
}
